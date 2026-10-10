import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { workspace, sameOrigin, limited, failure, audit, HttpError } from "./access";
import { adminClient, appUrl } from "./supabase";
import { hash, encrypt, decrypt } from "./crypto";
import { oauthStateMatches } from "../security";
import { GSC_SCOPE, GSC_SCOPES, exchangeGscToken, gscConnection, gscStatus, type GscCredentials } from "./search-console";

// Integration actions for Google Search Console (provider
// google_search_console): status, connect, callback, disconnect. The callback
// returns to the SEO page. Read-only access; nothing in Search Console changes.

const provider = "google_search_console";
const cookieName = "mavix_oauth_google_search_console";
const redirectUri = () => appUrl() + "/api/integrations/google_search_console/callback";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const back = (query: string) => new NextResponse(null, { status: 303, headers: { ...headers, Location: appUrl() + "/seo?" + query } });

export async function handleSearchConsoleIntegration(request: Request, action: string) {
  const method = request.method;
  try {
    if (method === "POST") sameOrigin(request);
    const reading = method === "GET" && action === "status";
    const auth = await workspace(reading ? undefined : ["OWNER", "ADMIN"]);
    await limited("gsc-oauth:" + auth.user.id, reading ? 120 : 20);
    const db = adminClient();
    const query = () => db.from("integration_connections").select("*").eq("workspace_id", auth.workspaceId).eq("provider", provider).maybeSingle();

    if (reading) {
      // Same shape as the other Google status endpoints (Integraties cards).
      const c = await gscConnection(auth.workspaceId);
      const s = gscStatus(c);
      const status = s === "not_connected" ? "disconnected" : s === "connected" ? "connected" : s === "permission" ? "permission_missing" : "reconnect_required";
      return NextResponse.json({ status, connected: s === "connected", accountEmail: s === "not_connected" ? null : (c as { account_email?: string } | null)?.account_email || null }, { headers });
    }

    if (action === "connect" && method === "POST") {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new HttpError(503, "Google-koppeling vereist configuratie.");
      encrypt({}, auth.workspaceId + ":" + provider);
      const { error: insertError } = await db.from("integration_connections").upsert({ workspace_id: auth.workspaceId, provider, status: "disconnected" }, { onConflict: "workspace_id,provider", ignoreDuplicates: true });
      if (insertError) throw insertError;
      const { data: existing, error } = await query();
      if (error || !existing) throw new HttpError(503, "De verbinding kon niet worden geladen.");
      const state = randomBytes(32).toString("base64url");
      const verifier = randomBytes(48).toString("base64url");
      const { error: stateError } = await db.from("oauth_states").insert({
        token_hash: hash(state),
        workspace_id: auth.workspaceId,
        user_id: auth.user.id,
        provider,
        verifier,
        connection_generation: existing.connection_generation,
        expires_at: new Date(Date.now() + 600000).toISOString(),
      });
      if (stateError) throw stateError;
      (await cookies()).set(cookieName, state, { httpOnly: true, secure: appUrl().startsWith("https:"), sameSite: "lax", path: "/", maxAge: 600 });
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri(),
        response_type: "code",
        scope: GSC_SCOPES.join(" "),
        state,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "false",
        code_challenge: Buffer.from(hash(verifier), "hex").toString("base64url"),
        code_challenge_method: "S256",
      }).toString();
      return NextResponse.json({ url: url.toString() }, { headers });
    }

    if (action === "callback" && method === "GET") {
      const url = new URL(request.url);
      const state = url.searchParams.get("state");
      const jar = await cookies();
      if (!oauthStateMatches(state, jar.get(cookieName)?.value)) return back("gsc=expired");
      jar.delete(cookieName);
      const { data: states, error: stateError } = await db
        .from("oauth_states")
        .delete()
        .eq("token_hash", hash(state!))
        .eq("workspace_id", auth.workspaceId)
        .eq("user_id", auth.user.id)
        .eq("provider", provider)
        .gt("expires_at", new Date().toISOString())
        .select();
      if (stateError || states?.length !== 1) return back("gsc=expired");
      const pending = states[0] as { verifier: string; connection_generation: string };
      if (url.searchParams.has("error")) return back("gsc=denied");
      const code = url.searchParams.get("code");
      if (!code || code.length > 4096) return back("gsc=denied");
      const token = await exchangeGscToken({ code, grant_type: "authorization_code", redirect_uri: redirectUri(), code_verifier: pending.verifier });
      const granted = (token.scope || "").split(" ").filter(Boolean);
      if (!granted.includes(GSC_SCOPE)) return back("gsc=permission");
      const who = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: "Bearer " + token.access_token }, cache: "no-store", signal: AbortSignal.timeout(15000) }).catch(() => null);
      const account = who?.ok ? await who.json().catch(() => ({})) : {};
      if (typeof account.sub !== "string" || !account.sub || typeof account.email !== "string" || account.email_verified !== true) return back("gsc=failed");
      const { data: existing, error } = await query();
      if (error) throw error;
      if (!existing || existing.connection_generation !== pending.connection_generation) return back("gsc=expired");
      const sameAccount = existing.provider_account_id === account.sub;
      if (!token.refresh_token && sameAccount && existing.encrypted_credentials)
        token.refresh_token = decrypt<GscCredentials>(existing.encrypted_credentials, auth.workspaceId + ":" + provider).refresh_token;
      if (!token.refresh_token) return back("gsc=offline_access");
      const current = await workspace(["OWNER", "ADMIN"]);
      if (current.workspaceId !== auth.workspaceId || current.user.id !== auth.user.id) throw new HttpError(403, "Geen toegang tot deze werkruimte.");
      const { data: saved, error: saveError } = await db
        .from("integration_connections")
        .update({
          connected_user: auth.user.id,
          provider_account_id: account.sub,
          account_email: account.email,
          display_name: account.email,
          status: "connected",
          encrypted_credentials: encrypt(token, auth.workspaceId + ":" + provider),
          scopes: granted,
          expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
          connection_generation: randomUUID(),
          metadata: {},
        })
        .eq("workspace_id", auth.workspaceId)
        .eq("provider", provider)
        .eq("connection_generation", pending.connection_generation)
        .select("id");
      if (saveError) throw saveError;
      if (saved?.length !== 1) return back("gsc=expired");
      await audit(auth.workspaceId, auth.user.id, "integration_authorized");
      return back("gsc=connected");
    }

    // Disconnect: credentials removed; nothing at Google changes. Chosen
    // properties on SEO websites are cleared too.
    if (action === "disconnect" && method === "POST") {
      const { error } = await db
        .from("integration_connections")
        .update({ status: "disconnected", encrypted_credentials: null, expires_at: null, scopes: [], metadata: {}, account_email: null, display_name: null, provider_account_id: null, connected_user: null, connection_generation: randomUUID() })
        .eq("workspace_id", auth.workspaceId)
        .eq("provider", provider);
      if (error) throw error;
      await db.from("oauth_states").delete().eq("workspace_id", auth.workspaceId).eq("provider", provider);
      await db.from("seo_sites").update({ gsc_property: null }).eq("workspace_id", auth.workspaceId);
      (await cookies()).delete(cookieName);
      await audit(auth.workspaceId, auth.user.id, "integration_disconnected");
      return NextResponse.json({ ok: true }, { headers });
    }
    throw new HttpError(404, "Niet gevonden.");
  } catch (e) {
    if (action === "callback" && method === "GET" && !(e instanceof HttpError && e.status === 401)) return back("gsc=failed");
    return failure(e);
  }
}
