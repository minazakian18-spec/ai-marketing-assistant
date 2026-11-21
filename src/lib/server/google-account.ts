import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { workspace, sameOrigin, limited, failure, audit, HttpError } from "./access";
import { adminClient, appUrl } from "./supabase";
import { hash, encrypt, decrypt } from "./crypto";
import { oauthStateMatches } from "../security";
import { checkBusinessConnection } from "./google-business";
import { cleanupCalendar } from "./calendar";

// One Google account for all of Mavix ("Koppel Google"): one consent screen
// with the minimal scopes Google verifies, one token, one disconnect.
//
// The token is stored per service in the existing rows (gmail,
// google_calendar, google_business, google_search_console), each encrypted
// with its own context, so every service keeps its own refresh, status and
// settings and the database needs no new provider value. Every row gets the
// same account and the same grant; disconnecting revokes that grant at Google
// and clears all four rows.

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

export type GoogleService = "gmail" | "google_calendar" | "google_business" | "google_search_console";
export const SERVICES: { provider: GoogleService; scope: string; label: string; purpose: string; href: string }[] = [
  { provider: "google_business", scope: "https://www.googleapis.com/auth/business.manage", label: "Bedrijfsprofiel en reviews", purpose: "Reviews lezen en jouw antwoorden plaatsen", href: "/reviews" },
  { provider: "google_calendar", scope: "https://www.googleapis.com/auth/calendar.events", label: "Google Agenda", purpose: "Je marketingplanning in je agenda zetten", href: "/calendar" },
  { provider: "google_search_console", scope: "https://www.googleapis.com/auth/webmasters.readonly", label: "Search Console", purpose: "Klikken en zoekwoorden van je website tonen", href: "/seo" },
  { provider: "gmail", scope: "https://www.googleapis.com/auth/gmail.send", label: "Gmail (versturen)", purpose: "E-mails versturen vanaf je eigen adres", href: "/account/integraties" },
];

type Token = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
const PROVIDER = "google";
const COOKIE = "mavix_oauth_google";
const redirectUri = () => appUrl() + "/api/integrations/google/callback";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const back = (query: string) => new NextResponse(null, { status: 303, headers: { ...headers, Location: appUrl() + "/account/integraties?" + query } });
const db = () => adminClient();
const providers = SERVICES.map((s) => s.provider);

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
  if (!r.ok) throw new HttpError(d.error === "invalid_grant" ? 409 : 503, "Google-autorisatie is niet gelukt. Probeer het opnieuw.");
  if (typeof d.access_token !== "string" || typeof d.expires_in !== "number" || d.expires_in <= 0 || d.expires_in > 86400) throw new HttpError(502, "Google-autorisatie kon niet worden gecontroleerd.");
  return { access_token: d.access_token, expires_in: d.expires_in, ...(typeof d.refresh_token === "string" && d.refresh_token ? { refresh_token: d.refresh_token } : {}), ...(typeof d.scope === "string" ? { scope: d.scope } : {}) };
}

/** The refresh token Mavix already holds for this workspace and Google account (any service row). */
async function storedRefreshToken(workspaceId: string, sub?: string) {
  const { data } = await db().from("integration_connections").select("provider,provider_account_id,encrypted_credentials").eq("workspace_id", workspaceId).in("provider", providers);
  for (const row of data || []) {
    if (!row.encrypted_credentials || (sub && row.provider_account_id !== sub)) continue;
    try {
      const t = decrypt<Token>(row.encrypted_credentials, workspaceId + ":" + row.provider);
      if (t.refresh_token) return t.refresh_token;
    } catch {
      /* other key or broken: skip */
    }
  }
  return undefined;
}

/** Revokes the grant at Google (all services at once). Failures never block disconnecting in Mavix. */
async function revoke(token: string) {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
}

/** Per service: connected or not, and what the next step is. Never tokens. */
export async function googleStatus(workspaceId: string) {
  const { data, error } = await db().from("integration_connections").select("provider,status,scopes,account_email,encrypted_credentials,metadata").eq("workspace_id", workspaceId).in("provider", providers);
  if (error) throw new HttpError(503, "De Google-koppeling kon niet worden geladen.");
  const rows = data || [];
  const email = rows.find((r) => r.account_email && r.encrypted_credentials)?.account_email || null;
  const services = SERVICES.map((s) => {
    const row = rows.find((r) => r.provider === s.provider);
    const linked = !!row?.encrypted_credentials && row.status !== "disconnected";
    const granted = linked && ((row?.scopes as string[]) || []).includes(s.scope);
    return { provider: s.provider, label: s.label, purpose: s.purpose, href: s.href, status: !linked ? "disconnected" : !granted ? "permission_missing" : (row!.status as string), granted };
  });
  return { connected: services.some((s) => s.status !== "disconnected"), email, services };
}

/** Actions under /api/integrations/google/{connect,callback,status,disconnect}. */
export async function handleGoogleAccount(request: Request, action: string) {
  const method = request.method;
  try {
    if (method === "POST") sameOrigin(request);
    const reading = method === "GET" && action === "status";
    const auth = await workspace(reading ? undefined : ["OWNER", "ADMIN"]);
    await limited("google-account:" + auth.user.id, reading ? 120 : 20);

    if (reading) return NextResponse.json(await googleStatus(auth.workspaceId), { headers });

    // ---------- connect: one consent screen for every Mavix service
    if (action === "connect" && method === "POST") {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new HttpError(503, "Google-koppeling vereist configuratie.");
      encrypt({}, auth.workspaceId + ":gmail"); // the encryption key must work before consent
      const state = randomBytes(32).toString("base64url");
      const verifier = randomBytes(48).toString("base64url");
      const { error } = await db().from("oauth_states").insert({ token_hash: hash(state), workspace_id: auth.workspaceId, user_id: auth.user.id, provider: PROVIDER, verifier, expires_at: new Date(Date.now() + 600000).toISOString() });
      if (error) throw error;
      (await cookies()).set(COOKIE, state, { httpOnly: true, secure: appUrl().startsWith("https:"), sameSite: "lax", path: "/", maxAge: 600 });
      // Consent (and a new refresh token) only when Mavix holds none yet.
      const first = !(await storedRefreshToken(auth.workspaceId));
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri(),
        response_type: "code",
        scope: GOOGLE_SCOPES.join(" "),
        state,
        access_type: "offline",
        include_granted_scopes: "true",
        prompt: first ? "consent" : "select_account",
        code_challenge: Buffer.from(hash(verifier), "hex").toString("base64url"),
        code_challenge_method: "S256",
      }).toString();
      return NextResponse.json({ url: url.toString() }, { headers });
    }

    // ---------- callback: store the grant for every service it covers
    if (action === "callback" && method === "GET") {
      const url = new URL(request.url);
      const state = url.searchParams.get("state");
      const jar = await cookies();
      if (!oauthStateMatches(state, jar.get(COOKIE)?.value)) return back("error=expired&provider=google");
      jar.delete(COOKIE);
      const { data: states, error: stateError } = await db().from("oauth_states").delete().eq("token_hash", hash(state!)).eq("workspace_id", auth.workspaceId).eq("user_id", auth.user.id).eq("provider", PROVIDER).gt("expires_at", new Date().toISOString()).select();
      if (stateError || states?.length !== 1) return back("error=expired&provider=google");
      if (url.searchParams.has("error")) return back("error=denied&provider=google");
      const code = url.searchParams.get("code");
      if (!code || code.length > 4096) return back("error=denied&provider=google");
      const token = await exchange({ code, grant_type: "authorization_code", redirect_uri: redirectUri(), code_verifier: (states[0] as { verifier: string }).verifier });
      const granted = (token.scope || "").split(" ").filter(Boolean);
      const who = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: "Bearer " + token.access_token }, cache: "no-store", signal: AbortSignal.timeout(15000) }).catch(() => null);
      const account = who?.ok ? await who.json().catch(() => ({})) : {};
      if (typeof account.sub !== "string" || !account.sub || typeof account.email !== "string" || account.email_verified !== true) return back("error=failed&provider=google");
      // Google may leave out the refresh token on repeat consent: reuse ours for the same account.
      if (!token.refresh_token) token.refresh_token = await storedRefreshToken(auth.workspaceId, account.sub);
      if (!token.refresh_token) return back("error=offline_access&provider=google");
      const current = await workspace(["OWNER", "ADMIN"]);
      if (current.workspaceId !== auth.workspaceId || current.user.id !== auth.user.id) throw new HttpError(403, "Geen toegang tot deze werkruimte.");

      const covered = SERVICES.filter((s) => granted.includes(s.scope));
      if (!covered.length) return back("error=permission&provider=google");
      const { data: existing } = await db().from("integration_connections").select("provider,provider_account_id,connected_user,metadata").eq("workspace_id", auth.workspaceId).in("provider", providers);
      const expires = new Date(Date.now() + token.expires_in * 1000).toISOString();
      for (const s of covered) {
        const old = (existing || []).find((r) => r.provider === s.provider);
        const sameAccount = old?.provider_account_id === account.sub;
        if (s.provider === "google_calendar" && old?.connected_user && !sameAccount) await cleanupCalendar(auth.workspaceId, old.connected_user as string).catch(() => {});
        const { error } = await db()
          .from("integration_connections")
          .upsert(
            {
              workspace_id: auth.workspaceId,
              provider: s.provider,
              connected_user: auth.user.id,
              provider_account_id: account.sub,
              account_email: account.email,
              display_name: s.provider === "google_business" && sameAccount ? undefined : account.email,
              status: s.provider === "google_business" ? "selection_required" : "connected",
              encrypted_credentials: encrypt(token, auth.workspaceId + ":" + s.provider),
              scopes: granted,
              expires_at: expires,
              connection_generation: randomUUID(),
              metadata: sameAccount ? old?.metadata || {} : {},
            },
            { onConflict: "workspace_id,provider" },
          );
        if (error) throw error;
      }
      await audit(auth.workspaceId, auth.user.id, "integration_authorized");
      // Business Profile: find the location and prove reviews load (keeps an earlier choice).
      if (covered.some((s) => s.provider === "google_business")) await checkBusinessConnection(auth.workspaceId).catch(() => null);
      return back("connected=google");
    }

    // ---------- disconnect: revoke at Google, clear every service
    if (action === "disconnect" && method === "POST") {
      const { data: rows } = await db().from("integration_connections").select("provider,encrypted_credentials,connected_user").eq("workspace_id", auth.workspaceId).in("provider", providers);
      const refresh = await storedRefreshToken(auth.workspaceId);
      if (refresh) await revoke(refresh);
      const calendarUser = (rows || []).find((r) => r.provider === "google_calendar")?.connected_user as string | undefined;
      if (calendarUser) await cleanupCalendar(auth.workspaceId, calendarUser).catch(() => {});
      const { error } = await db()
        .from("integration_connections")
        .update({ status: "disconnected", encrypted_credentials: null, expires_at: null, scopes: [], metadata: {}, account_email: null, display_name: null, provider_account_id: null, connected_user: null, connection_generation: randomUUID() })
        .eq("workspace_id", auth.workspaceId)
        .in("provider", providers);
      if (error) throw error;
      await db().from("oauth_states").delete().eq("workspace_id", auth.workspaceId).in("provider", [PROVIDER, ...providers]);
      await db().from("inbox_sync_state").delete().eq("workspace_id", auth.workspaceId).eq("provider", "gmail");
      await audit(auth.workspaceId, auth.user.id, "integration_disconnected");
      return NextResponse.json({ ok: true }, { headers });
    }
    throw new HttpError(404, "Niet gevonden.");
  } catch (e) {
    if (action === "callback" && method === "GET" && !(e instanceof HttpError && e.status === 401)) return back("error=failed&provider=google");
    return failure(e);
  }
}
