import "server-only";
import { adminClient } from "./supabase";
import { emailProvider } from "./notifications";

// One place that delivers a notification on every channel the member chose in
// Account > Meldingen: in Mavix, by e-mail (Resend) and by WhatsApp (Twilio).
// Delivery problems never break the action that caused the notification.
//
// WhatsApp (Twilio): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
// TWILIO_WHATSAPP_FROM ("whatsapp:+31..."). Meta only allows messages a
// business starts with an approved template: set TWILIO_WHATSAPP_CONTENT_SID
// to a template with {{1}} = title and {{2}} = text. Without it Twilio only
// delivers inside an open 24-hour conversation (or the sandbox).

export type NotifyInput = {
  workspaceId: string;
  event: string;
  title: string;
  body: string;
  /** Path in Mavix the notification links to, e.g. "/inbox". */
  link?: string;
  entity?: { type: string; id: string };
};

export const whatsappConfigured = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);

async function sendWhatsApp(to: string, title: string, body: string) {
  const phone = to.replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(phone) || !whatsappConfigured()) return;
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const params = new URLSearchParams({ To: "whatsapp:" + phone, From: process.env.TWILIO_WHATSAPP_FROM! });
  if (process.env.TWILIO_WHATSAPP_CONTENT_SID) {
    params.set("ContentSid", process.env.TWILIO_WHATSAPP_CONTENT_SID);
    params.set("ContentVariables", JSON.stringify({ 1: title.slice(0, 100), 2: body.slice(0, 500) }));
  } else params.set("Body", `${title}\n${body}`.slice(0, 1500));
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(sid + ":" + process.env.TWILIO_AUTH_TOKEN).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    signal: AbortSignal.timeout(10000),
  });
}

export async function notify(n: NotifyInput) {
  try {
    const db = adminClient();
    const { data: prefs } = await db.from("notification_preferences").select("user_id,channel").eq("workspace_id", n.workspaceId).eq("event_type", n.event).eq("enabled", true);
    if (!prefs?.length) return;
    const by = (channel: string) => [...new Set(prefs.filter((p) => p.channel === channel).map((p) => p.user_id as string))];
    const inApp = by("IN_APP");
    if (inApp.length)
      await db.from("notifications").insert(
        inApp.map((recipient_id) => ({ workspace_id: n.workspaceId, recipient_id, event_type: n.event, title: n.title.slice(0, 200), body: n.body.slice(0, 500), ...(n.entity ? { related_entity_type: n.entity.type, related_entity_id: n.entity.id } : {}) })),
      );
    const link = n.link ? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "") + n.link : "";
    const text = n.body + (link ? `\n\nOpen in Mavix: ${link}` : "") + "\n\nJe ontvangt dit bericht omdat je dit hebt aangezet in Mavix (Account > Meldingen).";
    for (const userId of by("EMAIL")) {
      const { data } = await db.auth.admin.getUserById(userId);
      const email = data?.user?.email;
      if (email) await emailProvider.send(email, "Mavix: " + n.title, text, `notify-${n.event}-${userId}-${n.entity?.id || Date.now()}`).catch(() => null);
    }
    const whatsapp = by("WHATSAPP");
    if (whatsapp.length && whatsappConfigured()) {
      const { data: people } = await db.from("profiles").select("id,phone").in("id", whatsapp);
      for (const p of people || []) if (p.phone) await sendWhatsApp(String(p.phone), "Mavix: " + n.title, n.body).catch(() => null);
    }
  } catch {
    console.error(JSON.stringify({ event: "notify_failed", type: n.event }));
  }
}
