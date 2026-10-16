import "server-only";
import { adminClient } from "./supabase";
import { HttpError } from "./access";
import { readWorkspace } from "./workspace-store";
import { publishCapability, publishPost } from "./instagram-publish";
import { sendCampaign, sendingCapability } from "./email-campaigns";
import { WORKFLOWS, dueItems, workflowStatus, type WorkflowId } from "../automation";
import type { Post } from "../types";
import type { EmailCampaign } from "../email-model";

// Server side of the shared automation model (../automation.ts): real facts
// per workflow, the explicit permission switch, and the scheduler that runs
// permitted workflows (POST /api/automation/cron with CRON_SECRET).

const db = () => adminClient();
const notReady = (e: { code?: string } | null) => !!e && ["42P01", "PGRST205", "42703"].includes(e.code || "");

async function permissions(workspaceId: string) {
  const { data, error } = await db().from("automation_permissions").select("workflow,enabled,updated_at").eq("workspace_id", workspaceId);
  if (error && !notReady(error)) throw new HttpError(503, "De automatiseringen konden niet worden geladen.");
  return new Map((data || []).map((r) => [r.workflow as string, !!r.enabled]));
}

async function runs(workspaceId: string) {
  const { data } = await db().from("automation_runs").select("workflow,status,detail,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100);
  return data || [];
}

export async function automationStatus(workspaceId: string) {
  const [ws, perms, history, ig, mail] = await Promise.all([readWorkspace(workspaceId), permissions(workspaceId), runs(workspaceId), publishCapability(workspaceId).catch(() => null), Promise.resolve(sendingCapability())]);
  const posts = (ws.posts || []) as Post[];
  const emails = ((ws.email as { campaigns?: EmailCampaign[] })?.campaigns || []) as EmailCampaign[];
  const ig2 = (ws.instagram || {}) as { mode?: string; enabled?: boolean };
  const em = ((ws.email as { settings?: { mode?: string; enabled?: boolean } })?.settings || {}) as { mode?: string; enabled?: boolean };
  const rv = ((ws.review as { settings?: { enabled?: boolean } })?.settings || {}) as { enabled?: boolean };
  const weekAgo = Date.now() - 7 * 86400_000;
  return WORKFLOWS.map((w) => {
    const mine = history.filter((r) => r.workflow === w.id);
    const last = mine[0];
    const requirements =
      w.id === "instagram_publish_scheduled"
        ? [{ label: "Instagram gekoppeld met publicatierechten", met: !!ig?.ready }, { label: "Planner van Mavix ingericht", met: !!process.env.CRON_SECRET }]
        : w.id === "email_send_scheduled"
          ? [{ label: "Verzenddomein ingericht", met: mail.ready }, { label: "Planner van Mavix ingericht", met: !!process.env.CRON_SECRET }]
          : w.id === "review_auto_reply"
            ? [{ label: "Google Bedrijfsprofiel gekoppeld", met: false }, { label: "Automatisch reageren vrijgegeven door Mavix", met: false }]
            : [{ label: "Achtergrondtaak voor concepten", met: false }];
    return workflowStatus(w, {
      preference: w.module === "social" ? !!ig2.enabled || ig2.mode === "auto" || ig2.mode === "full" : w.module === "email" ? !!em.enabled : !!rv.enabled,
      permitted: perms.get(w.id) || false,
      requirements,
      pendingApprovals: w.module === "social" ? posts.filter((p) => p.status === "draft").length : w.module === "email" ? emails.filter((c) => c.status === "draft").length : 0,
      lastRun: last ? { at: last.created_at as string, status: last.status as "ok", detail: (last.detail as string) || undefined } : null,
      recentFailures: mine.filter((r) => r.status === "failed" && Date.parse(r.created_at as string) >= weekAgo).length,
    });
  });
}

/** Switches the explicit permission for an automatic workflow (owners and admins). */
export async function setPermission(o: { workspaceId: string; userId: string }, workflow: WorkflowId, enabled: boolean) {
  const w = WORKFLOWS.find((x) => x.id === workflow);
  if (!w || !w.permission) throw new HttpError(400, "Deze automatisering kun je niet zo aanzetten.");
  if (enabled && !w.runnable) throw new HttpError(409, "Deze automatisering is nog niet beschikbaar.");
  if (enabled && workflow === "instagram_publish_scheduled") {
    const cap = await publishCapability(o.workspaceId);
    if (!cap.ready) throw new HttpError(409, cap.message);
  }
  if (enabled && workflow === "email_send_scheduled" && !sendingCapability().ready) throw new HttpError(409, sendingCapability().message);
  const { error } = await db()
    .from("automation_permissions")
    .upsert({ workspace_id: o.workspaceId, workflow, enabled, updated_by: o.userId, updated_at: new Date().toISOString() }, { onConflict: "workspace_id,workflow" });
  if (error) throw new HttpError(503, notReady(error) ? "Automatiseringen worden nog ingericht. Probeer het later opnieuw." : "Opslaan is niet gelukt.");
  await db().from("audit_logs").insert({ workspace_id: o.workspaceId, actor_id: o.userId, event: "automation_" + workflow + (enabled ? "_enabled" : "_disabled") });
}

async function record(workspaceId: string, workflow: string, status: "ok" | "failed" | "skipped", itemId: string | null, detail: string | null) {
  await db().from("automation_runs").insert({ workspace_id: workspaceId, workflow, status, item_id: itemId, detail: detail ? detail.slice(0, 300) : null, created_at: new Date().toISOString() });
}

/**
 * The scheduler: for workspaces that explicitly permitted it, publishes due
 * scheduled Instagram posts and sends due scheduled campaigns. At most
 * `max` items per call; every action and skip is recorded.
 */
export async function runScheduled(now = Date.now(), max = 5) {
  const { data: rows, error } = await db().from("automation_permissions").select("workspace_id,workflow").eq("enabled", true).in("workflow", ["instagram_publish_scheduled", "email_send_scheduled"]).limit(500);
  if (error) throw new HttpError(503, "Automatiseringen zijn nog niet ingericht.");
  let done = 0;
  for (const r of rows || []) {
    if (done >= max) break;
    const workspaceId = r.workspace_id as string;
    const { data: ws } = await db().from("workspaces").select("deleted_at,access_status").eq("id", workspaceId).maybeSingle();
    if (!ws || ws.deleted_at || (ws.access_status && ws.access_status !== "approved")) continue;
    const data = await readWorkspace(workspaceId);
    if (r.workflow === "instagram_publish_scheduled") {
      for (const p of dueItems((data.posts || []) as Post[], now)) {
        if (done++ >= max) break;
        try {
          const res = await publishPost({ workspaceId, userId: null, trigger: "automation" }, p.id);
          await record(workspaceId, r.workflow, res.repeated ? "skipped" : "ok", p.id, res.repeated ? "Was al gepubliceerd." : "Gepubliceerd op Instagram.");
        } catch (e) {
          await record(workspaceId, r.workflow, "failed", p.id, e instanceof HttpError ? e.message : "Publiceren mislukt.");
        }
      }
    } else {
      for (const c of dueItems(((data.email as { campaigns?: EmailCampaign[] })?.campaigns || []) as EmailCampaign[], now)) {
        if (done++ >= max) break;
        try {
          const res = await sendCampaign({ workspaceId, userId: null, trigger: "automation" }, c.id);
          await record(workspaceId, r.workflow, res.repeated ? "skipped" : "ok", c.id, res.repeated ? "Was al verstuurd." : `Verstuurd naar ${res.sent} ontvangers.`);
        } catch (e) {
          await record(workspaceId, r.workflow, "failed", c.id, e instanceof HttpError ? e.message : "Versturen mislukt.");
        }
      }
    }
  }
  return { processed: Math.min(done, max) };
}
