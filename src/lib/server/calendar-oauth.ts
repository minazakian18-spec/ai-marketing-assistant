import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { workspace, sameOrigin, limited, failure, HttpError } from "./access";
import { adminClient, appUrl } from "./supabase";
import { hash, encrypt, decrypt } from "./crypto";
import { oauthStateMatches } from "../security";
import {
  CALENDAR_SCOPES,
  exchangeCalendarToken,
  type CalendarCredentials,
} from "./calendar-credentials";
import { calendarStatus, listCalendars, cleanupCalendar } from "./calendar";

const provider = "google_calendar";
const cookieName = "mavix_oauth_google_calendar";
const redirectUri = () =>
  appUrl() + "/api/integrations/google_calendar/callback";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
const json = (value: unknown) => NextResponse.json(value, { headers });
const redirect = (url: string) =>
  new NextResponse(null, {
    status: 303,
    headers: { ...headers, Location: url },
  });

export async function handleCalendarIntegration(
  request: Request,
  action: string,
) {
  try {
    const method = request.method;
    if (method === "POST") sameOrigin(request);
    // GET connect is supported only as a same-origin browser navigation/fetch.
    // Cross-site links must not overwrite an in-progress OAuth state cookie.
    if (
      method === "GET" &&
      action === "connect" &&
      request.headers.get("sec-fetch-site") !== "same-origin"
    )
      sameOrigin(request);
    const auth = await workspace(
      action === "status" || action === "calendars"
        ? undefined
        : ["OWNER", "ADMIN"],
    );
    await limited(
      "calendar-oauth:" + auth.user.id,
      action === "status" || action === "calendars" ? 120 : 10,
    );
    const db = adminClient();
    const query = () =>
      db
        .from("integration_connections")
        .select("*")
        .eq("workspace_id", auth.workspaceId)
        .eq("provider", provider)
        .maybeSingle();

    if (method === "GET" && action === "status")
      return json(await calendarStatus(auth.workspaceId, auth.user.id));
    if (method === "GET" && action === "calendars")
      return json({
        calendars: await listCalendars({
          workspaceId: auth.workspaceId,
          userId: auth.user.id,
        }),
      });

    if (action === "connect" && (method === "GET" || method === "POST")) {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
        throw new HttpError(503, "Google-koppeling vereist configuratie.");
      encrypt({}, auth.workspaceId + ":" + provider); // Validate encryption setup before consent.
      const { error: insertError } = await db
        .from("integration_connections")
        .upsert(
          { workspace_id: auth.workspaceId, provider, status: "disconnected" },
          { onConflict: "workspace_id,provider", ignoreDuplicates: true },
        );
      if (insertError) throw insertError;
      const { data: existing, error } = await query();
      if (error || !existing)
        throw new HttpError(503, "De verbinding kon niet worden geladen.");
      const state = randomBytes(32).toString("base64url"),
        verifier = randomBytes(48).toString("base64url");
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
      (await cookies()).set(cookieName, state, {
        httpOnly: true,
        secure: appUrl().startsWith("https:"),
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      });
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri(),
        response_type: "code",
        scope: CALENDAR_SCOPES.join(" "),
        state,
        access_type: "offline",
        prompt: "consent",
        code_challenge: Buffer.from(hash(verifier), "hex").toString(
          "base64url",
        ),
        code_challenge_method: "S256",
      }).toString();
      return method === "GET"
        ? redirect(url.toString())
        : json({ url: url.toString() });
    }

    if (action === "callback" && method === "GET") {
      const url = new URL(request.url),
        state = url.searchParams.get("state"),
        jar = await cookies();
      if (!oauthStateMatches(state, jar.get(cookieName)?.value))
        throw new HttpError(400, "Ongeldige of verlopen autorisatie.");
      jar.delete(cookieName);
      // DELETE ... RETURNING makes state consumption atomic across server instances.
      const { data: states, error: stateError } = await db
        .from("oauth_states")
        .delete()
        .eq("token_hash", hash(state!))
        .eq("workspace_id", auth.workspaceId)
        .eq("user_id", auth.user.id)
        .eq("provider", provider)
        .gt("expires_at", new Date().toISOString())
        .select();
      if (stateError || states?.length !== 1)
        throw new HttpError(400, "Autorisatie is verlopen of al gebruikt.");
      const pending = states[0];
      if (url.searchParams.has("error"))
        return redirect(appUrl() + "/calendar?calendar_error=denied");
      const code = url.searchParams.get("code");
      if (!code || code.length > 4096)
        throw new HttpError(400, "Toestemming is niet gegeven.");
      const token = await exchangeCalendarToken({
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri(),
        code_verifier: pending.verifier,
      });
      const granted = (token.scope || "").split(" ").filter(Boolean);
      if (
        !CALENDAR_SCOPES.filter((s) => s.startsWith("https:")).every((s) =>
          granted.includes(s),
        )
      )
        return redirect(appUrl() + "/calendar?calendar_error=permission");
      const who = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: "Bearer " + token.access_token },
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!who.ok)
        throw new HttpError(
          502,
          "Google-account kon niet worden gecontroleerd.",
        );
      const account = await who.json();
      if (
        typeof account.sub !== "string" ||
        !account.sub ||
        typeof account.email !== "string" ||
        !account.email ||
        account.email_verified !== true
      )
        throw new HttpError(
          502,
          "Google-account kon niet worden gecontroleerd.",
        );
      const { data: existing, error } = await query();
      if (error) throw error;
      if (
        !existing ||
        existing.connection_generation !== pending.connection_generation
      )
        throw new HttpError(
          409,
          "De verbinding is gewijzigd. Start de koppeling opnieuw.",
        );
      // Google may omit a refresh token on repeat consent. Reuse only for the
      // exact same Google account, never across accounts or after disconnect.
      if (
        !token.refresh_token &&
        existing.provider_account_id === account.sub &&
        existing.encrypted_credentials
      )
        token.refresh_token = decrypt<CalendarCredentials>(
          existing.encrypted_credentials,
          auth.workspaceId + ":" + provider,
        ).refresh_token;
      if (!token.refresh_token)
        return redirect(appUrl() + "/calendar?calendar_error=offline_access");
      const sameAccount =
        existing.provider_account_id === account.sub &&
        existing.connected_user === auth.user.id;
      if (!sameAccount && existing.connected_user)
        await cleanupCalendar(auth.workspaceId, existing.connected_user);
      // Membership may have changed while Google was exchanging the code.
      const currentAuth = await workspace(["OWNER", "ADMIN"]);
      if (
        currentAuth.workspaceId !== auth.workspaceId ||
        currentAuth.user.id !== auth.user.id
      )
        throw new HttpError(403, "Geen toegang tot deze werkruimte.");
      const { data: saved, error: saveError } = await db
        .from("integration_connections")
        .update({
          connected_user: auth.user.id,
          provider_account_id: account.sub,
          display_name: account.email,
          account_email: account.email,
          status: "connected",
          encrypted_credentials: encrypt(
            token,
            auth.workspaceId + ":" + provider,
          ),
          scopes: granted,
          expires_at: new Date(
            Date.now() + token.expires_in * 1000,
          ).toISOString(),
          connection_generation: randomUUID(),
          metadata: sameAccount ? existing.metadata : {},
        })
        .eq("workspace_id", auth.workspaceId)
        .eq("provider", provider)
        .eq("connection_generation", pending.connection_generation)
        .select("id");
      if (saveError) throw saveError;
      if (saved?.length !== 1)
        throw new HttpError(
          409,
          "De verbinding is gewijzigd. Start de koppeling opnieuw.",
        );
      return redirect(appUrl() + "/calendar?connected=1");
    }

    if (action === "disconnect" && method === "POST") {
      const { data: existing, error } = await query();
      if (error) throw error;
      // Stop watch channels while credentials are still available. No Google
      // events are deleted. Local disconnect avoids revoking other Google grants.
      if (existing?.connected_user)
        await cleanupCalendar(auth.workspaceId, existing.connected_user);
      const { error: saveError } = await db
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
      if (saveError) throw saveError;
      const { error: stateError } = await db
        .from("oauth_states")
        .delete()
        .eq("workspace_id", auth.workspaceId)
        .eq("provider", provider);
      if (stateError) throw stateError;
      (await cookies()).delete(cookieName);
      return json({ ok: true });
    }
    throw new HttpError(404, "Niet gevonden.");
  } catch (error) {
    return failure(error);
  }
}
