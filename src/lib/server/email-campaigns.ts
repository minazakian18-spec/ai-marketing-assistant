import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { adminClient, appUrl } from "./supabase";
import { HttpError } from "./access";
import { emailHash, unsubscribeToken } from "./newsletter";
import { mutateWorkspace, readWorkspace } from "./workspace-store";
import { normalizeEmail } from "../newsletter";
import { campaignRecipients, renderCampaignEmail, type AudienceContact } from "../email-send";
import type { EmailCampaign } from "../email-model";

// E-mail campaigns through the marketing e-mail provider (Resend HTTP API).
// This is separate from Gmail: Gmail is the Inbox (one-to-one mail from the
// owner's own mailbox); campaigns go through a bulk provider with a verified
// sending domain, unsubscribe headers and delivery webhooks.
//
// Consent: recipients are ONLY newsletter subscribers with status
// "subscribed" (form signup with recorded consent, confirmed when the form
// uses double opt-in), not suppressed, intersected with the chosen segment.
// Imported contacts are never treated as consent.
//
// Configuration (server env, never shown to users):
//   EMAIL_API_KEY              Resend API key (already used for account mail)
//   EMAIL_MARKETING_FROM       e.g. "Mavix <nieuwsbrief@mail.jouwdomein.nl>" on a verified domain
//   EMAIL_MARKETING_ENABLED=1  switch for real campaign sends (test e-mails work without it)
//   RESEND_WEBHOOK_SECRET      "whsec_…" for delivery/bounce/complaint webhooks

const db = () => adminClient();
export const MAX_RECIPIENTS = 2000;
const BATCH = 100;

export type SendingCapability = { ready: boolean; testReady: boolean; code: "ready" | "not_configured" | "disabled"; message: string };

export function sendingCapability(): SendingCapability {
  const base = !!(process.env.EMAIL_API_KEY && process.env.EMAIL_MARKETING_FROM);
  if (!base) return { ready: false, testReady: false, code: "not_configured", message: "Versturen van campagnes is nog niet ingericht: Mavix heeft hiervoor een geverifieerd verzenddomein nodig." };
  if (process.env.EMAIL_MARKETING_ENABLED !== "1") return { ready: false, testReady: true, code: "disabled", message: "Testmails werken. Echte campagnes versturen staat nog uit tot het verzenddomein volledig is gecontroleerd." };
  return { ready: true, testReady: true, code: "ready", message: "Klaar om te versturen." };
}

/** Consent-checked recipients for a segment, with the counts the UI shows. */
export async function audience(workspaceId: string, segment: string) {
  const [{ data: subs, error }, { data: suppressed }, ws] = await Promise.all([
    db().from("newsletter_subscribers").select("id,email,email_normalized,name,status").eq("workspace_id", workspaceId).eq("status", "subscribed").limit(10000),
    db().from("email_suppressions").select("email_hash").eq("workspace_id", workspaceId).limit(20000),
    readWorkspace(workspaceId),
  ]);
  if (error) throw new HttpError(503, "De ontvangers konden niet worden geladen.");
  const blocked = new Set((suppressed || []).map((s) => s.email_hash as string));
  const consented = (subs || [])
    .filter((s) => !blocked.has(emailHash(workspaceId, String(s.email))))
    .map((s) => ({ subscriberId: String(s.id), email: String(s.email), name: String(s.name || "") }));
  const contacts = (Array.isArray(ws.contacts) ? ws.contacts : []) as AudienceContact[];
  return campaignRecipients(segment, consented, contacts);
}

async function resend(path: string, body: unknown, idempotencyKey: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch("https://api.resend.com" + path, {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.EMAIL_API_KEY, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.slice(0, 256) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) return data as { id?: string; data?: { id: string }[] };
      if (r.status < 500 && r.status !== 429) {
        console.error(JSON.stringify({ event: "email_campaign_rejected", status: r.status }));
        throw new HttpError(400, "De e-mailprovider heeft deze verzending geweigerd. Controleer het verzenddomein.");
      }
    } catch (e) {
      if (e instanceof HttpError) throw e;
    }
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  throw new HttpError(503, "De e-mailprovider is niet bereikbaar. Probeer het later opnieuw.");
}

async function loadCampaign(workspaceId: string, campaignId: string) {
  if (!/^[\w-]{1,80}$/.test(campaignId)) throw new HttpError(404, "Deze campagne bestaat niet.");
  const ws = await readWorkspace(workspaceId);
  const c = (((ws.email as { campaigns?: EmailCampaign[] })?.campaigns || []) as EmailCampaign[]).find((x) => x.id === campaignId);
  if (!c) throw new HttpError(404, "Deze campagne bestaat niet.");
  const profile = (ws.profile || {}) as Record<string, string>;
  return { c, profile };
}

/** One test e-mail to the signed-in user's own address. Never to customers. */
export async function sendTest(o: { workspaceId: string; userId: string; email: string }, campaignId: string) {
  const cap = sendingCapability();
  if (!cap.testReady) throw new HttpError(409, cap.message);
  if (!o.email) throw new HttpError(400, "Je account heeft geen e-mailadres.");
  const { c, profile } = await loadCampaign(o.workspaceId, campaignId);
  const mail = renderCampaignEmail(c, { business: profile.name || "", address: [profile.address, profile.postalCode, profile.city].filter(Boolean).join(", "), unsubscribeUrl: appUrl() + "/nieuwsbrief/afmelden?token=test", test: true });
  const key = "test:" + o.workspaceId + ":" + campaignId + ":" + Math.floor(Date.now() / 60000);
  await resend("/emails", { from: process.env.EMAIL_MARKETING_FROM, to: [o.email], subject: "[Test] " + mail.subject, html: mail.html, text: mail.text }, key);
  await db().from("email_campaign_runs").insert({ workspace_id: o.workspaceId, campaign_id: campaignId, kind: "test", status: "sent", recipients: 1, sent: 1, created_by: o.userId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  return { to: o.email };
}

/**
 * Sends an approved (or due scheduled) campaign to its consented audience,
 * once. Records a run and a delivery row per recipient (no addresses stored),
 * then marks the campaign as sent in the workspace.
 */
const STALE_MS = 15 * 60 * 1000;

/** Close a run that stopped half-way: confirmed e-mails count as sent, the rest as not sent. */
async function closeInterrupted(run: { id: string; recipients: number }) {
  const { data: rows } = await db().from("email_deliveries").select("status").eq("run_id", run.id).limit(MAX_RECIPIENTS);
  const sent = (rows || []).filter((r) => ["sent", "delivered", "opened", "clicked"].includes(r.status as string)).length;
  const failed = Math.max(0, run.recipients - sent);
  const status = !sent ? "failed" : failed ? "partial" : "sent";
  const at = new Date().toISOString();
  await db().from("email_deliveries").update({ status: "failed", error: "Verzending onderbroken.", updated_at: at }).eq("run_id", run.id).eq("status", "queued");
  await db()
    .from("email_campaign_runs")
    .update({ status, sent, failed, updated_at: at, error: failed ? `Verzending onderbroken: ${failed} e-mail(s) niet verstuurd.` : null })
    .eq("id", run.id)
    .eq("status", "sending");
  console.error(JSON.stringify({ event: "email_campaign_interrupted", sent, failed }));
  return { status, sent, recipients: run.recipients, repeated: true };
}

export async function sendCampaign(o: { workspaceId: string; userId: string | null; trigger: "manual" | "automation" }, campaignId: string) {
  const cap = sendingCapability();
  if (!cap.ready) throw new HttpError(409, cap.message);
  const { data: existing } = await db().from("email_campaign_runs").select("id,status,sent,recipients,updated_at").eq("workspace_id", o.workspaceId).eq("campaign_id", campaignId).eq("kind", "send").in("status", ["sending", "sent", "partial"]).limit(1);
  if (existing?.[0]?.status === "sending") {
    // A run updates updated_at after every batch. One that has been silent
    // for 15 minutes was interrupted (restart, time-out): close it honestly
    // from what was confirmed. Nothing is sent again, so nobody gets the
    // campaign twice.
    if (Date.now() - Date.parse(existing[0].updated_at as string) < STALE_MS) throw new HttpError(409, "Deze campagne wordt al verstuurd.");
    return closeInterrupted(existing[0] as { id: string; recipients: number });
  }
  if (existing?.[0]) return { status: existing[0].status as string, sent: existing[0].sent as number, recipients: existing[0].recipients as number, repeated: true };

  const { c, profile } = await loadCampaign(o.workspaceId, campaignId);
  if (c.status !== "approved" && c.status !== "scheduled") throw new HttpError(409, "Keur de campagne eerst goed. Alleen goedgekeurde of ingeplande campagnes kunnen worden verstuurd.");
  if (!c.subject.trim() || !c.body.trim()) throw new HttpError(400, "Vul een onderwerp en tekst in.");
  const list = await audience(o.workspaceId, c.audience);
  if (!list.recipients.length) throw new HttpError(400, "Er zijn geen ontvangers met aantoonbare toestemming in deze doelgroep.");
  if (list.recipients.length > MAX_RECIPIENTS) throw new HttpError(400, `Mavix verstuurt nu maximaal ${MAX_RECIPIENTS} e-mails per campagne.`);

  const now = new Date().toISOString();
  const { data: run, error: runError } = await db()
    .from("email_campaign_runs")
    .insert({ workspace_id: o.workspaceId, campaign_id: campaignId, kind: "send", trigger: o.trigger, status: "sending", recipients: list.recipients.length, created_by: o.userId, created_at: now, updated_at: now })
    .select("id")
    .single();
  if (runError?.code === "23505") throw new HttpError(409, "Deze campagne wordt al verstuurd.");
  if (runError || !run) throw new HttpError(503, "Versturen is in Mavix nog niet ingericht. Probeer het later opnieuw.");
  console.info(JSON.stringify({ event: "email_campaign_started", trigger: o.trigger, recipients: list.recipients.length }));

  const address = [profile.address, profile.postalCode, profile.city].filter(Boolean).join(", ");
  let sent = 0,
    failed = 0;
  for (let i = 0; i < list.recipients.length; i += BATCH) {
    const chunk = list.recipients.slice(i, i + BATCH);
    const rows = chunk.map((r) => ({ run_id: run.id, workspace_id: o.workspaceId, subscriber_id: r.subscriberId, email_hash: emailHash(o.workspaceId, r.email), status: "queued", created_at: now, updated_at: now }));
    await db().from("email_deliveries").insert(rows);
    const messages = chunk.map((r) => {
      const unsub = appUrl() + "/api/newsletter/unsubscribe?token=" + encodeURIComponent(unsubscribeToken(r.subscriberId));
      const mail = renderCampaignEmail(c, { business: profile.name || "", address, unsubscribeUrl: appUrl() + "/nieuwsbrief/afmelden?token=" + encodeURIComponent(unsubscribeToken(r.subscriberId)), firstName: r.name.split(" ")[0] });
      return {
        from: process.env.EMAIL_MARKETING_FROM,
        to: [r.email],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        headers: { "List-Unsubscribe": "<" + unsub + ">", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        tags: [{ name: "mavix_run", value: String(run.id).replace(/-/g, "_") }],
      };
    });
    try {
      const res = await resend("/emails/batch", messages, run.id + ":" + i);
      const ids = res.data || [];
      for (let k = 0; k < chunk.length; k++) {
        const id = ids[k]?.id;
        await db()
          .from("email_deliveries")
          .update({ status: id ? "sent" : "failed", provider_message_id: id || null, error: id ? null : "Geen bevestiging van de provider.", updated_at: new Date().toISOString() })
          .eq("run_id", run.id)
          .eq("email_hash", rows[k].email_hash);
        if (id) sent++;
        else failed++;
      }
    } catch (e) {
      failed += chunk.length;
      await db().from("email_deliveries").update({ status: "failed", error: (e instanceof HttpError ? e.message : "Verzenden mislukt.").slice(0, 300), updated_at: new Date().toISOString() }).eq("run_id", run.id).eq("status", "queued");
    }
    // Heartbeat: shows the run is still alive (see STALE_MS).
    await db().from("email_campaign_runs").update({ sent, failed, updated_at: new Date().toISOString() }).eq("id", run.id);
  }
  const status = !sent ? "failed" : failed ? "partial" : "sent";
  await db().from("email_campaign_runs").update({ status, sent, failed, updated_at: new Date().toISOString(), error: failed ? `${failed} e-mail(s) niet verstuurd.` : null }).eq("id", run.id);
  if (sent)
    await mutateWorkspace(o.workspaceId, (data) => {
      const email = (data.email || {}) as { settings?: unknown; campaigns?: EmailCampaign[] };
      const at = new Date().toISOString();
      return { data: { ...data, email: { ...email, campaigns: (email.campaigns || []).map((x) => (x.id === campaignId ? { ...x, status: "sent" as const, reason: "", updatedAt: at, delivery: { runId: String(run.id), sentAt: at, recipients: list.recipients.length } } : x)) } }, result: null };
    }).catch((e) => console.error(JSON.stringify({ event: "email_campaign_record_failed", code: (e as HttpError).status || "error" })));
  console.info(JSON.stringify({ event: "email_campaign_done", status, sent, failed }));
  return { status, sent, recipients: list.recipients.length, repeated: false };
}

/** Delivery numbers for a campaign, only from provider events (no estimates). */
export async function campaignStats(workspaceId: string, campaignId: string) {
  const { data: runs } = await db().from("email_campaign_runs").select("id,kind,status,recipients,sent,failed,created_at").eq("workspace_id", workspaceId).eq("campaign_id", campaignId).order("created_at", { ascending: false }).limit(10);
  const send = (runs || []).find((r) => r.kind === "send");
  if (!send) return { runs: runs || [], stats: null };
  const { data: d } = await db().from("email_deliveries").select("status,opened_at,clicked_at").eq("run_id", send.id).limit(MAX_RECIPIENTS);
  const rows = d || [];
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  return {
    runs: runs || [],
    stats: { recipients: send.recipients, sent: send.sent, delivered: count("delivered"), bounced: count("bounced"), complained: count("complained"), failed: count("failed"), opened: rows.filter((r) => r.opened_at).length, clicked: rows.filter((r) => r.clicked_at).length },
  };
}

// ---------- Provider webhooks (Svix signatures, as Resend sends them) ----------

export function verifyWebhook(headers: Headers, body: string, secret = process.env.RESEND_WEBHOOK_SECRET || "") {
  const id = headers.get("svix-id") || "",
    ts = headers.get("svix-timestamp") || "",
    sigs = headers.get("svix-signature") || "";
  if (!secret.startsWith("whsec_") || !id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`${id}.${ts}.${body}`).digest();
  return sigs.split(" ").some((s) => {
    const given = Buffer.from(s.split(",")[1] || "", "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Applies one provider event to its delivery; bounces and complaints suppress the address. */
export async function applyWebhookEvent(event: { type?: string; data?: { email_id?: string; to?: string[] } }) {
  const id = event.data?.email_id;
  if (!id || !/^[\w-]{1,120}$/.test(id)) return false;
  const { data: row } = await db().from("email_deliveries").select("id,workspace_id,status").eq("provider_message_id", id).maybeSingle();
  if (!row) return false;
  const at = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: at };
  switch (event.type) {
    case "email.delivered":
      if (row.status === "sent") patch.status = "delivered";
      break;
    case "email.bounced":
      patch.status = "bounced";
      break;
    case "email.complained":
      patch.status = "complained";
      break;
    case "email.opened":
      patch.opened_at = at;
      break;
    case "email.clicked":
      patch.clicked_at = at;
      patch.opened_at = at;
      break;
    default:
      return false;
  }
  await db().from("email_deliveries").update(patch).eq("id", row.id);
  // Never mail a bounced or complaining address again.
  const to = event.data?.to?.[0];
  if ((event.type === "email.bounced" || event.type === "email.complained") && to)
    await db().from("email_suppressions").upsert({ workspace_id: row.workspace_id, email_hash: emailHash(row.workspace_id as string, normalizeEmail(to)), reason: "manual" }, { onConflict: "workspace_id,email_hash" });
  return true;
}
