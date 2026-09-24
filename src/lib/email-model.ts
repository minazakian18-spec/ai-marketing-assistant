import type { Profile } from "./types";
import { recipients, segments } from "./contact-data.ts";
import { localDate, localDateTime } from "./instagram-model.ts";
export const emailKinds = [
  "Create Campaign",
  "Create Newsletter",
  "Create Promotion",
  "Create Follow-up",
  "Create Welcome Email",
  "Re-engagement Email",
  "Subject Lines",
  "Preview Text",
  "Content Ideas",
] as const;
export type EmailKind = (typeof emailKinds)[number];
export type EmailCampaign = {
  id: string;
  title: string;
  kind: EmailKind;
  prompt: string;
  subject: string;
  preview: string;
  sender: string;
  audience: string;
  body: string;
  cta: string;
  ctaUrl: string;
  hero: string;
  footer: string;
  status: "draft" | "approved" | "scheduled" | "rejected" | "blocked" | "sent";
  date: string;
  createdAt: string;
  source: "manual" | "autopilot";
  variant: number;
  reason: string;
};
export const emailModes = [
  {
    id: "assist",
    title: "Assist",
    description: "AI maakt alleen e-mails wanneer jij hier zelf om vraagt.",
  },
  {
    id: "auto",
    title: "Auto Create",
    description:
      "Mavix bedenkt, maakt en plant zelfstandig e-mails volgens jouw schema. Met 'Vraag per item toestemming' bepaal je of Mavix eerst jouw goedkeuring vraagt of direct verstuurt.",
  },
] as const;
export const emailMix = {
  offers: "Promoties",
  news: "Nieuws / updates",
  products: "Producten/diensten",
  tips: "Educatief/tips",
  reviews: "Reviews/social proof",
};
export const emailAllowed = {
  products: "Bestaande producten/diensten promoten",
  offers: "Bestaande aanbiedingen gebruiken",
  reviews: "Reviews/social proof gebruiken",
  website: "Website-informatie gebruiken",
  tips: "Tips en informatieve content maken",
  segments: "Bestaande klantsegmenten gebruiken",
};
export const emailForbidden = {
  discounts: "Zelf kortingen verzinnen",
  prices: "Prijzen wijzigen",
  customers: "Klantgegevens verzinnen",
  unsubscribed: "Mails sturen naar uitgeschreven contacten",
  sensitive: "Gevoelige onderwerpen gebruiken",
  claims: "Claims maken die niet in Brand Hub staan",
  unknown: "Onbekende feiten verzinnen",
};
export const workflowNames = [
  "Welcome Email",
  "Follow-up Email",
  "Re-engagement Email",
  "Promotion Email",
] as const;
export type Workflow = {
  name: (typeof workflowNames)[number];
  enabled: boolean;
  audience: string;
  trigger: string;
  approval: boolean;
};
export type EmailSettings = {
  mode: "assist" | "auto";
  enabled: boolean;
  requireApproval: boolean;
  newsletters: number;
  newsletterPeriod?: "week" | "month";
  notify?: boolean;
  promotions: number;
  reengagement: number;
  followups: boolean;
  days: number[];
  time: string;
  bestTime: boolean;
  mix: Record<string, number>;
  audience: string;
  autoAudience: boolean;
  allowed: Record<string, boolean>;
  forbidden: Record<string, boolean>;
  uncertain: "review" | "skip";
  workflows: Workflow[];
  vacation: {
    enabled: boolean;
    from: string;
    until: string;
    campaigns: number;
    automatic: boolean;
    approval: boolean;
    notify: boolean;
  };
};
export const defaultEmail: EmailSettings = {
  mode: "assist",
  enabled: false,
  requireApproval: true,
  newsletters: 1,
  promotions: 2,
  reengagement: 1,
  followups: true,
  days: [2, 4],
  time: "10:00",
  bestTime: true,
  mix: { offers: 30, news: 25, products: 20, tips: 15, reviews: 10 },
  audience: "Nieuwsbriefabonnees",
  autoAudience: true,
  allowed: Object.fromEntries(Object.keys(emailAllowed).map((k) => [k, true])),
  forbidden: Object.fromEntries(
    Object.keys(emailForbidden).map((k) => [k, true]),
  ),
  uncertain: "review",
  workflows: workflowNames.map((name, i) => ({
    name,
    enabled: i < 2,
    audience: [
      "Nieuwe klanten",
      "Recente kopers",
      "Inactief 60+ dagen",
      "VIP klanten",
    ][i],
    trigger: [
      "Na bevestigde inschrijving",
      "3 dagen na aankoop",
      "60 dagen zonder activiteit",
      "Bij een bestaande aanbieding",
    ][i],
    approval: true,
  })),
  vacation: {
    enabled: false,
    from: "",
    until: "",
    campaigns: 1,
    automatic: false,
    approval: true,
    notify: true,
  },
};
const countValid = (v: unknown) =>
  Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 12;
const dayValid = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !isNaN(new Date(v).getTime()) &&
  new Date(v).toISOString().slice(0, 10) === v;
export function emailSettingsError(s: EmailSettings): string {
  if (
    !s ||
    !emailModes.some((m) => m.id === s.mode) ||
    typeof s.enabled !== "boolean" ||
    typeof s.requireApproval !== "boolean"
  )
    return "Kies een geldige modus.";
  if (![s.newsletters, s.promotions, s.reengagement].every(countValid))
    return "Frequenties moeten tussen 0 en 12 liggen.";
  if (
    !Array.isArray(s.days) ||
    !s.days.length ||
    s.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    new Set(s.days).size !== s.days.length
  )
    return "Kies minimaal één geldige dag.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time))
    return "Kies een geldige verzendtijd.";
  if (
    !s.mix ||
    Object.keys(emailMix).some(
      (k) => !Number.isInteger(s.mix[k]) || s.mix[k] < 0 || s.mix[k] > 100,
    ) ||
    Object.values(s.mix).reduce((a, b) => a + b, 0) !== 100
  )
    return "De contentmix moet 100% zijn.";
  if (!segments.includes(s.audience as (typeof segments)[number]))
    return "Kies een bestaande doelgroep.";
  if (
    ![s.autoAudience, s.bestTime, s.followups].every(
      (v) => typeof v === "boolean",
    ) ||
    !["review", "skip"].includes(s.uncertain)
  )
    return "Controleer de Autopilot-opties.";
  if (
    !s.allowed ||
    !s.forbidden ||
    Object.keys(emailAllowed).some((k) => typeof s.allowed[k] !== "boolean") ||
    Object.keys(emailForbidden).some((k) => typeof s.forbidden[k] !== "boolean")
  )
    return "Controleer de regels.";
  if (
    !s.forbidden.unknown ||
    !s.forbidden.unsubscribed ||
    !s.forbidden.customers
  )
    return "Onbekende feiten, klantgegevens en uitgeschreven contacten blijven beschermd.";
  if (
    !Array.isArray(s.workflows) ||
    s.workflows.length !== 4 ||
    s.workflows.some(
      (w, i) =>
        !w ||
        w.name !== workflowNames[i] ||
        typeof w.enabled !== "boolean" ||
        typeof w.approval !== "boolean" ||
        !segments.includes(w.audience as (typeof segments)[number]) ||
        typeof w.trigger !== "string" ||
        !w.trigger.trim(),
    )
  )
    return "Controleer de workflows.";
  if (s.newsletterPeriod && !["week", "month"].includes(s.newsletterPeriod))
    return "Kies week of maand.";
  if (s.notify !== undefined && typeof s.notify !== "boolean")
    return "Controleer de notificatie-instelling.";
  const v = s.vacation;
  if (
    !v ||
    ![v.enabled, v.automatic, v.approval, v.notify].every(
      (x) => typeof x === "boolean",
    ) ||
    !countValid(v.campaigns)
  )
    return "Controleer de vakantie-instellingen.";
  if (
    v.enabled &&
    (!dayValid(v.from) || !dayValid(v.until) || v.until < v.from)
  )
    return "Kies geldige vakantiedatums; Until moet na Away from liggen.";
  if (v.automatic === v.approval)
    return "Kies automatisch verzenden of eerst goedkeuren.";
  return "";
}
export function emailPolicy(s: EmailSettings, date: Date) {
  const day = localDate(date);
  const away =
    s.vacation.enabled && day >= s.vacation.from && day <= s.vacation.until;
  return {
    away,
    automatic:
      s.enabled &&
      s.mode === "auto" &&
      !s.requireApproval &&
      (away ? s.vacation.automatic && !s.vacation.approval : true),
    weekly: away ? s.vacation.campaigns : s.newsletters,
  };
}
export function emailReadiness(p: Profile, campaigns: EmailCampaign[]) {
  const checks = [
    {
      label: "Bedrijfsgegevens",
      done: !!p.name.trim() && !!p.description.trim(),
    },
    { label: "Tone of voice", done: !!p.voice.trim() },
    { label: "Producten/diensten", done: !!p.products?.trim() },
    { label: "Website", done: !!p.website.trim() },
    {
      label: "Contacten (voorbeelddata)",
      done: recipients("Alle contacten").length > 0,
    },
    { label: "Aanbiedingen", done: !!p.offers?.trim() },
    {
      label: "Minimaal 3 eerdere e-mailcampagnes",
      done: campaigns.filter((c) => c.status === "sent").length >= 3,
    },
  ];
  return {
    checks,
    score: Math.round(
      (checks.filter((c) => c.done).length / checks.length) * 100,
    ),
  };
}
export function emailCampaignValid(c: EmailCampaign) {
  return (
    !!c &&
    [
      "id",
      "title",
      "prompt",
      "subject",
      "preview",
      "sender",
      "audience",
      "body",
      "cta",
      "ctaUrl",
      "hero",
      "footer",
      "date",
      "createdAt",
      "reason",
    ].every((k) => typeof c[k as keyof EmailCampaign] === "string") &&
    emailKinds.includes(c.kind) &&
    ["draft", "approved", "scheduled", "rejected", "blocked", "sent"].includes(
      c.status,
    ) &&
    ["manual", "autopilot"].includes(c.source) &&
    Number.isInteger(c.variant) &&
    segments.includes(c.audience as (typeof segments)[number]) &&
    (!c.date || !isNaN(Date.parse(c.date))) &&
    (!c.hero ||
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(c.hero))
  );
}
export function campaignError(c: EmailCampaign, schedule = false) {
  if (
    !c.title.trim() ||
    !c.subject.trim() ||
    !c.sender.trim() ||
    !c.body.trim() ||
    !c.cta.trim() ||
    !c.footer.trim()
  )
    return "Vul titel, onderwerp, afzender, body, CTA en footer in.";
  if (!recipients(c.audience).length)
    return "Deze doelgroep heeft geen ingeschreven contacten. Kies een andere doelgroep.";
  if (c.ctaUrl && !/^https?:\/\//i.test(c.ctaUrl))
    return "Gebruik een http(s)-adres voor de CTA.";
  if (
    schedule &&
    (!c.date ||
      !Number.isFinite(new Date(c.date).getTime()) ||
      new Date(c.date).getTime() <= Date.now())
  )
    return "Kies een verzendtijd in de toekomst.";
  return "";
}
export type EmailSlot = {
  date: string;
  kind: EmailKind;
  automatic: boolean;
  audience: string;
  reason?: string;
};
export function emailSlots(s: EmailSettings, now: Date): EmailSlot[] {
  if (emailSettingsError(s) || !s.enabled || s.mode === "assist") return [];
  const result: EmailSlot[] = [];
  // Four rolling weeks; monthly limits are represented once per 28-day preview.
  for (let week = 0; week < 4; week++) {
    const candidates: Date[] = [];
    for (let day = 0; day < 7; day++) {
      const d = new Date(now);
      d.setDate(d.getDate() + week * 7 + day);
      const [h, m] = (s.bestTime ? "10:00" : s.time).split(":").map(Number);
      d.setHours(h, m, 0, 0);
      if (d > now && s.days.includes(d.getDay())) candidates.push(d);
    }
    let news = 0,
      awayCount = 0;
    for (const d of candidates) {
      const policy = emailPolicy(s, d);
      const limit = policy.away ? s.vacation.campaigns : s.newsletters;
      const used = policy.away ? awayCount : news;
      if (used < limit) {
        result.push({
          date: localDateTime(d),
          kind: "Create Newsletter",
          automatic: policy.automatic,
          audience: s.autoAudience ? "Nieuwsbriefabonnees" : s.audience,
        });
        if (policy.away) awayCount++;
        else news++;
      }
    }
    // More than one campaign per selected day is spaced by 30 minutes.
    if (candidates.length)
      for (let n = candidates.length; n < 12; n++) {
        const d = new Date(candidates[n % candidates.length]);
        d.setMinutes(d.getMinutes() + 30 * Math.floor(n / candidates.length));
        const p = emailPolicy(s, d);
        if ((p.away ? awayCount : news) >= p.weekly) break;
        result.push({
          date: localDateTime(d),
          kind: "Create Newsletter",
          automatic: p.automatic,
          audience: s.autoAudience ? "Nieuwsbriefabonnees" : s.audience,
        });
        if (p.away) awayCount++;
        else news++;
      }
  }
  for (const [kind, limit, audience] of [
    ["Create Promotion", s.promotions, "VIP klanten"],
    ["Re-engagement Email", s.reengagement, "Inactief 60+ dagen"],
  ] as const) {
    let added = 0;
    for (let offset = 1; offset <= 28 && added < limit; offset++) {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      const [h, m] = (s.bestTime ? "10:00" : s.time).split(":").map(Number);
      d.setHours(h, m + 15, 0, 0);
      if (!s.days.includes(d.getDay()) || emailPolicy(s, d).away) continue;
      result.push({
        date: localDateTime(d),
        kind,
        automatic: emailPolicy(s, d).automatic,
        audience: s.autoAudience ? audience : s.audience,
      });
      added++;
    }
  }
  const sorted = result.sort((a, b) => a.date.localeCompare(b.date));
  let monthlyNews = 0;
  return sorted.filter((slot) => {
    if (
      s.newsletterPeriod !== "month" ||
      slot.kind !== "Create Newsletter" ||
      emailPolicy(s, new Date(slot.date)).away
    )
      return true;
    return monthlyNews++ < s.newsletters;
  });
}
export const emailStats = [
  ["Verzonden", "4.850"],
  ["Delivered", "98,7%"],
  ["Click rate", "4,6%"],
  ["Unsubscribes", "8"],
  ["Beste campagne", "Weekendselectie"],
];
