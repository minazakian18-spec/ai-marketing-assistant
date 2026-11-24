import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { workspace, sameOrigin, limited, failure, audit, HttpError } from "./access";
import { adminClient, appUrl } from "./supabase";
import { hash, encrypt, decrypt } from "./crypto";
import { oauthStateMatches } from "../security";
import { metered } from "./ai-usage";
import { storedProfile } from "./stored-profile";
import { adsAdvice } from "./ads-advice";

// Google Ads ("Koppel Google Ads" on /ads). A separate, optional consent with
// the adwords scope, so the verified Google account consent stays as it is.
// Mavix only reads: it lists the ad accounts the user can access and stores
// the one the user picks. Nothing is created or changed in Google Ads.
//
// Calls to the Google Ads API carry Mavix's developer token when one is set
// (GOOGLE_ADS_DEVELOPER_TOKEN); the API version can be overridden with
// GOOGLE_ADS_API_VERSION.

const PROVIDER = "google_ads";
const SCOPE = "https://www.googleapis.com/auth/adwords";
const COOKIE = "mavix_oauth_google_ads";
type Token = { access_token: string; refresh_token?: string; expires_in: number; scope?: string; obtained_at?: number };
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const redirectUri = () => appUrl() + "/api/integrations/google_ads/callback";
const back = (query: string) => new NextResponse(null, { status: 303, headers: { ...headers, Location: appUrl() + "/ads?" + query } });
const db = () => adminClient();
const ctx = (ws: string) => ws + ":" + PROVIDER;
const apiVersion = () => process.env.GOOGLE_ADS_API_VERSION || "v26";

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
  if (!r.ok) throw new HttpError(d.error === "invalid_grant" ? 409 : 503, d.error === "invalid_grant" ? "Koppel Google Ads opnieuw." : "Google-autorisatie is niet gelukt. Probeer het opnieuw.");
  if (typeof d.access_token !== "string" || typeof d.expires_in !== "number") throw new HttpError(502, "Google-autorisatie kon niet worden gecontroleerd.");
  return { access_token: d.access_token, expires_in: d.expires_in, obtained_at: Date.now(), ...(typeof d.refresh_token === "string" && d.refresh_token ? { refresh_token: d.refresh_token } : {}), ...(typeof d.scope === "string" ? { scope: d.scope } : {}) };
}

async function row(workspaceId: string) {
  const { data, error } = await db().from("integration_connections").select("status,account_email,encrypted_credentials,metadata,scopes").eq("workspace_id", workspaceId).eq("provider", PROVIDER).maybeSingle();
  if (error) throw new HttpError(503, "De Google Ads-koppeling kon niet worden geladen. Is de database bijgewerkt?");
  return data;
}

/** A valid access token, refreshed 5 minutes before it expires. invalid_grant = reconnect. */
async function accessToken(workspaceId: string) {
  const r = await row(workspaceId);
  if (!r?.encrypted_credentials) throw new HttpError(409, "Google Ads is nog niet gekoppeld.");
  const t = decrypt<Token>(r.encrypted_credentials, ctx(workspaceId));
  if ((t.obtained_at || 0) + (t.expires_in - 300) * 1000 > Date.now()) return t.access_token;
  if (!t.refresh_token) throw new HttpError(409, "Koppel Google Ads opnieuw.");
  try {
    const fresh = await exchange({ grant_type: "refresh_token", refresh_token: t.refresh_token });
    await db().from("integration_connections").update({ encrypted_credentials: encrypt({ ...fresh, refresh_token: fresh.refresh_token || t.refresh_token }, ctx(workspaceId)), expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString() }).eq("workspace_id", workspaceId).eq("provider", PROVIDER);
    return fresh.access_token;
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) await db().from("integration_connections").update({ status: "reconnect_required" }).eq("workspace_id", workspaceId).eq("provider", PROVIDER);
    throw e;
  }
}

/** The Google Ads accounts this Google user can open (ids as 123-456-7890). */
async function accessibleAccounts(workspaceId: string) {
  const token = await accessToken(workspaceId);
  const h: Record<string, string> = { Authorization: "Bearer " + token };
  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) h["developer-token"] = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const r = await fetch(`https://googleads.googleapis.com/${apiVersion()}/customers:listAccessibleCustomers`, { headers: h, cache: "no-store", signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!r) throw new HttpError(503, "Google Ads is tijdelijk niet bereikbaar.");
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = JSON.stringify(d);
    console.error(JSON.stringify({ event: "google_ads_accounts_failed", status: r.status, error: msg.slice(0, 300) }));
    if (/DEVELOPER_TOKEN|developer token|not approved|NOT_ALLOWLISTED|PERMISSION/i.test(msg)) throw new HttpError(503, "Mavix wacht nog op toegang tot de Google Ads API. Je koppeling is bewaard; je accounts verschijnen zodra Google de toegang goedkeurt.");
    throw new HttpError(r.status === 401 ? 409 : 502, r.status === 401 ? "Koppel Google Ads opnieuw." : "Je Google Ads-accounts konden niet worden geladen.");
  }
  const names: string[] = Array.isArray(d.resourceNames) ? d.resourceNames : [];
  return names
    .map((n) => n.replace(/^customers\//, ""))
    .filter((id) => /^\d{10}$/.test(id))
    .map((id) => ({ id, label: `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` }));
}


// ---------- Reporting (GAQL, read-only) ----------

/** One GAQL query on the chosen account; all result pages. */
async function gaql(workspaceId: string, customerId: string, query: string) {
  const token = await accessToken(workspaceId);
  const h: Record<string, string> = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) h["developer-token"] = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const rows: Record<string, any>[] = [];
  let pageToken = "";
  for (let i = 0; i < 10; i++) {
    const r = await fetch(`https://googleads.googleapis.com/${apiVersion()}/customers/${customerId}/googleAds:search`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ query, ...(pageToken ? { pageToken } : {}) }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    }).catch(() => null);
    if (!r) throw new HttpError(503, "Google Ads is tijdelijk niet bereikbaar.");
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = JSON.stringify(d);
      console.error(JSON.stringify({ event: "google_ads_query_failed", status: r.status, error: msg.slice(0, 300) }));
      if (r.status === 401) throw new HttpError(409, "Koppel Google Ads opnieuw.");
      if (/USER_PERMISSION_DENIED|CUSTOMER_NOT_ENABLED|NOT_ADS_USER/i.test(msg)) throw new HttpError(403, "Dit Google Ads-account is niet (meer) actief of je hebt er geen toegang toe. Kies een ander account.");
      throw new HttpError(502, "De cijfers uit Google Ads konden niet worden geladen.");
    }
    rows.push(...(d.results || []));
    pageToken = d.nextPageToken || "";
    if (!pageToken) break;
  }
  return rows;
}

const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
type Totals = { cost: number; clicks: number; impressions: number; conversions: number; value: number };
const totalsOf = (m: Record<string, unknown> = {}): Totals => ({
  cost: Number(m.costMicros || 0) / 1e6,
  clicks: Number(m.clicks || 0),
  impressions: Number(m.impressions || 0),
  conversions: Number(m.conversions || 0),
  value: Number(m.conversionsValue || 0),
});
const sum = (list: Totals[]): Totals => list.reduce((a, b) => ({ cost: a.cost + b.cost, clicks: a.clicks + b.clicks, impressions: a.impressions + b.impressions, conversions: a.conversions + b.conversions, value: a.value + b.value }), { cost: 0, clicks: 0, impressions: 0, conversions: 0, value: 0 });

export type AdsReport = Awaited<ReturnType<typeof adsReport>>;

/** Last 30 days (until yesterday) next to the 30 days before, weekly trend, campaigns and search terms. */
async function adsReport(workspaceId: string, customerId: string) {
  const now = `segments.date BETWEEN '${day(30)}' AND '${day(1)}'`;
  const before = `segments.date BETWEEN '${day(60)}' AND '${day(31)}'`;
  const m = "metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value";
  const [info, cur, prev, weeks, campaigns, terms] = await Promise.all([
    gaql(workspaceId, customerId, "SELECT customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1"),
    gaql(workspaceId, customerId, `SELECT ${m} FROM customer WHERE ${now}`),
    gaql(workspaceId, customerId, `SELECT ${m} FROM customer WHERE ${before}`),
    gaql(workspaceId, customerId, `SELECT segments.week, ${m} FROM customer WHERE segments.date BETWEEN '${day(84)}' AND '${day(1)}'`),
    gaql(workspaceId, customerId, `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign_budget.amount_micros, ${m} FROM campaign WHERE ${now} AND campaign.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 50`),
    // Search terms only exist for search campaigns; an account without them just returns none.
    gaql(workspaceId, customerId, `SELECT search_term_view.search_term, ${m} FROM search_term_view WHERE ${now} ORDER BY metrics.clicks DESC LIMIT 25`).catch(() => []),
  ]);
  const c = info[0]?.customer || {};
  const byWeek = new Map<string, Totals[]>();
  for (const r of weeks) {
    const w = String(r.segments?.week || "");
    if (w) byWeek.set(w, [...(byWeek.get(w) || []), totalsOf(r.metrics)]);
  }
  return {
    account: { id: customerId, name: String(c.descriptiveName || ""), currency: String(c.currencyCode || "EUR"), timeZone: String(c.timeZone || "") },
    period: { from: day(30), to: day(1), previousFrom: day(60), previousTo: day(31) },
    current: sum(cur.map((r) => totalsOf(r.metrics))),
    previous: sum(prev.map((r) => totalsOf(r.metrics))),
    weeks: [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, list]) => ({ week, ...sum(list) })),
    campaigns: campaigns.map((r) => ({
      id: String(r.campaign?.id || ""),
      name: String(r.campaign?.name || "Campagne"),
      status: String(r.campaign?.status || ""),
      type: String(r.campaign?.advertisingChannelType || ""),
      dailyBudget: Number(r.campaignBudget?.amountMicros || 0) / 1e6,
      ...totalsOf(r.metrics),
    })),
    searchTerms: terms.map((r) => ({ term: String(r.searchTermView?.searchTerm || ""), ...totalsOf(r.metrics) })).filter((t) => t.term),
  };
}

export async function googleAdsStatus(workspaceId: string) {
  const r = await row(workspaceId);
  const linked = !!r?.encrypted_credentials && r.status !== "disconnected";
  const meta = (r?.metadata || {}) as { customerId?: string };
  return { connected: linked, status: linked ? (r!.status as string) : "disconnected", email: linked ? r!.account_email || null : null, customerId: linked ? meta.customerId || null : null };
}

/** Actions under /api/integrations/google_ads/{status,connect,callback,accounts,select,report,advice,disconnect}. */
export async function handleGoogleAds(request: Request, action: string) {
  const method = request.method;
  try {
    if (method === "POST") sameOrigin(request);
    const reading = method === "GET" && (action === "status" || action === "report");
    const auth = await workspace(reading ? undefined : ["OWNER", "ADMIN"]);
    await limited("google-ads:" + auth.user.id, reading ? 120 : 30);
    if (action === "status") return NextResponse.json(await googleAdsStatus(auth.workspaceId), { headers });
    if (action === "report" && method === "GET") {
      const st = await googleAdsStatus(auth.workspaceId);
      if (st.status !== "connected" || !st.customerId) throw new HttpError(409, "Google Ads is nog niet gekoppeld.");
      return NextResponse.json(await adsReport(auth.workspaceId, st.customerId), { headers });
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
      if (!oauthStateMatches(state, jar.get(COOKIE)?.value)) return back("ads=expired");
      jar.delete(COOKIE);
      const { data: states, error: stateError } = await db().from("oauth_states").delete().eq("token_hash", hash(state!)).eq("workspace_id", auth.workspaceId).eq("user_id", auth.user.id).eq("provider", PROVIDER).gt("expires_at", new Date().toISOString()).select();
      if (stateError || states?.length !== 1) return back("ads=expired");
      if (url.searchParams.has("error")) return back("ads=denied");
      const code = url.searchParams.get("code");
      if (!code || code.length > 4096) return back("ads=denied");
      const token = await exchange({ code, grant_type: "authorization_code", redirect_uri: redirectUri(), code_verifier: (states[0] as { verifier: string }).verifier });
      const granted = (token.scope || "").split(" ").filter(Boolean);
      if (!granted.includes(SCOPE)) return back("ads=permission");
      if (!token.refresh_token) return back("ads=offline");
      const who = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: "Bearer " + token.access_token }, cache: "no-store", signal: AbortSignal.timeout(15000) }).catch(() => null);
      const account = who?.ok ? await who.json().catch(() => ({})) : {};
      if (typeof account.sub !== "string" || typeof account.email !== "string") return back("ads=failed");
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
      if (error) return back("ads=database");
      await audit(auth.workspaceId, auth.user.id, "integration_authorized");
      return back("ads=connected");
    }

    if (action === "accounts" && method === "GET") return NextResponse.json({ accounts: await accessibleAccounts(auth.workspaceId) }, { headers });

    if (action === "select" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const id = String(body.customerId || "").replace(/-/g, "");
      if (!/^\d{10}$/.test(id)) throw new HttpError(400, "Kies een geldig Google Ads-account.");
      const accounts = await accessibleAccounts(auth.workspaceId);
      if (!accounts.some((a) => a.id === id)) throw new HttpError(403, "Dit account hoort niet bij je Google-login.");
      const { error } = await db().from("integration_connections").update({ status: "connected", metadata: { customerId: id } }).eq("workspace_id", auth.workspaceId).eq("provider", PROVIDER);
      if (error) throw error;
      return NextResponse.json(await googleAdsStatus(auth.workspaceId), { headers });
    }

    // AI proposals from the real numbers plus the Brand Hub. Drafts only:
    // Mavix never changes a campaign.
    if (action === "advice" && method === "POST") {
      const st = await googleAdsStatus(auth.workspaceId);
      if (st.status !== "connected" || !st.customerId) throw new HttpError(409, "Google Ads is nog niet gekoppeld.");
      const report = await adsReport(auth.workspaceId, st.customerId);
      const profile = await storedProfile(auth.workspaceId);
      const advice = await metered(auth, "content_campaign", () => adsAdvice(report, profile, new Date().toISOString().slice(0, 10)), request.headers.get("idempotency-key"));
      return NextResponse.json({ advice, period: report.period }, { headers });
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
    if (action === "callback" && method === "GET" && !(e instanceof HttpError && e.status === 401)) return back("ads=failed");
    return failure(e);
  }
}
