import "server-only";
import { adminClient } from "./supabase";
import { HttpError } from "./access";
import { encrypt, decrypt } from "./crypto";

// Google Search Console (provider google_search_console), read-only scope.
// Private search data for properties the connected Google account may see.
// Same token model as the other Google connections: encrypted credentials
// (context workspace:provider), refresh 60 s before expiry, one retry on 401,
// invalid_grant -> reconnect_required, temporary failures never disconnect.

export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const GSC_SCOPES = ["openid", "email", GSC_SCOPE];
const PROVIDER = "google_search_console";
const context = (workspaceId: string) => workspaceId + ":" + PROVIDER;
const API = "https://www.googleapis.com/webmasters/v3";

export type GscCredentials = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
type Connection = { id: string; workspace_id: string; status: string; scopes: string[] | null; encrypted_credentials: string | null; expires_at: string | null; connection_generation: string };

export async function exchangeGscToken(body: Record<string, string>): Promise<GscCredentials> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new HttpError(503, "Google-koppeling vereist configuratie.");
  let r: Response;
  try {
    r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...body, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET }),
    });
  } catch {
    throw new HttpError(503, "Google is tijdelijk niet bereikbaar. Probeer het later opnieuw.");
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (d.error === "invalid_grant") throw new HttpError(409, "Koppel Google Search Console opnieuw.");
    if (r.status === 429) throw new HttpError(429, "Te veel aanvragen bij Google. Probeer het later opnieuw.");
    throw new HttpError(503, "Google-autorisatie is tijdelijk niet beschikbaar.");
  }
  if (typeof d.access_token !== "string" || !d.access_token || typeof d.expires_in !== "number" || d.expires_in <= 0 || d.expires_in > 86400)
    throw new HttpError(502, "Google-autorisatie kon niet worden gecontroleerd.");
  return {
    access_token: d.access_token,
    expires_in: d.expires_in,
    ...(typeof d.refresh_token === "string" && d.refresh_token ? { refresh_token: d.refresh_token } : {}),
    ...(typeof d.scope === "string" ? { scope: d.scope } : {}),
  };
}

export async function gscConnection(workspaceId: string): Promise<Connection | null> {
  const { data, error } = await adminClient().from("integration_connections").select("*").eq("workspace_id", workspaceId).eq("provider", PROVIDER).maybeSingle();
  if (error) throw new HttpError(503, "De verbinding kon niet worden geladen.");
  return (data as Connection) || null;
}

export function gscStatus(c: Connection | null): "not_connected" | "connected" | "reconnect" | "permission" {
  if (!c || c.status === "disconnected" || !c.encrypted_credentials) return "not_connected";
  if (c.status === "reconnect_required") return "reconnect";
  if (c.status === "permission_missing" || !(c.scopes || []).includes(GSC_SCOPE)) return "permission";
  return c.status === "connected" ? "connected" : "reconnect";
}

async function mark(c: Connection, status: string) {
  if (c.status === status) return;
  await adminClient().from("integration_connections").update({ status }).eq("id", c.id).eq("connection_generation", c.connection_generation).eq("encrypted_credentials", c.encrypted_credentials);
}

async function token(workspaceId: string, rejected?: string): Promise<{ token: GscCredentials; c: Connection }> {
  const c = await gscConnection(workspaceId);
  const status = gscStatus(c);
  if (status === "not_connected") throw new HttpError(409, "Koppel eerst Google Search Console.");
  if (status === "permission") throw new HttpError(403, "Toestemming voor Search Console ontbreekt. Koppel opnieuw.");
  if (status === "reconnect") throw new HttpError(409, "Koppel Google Search Console opnieuw.");
  let t = decrypt<GscCredentials>(c!.encrypted_credentials!, context(workspaceId));
  const expiry = Date.parse(c!.expires_at || "");
  if (Number.isFinite(expiry) && expiry > Date.now() + 60000 && t.access_token !== rejected) return { token: t, c: c! };
  if (!t.refresh_token) {
    await mark(c!, "reconnect_required");
    throw new HttpError(409, "Koppel Google Search Console opnieuw.");
  }
  let fresh: GscCredentials;
  try {
    fresh = await exchangeGscToken({ grant_type: "refresh_token", refresh_token: t.refresh_token });
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) await mark(c!, "reconnect_required");
    throw e;
  }
  t = { ...fresh, refresh_token: fresh.refresh_token || t.refresh_token };
  const { error } = await adminClient()
    .from("integration_connections")
    .update({ encrypted_credentials: encrypt(t, context(workspaceId)), expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString() })
    .eq("id", c!.id)
    .eq("connection_generation", c!.connection_generation);
  if (error) throw new HttpError(503, "De verbinding kon niet worden bijgewerkt.");
  return { token: t, c: c! };
}

async function gsc<T>(workspaceId: string, path: string, init: RequestInit = {}): Promise<T> {
  let { token: t } = await token(workspaceId);
  for (let attempt = 0; attempt < 2; attempt++) {
    let r: Response;
    try {
      r = await fetch(API + path, { ...init, cache: "no-store", signal: AbortSignal.timeout(20000), headers: { ...(init.headers || {}), Authorization: "Bearer " + t.access_token } });
    } catch {
      throw new HttpError(503, "Google Search Console is tijdelijk niet bereikbaar.");
    }
    if (r.status === 401 && attempt === 0) {
      t = (await token(workspaceId, t.access_token)).token;
      continue;
    }
    const d = await r.json().catch(() => ({}));
    if (r.ok) return d as T;
    if (r.status === 401) {
      const c = await gscConnection(workspaceId);
      if (c) await mark(c, "reconnect_required");
      throw new HttpError(409, "Koppel Google Search Console opnieuw.");
    }
    if (r.status === 403) {
      const reason = JSON.stringify(d).toLowerCase();
      if (reason.includes("accessnotconfigured") || reason.includes("service_disabled") || reason.includes("has not been used"))
        throw new HttpError(503, "De Search Console API is nog niet ingeschakeld voor dit Mavix-project.");
      throw new HttpError(403, "Dit Google-account heeft geen toegang tot deze Search Console-property.");
    }
    if (r.status === 429) throw new HttpError(429, "Te veel aanvragen bij Google. Probeer het later opnieuw.");
    if (r.status === 404) throw new HttpError(404, "Deze Search Console-property bestaat niet (meer).");
    throw new HttpError(503, "Google Search Console is tijdelijk niet beschikbaar.");
  }
  throw new HttpError(409, "Koppel Google Search Console opnieuw.");
}

/** Properties the connected account can read (unverified ones are skipped). */
export async function listProperties(workspaceId: string) {
  const d = await gsc<{ siteEntry?: { siteUrl?: string; permissionLevel?: string }[] }>(workspaceId, "/sites");
  return (d.siteEntry || [])
    .filter((s) => typeof s.siteUrl === "string" && s.permissionLevel && s.permissionLevel !== "siteUnverifiedUser")
    .map((s) => ({ siteUrl: s.siteUrl!.slice(0, 300), permission: s.permissionLevel! }));
}

/** Best match for a host: domain property first, then URL-prefix properties. */
export function matchProperty(host: string, properties: { siteUrl: string }[]) {
  const bare = host.toLowerCase().replace(/^www\./, "");
  const domain = properties.find((p) => p.siteUrl.toLowerCase() === "sc-domain:" + bare);
  if (domain) return domain.siteUrl;
  const prefix = properties.find((p) => {
    try {
      return new URL(p.siteUrl).hostname.toLowerCase().replace(/^www\./, "") === bare;
    } catch {
      return false;
    }
  });
  return prefix?.siteUrl || null;
}

type Row = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };
const metrics = (r: Row) => ({
  clicks: Math.round(r.clicks || 0),
  impressions: Math.round(r.impressions || 0),
  ctr: Math.round((r.ctr || 0) * 10000) / 100,
  position: Math.round((r.position || 0) * 10) / 10,
});
const day = (d: Date) => d.toISOString().slice(0, 10);

/** Search performance for the last `days` days with final data (Google lags ~2-3 days). */
export async function searchPerformance(workspaceId: string, property: string, days = 28) {
  const end = new Date(Date.now() - 3 * 86400000);
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  const path = "/sites/" + encodeURIComponent(property) + "/searchAnalytics/query";
  const q = (body: Record<string, unknown>) =>
    gsc<{ rows?: Row[] }>(workspaceId, path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startDate: day(start), endDate: day(end), dataState: "final", ...body }) });
  const [totals, daily, queries, pages] = await Promise.all([q({}), q({ dimensions: ["date"], rowLimit: 100 }), q({ dimensions: ["query"], rowLimit: 20 }), q({ dimensions: ["page"], rowLimit: 20 })]);
  return {
    property,
    range: { start: day(start), end: day(end) },
    totals: totals.rows?.[0] ? metrics(totals.rows[0]) : { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    daily: (daily.rows || []).map((r) => ({ date: String(r.keys?.[0] || ""), ...metrics(r) })),
    queries: (queries.rows || []).map((r) => ({ key: String(r.keys?.[0] || "").slice(0, 200), ...metrics(r) })),
    pages: (pages.rows || []).map((r) => ({ key: String(r.keys?.[0] || "").slice(0, 500), ...metrics(r) })),
  };
}
