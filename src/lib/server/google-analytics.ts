import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { workspace, sameOrigin, limited, failure, audit, HttpError } from "./access";
import { adminClient, appUrl } from "./supabase";
import { hash, encrypt, decrypt } from "./crypto";
import { oauthStateMatches } from "../security";

// Google Analytics 4 ("Koppel Google Analytics" on /inzichten). A separate,
// optional consent with the analytics.readonly scope. Mavix only reads: it
// lists the GA4 properties the user can open, stores the one the user picks
// and reads visitor reports (Data API). Nothing is changed in Analytics.

const PROVIDER = "google_analytics";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const COOKIE = "mavix_oauth_google_analytics";
type Token = { access_token: string; refresh_token?: string; expires_in: number; scope?: string; obtained_at?: number };
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const redirectUri = () => appUrl() + "/api/integrations/google_analytics/callback";
const back = (query: string) => new NextResponse(null, { status: 303, headers: { ...headers, Location: appUrl() + "/inzichten?" + query } });
const db = () => adminClient();
const ctx = (ws: string) => ws + ":" + PROVIDER;

async function exchange(body: Record<string, string>): Promise<Token> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new HttpError(503, "Google-koppeling vereist configuratie.");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET }),
  }).catch(() => null);
  if (!r) throw new HttpError(503, "Google is tijdelijk niet bereikbaar. Probeer het later opnieuw.");
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(d.error === "invalid_grant" ? 409 : 503, d.error === "invalid_grant" ? "Koppel Google Analytics opnieuw." : "Google-autorisatie is niet gelukt. Probeer het opnieuw.");
  if (typeof d.access_token !== "string" || typeof d.expires_in !== "number") throw new HttpError(502, "Google-autorisatie kon niet worden gecontroleerd.");
  return { access_token: d.access_token, expires_in: d.expires_in, obtained_at: Date.now(), ...(typeof d.refresh_token === "string" && d.refresh_token ? { refresh_token: d.refresh_token } : {}), ...(typeof d.scope === "string" ? { scope: d.scope } : {}) };
}

async function row(workspaceId: string) {
  const { data, error } = await db().from("integration_connections").select("status,account_email,encrypted_credentials,metadata,scopes").eq("workspace_id", workspaceId).eq("provider", PROVIDER).maybeSingle();
  if (error) throw new HttpError(503, "De Google Analytics-koppeling kon niet worden geladen. Is de database bijgewerkt?");
  return data;
}

/** A valid access token, refreshed 5 minutes before it expires. invalid_grant = reconnect. */
async function accessToken(workspaceId: string) {
  const r = await row(workspaceId);
  if (!r?.encrypted_credentials) throw new HttpError(409, "Google Analytics is nog niet gekoppeld.");
  const t = decrypt<Token>(r.encrypted_credentials, ctx(workspaceId));
  if ((t.obtained_at || 0) + (t.expires_in - 300) * 1000 > Date.now()) return t.access_token;
  if (!t.refresh_token) throw new HttpError(409, "Koppel Google Analytics opnieuw.");
  try {
    const fresh = await exchange({ grant_type: "refresh_token", refresh_token: t.refresh_token });
    await db().from("integration_connections").update({ encrypted_credentials: encrypt({ ...fresh, refresh_token: fresh.refresh_token || t.refresh_token }, ctx(workspaceId)), expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString() }).eq("workspace_id", workspaceId).eq("provider", PROVIDER);
    return fresh.access_token;
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) await db().from("integration_connections").update({ status: "reconnect_required" }).eq("workspace_id", workspaceId).eq("provider", PROVIDER);
    throw e;
  }
}

/** Calls a Google Analytics API with the stored token; maps errors to plain Dutch. */
async function gaFetch(workspaceId: string, url: string, body?: object) {
  const token = await accessToken(workspaceId);
  const r = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer " + token, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);
  if (!r) throw new HttpError(503, "Google Analytics is tijdelijk niet bereikbaar.");
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error(JSON.stringify({ event: "google_analytics_failed", status: r.status, error: JSON.stringify(d).slice(0, 300) }));
    if (r.status === 401) throw new HttpError(409, "Koppel Google Analytics opnieuw.");
    if (/SERVICE_DISABLED|has not been used|is disabled/i.test(JSON.stringify(d))) throw new HttpError(503, "Mavix wacht nog op toegang tot Google Analytics. Je koppeling is bewaard.");
    throw new HttpError(502, "Google Analytics kon niet worden geladen.");
  }
  return d;
}

/** The GA4 properties this Google user can open. */
async function properties(workspaceId: string) {
  const out: { id: string; label: string }[] = [];
  let page = "";
  for (let i = 0; i < 5; i++) {
    const d = await gaFetch(workspaceId, "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200" + (page ? "&pageToken=" + encodeURIComponent(page) : ""));
    for (const a of d.accountSummaries || [])
      for (const p of a.propertySummaries || []) {
        const id = String(p.property || "").replace(/^properties\//, "");
        if (/^\d{1,20}$/.test(id)) out.push({ id, label: `${p.displayName || id} (${a.displayName || "account"})` });
      }
    page = d.nextPageToken || "";
    if (!page) break;
  }
  return out;
}

const num = (v: unknown) => Number((v as { value?: string } | undefined)?.value || 0);
type Row = { dimensionValues: { value: string }[]; metricValues: { value: string }[] };

/** Visitors of the last 28 days (and the 28 before), per week, per channel and top pages. */
async function report(workspaceId: string, propertyId: string) {
  const base = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const range = [{ startDate: "28daysAgo", endDate: "yesterday" }];
  const [totals, weeks, channels, pages] = await Promise.all([
    gaFetch(workspaceId, base, { dateRanges: [...range, { startDate: "56daysAgo", endDate: "29daysAgo" }], metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "newUsers" }, { name: "keyEvents" }] }),
    gaFetch(workspaceId, base, { dateRanges: range, dimensions: [{ name: "isoYearIsoWeek" }], metrics: [{ name: "activeUsers" }, { name: "sessions" }], orderBys: [{ dimension: { dimensionName: "isoYearIsoWeek" } }] }),
    gaFetch(workspaceId, base, { dateRanges: range, dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 8 }),
    gaFetch(workspaceId, base, { dateRanges: range, dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }], orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 8 }),
  ]);
  // With two date ranges GA adds a dateRange dimension: date_range_0 = now, date_range_1 = before.
  const rows = (totals.rows || []) as Row[];
  const pick = (name: string) => rows.find((r) => r.dimensionValues?.[0]?.value === name)?.metricValues || [];
  const now = pick("date_range_0"), before = pick("date_range_1");
  const metric = (i: number) => ({ value: num(now[i]), previous: num(before[i]) });
  return {
    users: metric(0),
    sessions: metric(1),
    newUsers: metric(2),
    keyEvents: metric(3),
    weeks: ((weeks.rows || []) as Row[]).map((r) => ({ week: r.dimensionValues[0].value, users: num(r.metricValues[0]), sessions: num(r.metricValues[1]) })),
    channels: ((channels.rows || []) as Row[]).map((r) => ({ name: r.dimensionValues[0].value, sessions: num(r.metricValues[0]) })),
    pages: ((pages.rows || []) as Row[]).map((r) => ({ path: r.dimensionValues[0].value, views: num(r.metricValues[0]) })),
  };
}

export async function googleAnalyticsStatus(workspaceId: string) {
  const r = await row(workspaceId);
  const linked = !!r?.encrypted_credentials && r.status !== "disconnected";
  const meta = (r?.metadata || {}) as { propertyId?: string; propertyName?: string };
  return { connected: linked, status: linked ? (r!.status as string) : "disconnected", email: linked ? r!.account_email || null : null, propertyId: linked ? meta.propertyId || null : null, propertyName: linked ? meta.propertyName || null : null };
}

/** Actions under /api/integrations/google_analytics/{status,connect,callback,properties,select,report,disconnect}. */
export async function handleGoogleAnalytics(request: Request, action: string) {
  const method = request.method;
  try {
    if (method === "POST") sameOrigin(request);
    const reading = method === "GET" && (action === "status" || action === "report");
    const auth = await workspace(reading ? undefined : ["OWNER", "ADMIN"]);
    await limited("google-analytics:" + auth.user.id, reading ? 120 : 30);
    if (action === "status") return NextResponse.json(await googleAnalyticsStatus(auth.workspaceId), { headers });
    if (action === "report" && method === "GET") {
      const st = await googleAnalyticsStatus(auth.workspaceId);
      if (st.status !== "connected" || !st.propertyId) throw new HttpError(409, "Google Analytics is nog niet gekoppeld.");
      return NextResponse.json(await report(auth.workspaceId, st.propertyId), { headers });
    }

    if (action === "connect" && method === "POST") {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new HttpError(503, "Google-koppeling vereist configuratie.");
      encrypt({}, ctx(auth.workspaceId));
      const state = randomBytes(32).toString("base64url");
      const verifier = randomBytes(48).toString("base64url");
      const { error } = await db().from("oauth_states").insert({ token_hash: hash(state), workspace_id: auth.workspaceId, user_id: auth.user.id, provider: PROVIDER, verifier, expires_at: new Date(Date.now() + 600000).toISOString() });
      if (error) throw error;
      (await cookies()).set(COOKIE, state, { httpOnly: true, secure: appUrl().startsWith("https:"), sameSite: "lax", path: "/", maxAge: 600 });
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri(),
        response_type: "code",
        scope: ["openid", "email", SCOPE].join(" "),
        state,
        access_type: "offline",
        include_granted_scopes: "true",
        prompt: "consent",
        code_challenge: Buffer.from(hash(verifier), "hex").toString("base64url"),
        code_challenge_method: "S256",
      }).toString();
      return NextResponse.json({ url: url.toString() }, { headers });
    }

    if (action === "callback" && method === "GET") {
      const url = new URL(request.url);
      const state = url.searchParams.get("state");
      const jar = await cookies();
      if (!oauthStateMatches(state, jar.get(COOKIE)?.value)) return back("ga=expired");
      jar.delete(COOKIE);
      const { data: states, error: stateError } = await db().from("oauth_states").delete().eq("token_hash", hash(state!)).eq("workspace_id", auth.workspaceId).eq("user_id", auth.user.id).eq("provider", PROVIDER).gt("expires_at", new Date().toISOString()).select();
      if (stateError || states?.length !== 1) return back("ga=expired");
      if (url.searchParams.has("error")) return back("ga=denied");
      const code = url.searchParams.get("code");
      if (!code || code.length > 4096) return back("ga=denied");
      const token = await exchange({ code, grant_type: "authorization_code", redirect_uri: redirectUri(), code_verifier: (states[0] as { verifier: string }).verifier });
      const granted = (token.scope || "").split(" ").filter(Boolean);
      if (!granted.includes(SCOPE)) return back("ga=permission");
      if (!token.refresh_token) return back("ga=offline");
      const who = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: "Bearer " + token.access_token }, cache: "no-store", signal: AbortSignal.timeout(15000) }).catch(() => null);
      const account = who?.ok ? await who.json().catch(() => ({})) : {};
      if (typeof account.sub !== "string" || typeof account.email !== "string") return back("ga=failed");
      const { error } = await db()
        .from("integration_connections")
        .upsert(
          {
            workspace_id: auth.workspaceId,
            provider: PROVIDER,
            connected_user: auth.user.id,
            provider_account_id: account.sub,
            account_email: account.email,
            display_name: account.email,
            status: "selection_required",
            encrypted_credentials: encrypt(token, ctx(auth.workspaceId)),
            scopes: granted,
            expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
            connection_generation: randomUUID(),
            metadata: {},
          },
          { onConflict: "workspace_id,provider" },
        );
      if (error) return back("ga=database");
      await audit(auth.workspaceId, auth.user.id, "integration_authorized");
      return back("ga=connected");
    }

    if (action === "properties" && method === "GET") return NextResponse.json({ properties: await properties(auth.workspaceId) }, { headers });

    if (action === "select" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const id = String(body.propertyId || "");
      if (!/^\d{1,20}$/.test(id)) throw new HttpError(400, "Kies een geldige Analytics-property.");
      const match = (await properties(auth.workspaceId)).find((p) => p.id === id);
      if (!match) throw new HttpError(403, "Deze property hoort niet bij je Google-login.");
      const { error } = await db().from("integration_connections").update({ status: "connected", metadata: { propertyId: id, propertyName: match.label } }).eq("workspace_id", auth.workspaceId).eq("provider", PROVIDER);
      if (error) throw error;
      return NextResponse.json(await googleAnalyticsStatus(auth.workspaceId), { headers });
    }

    if (action === "disconnect" && method === "POST") {
      const r = await row(auth.workspaceId);
      if (r?.encrypted_credentials) {
        try {
          const t = decrypt<Token>(r.encrypted_credentials, ctx(auth.workspaceId));
          await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: t.refresh_token || t.access_token }), cache: "no-store", signal: AbortSignal.timeout(10000) }).catch(() => null);
        } catch {
          /* unreadable token: clearing is enough */
        }
      }
      await db().from("integration_connections").update({ status: "disconnected", encrypted_credentials: null, expires_at: null, scopes: [], metadata: {}, account_email: null, display_name: null, provider_account_id: null, connected_user: null, connection_generation: randomUUID() }).eq("workspace_id", auth.workspaceId).eq("provider", PROVIDER);
      await audit(auth.workspaceId, auth.user.id, "integration_disconnected");
      return NextResponse.json({ ok: true }, { headers });
    }
    throw new HttpError(404, "Niet gevonden.");
  } catch (e) {
    if (action === "callback" && method === "GET" && !(e instanceof HttpError && e.status === 401)) return back("ga=failed");
    return failure(e);
  }
}
