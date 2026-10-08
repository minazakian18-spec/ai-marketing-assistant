import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, sameOrigin, limited, failure, audit, HttpError } from "./access";
import { adminClient, appUrl } from "./supabase";
import { hash, encrypt, decrypt } from "./crypto";
import { oauthStateMatches } from "../security";
import {
  ApiAccessError,
  GBP_MANAGE,
  GBP_SCOPES,
  businessConnection,
  exchangeBusinessToken,
  listBusinessLocations,
  saveLocation,
  verifiedLocation,
  type BusinessCredentials,
} from "./google-business";

// Integration actions for Google Business Profile (provider google_business):
// connect, callback, status, locations, select and disconnect. One connection
// powers both the profile and Google Reviews.

const provider = "google_business";
const cookieName = "mavix_oauth_google_business";
const redirectUri = () => appUrl() + "/api/integrations/google_business/callback";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const json = (value: unknown) => NextResponse.json(value, { headers });
const back = (query: string) =>
  new NextResponse(null, { status: 303, headers: { ...headers, Location: appUrl() + "/account/integraties?" + query } });
const selection = z.object({ account: z.string().max(60), location: z.string().max(60) }).strict();

export async function handleBusinessIntegration(request: Request, action: string) {
  const method = request.method;
  try {
    if (method === "POST") sameOrigin(request);
    const reading = method === "GET" && action === "status";
    const auth = await workspace(reading ? undefined : ["OWNER", "ADMIN"]);
    await limited("gbp-oauth:" + auth.user.id, reading ? 120 : 20);
    const db = adminClient();
    const query = () => db.from("integration_connections").select("*").eq("workspace_id", auth.workspaceId).eq("provider", provider).maybeSingle();

    // ---------- status (any member; no tokens, no Google call)
    if (reading) {
      const { data: c, error } = await query();
      if (error) throw new HttpError(503, "De verbinding kon niet worden geladen.");
      const m = (c?.metadata || {}) as { location?: string; locationTitle?: string; locationAddress?: string };
      let status = !c || c.status === "disconnected" ? "disconnected" : (c.status as string);
      if (status === "connected" && !c?.encrypted_credentials) status = "reconnect_required";
      if (status === "connected" && !(c?.scopes || []).includes(GBP_MANAGE)) status = "permission_missing";
      if (status === "connected" && !m.location) status = "selection_required";
      return json({
        status,
        connected: status === "connected",
        accountEmail: status === "disconnected" ? null : c?.account_email || null,
        location: m.location ? { name: m.locationTitle || "", address: m.locationAddress || "" } : null,
      });
    }

    // ---------- connect
    if (action === "connect" && method === "POST") {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new HttpError(503, "Google-koppeling vereist configuratie.");
      encrypt({}, auth.workspaceId + ":" + provider); // Validate encryption setup before consent.
      const { error: insertError } = await db
        .from("integration_connections")
        .upsert({ workspace_id: auth.workspaceId, provider, status: "disconnected" }, { onConflict: "workspace_id,provider", ignoreDuplicates: true });
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
        scope: GBP_SCOPES.join(" "),
        state,
        access_type: "offline",
        prompt: "consent",
        code_challenge: Buffer.from(hash(verifier), "hex").toString("base64url"),
        code_challenge_method: "S256",
      }).toString();
      return json({ url: url.toString() });
    }

    // ---------- callback
    if (action === "callback" && method === "GET") {
      const url = new URL(request.url);
      const state = url.searchParams.get("state");
      const jar = await cookies();
      if (!oauthStateMatches(state, jar.get(cookieName)?.value)) return back("error=expired&provider=" + provider);
      jar.delete(cookieName);
      // DELETE ... RETURNING: consume the state exactly once across instances.
      const { data: states, error: stateError } = await db
        .from("oauth_states")
        .delete()
        .eq("token_hash", hash(state!))
        .eq("workspace_id", auth.workspaceId)
        .eq("user_id", auth.user.id)
        .eq("provider", provider)
        .gt("expires_at", new Date().toISOString())
        .select();
      if (stateError || states?.length !== 1) return back("error=expired&provider=" + provider);
      const pending = states[0] as { verifier: string; connection_generation: string };
      if (url.searchParams.has("error")) return back("error=denied&provider=" + provider);
      const code = url.searchParams.get("code");
      if (!code || code.length > 4096) return back("error=denied&provider=" + provider);
      const token = await exchangeBusinessToken({ code, grant_type: "authorization_code", redirect_uri: redirectUri(), code_verifier: pending.verifier });
      const granted = (token.scope || "").split(" ").filter(Boolean);
      if (!granted.includes(GBP_MANAGE)) return back("error=permission&provider=" + provider);
      const who = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: "Bearer " + token.access_token },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }).catch(() => null);
      const account = who?.ok ? await who.json().catch(() => ({})) : {};
      if (typeof account.sub !== "string" || !account.sub || typeof account.email !== "string" || account.email_verified !== true)
        return back("error=failed&provider=" + provider);
      const { data: existing, error } = await query();
      if (error) throw error;
      if (!existing || existing.connection_generation !== pending.connection_generation) return back("error=expired&provider=" + provider);
      const sameAccount = existing.provider_account_id === account.sub;
      // Google may omit the refresh token on repeat consent: reuse only for the same Google account.
      if (!token.refresh_token && sameAccount && existing.encrypted_credentials)
        token.refresh_token = decrypt<BusinessCredentials>(existing.encrypted_credentials, auth.workspaceId + ":" + provider).refresh_token;
      if (!token.refresh_token) return back("error=offline_access&provider=" + provider);
      // Membership may have changed while Google was exchanging the code.
      const current = await workspace(["OWNER", "ADMIN"]);
      if (current.workspaceId !== auth.workspaceId || current.user.id !== auth.user.id) throw new HttpError(403, "Geen toegang tot deze werkruimte.");
      const generation = randomUUID();
      const metadata = sameAccount ? existing.metadata || {} : {};
      const { data: saved, error: saveError } = await db
        .from("integration_connections")
        .update({
          connected_user: auth.user.id,
          provider_account_id: account.sub,
          account_email: account.email,
          display_name: sameAccount ? existing.display_name : null,
          status: "selection_required",
          encrypted_credentials: encrypt(token, auth.workspaceId + ":" + provider),
          scopes: granted,
          expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
          connection_generation: generation,
          metadata,
        })
        .eq("workspace_id", auth.workspaceId)
        .eq("provider", provider)
        .eq("connection_generation", pending.connection_generation)
        .select("id");
      if (saveError) throw saveError;
      if (saved?.length !== 1) return back("error=expired&provider=" + provider);
      await audit(auth.workspaceId, auth.user.id, "integration_authorized");

      // Discover locations: one usable location is selected automatically, an
      // earlier choice is kept when Google still returns it.
      const conn = { id: saved[0].id as string, connection_generation: generation, metadata };
      try {
        const locations = await listBusinessLocations(auth.workspaceId);
        const previous = locations.find((l) => l.location === (metadata as { location?: string }).location);
        const usable = locations.filter((l) => !l.closed);
        const pick = previous || (usable.length === 1 ? usable[0] : locations.length === 1 ? locations[0] : null);
        if (pick) {
          await saveLocation(auth.workspaceId, conn, pick);
          return back("connected=" + provider);
        }
        if (sameAccount && (metadata as { location?: string }).location)
          await db.from("integration_connections").update({ metadata: {}, display_name: null }).eq("id", conn.id).eq("connection_generation", generation);
        return back((locations.length ? "select=" : "error=no_locations&provider=") + provider);
      } catch (e) {
        if (e instanceof ApiAccessError) return back("error=api_access&provider=" + provider);
        // Temporary Google trouble: the account is linked; the location can be chosen later.
        return back("select=" + provider);
      }
    }

    // ---------- locations (live from Google, never trusted from the browser)
    if (action === "locations" && method === "GET") {
      await businessConnection(auth.workspaceId);
      return json({ locations: await listBusinessLocations(auth.workspaceId) });
    }

    // ---------- select
    if (action === "select" && method === "POST") {
      const input = selection.parse(await request.json());
      const c = await businessConnection(auth.workspaceId);
      const location = await verifiedLocation(auth.workspaceId, input.account, input.location);
      const fresh = await businessConnection(auth.workspaceId);
      if (fresh.connection_generation !== c.connection_generation) throw new HttpError(409, "De koppeling is gewijzigd. Probeer opnieuw.");
      await saveLocation(auth.workspaceId, fresh, location);
      await audit(auth.workspaceId, auth.user.id, "integration_connected");
      return json({ ok: true, location: { name: location.title, address: location.address } });
    }

    // ---------- disconnect (nothing at Google is deleted)
    if (action === "disconnect" && method === "POST") {
      const { error } = await db
        .from("integration_connections")
        .update({
          status: "disconnected",
          encrypted_credentials: null,
          expires_at: null,
          scopes: [],
          metadata: {},
          account_email: null,
          display_name: null,
          provider_account_id: null,
          connected_user: null,
          connection_generation: randomUUID(),
        })
        .eq("workspace_id", auth.workspaceId)
        .eq("provider", provider);
      if (error) throw error;
      const { error: stateError } = await db.from("oauth_states").delete().eq("workspace_id", auth.workspaceId).eq("provider", provider);
      if (stateError) throw stateError;
      (await cookies()).delete(cookieName);
      await audit(auth.workspaceId, auth.user.id, "integration_disconnected");
      return json({ ok: true });
    }
    throw new HttpError(404, "Niet gevonden.");
  } catch (e) {
    if (e instanceof z.ZodError || e instanceof SyntaxError) return failure(new HttpError(400, "Ongeldige bedrijfslocatie."));
    if (action === "callback" && method === "GET" && !(e instanceof HttpError && e.status === 401))
      return back("error=failed&provider=" + provider);
    return failure(e);
  }
}
