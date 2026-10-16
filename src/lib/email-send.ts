import type { EmailCampaign } from "./email-model";

// Pure helpers for real e-mail campaign sends (server and tests).

export type AudienceContact = { email: string; group?: string; status?: string; newsletter?: { status?: string } };
export type Consented = { subscriberId: string; email: string; name: string };

const norm = (e: string) => e.trim().toLowerCase();
const SEGMENT_GROUP: Record<string, string> = { "Nieuwe klanten": "Nieuw", "VIP klanten": "Vaste klanten", "Inactief 60+ dagen": "Inactief", "Recente kopers": "Klant" };

/**
 * Recipients for a segment: only consented newsletter subscribers. For a
 * segment narrower than "everyone" the subscriber must also be a contact in
 * that group. Returns the list plus how many contacts were left out because
 * Mavix has no recorded consent for them (for example imported contacts).
 */
export function campaignRecipients(segment: string, consented: Consented[], contacts: AudienceContact[]) {
  const group = SEGMENT_GROUP[segment];
  const inGroup = group ? new Set(contacts.filter((c) => c.group === group || c.group === segment).map((c) => norm(c.email))) : null;
  const seen = new Set<string>();
  const recipients = consented.filter((s) => {
    const e = norm(s.email);
    if (seen.has(e) || (inGroup && !inGroup.has(e))) return false;
    seen.add(e);
    return true;
  });
  const consentedSet = new Set(consented.map((s) => norm(s.email)));
  const targeted = contacts.filter((c) => c.email && (!group || c.group === group || c.group === segment) && c.status === "Ingeschreven");
  return { recipients, withoutConsent: targeted.filter((c) => !consentedSet.has(norm(c.email))).length };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const safeUrl = (u: string) => (/^https:\/\/[^\s"'<>]+$/i.test(u) ? u : "");

/** The campaign as a responsive HTML e-mail plus a plain-text version. */
export function renderCampaignEmail(c: Pick<EmailCampaign, "subject" | "preview" | "body" | "cta" | "ctaUrl" | "hero">, o: { business: string; address: string; unsubscribeUrl: string; firstName?: string; test?: boolean }) {
  const body = c.body.replace(/\[voornaam\]/gi, o.firstName || "").replace(/\{\{\s*voornaam\s*\}\}/gi, o.firstName || "");
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const cta = c.cta.trim() && safeUrl(c.ctaUrl) ? { label: c.cta.trim(), href: safeUrl(c.ctaUrl) } : null;
  const hero = safeUrl(c.hero);
  const reason = `Je ontvangt deze e-mail omdat je je hebt ingeschreven voor de nieuwsbrief van ${o.business || "dit bedrijf"}.`;
  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f4f8;font-family:Arial,Helvetica,sans-serif;color:#1f1b2d">
<div style="display:none;max-height:0;overflow:hidden">${esc(c.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
${o.test ? `<tr><td style="padding:10px 24px;background:#fff7e0;font-size:13px;color:#6b4e00">Testmail: zo ziet je campagne eruit. Deze e-mail is alleen naar jou gestuurd.</td></tr>` : ""}
${hero ? `<tr><td><img src="${esc(hero)}" alt="" width="600" style="display:block;width:100%;height:auto"></td></tr>` : ""}
<tr><td style="padding:28px 24px 8px">${paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6">${esc(p).replace(/\n/g, "<br>")}</p>`).join("")}
${cta ? `<p style="margin:8px 0 24px"><a href="${esc(cta.href)}" style="display:inline-block;padding:12px 22px;background:#5b21b6;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold">${esc(cta.label)}</a></p>` : ""}</td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid #ece9f3;font-size:12px;line-height:1.6;color:#6f6a80">${esc(o.business)}${o.address ? " · " + esc(o.address) : ""}<br>${esc(reason)}<br><a href="${esc(o.unsubscribeUrl)}" style="color:#5b21b6">Afmelden</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = [...paragraphs, ...(cta ? [`${cta.label}: ${cta.href}`] : []), "—", [o.business, o.address].filter(Boolean).join(" · "), reason, "Afmelden: " + o.unsubscribeUrl].join("\n\n");
  return { subject: c.subject.trim(), html, text };
}
