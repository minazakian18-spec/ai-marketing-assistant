import { sendNewGmail } from "./gmail";
import { gmailToken } from "./gmail-credentials";
import { gmailRequest } from "./gmail-api";
import { calendarToken } from "./calendar-credentials";
import { businessToken, rawReviewsPage } from "./google-business";
import "server-only";
import { adminClient, appUrl } from "./supabase";
import { HttpError } from "./access";
import { encrypt, decrypt } from "./crypto";
export type Provider =
  "google_business" | "gmail" | "instagram" | "google_calendar";
export const scopes = {
  google_business: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/business.manage",
  ],
  gmail: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
  ],
  instagram: ["instagram_business_basic", "instagram_business_manage_messages"],
  google_calendar: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  ],
};
export type Credentials = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};
export const callback = (provider: Provider) =>
  appUrl() + "/api/integrations/" + provider + "/callback";
export async function googleToken(
  body: Record<string, string>,
): Promise<Credentials> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...body,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    cache: "no-store",
  });
  if (!r.ok)
    throw new HttpError(
      502,
      "Google-autorisatie is verlopen of geweigerd. Verbind opnieuw.",
    );
  return r.json();
}
export async function connectionToken(workspaceId: string, provider: Provider) {
  if (provider === "gmail") return gmailToken(workspaceId);
  if (provider === "google_calendar") return calendarToken(workspaceId);
  if (provider === "google_business") return businessToken(workspaceId);
  const db = adminClient();
  const { data: c, error } = await db
    .from("integration_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .single();
  if (error || !c?.encrypted_credentials)
    throw new HttpError(409, "Verbind eerst je account.");
  let token = decrypt<Credentials>(
    c.encrypted_credentials,
    workspaceId + ":" + provider,
  );
  if (!c.expires_at || new Date(c.expires_at).getTime() < Date.now() + 60000) {
    if (!token.refresh_token || provider === "instagram") {
      await db
        .from("integration_connections")
        .update({ status: "reconnect_required" })
        .eq("id", c.id);
      throw new HttpError(409, "Verbind je account opnieuw.");
    }
    try {
      const refreshed = await googleToken({
        grant_type: "refresh_token",
        refresh_token: token.refresh_token,
      });
      token = { ...token, ...refreshed };
      const { error } = await db
        .from("integration_connections")
        .update({
          encrypted_credentials: encrypt(token, workspaceId + ":" + provider),
          expires_at: new Date(
            Date.now() + (token.expires_in || 3600) * 1000,
          ).toISOString(),
        })
        .eq("id", c.id);
      if (error) throw new Error("save");
    } catch {
      await db
        .from("integration_connections")
        .update({ status: "reconnect_required" })
        .eq("id", c.id);
      throw new HttpError(409, "Verbind je account opnieuw.");
    }
  }
  return { token, c };
}
// Google Business Profile (accounts, locations, reviews, replies) lives in
// google-business.ts with hardened requests and API-access detection. This
// wrapper keeps the research module's raw review reader.
export async function listReviews(workspaceId: string, pageToken = "") {
  return rawReviewsPage(workspaceId, pageToken);
}
export async function sendGmail(workspaceId: string, raw: string) {
  return gmailRequest(workspaceId, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw }),
  });
}
export async function sendTestEmail(
  workspaceId: string,
  to: string,
  subject: string,
  body: string,
) {
  return sendNewGmail(workspaceId, { to, subject, body });
}
