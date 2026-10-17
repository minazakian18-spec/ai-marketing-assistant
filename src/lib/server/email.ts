import { PLAN_IDS, PLANS } from "../plans";
import "server-only";
import { appUrl } from "./supabase";

// Transactional e-mail for account events (Resend HTTP API, the provider the
// newsletter confirmation already uses). Server-side only; the key is read
// from EMAIL_API_KEY and never logged. Every message has HTML and plain text,
// a stable idempotency key (Resend drops repeats of the same key for 24 h) and
// at most two retries on network or 5xx errors. Never includes passwords,
// tokens or payment details.
//
// Supabase Auth sends sign-up confirmation and password reset itself; the
// matching Mavix templates for its dashboard are in docs/email-templates/.

export type TemplateName =
  | "demo_received"
  | "demo_confirmed"
  | "application_received"
  | "application_approved"
  | "application_rejected"
  | "payment_succeeded"
  | "payment_failed"
  | "account_activated"
  | "security_alert";

export type TemplateData = {
  email: string;
  name: string;
  company?: string;
  plan?: string | null;
  reason?: string | null;
  /** Only for demo_confirmed: an appointment that was really booked. */
  appointment?: string;
  /** Only for security_alert. */
  detail?: string;
};

type Rendered = { subject: string; heading: string; paragraphs: string[]; cta?: { label: string; href: string } };

const PLAN: Record<string, string> = Object.fromEntries(PLAN_IDS.map((id) => [id, PLANS[id].name]));
const first = (name: string) => name.trim().split(/\s+/)[0] || "";

export function render(template: TemplateName, d: TemplateData): Rendered {
  const hi = d.name ? `Beste ${first(d.name)},` : "Beste klant,";
  const plan = d.plan && PLAN[d.plan] ? ` voor het ${PLAN[d.plan]}-abonnement` : "";
  const base = appUrl();
  switch (template) {
    case "demo_received":
      return {
        subject: "We hebben je demo-aanvraag ontvangen",
        heading: "Bedankt voor je demo-aanvraag",
        paragraphs: [hi, "We hebben je aanvraag voor een demo van Mavix ontvangen. We nemen binnen twee werkdagen contact met je op om een moment af te spreken.", "Er is nog niets vastgelegd of afgesproken; je hoeft nu niets te doen."],
      };
    case "demo_confirmed":
      return {
        subject: "Je demo van Mavix is ingepland",
        heading: "Je demo is ingepland",
        paragraphs: [hi, `Je demo van Mavix staat gepland op ${d.appointment || "het afgesproken moment"}.`, "Lukt het onverhoopt niet? Beantwoord deze e-mail, dan zoeken we een ander moment."],
      };
    case "application_received":
      return {
        subject: "We hebben je aanvraag voor Mavix ontvangen",
        heading: "Bedankt voor je aanvraag",
        paragraphs: [hi, `We hebben je aanvraag${plan} ontvangen. We beoordelen elke aanvraag persoonlijk en laten je per e-mail weten wanneer dat is afgerond.`, "Er is niets afgeschreven. Betalen gebeurt pas nadat je aanvraag is goedgekeurd."],
      };
    case "application_approved":
      return {
        subject: "Je aanvraag voor Mavix is goedgekeurd",
        heading: "Je aanvraag is goedgekeurd",
        paragraphs: [hi, `Goed nieuws: je aanvraag${plan} is goedgekeurd. Maak je account aan met dit e-mailadres (of log in als je dat al hebt gedaan).`, "We sturen je daarna de gegevens om het abonnement te betalen. Je account wordt geactiveerd zodra de betaling is bevestigd."],
        cta: { label: "Account aanmaken", href: base + "/register" },
      };
    case "application_rejected":
      return {
        subject: "Over je aanvraag voor Mavix",
        heading: "Over je aanvraag",
        paragraphs: [hi, "Bedankt voor je interesse in Mavix. Na beoordeling kunnen we je aanvraag op dit moment helaas niet goedkeuren.", ...(d.reason ? [`Toelichting: ${d.reason}`] : []), "Er is niets afgeschreven. Heb je vragen? Beantwoord dan deze e-mail."],
      };
    case "payment_succeeded":
      return {
        subject: "Je betaling voor Mavix is ontvangen",
        heading: "Betaling ontvangen",
        paragraphs: [hi, `We hebben je betaling${plan} ontvangen. Je factuur vind je in Mavix onder Account → Facturatie.`],
        cta: { label: "Naar facturatie", href: base + "/account/facturatie" },
      };
    case "payment_failed":
      return {
        subject: "Je betaling voor Mavix is niet gelukt",
        heading: "Betaling niet gelukt",
        paragraphs: [hi, "Je laatste betaling voor Mavix is niet gelukt. Controleer je betaalgegevens in het betaalportaal; we proberen het daarna opnieuw.", "Je gegevens blijven bewaard."],
        cta: { label: "Betaalgegevens bekijken", href: base + "/account/facturatie" },
      };
    case "account_activated":
      return {
        subject: "Je Mavix-account is actief",
        heading: "Welkom bij Mavix",
        paragraphs: [hi, "Je account is geactiveerd. Je kunt nu inloggen en je werkruimte inrichten: begin met Brand Hub, zodat Mavix in jouw stem schrijft."],
        cta: { label: "Inloggen", href: base + "/login" },
      };
    case "security_alert":
      return {
        subject: "Beveiligingsmelding voor je Mavix-account",
        heading: "Beveiligingsmelding",
        paragraphs: [hi, d.detail || "Er is een belangrijke wijziging aan je account gedaan.", "Was jij dit niet? Wijzig dan direct je wachtwoord en neem contact met ons op."],
        cta: { label: "Wachtwoord wijzigen", href: base + "/forgot-password" },
      };
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function toHtml(r: Rendered) {
  const paras = r.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2b2838">${esc(p)}</p>`).join("");
  const cta = r.cta
    ? `<p style="margin:22px 0 6px"><a href="${esc(r.cta.href)}" style="display:inline-block;background:#6d28d9;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px">${esc(r.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.subject)}</title></head>
<body style="margin:0;background:#f6f5fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5fa;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #ece9f3">
<tr><td style="padding:28px 28px 8px"><div style="font-size:20px;font-weight:700;color:#2e1065">Mavix</div></td></tr>
<tr><td style="padding:8px 28px 28px"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#18122b">${esc(r.heading)}</h1>${paras}${cta}</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #ece9f3;font-size:12px;line-height:1.5;color:#8a8796">Je ontvangt dit bericht omdat er iets is gewijzigd aan je aanvraag of account bij Mavix. Dit is geen marketingbericht.</td></tr>
</table></td></tr></table></body></html>`;
}

export function toText(r: Rendered) {
  return [r.heading, "", ...r.paragraphs.flatMap((p) => [p, ""]), ...(r.cta ? [`${r.cta.label}: ${r.cta.href}`, ""] : []), "—", "Mavix", "Je ontvangt dit bericht omdat er iets is gewijzigd aan je aanvraag of account bij Mavix."].join("\n");
}

export const emailConfigured = () => !!(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);

/** Sends one account e-mail. Never throws: returns whether it was really sent. */
export async function sendTemplate(template: TemplateName, data: TemplateData, idempotencyKey: string): Promise<{ sent: boolean; reason?: string }> {
  if (!emailConfigured()) return { sent: false, reason: "e-mail niet geconfigureerd" };
  const r = render(template, data);
  const body = JSON.stringify({ from: process.env.EMAIL_FROM, to: [data.email], subject: r.subject, html: toHtml(r), text: toText(r), ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}) });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.EMAIL_API_KEY, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.slice(0, 256) },
        body,
      });
      if (res.ok) {
        console.info(JSON.stringify({ event: "email_sent", template }));
        return { sent: true };
      }
      if (res.status < 500 && res.status !== 429) {
        console.error(JSON.stringify({ event: "email_rejected", template, status: res.status }));
        return { sent: false, reason: "geweigerd door provider" };
      }
    } catch {
      // network error: retry below
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  console.error(JSON.stringify({ event: "email_failed", template }));
  return { sent: false, reason: "provider niet bereikbaar" };
}
