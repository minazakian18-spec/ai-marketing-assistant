import "server-only";
import { z } from "zod";
import { adminClient } from "../supabase";
import { HttpError } from "../access";
import { addCampaign, buildCampaignRecords, campaignValid } from "../../campaigns";
import type { Role } from "../../security";

// Mavix Agent write actions (phase 3).
//
// The agent never changes the workspace itself. A write tool only records a
// PENDING action (agent_actions) with a validated payload and a plain summary.
// The user then confirms or cancels it in the app; only that confirmation
// (POST /api/agent/actions/:id) carries out the change. Rules:
//   - owner: the confirming user must be the user the action was proposed to,
//     in the same workspace, with role OWNER or ADMIN (re-checked at confirm);
//   - once: pending -> executing is a conditional update, so a double click or
//     two tabs cannot run it twice; a repeated confirm of a finished action
//     returns the stored result;
//   - expiry: pending actions expire after 24 hours;
//   - audit: the row keeps who, what, when and the outcome.
// Agent writes only ADD drafts (status "draft"); nothing is scheduled,
// published, sent, changed or deleted.

export const WRITE_ROLES: Role[] = ["OWNER", "ADMIN"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const db = () => adminClient();
const notReady = (e: { code?: string } | null) => !!e && ["42P01", "PGRST205", "42703"].includes(e.code || "");

const text = (max: number) => z.string().trim().max(max);
export const campaignPayload = z
  .object({
    title: text(120).min(1),
    goal: text(1000).min(5),
    instagram: z.object({ caption: text(2200).min(1), hashtags: text(400), visual_brief: text(1000) }).strict().nullable(),
    email: z.object({ subject: text(150).min(1), preview: text(200), body: text(6000).min(1), cta: text(60) }).strict().nullable(),
    copy: z.object({ title: text(120).min(1), body: text(3000).min(1) }).strict().nullable(),
    ctas: z.array(text(120)).max(4),
    schedule: z
      .array(z.object({ channel: z.enum(["instagram", "email", "copy"]), day_offset: z.number().int().min(0).max(14), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).strict())
      .max(3),
  })
  .strict()
  .refine((p) => !!(p.instagram || p.email || p.copy), "Een campagne heeft minstens één onderdeel nodig.");
export type CampaignPayload = z.infer<typeof campaignPayload>;

export function campaignSummaryText(p: CampaignPayload) {
  const parts = [p.instagram && "Instagram-post", p.email && "e-mail", p.copy && "marketingtekst"].filter(Boolean);
  return `Campagne "${p.title}" opslaan als concepten: ${parts.join(", ")}.`.slice(0, 500);
}

export type ActionRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  conversation_id: string | null;
  message_id: string | null;
  kind: "save_campaign_drafts";
  payload: unknown;
  summary: string;
  status: "pending" | "executing" | "done" | "failed" | "cancelled" | "expired";
  result: { campaignId?: string; href?: string } | null;
  error: string | null;
  created_at: string;
  expires_at: string;
};
const COLUMNS = "id,workspace_id,user_id,conversation_id,message_id,kind,payload,summary,status,result,error,created_at,expires_at";

function check(error: { code?: string } | null, what: string) {
  if (!error) return;
  if (notReady(error)) throw new HttpError(503, "Acties via Mavi worden nog ingericht. Probeer het later opnieuw.");
  console.error(JSON.stringify({ event: "agent_action_db_error", code: error.code || "error" }));
  throw new HttpError(503, what);
}

/** Records a proposed change. Nothing in the workspace changes here. */
export async function proposeAction(o: { workspaceId: string; userId: string; role: Role; conversationId?: string }, payload: CampaignPayload) {
  if (!WRITE_ROLES.includes(o.role)) throw new HttpError(403, "Alleen eigenaren en beheerders kunnen concepten opslaan.");
  const summary = campaignSummaryText(payload);
  const now = new Date();
  const { data, error } = await db()
    .from("agent_actions")
    .insert({
      workspace_id: o.workspaceId,
      user_id: o.userId,
      conversation_id: o.conversationId || null,
      kind: "save_campaign_drafts",
      payload,
      summary,
      status: "pending",
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 24 * 3600_000).toISOString(),
    })
    .select("id,summary")
    .single();
  check(error, "Het voorstel kon niet worden klaargezet.");
  console.info(JSON.stringify({ event: "agent_action_proposed", kind: "save_campaign_drafts", workspace: o.workspaceId }));
  return data as { id: string; summary: string };
}

/** Links proposed actions to the assistant message that shows them. */
export async function linkActions(o: { workspaceId: string; userId: string }, ids: string[], messageId: string) {
  if (!ids.length) return;
  const { error } = await db().from("agent_actions").update({ message_id: messageId }).in("id", ids).eq("workspace_id", o.workspaceId).eq("user_id", o.userId);
  if (error) console.error(JSON.stringify({ event: "agent_action_link_failed", code: error.code || "error" }));
}

async function ownAction(o: { workspaceId: string; userId: string }, id: string) {
  if (!UUID.test(id)) throw new HttpError(404, "Dit voorstel bestaat niet.");
  const { data, error } = await db().from("agent_actions").select(COLUMNS).eq("id", id).eq("workspace_id", o.workspaceId).eq("user_id", o.userId).maybeSingle();
  check(error, "Het voorstel kon niet worden geladen.");
  // Someone else's action looks exactly like a missing one.
  if (!data) throw new HttpError(404, "Dit voorstel bestaat niet.");
  return data as ActionRow;
}

const view = (a: ActionRow) => ({ id: a.id, status: a.status, summary: a.summary, result: a.result, error: a.error });

/**
 * Applies a change to the workspace document with optimistic locking:
 * read data+version, apply, write only if the version is unchanged; retry on
 * a concurrent save. Browsers then see a newer version and reload.
 */
export async function mutateWorkspace<T>(workspaceId: string, change: (data: Record<string, unknown>) => { data: Record<string, unknown>; result: T }, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    const { data: row, error } = await db().from("business_profiles").select("data,version").eq("workspace_id", workspaceId).single();
    if (error || !row) throw new HttpError(503, "De werkruimte kon niet worden geladen.");
    const { data, result } = change((row.data || {}) as Record<string, unknown>);
    const { data: updated, error: saveError } = await db()
      .from("business_profiles")
      .update({ data, version: (row.version as number) + 1, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("version", row.version)
      .select("version")
      .maybeSingle();
    if (saveError) throw new HttpError(503, "Opslaan is niet gelukt.");
    if (updated) return result;
  }
  throw new HttpError(409, "De werkruimte werd tegelijk gewijzigd. Probeer het opnieuw.");
}

/** Carries out (confirm) or drops (cancel) a pending action, at most once. */
export async function decideAction(o: { workspaceId: string; userId: string; role: Role }, id: string, decision: "confirm" | "cancel") {
  const action = await ownAction(o, id);
  if (decision === "confirm" && !WRITE_ROLES.includes(o.role)) throw new HttpError(403, "Alleen eigenaren en beheerders kunnen concepten opslaan.");
  if (action.status !== "pending") {
    // Idempotent: a repeated confirm of a finished action returns its result.
    if (decision === "confirm" && action.status === "done") return { action: view(action), repeated: true };
    if (decision === "cancel" && action.status === "cancelled") return { action: view(action), repeated: true };
    throw new HttpError(409, action.status === "executing" ? "Dit voorstel wordt al uitgevoerd." : "Dit voorstel is niet meer open.");
  }
  const now = new Date().toISOString();
  if (Date.parse(action.expires_at) < Date.now()) {
    await db().from("agent_actions").update({ status: "expired", updated_at: now }).eq("id", id).eq("status", "pending");
    throw new HttpError(410, "Dit voorstel is verlopen. Vraag Mavi om een nieuw voorstel.");
  }
  // Claim the action: only one request can move it out of 'pending'.
  const next = decision === "confirm" ? "executing" : "cancelled";
  const { data: claimed, error: claimError } = await db()
    .from("agent_actions")
    .update({ status: next, decided_at: now, updated_at: now })
    .eq("id", id)
    .eq("workspace_id", o.workspaceId)
    .eq("user_id", o.userId)
    .eq("status", "pending")
    .select(COLUMNS)
    .maybeSingle();
  check(claimError, "Het voorstel kon niet worden verwerkt.");
  if (!claimed) {
    const fresh = await ownAction(o, id);
    if (fresh.status === "done" && decision === "confirm") return { action: view(fresh), repeated: true };
    throw new HttpError(409, "Dit voorstel is al verwerkt.");
  }
  console.info(JSON.stringify({ event: "agent_action_" + (decision === "confirm" ? "confirmed" : "cancelled"), kind: action.kind, workspace: o.workspaceId }));
  if (decision === "cancel") return { action: view(claimed as ActionRow), repeated: false };

  try {
    // Validate again: the stored payload is never trusted blindly.
    const payload = campaignPayload.parse(action.payload);
    const campaignId = await mutateWorkspace(o.workspaceId, (ws) => {
      const records = buildCampaignRecords(payload, { source: "agent", profile: (ws.profile || {}) as Record<string, string> });
      if (!campaignValid(records.campaign)) throw new HttpError(400, "Het voorstel is ongeldig.");
      const existing = Array.isArray(ws.campaigns) ? ws.campaigns : [];
      if (existing.length >= 500) throw new HttpError(409, "Je hebt het maximale aantal campagnes bereikt.");
      return { data: addCampaign(ws as Parameters<typeof addCampaign>[0], records) as Record<string, unknown>, result: records.campaign.id };
    });
    const result = { campaignId, href: "/studio/campagne?id=" + campaignId };
    const { data: done, error } = await db().from("agent_actions").update({ status: "done", result, updated_at: new Date().toISOString() }).eq("id", id).select(COLUMNS).single();
    check(error, "Het voorstel is uitgevoerd, maar de status kon niet worden bijgewerkt.");
    console.info(JSON.stringify({ event: "agent_action_done", kind: action.kind, workspace: o.workspaceId }));
    return { action: view(done as ActionRow), repeated: false };
  } catch (e) {
    const message = e instanceof HttpError ? e.message : e instanceof z.ZodError ? "Het voorstel is ongeldig." : "Opslaan is niet gelukt.";
    // A temporary failure (busy workspace, database) leaves the proposal open for a retry.
    const retryable = e instanceof HttpError && (e.status === 409 || e.status === 503) && !/maximale/.test(e.message);
    await db().from("agent_actions").update({ status: retryable ? "pending" : "failed", error: message.slice(0, 300), updated_at: new Date().toISOString() }).eq("id", id);
    console.error(JSON.stringify({ event: "agent_action_failed", kind: action.kind }));
    throw e instanceof HttpError ? e : new HttpError(400, message);
  }
}
