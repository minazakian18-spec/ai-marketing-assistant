import "server-only";
import { adminClient } from "./supabase";
import { HttpError } from "./access";
import { mutateWorkspace, readWorkspace } from "./workspace-store";
import { publishCapability, publishPost } from "./instagram-publish";
import { sendCampaign, sendingCapability } from "./email-campaigns";
import { listGoogleReviews, putReviewReply } from "./google-business";
import { generateReviewReply } from "./ai";
import { metered } from "./ai-usage";
import { WORKFLOWS, amsterdamToUtc, dueItems, replyDecision, workflowStatus, type ReplyRules, type WorkflowId } from "../automation";
import type { Post } from "../types";
import type { EmailCampaign } from "../email-model";

// Server side of the shared automation model (../automation.ts): real facts
// per workflow, the explicit permission switch, and the scheduler that runs
// permitted workflows (POST /api/automation/cron with CRON_SECRET).

const db = () => adminClient();
const notReady = (e: { code?: string } | null) => !!e && ["42P01", "PGRST205", "42703"].includes(e.code || "");
const AUTO_WORKFLOWS = ["instagram_publish_scheduled", "email_send_scheduled", "review_auto_reply"];
/** Auto Reply: at most this many replies per workspace per scheduler run (the cron runs every few minutes). */
const REPLIES_PER_RUN = 3;

async function permissions(workspaceId: string) {
  const { data, error } = await db().from("automation_permissions").select("workflow,enabled,updated_at").eq("workspace_id", workspaceId);
  if (error && !notReady(error)) throw new HttpError(503, "De automatiseringen konden niet worden geladen.");
  return new Map((data || []).map((r) => [r.workflow as string, !!r.enabled]));
}

async function runs(workspaceId: string) {
  const { data } = await db().from("automation_runs").select("workflow,status,detail,item_id,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100);
  return data || [];
}

/** Whether Google reviews can really be answered for this workspace (connected, location chosen). */
export async function reviewsCapability(workspaceId: string): Promise<{ ready: boolean; message: string }> {
  const { data: c } = await db().from("integration_connections").select("status,metadata,encrypted_credentials").eq("workspace_id", workspaceId).eq("provider", "google_business").maybeSingle();
  if (!c || c.status === "disconnected" || !c.encrypted_credentials) return { ready: false, message: "Koppel eerst Google Bedrijfsprofiel." };
  if (c.status !== "connected" || !(c.metadata as { location?: string } | null)?.location) return { ready: false, message: "Google Bedrijfsprofiel is gekoppeld, maar de reviews laden nog niet. Controleer de koppeling bij Reviews." };
  return { ready: true, message: "Klaar." };
}

export async function automationStatus(workspaceId: string) {
  const [ws, perms, history, ig, mail, reviews] = await Promise.all([
    readWorkspace(workspaceId),
    permissions(workspaceId),
    runs(workspaceId),
    publishCapability(workspaceId).catch(() => null),
    Promise.resolve(sendingCapability()),
    reviewsCapability(workspaceId).catch(() => ({ ready: false, message: "" })),
  ]);
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
            ? [{ label: "Google Bedrijfsprofiel gekoppeld en reviews laden", met: reviews.ready }, { label: "Planner van Mavix ingericht", met: !!process.env.CRON_SECRET }]
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
  if (enabled && workflow === "review_auto_reply") {
    const cap = await reviewsCapability(o.workspaceId);
    if (!cap.ready) throw new HttpError(409, cap.message);
  }
  const { error } = await db()
    .from("automation_permissions")
    .upsert({ workspace_id: o.workspaceId, workflow, enabled, updated_by: o.userId, updated_at: new Date().toISOString() }, { onConflict: "workspace_id,workflow" });
  if (error) throw new HttpError(503, notReady(error) ? "Automatiseringen worden nog ingericht. Probeer het later opnieuw." : "Opslaan is niet gelukt.");
  await db().from("audit_logs").insert({ workspace_id: o.workspaceId, actor_id: o.userId, event: "automation_" + workflow + (enabled ? "_enabled" : "_disabled") });
}

async function record(workspaceId: string, workflow: string, status: "ok" | "failed" | "skipped", itemId: string | null, detail: string | null) {
  await db().from("automation_runs").insert({ workspace_id: workspaceId, workflow, status, item_id: itemId, detail: detail ? detail.slice(0, 300) : null, created_at: new Date().toISOString() });
}

/** The review rules the owner set (preferences); the permission row is the switch. */
export function reviewRules(ws: { review?: unknown }): ReplyRules & { tone?: string; signature?: string } {
  const s = ((ws.review as { settings?: Record<string, unknown> })?.settings || {}) as Record<string, unknown>;
  const n = (v: unknown, d: number) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5 ? (v as number) : d);
  return { enabled: true, autoPublishMinRating: n(s.autoPublishMinRating, 4), manualBelowRating: n(s.manualBelowRating, 3), tone: typeof s.tone === "string" ? s.tone : undefined, signature: typeof s.signature === "string" ? s.signature : undefined };
}

/**
 * Auto Reply on Google reviews for one workspace that explicitly permitted it.
 * Google is the source of truth: only reviews without a reply are considered,
 * and replyDecision (../automation.ts) decides per review. Positive reviews
 * without sensitive content get an AI reply, written in the owner's tone and
 * posted through the Business Profile API; everything else stays with the
 * owner and is recorded once as "skipped". AI costs are metered on the
 * account of the person who gave the permission.
 */
export async function autoReplyReviews(o: { workspaceId: string; userId: string | null }, ws: { review?: unknown; profile?: unknown }, limit = REPLIES_PER_RUN) {
  const workflow = "review_auto_reply";
  if (!o.userId) {
    await record(o.workspaceId, workflow, "failed", null, "Geen eigenaar gevonden voor de AI-kosten. Zet de toestemming opnieuw aan.");
    return 1;
  }
  const rules = reviewRules(ws);
  let page;
  try {
    page = await listGoogleReviews(o.workspaceId, { pageSize: 25 });
  } catch (e) {
    await record(o.workspaceId, workflow, "failed", null, e instanceof HttpError ? e.message : "Reviews konden niet worden geladen.");
    return 1;
  }
  const seen = new Set((await runs(o.workspaceId)).filter((r) => r.workflow === workflow && r.item_id).map((r) => r.item_id as string));
  let done = 0;
  let replied = 0;
  for (const r of page.reviews) {
    if (r.reply || seen.has(r.id)) continue;
    const decision = replyDecision({ rating: r.rating, comment: r.comment, hasReply: !!r.reply }, rules);
    if (decision.action !== "auto") {
      // Recorded once, so the owner sees why Mavix left it; never again on later runs.
      await record(o.workspaceId, workflow, "skipped", r.id, decision.reason);
      done++;
      continue;
    }
    if (replied >= limit) break;
    try {
      const text = await metered({ workspaceId: o.workspaceId, user: { id: o.userId } }, "review_reply", () =>
        generateReviewReply({ reviewer: r.reviewer.anonymous ? "" : r.reviewer.name, rating: r.rating, comment: r.comment }, (ws.profile as Record<string, unknown>) || {}, { tone: rules.tone, signature: rules.signature }),
      );
      const clean = text.trim().slice(0, 4096);
      if (!clean) throw new HttpError(502, "Mavix kon geen antwoord schrijven.");
      await putReviewReply(o.workspaceId, r.id, clean);
      await record(o.workspaceId, workflow, "ok", r.id, `Automatisch beantwoord (${r.rating} sterren).`);
      console.info(JSON.stringify({ event: "review_auto_replied", rating: r.rating }));
      replied++;
    } catch (e) {
      await record(o.workspaceId, workflow, "failed", r.id, e instanceof HttpError ? e.message : "Antwoorden is niet gelukt.");
    }
    done++;
  }
  return done;
}

/**
 * The scheduler: for workspaces that explicitly permitted it, publishes due
 * scheduled Instagram posts, sends due scheduled campaigns and answers new
 * positive Google reviews. At most `max` items per call; every action and
 * skip is recorded.
 */
export async function runScheduled(now = Date.now(), max = 5) {
  const { data: rows, error } = await db().from("automation_permissions").select("workspace_id,workflow,updated_by").eq("enabled", true).in("workflow", AUTO_WORKFLOWS).limit(500);
  if (error) throw new HttpError(503, "Automatiseringen zijn nog niet ingericht.");
  let done = 0;
  for (const r of rows || []) {
    if (done >= max) break;
    const workspaceId = r.workspace_id as string;
    const { data: ws } = await db().from("workspaces").select("deleted_at,access_status").eq("id", workspaceId).maybeSingle();
    if (!ws || ws.deleted_at || (ws.access_status && ws.access_status !== "approved")) continue;
    const data = await readWorkspace(workspaceId);
    if (r.workflow === "instagram_publish_scheduled") {
      // Older than the 6-hour window: never published late on its own. The post
      // becomes "failed" with a clear reason, so the owner can post it now or
      // plan it again (Social > Gemist).
      const tooLate = ((data.posts || []) as Post[]).filter((p) => p.status === "scheduled" && p.date && amsterdamToUtc(p.date) < now - 6 * 3600_000).map((p) => p.id);
      if (tooLate.length) {
        await mutateWorkspace(workspaceId, (d) => ({
          data: { ...d, posts: ((d.posts || []) as Post[]).map((p) => (tooLate.includes(p.id) && p.status === "scheduled" ? { ...p, status: "failed" as const, failureReason: "Niet gepubliceerd op het geplande moment. Plaats de post nu of plan hem opnieuw in." } : p)) },
          result: null,
        })).catch(() => null);
        for (const id of tooLate) await record(workspaceId, r.workflow, "failed", id, "Gemist: het geplande moment is voorbij.");
      }
      for (const p of dueItems((data.posts || []) as Post[], now)) {
        if (done++ >= max) break;
        try {
          const res = await publishPost({ workspaceId, userId: null, trigger: "automation" }, p.id);
          await record(workspaceId, r.workflow, res.repeated ? "skipped" : "ok", p.id, res.repeated ? "Was al gepubliceerd." : "Gepubliceerd op Instagram.");
        } catch (e) {
          await record(workspaceId, r.workflow, "failed", p.id, e instanceof HttpError ? e.message : "Publiceren mislukt.");
        }
      }
    } else if (r.workflow === "email_send_scheduled") {
      for (const c of dueItems(((data.email as { campaigns?: EmailCampaign[] })?.campaigns || []) as EmailCampaign[], now)) {
        if (done++ >= max) break;
        try {
          const res = await sendCampaign({ workspaceId, userId: null, trigger: "automation" }, c.id);
          await record(workspaceId, r.workflow, res.repeated ? "skipped" : "ok", c.id, res.repeated ? "Was al verstuurd." : `Verstuurd naar ${res.sent} ontvangers.`);
        } catch (e) {
          await record(workspaceId, r.workflow, "failed", c.id, e instanceof HttpError ? e.message : "Versturen mislukt.");
        }
      }
    } else if (r.workflow === "review_auto_reply") {
      done += await autoReplyReviews({ workspaceId, userId: (r.updated_by as string | null) || null }, data, Math.min(REPLIES_PER_RUN, max - done));
    }
  }
  return { processed: Math.min(done, max) };
}
