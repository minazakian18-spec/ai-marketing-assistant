import "server-only";
import { adminClient } from "./supabase";
import { encrypt, decrypt } from "./crypto";
import { emailProvider } from "./notifications";

// Real health check for every Google connection (Gmail, Agenda,
// Bedrijfsprofiel, Search Console). One cheap, real call per connection: the
// stored refresh token is exchanged at Google's token endpoint. That proves
// the grant still works, and it keeps the access token fresh.
//
//   ok              -> new access token stored, metadata.check = { at, ok: true }
//   invalid_grant   -> status reconnect_required (ONLY then), owners and admins
//                      get an in-app notification and an e-mail
//   anything else   -> network, 5xx, rate limit: metadata.check records a
//                      temporary failure, the status is left alone
//
// Writes are guarded by id + connection_generation + the old ciphertext, so a
// concurrent refresh by a request (gmailToken, businessToken, ...) wins and
// nothing is overwritten. Tokens never leave this file and are never logged.

export const GOOGLE_PROVIDERS = ["gmail", "google_calendar", "google_business", "google_search_console"] as const;
export type GoogleProvider = (typeof GOOGLE_PROVIDERS)[number];
const LABEL: Record<GoogleProvider, string> = { gmail: "Gmail", google_calendar: "Google Agenda", google_business: "Google Bedrijfsprofiel", google_search_console: "Google Search Console" };
/** A connection counts as checked for this long; older checks show as "Controleren…". */
export const CHECK_FRESH_MS = 24 * 3600_000;

type Row = {
  id: string;
  workspace_id: string;
  provider: GoogleProvider;
  status: string;
  encrypted_credentials: string | null;
  connection_generation: string;
  metadata: Record<string, unknown> | null;
};
type Creds = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
export type CheckOutcome = "ok" | "reconnect" | "temporary" | "skipped";

const db = () => adminClient();
const log = (event: string, fields: Record<string, unknown>) => console.info(JSON.stringify({ event, ...fields }));

async function refresh(refreshToken: string): Promise<{ ok: true; creds: Creds } | { ok: false; reconnect: boolean }> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return { ok: false, reconnect: false };
  let r: Response;
  try {
    r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET }),
    });
  } catch {
    return { ok: false, reconnect: false };
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, reconnect: d?.error === "invalid_grant" };
  if (typeof d.access_token !== "string" || !d.access_token || typeof d.expires_in !== "number" || d.expires_in <= 0 || d.expires_in > 86400) return { ok: false, reconnect: false };
  return { ok: true, creds: { access_token: d.access_token, expires_in: d.expires_in, ...(typeof d.refresh_token === "string" && d.refresh_token ? { refresh_token: d.refresh_token } : {}), ...(typeof d.scope === "string" ? { scope: d.scope } : {}) } };
}

/** Tell owners and admins (in the app, and by e-mail when sending is set up). */
async function notifyReconnect(row: Row) {
  const { data: members } = await db().from("workspace_members").select("user_id,role").eq("workspace_id", row.workspace_id).in("role", ["OWNER", "ADMIN"]);
  const users = [...new Set((members || []).map((m) => m.user_id as string))];
  if (!users.length) return;
  const title = "Koppel " + LABEL[row.provider] + " opnieuw";
  const body = "Google accepteert de opgeslagen toegang niet meer. Ga naar Integraties en koppel " + LABEL[row.provider] + " opnieuw; je instellingen blijven bewaard.";
  await db()
    .from("notifications")
    .insert(users.map((recipient_id) => ({ workspace_id: row.workspace_id, recipient_id, event_type: "integration_reconnect", title, body, related_entity_type: "integration", related_entity_id: row.provider })));
  if (!process.env.EMAIL_API_KEY || !process.env.EMAIL_FROM) return;
  const day = new Date().toISOString().slice(0, 10);
  for (const id of users) {
    const { data } = await db().auth.admin.getUserById(id).catch(() => ({ data: null }));
    const email = data?.user?.email;
    if (!email) continue;
    await emailProvider.send(email, title + " (Mavix)", body + "\n\n" + (process.env.APP_URL || "https://mavix.webbo-solutions.nl") + "/account/integraties", "reconnect-" + row.id + "-" + day).catch(() => null);
  }
}

/** One real check of one Google connection (see above). */
export async function checkGoogleConnection(row: Row): Promise<CheckOutcome> {
  if (!row.encrypted_credentials || row.status === "disconnected" || row.status === "reconnect_required") return "skipped";
  const context = row.workspace_id + ":" + row.provider;
  let creds: Creds;
  try {
    creds = decrypt<Creds>(row.encrypted_credentials, context);
  } catch {
    return "temporary"; // Wrong key in this environment: never mark the customer's connection as expired.
  }
  const update = (values: Record<string, unknown>) =>
    db()
      .from("integration_connections")
      .update(values)
      .eq("id", row.id)
      .eq("connection_generation", row.connection_generation)
      .eq("encrypted_credentials", row.encrypted_credentials as string)
      .select("id");
  const meta = (check: Record<string, unknown>) => ({ ...(row.metadata || {}), check });
  const now = new Date().toISOString();
  const r = creds.refresh_token ? await refresh(creds.refresh_token) : { ok: false as const, reconnect: true };
  if (r.ok) {
    const next = { ...creds, ...r.creds, refresh_token: r.creds.refresh_token || creds.refresh_token };
    await update({ encrypted_credentials: encrypt(next, context), expires_at: new Date(Date.now() + next.expires_in * 1000).toISOString(), metadata: meta({ at: now, ok: true }) });
    log("google_check", { provider: row.provider, outcome: "ok" });
    return "ok";
  }
  if (r.reconnect) {
    const { data } = await update({ status: "reconnect_required", metadata: meta({ at: now, ok: false, reason: "invalid_grant" }) });
    log("google_check", { provider: row.provider, outcome: "reconnect" });
    if (data?.length) await notifyReconnect(row).catch(() => null);
    return "reconnect";
  }
  await update({ metadata: meta({ at: now, ok: false, reason: "temporary" }) });
  log("google_check", { provider: row.provider, outcome: "temporary" });
  return "temporary";
}

const SELECT = "id,workspace_id,provider,status,encrypted_credentials,connection_generation,metadata";

/** Health check for one workspace (Integraties: "Controleren"). */
export async function checkWorkspaceGoogle(workspaceId: string) {
  const { data } = await db().from("integration_connections").select(SELECT).eq("workspace_id", workspaceId).in("provider", GOOGLE_PROVIDERS as unknown as string[]);
  const out: Record<string, CheckOutcome> = {};
  for (const row of (data || []) as Row[]) out[row.provider] = await checkGoogleConnection(row);
  return out;
}

/** Scheduler: every Google connection that was not checked in the last 20 hours (at most `limit` per run). */
export async function runGoogleHealth(limit = 25, now = Date.now()) {
  const { data, error } = await db().from("integration_connections").select(SELECT).in("provider", GOOGLE_PROVIDERS as unknown as string[]).not("encrypted_credentials", "is", null).limit(500);
  if (error) return { googleChecks: 0 };
  const due = ((data || []) as Row[]).filter((r) => {
    if (r.status === "disconnected" || r.status === "reconnect_required") return false;
    const at = Date.parse(String((r.metadata?.check as { at?: string } | undefined)?.at || ""));
    return !Number.isFinite(at) || now - at > 20 * 3600_000;
  });
  let n = 0;
  for (const row of due.slice(0, limit)) {
    await checkGoogleConnection(row).catch(() => null);
    n++;
  }
  return { googleChecks: n };
}

/** For the health view: when was this connection last proven to work? */
export function lastCheck(metadata: unknown): { at: string; ok: boolean } | null {
  const c = (metadata as { check?: { at?: string; ok?: boolean } } | null)?.check;
  return c?.at ? { at: c.at, ok: !!c.ok } : null;
}
