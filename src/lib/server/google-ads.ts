import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { workspace, sameOrigin, limited, failure, audit, HttpError } from "./access";
import { adminClient, appUrl } from "./supabase";
import { hash, encrypt, decrypt } from "./crypto";
import { oauthStateMatches } from "../security";

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

export async function googleAdsStatus(workspaceId: string) {
  const r = await row(workspaceId);
  const linked = !!r?.encrypted_credentials && r.status !== "disconnected";
  const meta = (r?.metadata || {}) as { customerId?: string };
  return { connected: linked, status: linked ? (r!.status as string) : "disconnected", email: linked ? r!.account_email || null : null, customerId: linked ? meta.customerId || null : null };
}

/** Actions under /api/integrations/google_ads/{status,connect,callback,accounts,select,disconnect}. */
export async function handleGoogleAds(request: Request, action: string) {
  const method = request.method;
  try {
    if (method === "POST") sameOrigin(request);
    const reading = method === "GET" && action === "status";
    const auth = await workspace(reading ? undefined : ["OWNER", "ADMIN"]);
    await limited("google-ads:" + auth.user.id, reading ? 120 : 30);
    if (reading) return NextResponse.json(await googleAdsStatus(auth.workspaceId), { headers });

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
