import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { adminClient, appUrl } from "./supabase";
import { HttpError } from "./access";
import { emailProvider } from "./notifications";
import { mergeSubscribers, normalizeEmail, type SubscriberSync } from "../newsletter";
import type { Contact, Workspace } from "../types";

// Newsletter signups for a workspace: forms, subscribers, consent evidence,
// unsubscribe and suppression. Google, Meta and Gmail are not involved.
//
// Consent: a subscriber exists only after an explicit opt-in on a Mavix form
// (checkbox with the stored consent text). Receiving an e-mail or being a
// customer never creates one. With double opt-in the address must also be
// confirmed through a link. Unsubscribed and erased addresses are kept on a
// suppression list as a keyed hash.

const db = () => adminClient();
const log = (event: string, extra: Record<string, string | number> = {}) => console.info(JSON.stringify({ event, ...extra }));

export type NewsletterForm = {
  id: string;
  workspace_id: string;
  public_key: string;
  name: string;
  consent_text: string;
  privacy_policy_url: string | null;
  privacy_policy_version: string;
  allowed_origins: string[];
  redirect_url: string | null;
  double_opt_in: boolean;
  active: boolean;
};
export const FORM_COLUMNS =
  "id,workspace_id,public_key,name,consent_text,privacy_policy_url,privacy_policy_version,allowed_origins,redirect_url,double_opt_in,active";

// Keys derived from OAUTH_ENCRYPTION_KEY (no extra secret to manage).
function key(label: string) {
  const secret = process.env.OAUTH_ENCRYPTION_KEY;
  if (!secret) throw new HttpError(503, "Aanmelden is tijdelijk niet mogelijk.");
  return createHmac("sha256", secret).update("mavix-newsletter:" + label).digest();
}
const hmac = (label: string, value: string) => createHmac("sha256", key(label)).update(value).digest();
export const emailHash = (workspaceId: string, email: string) => hmac("suppression", workspaceId + ":" + normalizeEmail(email)).toString("hex");
export const ipHash = (ip: string) => (ip ? hmac("ip", ip).toString("hex").slice(0, 32) : null);
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export const emailConfigured = () => !!(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);
export const newFormKey = () => randomBytes(24).toString("base64url");

// Unsubscribe links are stateless and do not expire: "<subscriber id>.<mac>".
export function unsubscribeToken(subscriberId: string) {
  return subscriberId + "." + hmac("unsubscribe", subscriberId).toString("base64url").slice(0, 32);
}
export function verifyUnsubscribeToken(token: string): string | null {
  const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{32})$/.exec(token || "");
  if (!m) return null;
  const expected = Buffer.from(unsubscribeToken(m[1]).split(".")[1]);
  const given = Buffer.from(m[2]);
  return expected.length === given.length && timingSafeEqual(expected, given) ? m[1] : null;
}
export const unsubscribeUrl = (subscriberId: string) => appUrl() + "/nieuwsbrief/afmelden?token=" + encodeURIComponent(unsubscribeToken(subscriberId));

export async function formByKey(publicKey: string): Promise<NewsletterForm | null> {
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(publicKey || "")) return null;
  const { data, error } = await db().from("newsletter_forms").select(FORM_COLUMNS).eq("public_key", publicKey).eq("active", true).maybeSingle();
  if (error) throw error;
  return (data as NewsletterForm) || null;
}

/** Website check for cross-origin posts; an empty list allows any website. */
export function originAllowed(form: Pick<NewsletterForm, "allowed_origins">, origin: string | null) {
  if (!form.allowed_origins.length || !origin) return true;
  return form.allowed_origins.includes(origin);
}

export type Evidence = { ip: string; userAgent: string; pageUrl: string | null };
export function evidenceFrom(request: Request, pageUrl?: string | null): Evidence {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "";
  const referer = pageUrl ?? request.headers.get("referer");
  return { ip, userAgent: request.headers.get("user-agent") || "", pageUrl: referer && /^https?:\/\//.test(referer) ? referer : null };
}

async function businessName(workspaceId: string) {
  const { data } = await db().from("business_profiles").select("data").eq("workspace_id", workspaceId).maybeSingle();
  const name = (data?.data as { profile?: { name?: string } } | undefined)?.profile?.name;
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 120) : "ons bedrijf";
}

/** Hosted signup page: the active form and the business name, nothing else. */
export async function publicForm(publicKey: string) {
  const form = await formByKey(publicKey);
  if (!form) return null;
  return {
    publicKey: form.public_key,
    name: form.name,
    consentText: form.consent_text,
    privacyPolicyUrl: form.privacy_policy_url,
    doubleOptIn: form.double_opt_in,
    business: await businessName(form.workspace_id),
  };
}

async function consentEvent(row: Record<string, unknown>) {
  const { error } = await db().from("newsletter_consent_events").insert(row);
  if (error) throw error;
}
async function suppress(workspaceId: string, email: string, reason: "unsubscribed" | "erased" | "manual") {
  const { error } = await db()
    .from("email_suppressions")
    .upsert({ workspace_id: workspaceId, email_hash: emailHash(workspaceId, email), reason }, { onConflict: "workspace_id,email_hash" });
  if (error) throw error;
}
async function unsuppress(workspaceId: string, email: string) {
  const { error } = await db().from("email_suppressions").delete().eq("workspace_id", workspaceId).eq("email_hash", emailHash(workspaceId, email));
  if (error) throw error;
}

async function sendConfirmation(form: NewsletterForm, subscriberId: string, email: string) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const { error } = await db()
    .from("newsletter_subscribers")
    .update({ confirm_token_hash: sha256(token), confirm_expires_at: new Date(now.getTime() + 7 * 86400000).toISOString(), confirm_sent_at: now.toISOString() })
    .eq("id", subscriberId);
  if (error) throw error;
  const name = await businessName(form.workspace_id);
  const link = appUrl() + "/nieuwsbrief/bevestigen?token=" + encodeURIComponent(token);
  await emailProvider.send(
    email,
    "Bevestig je aanmelding voor de nieuwsbrief van " + name,
    `Hallo,\n\nJe hebt je aangemeld voor de nieuwsbrief van ${name}. Bevestig je aanmelding via deze link (7 dagen geldig):\n\n${link}\n\nHeb je je niet aangemeld? Dan kun je deze e-mail negeren; je ontvangt dan niets.\n`,
    "nl-confirm-" + subscriberId + "-" + now.getTime(),
  );
}

/**
 * Explicit opt-in from a form. Never reveals whether the address was already
 * known. Re-subscribing after an unsubscribe is allowed: it is a new, explicit
 * opt-in with its own consent record.
 */
export async function subscribe(form: NewsletterForm, input: { email: string; name?: string }, evidence: Evidence): Promise<{ status: "subscribed" | "pending" }> {
  const email = input.email.trim();
  const normalized = normalizeEmail(email);
  if (form.double_opt_in && !emailConfigured()) {
    console.error(JSON.stringify({ event: "newsletter_email_not_configured", missing: ["EMAIL_API_KEY", "EMAIL_FROM"].filter((n) => !process.env[n]) }));
    throw new HttpError(503, "Aanmelden is tijdelijk niet mogelijk.");
  }
  const { data: existing, error: readError } = await db()
    .from("newsletter_subscribers")
    .select("id,status,name,subscribed_at,confirm_sent_at")
    .eq("workspace_id", form.workspace_id)
    .eq("email_normalized", normalized)
    .maybeSingle();
  if (readError) throw readError;
  const now = new Date().toISOString();
  const status: "subscribed" | "pending" = existing?.status === "subscribed" ? "subscribed" : form.double_opt_in ? "pending" : "subscribed";
  const { data: saved, error } = await db()
    .from("newsletter_subscribers")
    .upsert(
      {
        workspace_id: form.workspace_id,
        email,
        email_normalized: normalized,
        name: input.name?.trim().slice(0, 120) || existing?.name || null,
        status,
        source: "form",
        form_id: form.id,
        privacy_policy_version: form.privacy_policy_version,
        subscribed_at: status === "subscribed" ? existing?.subscribed_at || now : null,
        unsubscribed_at: null,
        updated_at: now,
        synced_at: null,
      },
      { onConflict: "workspace_id,email_normalized" },
    )
    .select("id")
    .single();
  if (error || !saved) throw error || new Error("subscriber_upsert_failed");
  await consentEvent({
    workspace_id: form.workspace_id,
    subscriber_id: saved.id,
    event: "subscribe",
    form_id: form.id,
    consent_text: form.consent_text,
    privacy_policy_version: form.privacy_policy_version,
    privacy_policy_url: form.privacy_policy_url,
    page_url: evidence.pageUrl?.slice(0, 500) || null,
    ip_hash: ipHash(evidence.ip),
    user_agent: evidence.userAgent.slice(0, 300) || null,
    method: "form",
  });
  if (status === "subscribed") await unsuppress(form.workspace_id, normalized);
  else {
    const last = existing?.confirm_sent_at ? Date.parse(existing.confirm_sent_at) : 0;
    // At most one confirmation e-mail per 5 minutes per address.
    if (Date.now() - last > 5 * 60000)
      await sendConfirmation(form, saved.id, email).catch((e) => {
        console.error(JSON.stringify({ event: "newsletter_confirm_send_failed", code: (e as Error).message.slice(0, 40) }));
        throw new HttpError(503, "Aanmelden is tijdelijk niet mogelijk.");
      });
  }
  log("newsletter_subscribed", { status });
  return { status };
}

export async function confirm(token: string, evidence: Evidence): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token || "")) return false;
  const { data: s, error } = await db()
    .from("newsletter_subscribers")
    .select("id,workspace_id,email_normalized,status,form_id,confirm_expires_at,subscribed_at")
    .eq("confirm_token_hash", sha256(token))
    .maybeSingle();
  if (error) throw error;
  if (!s || !s.confirm_expires_at || Date.parse(s.confirm_expires_at) < Date.now()) return false;
  const now = new Date().toISOString();
  const { error: updateError } = await db()
    .from("newsletter_subscribers")
    .update({ status: "subscribed", confirmed_at: now, subscribed_at: s.subscribed_at || now, unsubscribed_at: null, confirm_token_hash: null, confirm_expires_at: null, updated_at: now, synced_at: null })
    .eq("id", s.id);
  if (updateError) throw updateError;
  await consentEvent({ workspace_id: s.workspace_id, subscriber_id: s.id, event: "confirm", form_id: s.form_id, ip_hash: ipHash(evidence.ip), user_agent: evidence.userAgent.slice(0, 300) || null, method: "link" });
  await unsuppress(s.workspace_id, s.email_normalized);
  log("newsletter_confirmed");
  return true;
}

export async function unsubscribe(subscriberId: string, method: "link" | "one_click" | "mavix_user", evidence: Evidence, workspaceId?: string): Promise<boolean> {
  let q = db().from("newsletter_subscribers").select("id,workspace_id,email_normalized,status").eq("id", subscriberId);
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  const { data: s, error } = await q.maybeSingle();
  if (error) throw error;
  if (!s) return false;
  const now = new Date().toISOString();
  if (s.status !== "unsubscribed") {
    const { error: updateError } = await db()
      .from("newsletter_subscribers")
      .update({ status: "unsubscribed", unsubscribed_at: now, confirm_token_hash: null, confirm_expires_at: null, updated_at: now, synced_at: null })
      .eq("id", s.id);
    if (updateError) throw updateError;
    await consentEvent({ workspace_id: s.workspace_id, subscriber_id: s.id, event: "unsubscribe", ip_hash: ipHash(evidence.ip), user_agent: evidence.userAgent.slice(0, 300) || null, method });
  }
  await suppress(s.workspace_id, s.email_normalized, "unsubscribed");
  log("newsletter_unsubscribed", { method });
  return true;
}

/** GDPR erasure: removes the subscriber and its consent records; keeps only a hashed suppression entry. */
export async function erase(workspaceId: string, subscriberId: string) {
  const { data: s, error } = await db().from("newsletter_subscribers").select("id,email_normalized").eq("workspace_id", workspaceId).eq("id", subscriberId).maybeSingle();
  if (error) throw error;
  if (!s) throw new HttpError(404, "Abonnee niet gevonden.");
  await suppress(workspaceId, s.email_normalized, "erased");
  const { error: deleteError } = await db().from("newsletter_subscribers").delete().eq("workspace_id", workspaceId).eq("id", s.id);
  if (deleteError) throw deleteError;
  log("newsletter_erased");
}

/** Normalized addresses (of the given ones) on the workspace's suppression list. */
export async function suppressedEmails(workspaceId: string, emails: string[]) {
  const byHash = new Map(emails.map((e) => [emailHash(workspaceId, e), normalizeEmail(e)]));
  const out = new Set<string>();
  const hashes = [...byHash.keys()];
  for (let i = 0; i < hashes.length; i += 200) {
    const { data, error } = await db().from("email_suppressions").select("email_hash").eq("workspace_id", workspaceId).in("email_hash", hashes.slice(i, i + 200));
    if (error) throw error;
    for (const r of data || []) out.add(byHash.get(r.email_hash as string)!);
  }
  return out;
}

const SYNC_COLUMNS = "id,email,name,status,source,subscribed_at,unsubscribed_at,privacy_policy_version,created_at";

/**
 * Contacts synchronisation, run when the workspace is loaded: subscriber
 * changes not yet merged (synced_at null) are merged into the stored contact
 * list (no duplicates by normalized e-mail) with the same optimistic version
 * check as a normal save. If the newsletter tables are missing (migration not
 * run) or anything fails, the workspace loads unchanged.
 */
export async function syncNewsletterContacts(workspaceId: string, data: Partial<Workspace>, version: number): Promise<{ data: Partial<Workspace>; version: number }> {
  try {
    const started = new Date().toISOString();
    const { data: rows, error } = await db()
      .from("newsletter_subscribers")
      .select(SYNC_COLUMNS)
      .eq("workspace_id", workspaceId)
      .is("synced_at", null)
      .order("updated_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    if (!rows?.length) return { data, version };
    const { contacts, changed } = mergeSubscribers((data.contacts as Contact[]) || [], rows as SubscriberSync[], () => "contact-" + crypto.randomUUID());
    let next = { data, version };
    if (changed) {
      const merged = { ...data, contacts };
      const { data: updated, error: saveError } = await db()
        .from("business_profiles")
        .update({ data: merged, version: version + 1, updated_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .eq("version", version)
        .select("version")
        .maybeSingle();
      if (saveError) throw saveError;
      // Saved elsewhere meanwhile: try again on the next load.
      if (!updated) return { data, version };
      next = { data: merged, version: updated.version as number };
    }
    const { error: markError } = await db()
      .from("newsletter_subscribers")
      .update({ synced_at: new Date().toISOString() })
      .in(
        "id",
        rows.map((r) => r.id as string),
      )
      .lte("updated_at", started);
    if (markError) throw markError;
    log("newsletter_contacts_synced", { subscribers: rows.length, changed: changed ? 1 : 0 });
    return next;
  } catch (e) {
    console.error(JSON.stringify({ event: "newsletter_sync_failed", code: (e as { code?: string })?.code || "error" }));
    return { data, version };
  }
}

/**
 * Called after a workspace save: contacts newly marked "Uitgeschreven" are
 * unsubscribed and suppressed. Contacts newly set to "Ingeschreven" whose
 * address is suppressed are refused: that needs a new opt-in by the person.
 */
// Before 202610100001_newsletter.sql has run there is nothing to guard.
const missingTable = (e: unknown) => ["42P01", "PGRST205"].includes((e as { code?: string })?.code || "");

export async function contactConsentGuard(workspaceId: string, before: Contact[], after: Contact[]) {
  const previous = new Map(before.map((c) => [c.id, c]));
  const optedIn = after.filter((c) => c.status === "Ingeschreven" && previous.get(c.id)?.status !== "Ingeschreven");
  if (!optedIn.length) return;
  const blocked = await suppressedEmails(
    workspaceId,
    optedIn.map((c) => c.email),
  ).catch((e) => {
    if (missingTable(e)) return new Set<string>();
    throw e;
  });
  if (blocked.size)
    throw new HttpError(
      409,
      "Een of meer contacten hebben zich afgemeld voor de nieuwsbrief. Zet ze niet terug op Ingeschreven; ze kunnen zich zelf opnieuw aanmelden via je formulier.",
    );
}
export async function applyContactUnsubscribes(workspaceId: string, before: Contact[], after: Contact[]) {
  const previous = new Map(before.map((c) => [c.id, c]));
  for (const c of after) {
    if (c.status !== "Uitgeschreven" || previous.get(c.id)?.status === "Uitgeschreven" || !previous.has(c.id)) continue;
    try {
      if (c.newsletter?.subscriberId) await unsubscribe(c.newsletter.subscriberId, "mavix_user", { ip: "", userAgent: "", pageUrl: null }, workspaceId);
      else await suppress(workspaceId, c.email, "manual");
    } catch (e) {
      if (missingTable(e)) return;
      throw e;
    }
  }
}
