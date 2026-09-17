import type {
  EmailCampaign,
  EmailKind,
  EmailSettings,
  EmailSlot,
} from "../email-model";
import type { Profile } from "../types";
import { emailSlots, emailPolicy, campaignError } from "../email-model.ts";
import { recipients } from "../contact-data.ts";
import { localDateTime } from "../instagram-model.ts";
export type EmailRequest = {
  prompt: string;
  kind: EmailKind;
  profile: Profile;
  audience: string;
  product: string;
  offer: string;
  useWebsite: boolean;
  variant: number;
};
export interface EmailTextProvider {
  generate(
    request: EmailRequest,
  ): Promise<Pick<EmailCampaign, "subject" | "preview" | "body" | "cta">>;
}
export interface ContactRepository {
  eligibleCount(segment: string): number;
}
export interface EmailDeliveryProvider {
  schedule(campaign: EmailCampaign): Promise<{ id: string }>;
}
export interface EmailAnalyticsProvider {
  getMetrics(
    campaignId: string,
  ): Promise<{ delivered: number; clicks: number; unsubscribes: number }>;
}
export const mockContacts: ContactRepository = {
  eligibleCount: (segment) => recipients(segment).length,
};
export const mockEmailText: EmailTextProvider = {
  async generate(r) {
    const topic = r.product || r.prompt.trim();
    const intro =
      r.kind === "Create Welcome Email"
        ? "Welkom bij " +
          (r.profile.name || "ons team") +
          "! Fijn dat je erbij bent."
        : r.kind === "Create Follow-up"
          ? "We horen graag hoe het met je gaat. Heb je een vraag? We helpen je graag verder."
          : r.kind === "Re-engagement Email"
            ? "Het is even geleden. We delen graag weer iets met je."
            : "";
    return {
      subject:
        (r.variant % 2 ? "Een update voor jou: " : "Ontdek: ") +
        topic.slice(0, 95),
      preview: ("Van " + (r.profile.name || "ons team") + " — " + topic).slice(
        0,
        150,
      ),
      body:
        "Hallo,\n\n" +
        (intro ? intro + "\n\n" : "") +
        (r.product
          ? "In de spotlight: " + r.product + "."
          : "Dit concept draait om jouw idee:\n“" + r.prompt.trim() + "”") +
        "\n\n" +
        (r.useWebsite && r.profile.description
          ? r.profile.description + "\n\n"
          : "") +
        (r.offer ? "Bestaande aanbieding: " + r.offer + "\n\n" : "") +
        "Wil je meer weten? Bekijk de details of neem contact met ons op.\n\nHartelijke groet,\n" +
        (r.profile.name || "Ons team"),
      cta: r.variant % 2 ? "Lees meer" : "Bekijk de details",
    };
  },
};
export async function generateEmail(
  r: EmailRequest,
  provider: EmailTextProvider = mockEmailText,
): Promise<EmailCampaign> {
  const text = await provider.generate(r);
  return {
    id: crypto.randomUUID(),
    title: r.prompt.trim().slice(0, 120),
    kind: r.kind,
    prompt: r.prompt,
    ...text,
    sender: r.profile.name || "Ons team",
    audience: r.audience,
    ctaUrl: r.profile.website || "",
    hero: r.profile.media?.[0] || "",
    footer: [
      r.profile.name || "Jouw bedrijfsnaam",
      r.profile.address,
      r.profile.postalCode,
      r.profile.city,
    ]
      .filter(Boolean)
      .join(" · "),
    status: "draft",
    date: "",
    createdAt: new Date().toISOString(),
    source: "manual",
    variant: r.variant,
    reason: "",
  };
}
export async function simulateEmail(
  s: EmailSettings,
  p: Profile,
  now: Date,
  workflow = false,
): Promise<{ campaigns: EmailCampaign[]; skipped: number }> {
  let slots: EmailSlot[] = emailSlots(s, now);
  if (workflow) {
    slots = [];
    if (s.enabled && s.mode !== "assist")
      for (const [i, w] of s.workflows.entries()) {
        if (!w.enabled || (w.name === "Follow-up Email" && !s.followups))
          continue;
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(10, i * 10, 0, 0);
        slots.push({
          date: localDateTime(d),
          kind: (
            [
              "Create Welcome Email",
              "Create Follow-up",
              "Re-engagement Email",
              "Create Promotion",
            ] as const
          )[i],
          automatic: emailPolicy(s, d).automatic && !w.approval,
          audience: w.audience,
          reason: "Voorbeeldtrigger: " + w.trigger,
        });
      }
  }
  const topics = Object.keys(s.mix).filter(
    (k) => s.mix[k] > 0 && (k === "news" ? s.allowed.website : s.allowed[k]),
  );
  const total = topics.reduce((n, k) => n + s.mix[k], 0);
  const campaigns: EmailCampaign[] = [];
  let skipped = 0;
  for (const [i, slot] of slots.entries()) {
    if (!topics.length || !s.allowed.segments) {
      skipped++;
      continue;
    }
    let weight = 0;
    const point = ((i + 0.5) / slots.length) * total;
    const topic =
      slot.kind === "Create Promotion"
        ? "offers"
        : topics.find((k) => (weight += s.mix[k]) >= point) || topics[0];
    if (topic === "offers" && !s.allowed.offers) {
      skipped++;
      continue;
    }
    const missing =
      !p.name.trim() ||
      !p.description.trim() ||
      (topic === "products" && !p.products?.trim()) ||
      (topic === "offers" && !p.offers?.trim()) ||
      topic === "reviews" ||
      (topic === "news" && !p.website.trim());
    if (missing && s.uncertain === "skip") {
      skipped++;
      continue;
    }
    const title: Record<string, string> = {
      offers: "Een aanbieding voor jou",
      news: "Nieuws van " + (p.name || "ons team"),
      products: "Onze productselectie",
      tips: "Een handige tip van ons team",
      reviews: "Klantervaring — voeg een bevestigde review toe",
    };
    const c = await generateEmail({
      prompt: title[topic],
      kind: slot.kind,
      profile: p,
      audience: slot.audience,
      product:
        topic === "products"
          ? p.products?.split("\n").filter(Boolean)[0] || ""
          : "",
      offer:
        topic === "offers"
          ? p.offers?.split("\n").filter(Boolean)[0] || ""
          : "",
      useWebsite: s.allowed.website,
      variant: i,
    });
    const empty = !recipients(c.audience).length;
    c.source = "autopilot";
    c.date = slot.date;
    c.reason = empty
      ? "Deze doelgroep heeft geen ingeschreven contacten."
      : missing
        ? "Controleer ontbrekende broninformatie in Brand Hub."
        : slot.reason || "";
    c.status = empty
      ? "blocked"
      : missing || campaignError(c)
        ? "draft"
        : slot.automatic
          ? "scheduled"
          : "draft";
    campaigns.push(c);
  }
  return { campaigns, skipped };
}
