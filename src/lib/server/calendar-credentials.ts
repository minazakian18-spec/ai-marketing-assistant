import "server-only";
import { adminClient } from "./supabase";
import { HttpError } from "./access";
import { encrypt, decrypt } from "./crypto";

export const CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];
export type CalendarCredentials = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};
const context = (workspaceId: string) => workspaceId + ":google_calendar";

// All provider responses stay server-side. Only validated token fields are kept.
export async function exchangeCalendarToken(
  body: Record<string, string>,
): Promise<CalendarCredentials> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
    throw new HttpError(503, "Google-koppeling vereist configuratie.");
  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...body,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
      }),
    });
  } catch {
    throw new HttpError(
      503,
      "Google is tijdelijk niet bereikbaar. Probeer het later opnieuw.",
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (data.error === "invalid_grant")
      throw new HttpError(409, "Verbind Google Calendar opnieuw.");
    if (response.status === 429)
      throw new HttpError(
        429,
        "Te veel aanvragen bij Google. Probeer het later opnieuw.",
      );
    throw new HttpError(
      503,
      "Google-autorisatie is tijdelijk niet beschikbaar.",
    );
  }
  if (
    typeof data.access_token !== "string" ||
    !data.access_token ||
    typeof data.expires_in !== "number" ||
    !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0 ||
    data.expires_in > 86400 ||
    (data.token_type && data.token_type.toLowerCase() !== "bearer")
  )
    throw new HttpError(
      502,
      "Google-autorisatie kon niet worden gecontroleerd.",
    );
  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    ...(typeof data.refresh_token === "string" && data.refresh_token
      ? { refresh_token: data.refresh_token }
      : {}),
    ...(typeof data.scope === "string" ? { scope: data.scope } : {}),
  };
}

export async function calendarConnection(workspaceId: string, userId?: string) {
  const { data: c, error } = await adminClient()
    .from("integration_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("provider", "google_calendar")
    .maybeSingle();
  if (error) throw new HttpError(503, "De verbinding kon niet worden geladen.");
  if (!c || !c.encrypted_credentials || c.status === "disconnected")
    throw new HttpError(409, "Verbind eerst Google Calendar.");
  // Check ownership BEFORE decrypting or refreshing another member's credentials.
  if (userId && c.connected_user !== userId)
    throw new HttpError(
      403,
      "Google Calendar is gekoppeld door een ander teamlid.",
    );
  if (c.status !== "connected")
    throw new HttpError(409, "Verbind Google Calendar opnieuw.");
  return c;
}

export async function markCalendarConnection(
  c: Awaited<ReturnType<typeof calendarConnection>>,
  status: string,
) {
  const { error } = await adminClient()
    .from("integration_connections")
    .update({ status })
    .eq("id", c.id)
    .eq("workspace_id", c.workspace_id)
    .eq("provider", "google_calendar")
    .eq("connection_generation", c.connection_generation)
    .eq("encrypted_credentials", c.encrypted_credentials);
  if (error)
    throw new HttpError(503, "De verbinding kon niet worden bijgewerkt.");
}

// The rejected access token identifies a 401 retry. If another request already
// refreshed it, reuse the newer token instead of refreshing again.
export async function calendarToken(
  workspaceId: string,
  userId?: string,
  rejectedAccessToken?: string,
  attempt = 0,
): Promise<{
  token: CalendarCredentials;
  c: Awaited<ReturnType<typeof calendarConnection>>;
}> {
  const c = await calendarConnection(workspaceId, userId);
  if (
    !CALENDAR_SCOPES.filter((s) => s.startsWith("https:")).every((s) =>
      c.scopes?.includes(s),
    )
  ) {
    await markCalendarConnection(c, "permission_missing");
    throw new HttpError(
      403,
      "Toestemming voor Google Calendar ontbreekt. Verbind opnieuw.",
    );
  }
  let token = decrypt<CalendarCredentials>(
    c.encrypted_credentials,
    context(workspaceId),
  );
  const expiry = Date.parse(c.expires_at || "");
  if (
    Number.isFinite(expiry) &&
    expiry > Date.now() + 60000 &&
    token.access_token !== rejectedAccessToken
  )
    return { token, c };
  if (!token.refresh_token) {
    await markCalendarConnection(c, "reconnect_required");
    throw new HttpError(409, "Verbind Google Calendar opnieuw.");
  }
  let refreshed: CalendarCredentials;
  try {
    refreshed = await exchangeCalendarToken({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    });
  } catch (error) {
    if (error instanceof HttpError && error.status === 409)
      await markCalendarConnection(c, "reconnect_required");
    throw error; // Network/configuration/rate-limit failures do not revoke consent.
  }
  token = { ...token, ...refreshed };
  if (
    refreshed.scope &&
    !CALENDAR_SCOPES.filter((s) => s.startsWith("https:")).every((s) =>
      refreshed.scope!.split(" ").includes(s),
    )
  ) {
    await markCalendarConnection(c, "permission_missing");
    throw new HttpError(
      403,
      "Toestemming voor Google Calendar ontbreekt. Verbind opnieuw.",
    );
  }
  const patch = {
    encrypted_credentials: encrypt(token, context(workspaceId)),
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
  };
  const { data, error } = await adminClient()
    .from("integration_connections")
    .update(patch)
    .eq("id", c.id)
    .eq("workspace_id", workspaceId)
    .eq("provider", "google_calendar")
    .eq("connection_generation", c.connection_generation)
    .eq("encrypted_credentials", c.encrypted_credentials)
    .eq("status", "connected")
    .select("id");
  if (error)
    throw new HttpError(503, "De verbinding kon niet worden bijgewerkt.");
  if (!data?.length) {
    if (attempt >= 1)
      throw new HttpError(409, "De verbinding is gewijzigd. Probeer opnieuw.");
    return calendarToken(workspaceId, userId, undefined, attempt + 1);
  }
  return { token, c: { ...c, ...patch } };
}
