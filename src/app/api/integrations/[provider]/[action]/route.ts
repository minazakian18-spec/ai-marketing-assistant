import { handleCalendarIntegration } from "@/lib/server/calendar-oauth";
import { handleBusinessIntegration } from "@/lib/server/google-business-oauth";
import { oauthStateMatches } from "@/lib/security";
import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  workspace,
  sameOrigin,
  limited,
  audit,
  failure,
  HttpError,
} from "@/lib/server/access";
import { adminClient, appUrl } from "@/lib/server/supabase";
import { hash, encrypt, decrypt } from "@/lib/server/crypto";
import {
  scopes,
  callback,
  googleToken,
  sendTestEmail,
  type Provider,
} from "@/lib/server/integrations";
import { cleanupCalendar } from "@/lib/server/calendar";
import {
  authorizeUrl,
  completeInstagram,
  completeInstagramFacebook,
  completeMessenger,
  INSTAGRAM_TAKEN,
  instagramMode,
  InstagramTokenTypeError,
  listInstagramAccounts,
  listPages,
  selectInstagramAccount,
  metaConfigured,
  metaScopes,
  missingMetaConfig,
  selectPage,
  subscribeWhatsApp,
  verifyWhatsAppNumber,
  type MetaCredentials,
} from "@/lib/server/meta";
import {
  exchangeGmailToken,
  type GmailCredentials,
} from "@/lib/server/gmail-credentials";
const testEmailInput = z.object({
  to: z.string().email().max(254),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});
const whatsappInput = z.object({
  phoneNumberId: z.string().regex(/^\d{5,30}$/),
  wabaId: z.string().regex(/^\d{5,30}$/),
  token: z
    .string()
    .min(20)
    .max(1000)
    .regex(/^[\w.\-|]+$/),
});
const WHATSAPP_TAKEN =
  "Dit WhatsApp-nummer is al gekoppeld aan een andere Mavix-werkruimte. Ontkoppel het daar eerst.";
const PROVIDERS = [
  "google_business",
  "gmail",
  "instagram",
  "google_calendar",
  "messenger",
  "whatsapp",
];
const GOOGLE = ["google_business", "gmail", "google_calendar"];

type Context = { params: Promise<{ provider: string; action: string }> };
const back = (query: string) =>
  NextResponse.redirect(new URL("/account/integraties?" + query, appUrl()));
async function newState(provider: string, workspaceId: string, userId: string) {
  let generation: string | undefined;
  if (provider === "gmail") {
    encrypt({}, workspaceId + ":gmail");
    const db = adminClient();
    const { error: insertError } = await db
      .from("integration_connections")
      .upsert(
        { workspace_id: workspaceId, provider, status: "disconnected" },
        { onConflict: "workspace_id,provider", ignoreDuplicates: true },
      );
    if (insertError) throw insertError;
    const { data, error } = await db
      .from("integration_connections")
      .select("connection_generation")
      .eq("workspace_id", workspaceId)
      .eq("provider", provider)
      .single();
    if (error || !data)
      throw new HttpError(503, "De verbinding kon niet worden geladen.");
    generation = data.connection_generation;
  }
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url");
  const { error } = await adminClient()
    .from("oauth_states")
    .insert({
      token_hash: hash(state),
      workspace_id: workspaceId,
      user_id: userId,
      provider,
      verifier,
      ...(generation ? { connection_generation: generation } : {}),
      expires_at: new Date(Date.now() + 600000).toISOString(),
    });
  if (error) throw error;
  (await cookies()).set("mavix_oauth_" + provider, state, {
    httpOnly: true,
    secure: appUrl().startsWith("https:"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return { state, verifier };
}
export async function POST(request: Request, { params }: Context) {
  try {
    const route = await params;
    if (
      route.provider === "google_calendar" ||
      route.provider === "google-calendar"
    )
      return handleCalendarIntegration(request, route.action);
    if (route.provider === "google_business")
      return handleBusinessIntegration(request, route.action);
    sameOrigin(request);
    if (!PROVIDERS.includes(route.provider))
      throw new HttpError(404, "Niet gevonden.");
    const provider = route.provider as Provider | "messenger" | "whatsapp",
      action = route.action;
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("oauth:" + auth.user.id, 10);
    const db = adminClient();
    if (action === "connect") {
      if (provider === "instagram" || provider === "messenger") {
        if (!metaConfigured(provider)) {
          console.error(
            JSON.stringify({
              event: "meta_not_configured",
              provider,
              missing: missingMetaConfig(provider),
            }),
          );
          throw new HttpError(
            503,
            (provider === "instagram" ? "Instagram" : "Messenger") +
              "-koppeling vereist nog Meta-appconfiguratie.",
          );
        }
        const { state } = await newState(
          provider,
          auth.workspaceId,
          auth.user.id,
        );
        return NextResponse.json({ url: authorizeUrl(provider, state) });
      }
      if (provider === "whatsapp") {
        const missing = missingMetaConfig("whatsapp");
        if (missing.length) {
          // Variable names only, never values.
          console.error(
            JSON.stringify({ event: "whatsapp_not_configured", missing }),
          );
          throw new HttpError(
            503,
            "WhatsApp kan nog niet worden gekoppeld: de Meta-configuratie van Mavix is nog niet compleet. Neem contact op met de beheerder.",
          );
        }
        await limited("whatsapp-connect:" + auth.workspaceId, 5);
        const input = whatsappInput.parse(await request.json());
        const number = await verifyWhatsAppNumber(input);
        // One WhatsApp number belongs to one workspace: its webhooks are
        // routed by phone number id. The unique index in
        // 202610080001_whatsapp_unique_number.sql enforces this under races.
        const { data: taken, error: takenError } = await db
          .from("integration_connections")
          .select("workspace_id")
          .eq("provider", "whatsapp")
          .eq("provider_account_id", input.phoneNumberId)
          .neq("workspace_id", auth.workspaceId)
          .neq("status", "disconnected")
          .limit(1);
        if (takenError) throw takenError;
        if (taken?.length) throw new HttpError(409, WHATSAPP_TAKEN);
        await subscribeWhatsApp(input);
        const { error } = await db.from("integration_connections").upsert(
          {
            workspace_id: auth.workspaceId,
            provider: "whatsapp",
            connected_user: auth.user.id,
            provider_account_id: input.phoneNumberId,
            display_name:
              number.display + (number.phone ? " (" + number.phone + ")" : ""),
            status: "connected",
            encrypted_credentials: encrypt(
              { access_token: input.token, obtained_at: Date.now() },
              auth.workspaceId + ":whatsapp",
            ),
            scopes: [
              "whatsapp_business_messaging",
              "whatsapp_business_management",
            ],
            expires_at: null,
            metadata: { wabaId: input.wabaId },
          },
          { onConflict: "workspace_id,provider" },
        );
        if (error?.code === "23505") throw new HttpError(409, WHATSAPP_TAKEN);
        if (error) throw error;
        await audit(auth.workspaceId, auth.user.id, "integration_connected");
        return NextResponse.json({ ok: true });
      }
      if (
        !process.env.GOOGLE_CLIENT_ID ||
        !process.env.GOOGLE_CLIENT_SECRET ||
        !process.env.OAUTH_ENCRYPTION_KEY
      )
        throw new HttpError(503, "Google-koppeling vereist configuratie.");
      const { state, verifier } = await newState(
        provider,
        auth.workspaceId,
        auth.user.id,
      );
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: callback(provider as Provider),
        response_type: "code",
        scope: scopes[provider as Provider].join(" "),
        state,
        access_type: "offline",
        prompt: "consent",
        code_challenge: Buffer.from(hash(verifier), "hex").toString(
          "base64url",
        ),
        code_challenge_method: "S256",
      }).toString();
      return NextResponse.json({ url: url.toString() });
    }
    if (action === "disconnect" && provider === "gmail") {
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
        .eq("provider", "gmail");
      if (error) throw error;
      const { error: stateError } = await db
        .from("oauth_states")
        .delete()
        .eq("workspace_id", auth.workspaceId)
        .eq("provider", "gmail");
      if (stateError) throw stateError;
      // Stop synchronisation: drop the history cursor and any sync lease.
      // Cached Inbox conversations are hidden (see inbox.ts); Gmail itself,
      // Google Calendar and Google sign-in are untouched.
      const { error: syncError } = await db
        .from("inbox_sync_state")
        .delete()
        .eq("workspace_id", auth.workspaceId)
        .eq("provider", "gmail");
      if (syncError) throw syncError;
      (await cookies()).delete("mavix_oauth_gmail");
      await audit(auth.workspaceId, auth.user.id, "integration_disconnected");
      return NextResponse.json(
        { ok: true },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (action === "disconnect") {
      if (provider === "google_calendar") {
        const { data: existing } = await db
          .from("integration_connections")
          .select("connected_user")
          .eq("workspace_id", auth.workspaceId)
          .eq("provider", provider)
          .maybeSingle();
        if (existing?.connected_user)
          await cleanupCalendar(
            auth.workspaceId,
            existing.connected_user,
          ).catch(() => {});
      }
      const { error } = await db
        .from("integration_connections")
        .update({
          status: "disconnected",
          encrypted_credentials: null,
          metadata: {},
          expires_at: null,
        })
        .eq("workspace_id", auth.workspaceId)
        .eq("provider", provider);
      if (error) throw error;
      await audit(auth.workspaceId, auth.user.id, "integration_disconnected");
      return NextResponse.json({ ok: true });
    }
    if (action === "select" && provider === "instagram") {
      const { account } = z
        .object({ account: z.string().regex(/^\d{1,30}$/) })
        .parse(await request.json());
      await selectInstagramAccount(auth.workspaceId, account);
      await audit(auth.workspaceId, auth.user.id, "integration_connected");
      return NextResponse.json({ ok: true });
    }
    if (action === "select" && provider === "messenger") {
      const { page } = z
        .object({ page: z.string().regex(/^\d{1,30}$/) })
        .parse(await request.json());
      await selectPage(auth.workspaceId, page);
      await audit(auth.workspaceId, auth.user.id, "integration_connected");
      return NextResponse.json({ ok: true });
    }
    if (action === "send" && provider === "gmail") {
      await limited("gmail-send:" + auth.workspaceId, 20);
      const input = testEmailInput.parse(await request.json());
      const result = await sendTestEmail(
        auth.workspaceId,
        input.to,
        input.subject,
        input.body,
      );
      await audit(auth.workspaceId, auth.user.id, "test_email_sent");
      return NextResponse.json({ id: result.id, status: "sent" });
    }
    throw new HttpError(404, "Niet gevonden.");
  } catch (e) {
    if (e instanceof z.ZodError)
      return failure(new HttpError(400, "Controleer de ingevoerde gegevens."));
    return failure(e);
  }
}
async function consumeState(
  provider: string,
  url: URL,
  auth: { workspaceId: string; user: { id: string } },
) {
  const state = url.searchParams.get("state"),
    jar = await cookies();
  if (!oauthStateMatches(state, jar.get("mavix_oauth_" + provider)?.value))
    throw new HttpError(400, "Ongeldige of verlopen autorisatie.");
  jar.delete("mavix_oauth_" + provider);
  const { data: rows, error } = await adminClient()
    .from("oauth_states")
    .delete()
    .eq("token_hash", hash(state!))
    .eq("user_id", auth.user.id)
    .eq("workspace_id", auth.workspaceId)
    .eq("provider", provider)
    .gt("expires_at", new Date().toISOString())
    .select();
  if (error || rows?.length !== 1)
    throw new HttpError(400, "Autorisatie is verlopen of al gebruikt.");
  return rows[0] as { verifier: string; connection_generation?: string };
}
export async function GET(request: Request, { params }: Context) {
  let gmailCallback = false;
  try {
    const route = await params;
    gmailCallback = route.provider === "gmail" && route.action === "callback";
    if (
      route.provider === "google_calendar" ||
      route.provider === "google-calendar"
    )
      return handleCalendarIntegration(request, route.action);
    if (route.provider === "google_business")
      return handleBusinessIntegration(request, route.action);
    if (!PROVIDERS.includes(route.provider))
      throw new HttpError(404, "Niet gevonden.");
    const provider = route.provider as Provider | "messenger" | "whatsapp",
      action = route.action;
    const auth = await workspace(
      action === "status" && provider === "gmail"
        ? undefined
        : ["OWNER", "ADMIN"],
    );
    const db = adminClient();
    if (action === "status" && provider === "gmail") {
      const { data: c, error } = await db
        .from("integration_connections")
        .select(
          "status,account_email,display_name,scopes,encrypted_credentials,last_synced_at",
        )
        .eq("workspace_id", auth.workspaceId)
        .eq("provider", "gmail")
        .maybeSingle();
      if (error) throw error;
      const status =
        c?.status === "connected" &&
        !scopes.gmail
          .filter((s) => s.startsWith("https:"))
          .every((s) => c.scopes?.includes(s))
          ? "permission_missing"
          : c?.status || "disconnected";
      return NextResponse.json(
        {
          connected: status === "connected" && !!c?.encrypted_credentials,
          accountEmail: c?.account_email || c?.display_name || null,
          status,
          lastSyncedAt: c?.last_synced_at || null,
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (action === "pages" && provider === "messenger") {
      const { data: c } = await db
        .from("integration_connections")
        .select("encrypted_credentials")
        .eq("workspace_id", auth.workspaceId)
        .eq("provider", "messenger")
        .maybeSingle();
      if (!c?.encrypted_credentials)
        throw new HttpError(409, "Verbind eerst Facebook.");
      const creds = decrypt<MetaCredentials>(
        c.encrypted_credentials,
        auth.workspaceId + ":messenger",
      );
      if (!creds.user_token)
        throw new HttpError(
          409,
          "Verbind Facebook opnieuw om een andere pagina te kiezen.",
        );
      return NextResponse.json({
        pages: (await listPages(creds.user_token)).map((p) => ({
          id: p.id,
          name: p.name,
        })),
      });
    }
    if (action === "accounts" && provider === "instagram") {
      const { data: c } = await db
        .from("integration_connections")
        .select("encrypted_credentials,metadata")
        .eq("workspace_id", auth.workspaceId)
        .eq("provider", "instagram")
        .maybeSingle();
      if (!c?.encrypted_credentials || c.metadata?.authMode !== "facebook")
        throw new HttpError(409, "Verbind eerst Instagram via Facebook.");
      const creds = decrypt<MetaCredentials>(
        c.encrypted_credentials,
        auth.workspaceId + ":instagram",
      );
      if (!creds.user_token)
        throw new HttpError(
          409,
          "Verbind Instagram opnieuw om een ander account te kiezen.",
        );
      // Never return Page tokens to the browser.
      return NextResponse.json(
        {
          accounts: (await listInstagramAccounts(creds.user_token)).map(
            (a) => ({
              id: a.id,
              username: a.username,
              name: a.name,
              pageName: a.pageName,
            }),
          ),
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (action !== "callback") throw new HttpError(404, "Niet gevonden.");
    const url = new URL(request.url);
    if (provider === "instagram" || provider === "messenger") {
      if (url.searchParams.get("error")) {
        await consumeState(provider, url, auth).catch(() => {});
        return back("error=denied&provider=" + provider);
      }
      await consumeState(provider, url, auth);
      const code = url.searchParams.get("code");
      if (!code) return back("error=denied&provider=" + provider);
      try {
        if (provider === "instagram" && instagramMode() === "facebook") {
          const fb = await completeInstagramFacebook(code);
          const accounts = await listInstagramAccounts(fb.userToken);
          // Nothing usable: keep whatever this workspace had before.
          if (!accounts.length)
            return back("error=no_instagram_account&provider=instagram");
          const { error } = await db.from("integration_connections").upsert(
            {
              workspace_id: auth.workspaceId,
              provider,
              connected_user: auth.user.id,
              provider_account_id: null,
              display_name: null,
              status: "selection_required",
              encrypted_credentials: encrypt(
                {
                  access_token: fb.userToken,
                  user_token: fb.userToken,
                  obtained_at: Date.now(),
                },
                auth.workspaceId + ":instagram",
              ),
              scopes: fb.granted,
              expires_at: fb.dataAccessExpiresAt,
              metadata: { authMode: "facebook" },
            },
            { onConflict: "workspace_id,provider" },
          );
          if (error) throw error;
          await audit(auth.workspaceId, auth.user.id, "integration_authorized");
          if (accounts.length > 1) return back("select=instagram");
          await selectInstagramAccount(auth.workspaceId, accounts[0].id);
          return back("connected=instagram");
        }
        if (provider === "instagram") {
          const ig = await completeInstagram(code);
          const { error } = await db.from("integration_connections").upsert(
            {
              workspace_id: auth.workspaceId,
              provider,
              connected_user: auth.user.id,
              provider_account_id: ig.accountId,
              display_name: ig.name,
              status: "connected",
              encrypted_credentials: encrypt(
                { access_token: ig.token, obtained_at: Date.now() },
                auth.workspaceId + ":instagram",
              ),
              scopes: ig.granted,
              expires_at: new Date(
                Date.now() + ig.expiresIn * 1000,
              ).toISOString(),
              metadata: {},
            },
            { onConflict: "workspace_id,provider" },
          );
          if (error?.code === "23505") throw new HttpError(409, INSTAGRAM_TAKEN);
          if (error) throw error;
          await audit(auth.workspaceId, auth.user.id, "integration_authorized");
          return back("connected=instagram");
        }
        const fb = await completeMessenger(code);
        const { error } = await db.from("integration_connections").upsert(
          {
            workspace_id: auth.workspaceId,
            provider,
            connected_user: auth.user.id,
            provider_account_id: null,
            display_name: fb.userName,
            status: "selection_required",
            encrypted_credentials: encrypt(
              {
                access_token: fb.userToken,
                user_token: fb.userToken,
                obtained_at: Date.now(),
              },
              auth.workspaceId + ":messenger",
            ),
            scopes: fb.granted.filter((s: string) =>
              metaScopes.messenger.includes(s),
            ),
            expires_at: null,
            metadata: {},
          },
          { onConflict: "workspace_id,provider" },
        );
        if (error) throw error;
        await audit(auth.workspaceId, auth.user.id, "integration_authorized");
        const pages = await listPages(fb.userToken);
        if (pages.length === 1) {
          await selectPage(auth.workspaceId, pages[0].id);
          return back("connected=messenger");
        }
        return back(
          pages.length
            ? "select=messenger"
            : "error=no_pages&provider=messenger",
        );
      } catch (e) {
        if (e instanceof InstagramTokenTypeError) {
          // Configuration issued e.g. a System-user token: refuse, store nothing.
          console.error(
            JSON.stringify({
              event: "instagram_config_token_type",
              tokenType: e.tokenType.slice(0, 40),
            }),
          );
          return back("error=token_type&provider=instagram");
        }
        if (e instanceof HttpError && e.status === 403)
          return back("error=permission&provider=" + provider);
        if (provider === "instagram" && e instanceof HttpError) {
          if (e.status === 409 && e.message === INSTAGRAM_TAKEN)
            return back("error=instagram_taken&provider=instagram");
          return back(
            (e.status === 400 && e.message.includes("verlopen")
              ? "error=expired"
              : "error=failed") + "&provider=instagram",
          );
        }
        throw e;
      }
    }
    if (!GOOGLE.includes(provider)) throw new HttpError(404, "Niet gevonden.");
    const { verifier, connection_generation } = await consumeState(
      provider,
      url,
      auth,
    );
    if (url.searchParams.has("error"))
      return back("error=denied&provider=" + provider);
    const code = url.searchParams.get("code");
    if (!code) throw new HttpError(400, "Toestemming is niet gegeven.");
    const token = await (
      provider === "gmail" ? exchangeGmailToken : googleToken
    )({
      code,
      grant_type: "authorization_code",
      redirect_uri: callback(provider as Provider),
      code_verifier: verifier,
    });
    const granted = (token.scope || "").split(" ");
    const missing = scopes[provider as Provider].filter(
      (s) =>
        s.startsWith("https://www.googleapis.com/auth/") &&
        !granted.includes(s),
    );
    if (missing.length) {
      if (provider === "google_calendar")
        return NextResponse.redirect(
          new URL("/calendar?calendar_error=permission", appUrl()),
        );
      if (provider === "gmail")
        return back("error=permission&provider=gmail");
      throw new HttpError(403, "Benodigde toestemming ontbreekt.");
    }
    const who = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: "Bearer " + token.access_token },
        cache: "no-store",
      },
    );
    if (!who.ok)
      throw new HttpError(502, "Google-account kon niet worden gecontroleerd.");
    const account = await who.json();
    if (provider === "gmail") {
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
      const { data: existing, error } = await db
        .from("integration_connections")
        .select("*")
        .eq("workspace_id", auth.workspaceId)
        .eq("provider", "gmail")
        .maybeSingle();
      if (error) throw error;
      if (
        !existing ||
        !connection_generation ||
        existing.connection_generation !== connection_generation
      )
        throw new HttpError(
          409,
          "De verbinding is gewijzigd. Start de koppeling opnieuw.",
        );
      if (
        !token.refresh_token &&
        existing.provider_account_id === account.sub &&
        existing.encrypted_credentials
      )
        token.refresh_token = decrypt<GmailCredentials>(
          existing.encrypted_credentials,
          auth.workspaceId + ":gmail",
        ).refresh_token;
      if (!token.refresh_token)
        return back("error=offline_access&provider=gmail");
      const current = await workspace(["OWNER", "ADMIN"]);
      if (
        current.workspaceId !== auth.workspaceId ||
        current.user.id !== auth.user.id
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
          encrypted_credentials: encrypt(token, auth.workspaceId + ":gmail"),
          scopes: granted,
          expires_at: new Date(
            Date.now() + (token.expires_in || 3600) * 1000,
          ).toISOString(),
          metadata: {},
          connection_generation: randomUUID(),
        })
        .eq("workspace_id", auth.workspaceId)
        .eq("provider", "gmail")
        .eq("connection_generation", connection_generation)
        .select("id");
      if (saveError) throw saveError;
      if (saved?.length !== 1)
        throw new HttpError(
          409,
          "De verbinding is gewijzigd. Start de koppeling opnieuw.",
        );
      await audit(auth.workspaceId, auth.user.id, "integration_authorized");
      return back("connected=gmail");
    }
    let metadata: Record<string, unknown> = {};
    if (provider === "google_calendar") {
      const { data: existing } = await db
        .from("integration_connections")
        .select("connected_user,metadata")
        .eq("workspace_id", auth.workspaceId)
        .eq("provider", provider)
        .maybeSingle();
      if (existing?.connected_user && existing.connected_user !== auth.user.id)
        await cleanupCalendar(auth.workspaceId, existing.connected_user).catch(
          () => {},
        );
      else metadata = existing?.metadata || {};
    }
    const { error: saveError } = await db
      .from("integration_connections")
      .upsert(
        {
          workspace_id: auth.workspaceId,
          provider,
          connected_user: auth.user.id,
          provider_account_id: account.sub,
          display_name: account.email,
          status:
            provider === "google_business" ? "selection_required" : "connected",
          encrypted_credentials: encrypt(
            token,
            auth.workspaceId + ":" + provider,
          ),
          scopes: granted,
          expires_at: new Date(
            Date.now() + (token.expires_in || 3600) * 1000,
          ).toISOString(),
          metadata,
        },
        { onConflict: "workspace_id,provider" },
      );
    if (saveError) throw saveError;
    await audit(auth.workspaceId, auth.user.id, "integration_authorized");
    return NextResponse.redirect(
      new URL(
        provider === "google_calendar"
          ? "/calendar?connected=1"
          : "/account/integraties",
        appUrl(),
      ),
    );
  } catch (e) {
    // The Gmail consent screen returns to a browser page: show a clear Dutch
    // notice on Integraties instead of a raw error response.
    if (gmailCallback && !(e instanceof HttpError && e.status === 401))
      return back(
        (e instanceof HttpError && e.status === 400
          ? "error=expired"
          : "error=failed") + "&provider=gmail",
      );
    return failure(e);
  }
}
