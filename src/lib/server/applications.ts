import "server-only";
import { adminClient } from "./supabase";
import { HttpError } from "./access";
import { transition, type AdminAction, type ApplicationStatus, type PaymentStatus } from "../applications";
import { sendTemplate } from "./email";

// Demo requests and account applications (migration 202610140001).
// Public submissions never create accounts or grant access; only a platform
// administrator moves an application forward, and every change is checked
// against the rules in src/lib/applications.ts, applied atomically (the
// update only succeeds if the status is still the one that was checked) and
// recorded in account_application_events.

export type ApplicationInput = {
  kind: "demo" | "application";
  name: string;
  email: string;
  company: string;
  phone?: string;
  website?: string;
  industry?: string;
  plan?: "starter" | "growth" | "autopilot";
  message?: string;
  preferredTime?: string;
};
export type ApplicationRow = {
  id: string;
  status: ApplicationStatus;
  payment_status: PaymentStatus;
  demo_completed_at: string | null;
  name: string;
  email: string;
  company: string;
  phone: string | null;
  website: string | null;
  industry: string | null;
  plan: string | null;
  message: string | null;
  preferred_time: string | null;
  workspace_id: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  status_at: string;
};

const db = () => adminClient();
const OPEN: ApplicationStatus[] = ["demo_requested", "demo_completed", "application_pending", "awaiting_payment", "payment_confirmed"];
const notReady = (e: { code?: string } | null) => !!e && ["42P01", "PGRST205", "42703"].includes(e.code || "");
function check(error: { code?: string } | null, what: string) {
  if (!error) return;
  if (notReady(error)) {
    console.error(JSON.stringify({ event: "applications_not_provisioned" }));
    throw new HttpError(503, "Aanvragen is tijdelijk niet beschikbaar. Probeer het later opnieuw.");
  }
  console.error(JSON.stringify({ event: "applications_db_error", code: error.code || "error" }));
  throw new HttpError(503, what);
}
async function event(applicationId: string, from: string | null, to: string, actor: string | null, note?: string) {
  const { error } = await db().from("account_application_events").insert({ application_id: applicationId, actor_id: actor, from_status: from, to_status: to, note: note || null });
  check(error, "De aanvraag kon niet worden vastgelegd.");
}

/**
 * Public demo request or application. One open record per e-mail address: a
 * later application continues an earlier demo request. The response never
 * reveals whether the address was already known.
 */
export async function submitApplication(input: ApplicationInput) {
  const email = input.email.trim().toLowerCase();
  const fields = {
    name: input.name,
    company: input.company,
    phone: input.phone || null,
    website: input.website || null,
    industry: input.industry || null,
    message: input.message || null,
    preferred_time: input.preferredTime || null,
  };
  const { data: existing, error } = await db()
    .from("account_applications")
    .select("id,status,plan")
    .eq("email", email)
    .in("status", OPEN)
    .order("created_at", { ascending: false })
    .limit(1);
  check(error, "Je aanvraag kon niet worden verwerkt.");
  const now = new Date().toISOString();
  const prev = existing?.[0] as { id: string; status: ApplicationStatus; plan: string | null } | undefined;

  if (prev) {
    // A demo request followed by an application continues the same record.
    const next: ApplicationStatus = input.kind === "application" && (prev.status === "demo_requested" || prev.status === "demo_completed") ? "application_pending" : prev.status;
    const { error: e } = await db()
      .from("account_applications")
      .update({ ...fields, plan: input.plan || prev.plan, status: next, status_at: next === prev.status ? undefined : now, updated_at: now })
      .eq("id", prev.id)
      .eq("status", prev.status);
    check(e, "Je aanvraag kon niet worden verwerkt.");
    if (next !== prev.status) await event(prev.id, prev.status, next, null, "Aanvraag ingediend door klant");
    return { id: prev.id, status: next, created: false };
  }
  const status: ApplicationStatus = input.kind === "demo" ? "demo_requested" : "application_pending";
  const { data: row, error: e } = await db()
    .from("account_applications")
    .insert({ ...fields, email, plan: input.plan || null, status, payment_status: "not_started", consent_at: now, status_at: now })
    .select("id")
    .single();
  check(e, "Je aanvraag kon niet worden verwerkt.");
  await event(row!.id as string, null, status, null, input.kind === "demo" ? "Demo aangevraagd" : "Aanvraag ingediend");
  await notify(input.kind === "demo" ? "demo_received" : "application_received", { id: row!.id as string, email, name: input.name, company: input.company, plan: input.plan || null });
  return { id: row!.id as string, status, created: true };
}

export async function listApplications() {
  const { data, error } = await db().from("account_applications").select("*").order("created_at", { ascending: false }).limit(300);
  check(error, "Aanvragen konden niet worden geladen.");
  const ids = (data || []).map((a) => a.id as string);
  const { data: events, error: e } = ids.length
    ? await db().from("account_application_events").select("application_id,from_status,to_status,note,created_at").in("application_id", ids).order("created_at", { ascending: true }).limit(3000)
    : { data: [], error: null };
  check(e, "De geschiedenis kon niet worden geladen.");
  return (data || []).map((a) => ({ ...(a as ApplicationRow), events: (events || []).filter((ev) => ev.application_id === a.id) }));
}

// Finds the existing Mavix account (and its own workspace) for an e-mail.
async function ownerWorkspace(email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new HttpError(503, "Accounts konden niet worden gecontroleerd.");
    const user = data.users.find((u) => (u.email || "").toLowerCase() === email);
    if (user) {
      const { data: m, error: me } = await db().from("workspace_members").select("workspace_id").eq("user_id", user.id).eq("role", "OWNER").order("created_at").limit(1);
      check(me, "Accounts konden niet worden gecontroleerd.");
      return (m?.[0]?.workspace_id as string) || null;
    }
    if (data.users.length < 1000) break;
  }
  return null;
}

/** Administrator action on an application (platformAdmin checked by the caller). */
export async function actOnApplication(id: string, action: AdminAction, actorId: string, opts: { note?: string; reason?: string } = {}) {
  const { data: app, error } = await db().from("account_applications").select("*").eq("id", id).maybeSingle();
  check(error, "De aanvraag kon niet worden geladen.");
  if (!app) throw new HttpError(404, "Deze aanvraag bestaat niet.");
  const a = app as ApplicationRow;
  const t = transition(a, action);
  if (!t.ok) throw new HttpError(409, t.reason);

  const now = new Date().toISOString();
  const change: Record<string, unknown> = { status: t.to, updated_at: now, reviewed_by: actorId, reviewed_at: now };
  if (t.to !== a.status) change.status_at = now;
  if (t.payment) change.payment_status = t.payment;
  if (action === "complete_demo") change.demo_completed_at = now;
  if (action === "reject") change.rejection_reason = (opts.reason || "").slice(0, 500) || null;
  if (action === "reopen") change.rejection_reason = null;

  // Access follows the application: activation approves the customer's own
  // workspace; suspension pauses it. Both require an existing account.
  let workspaceId = a.workspace_id;
  if (action === "activate" || action === "suspend") {
    workspaceId ??= await ownerWorkspace(a.email);
    if (!workspaceId)
      throw new HttpError(409, "Er bestaat nog geen Mavix-account met dit e-mailadres. Vraag de klant eerst een account aan te maken; daarna kun je activeren.");
    change.workspace_id = workspaceId;
  }

  const { data: updated, error: ue } = await db().from("account_applications").update(change).eq("id", id).eq("status", a.status).select("id").maybeSingle();
  check(ue, "Opslaan is niet gelukt.");
  if (!updated) throw new HttpError(409, "Deze aanvraag is intussen gewijzigd. Vernieuw de pagina.");

  if (workspaceId && (action === "activate" || action === "suspend")) {
    const access = action === "activate" ? "approved" : "suspended";
    const { error: we } = await db().from("workspaces").update({ access_status: access, access_changed_at: now }).eq("id", workspaceId).is("deleted_at", null);
    if (we) throw new HttpError(503, "De toegang van de werkruimte kon niet worden aangepast.");
    await db().from("audit_logs").insert({ workspace_id: workspaceId, actor_id: actorId, event: "application_" + action });
  }
  await event(id, a.status, t.to, actorId, opts.note || (action === "reject" ? opts.reason : undefined));

  const template = action === "approve" ? "application_approved" : action === "reject" ? "application_rejected" : action === "activate" ? "account_activated" : null;
  if (template) await notify(template, { id, email: a.email, name: a.name, company: a.company, plan: a.plan, reason: change.rejection_reason as string | null });
  return { id, status: t.to };
}

// Customer e-mails are best effort: a missing or failing provider never blocks
// the status change, and the outcome is recorded in the history.
async function notify(template: Parameters<typeof sendTemplate>[0], data: Parameters<typeof sendTemplate>[1] & { id: string }) {
  const result = await sendTemplate(template, data, `application-${data.id}-${template}`);
  await db()
    .from("account_application_events")
    .insert({ application_id: data.id, actor_id: null, from_status: null, to_status: "email", note: result.sent ? `E-mail verstuurd: ${template}` : `E-mail niet verstuurd (${result.reason}): ${template}` });
}
