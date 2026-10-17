// Mavix subscriptions: ONE source for prices, AI credits, per-action monthly
// limits, entitlements and workspace limits. Used by the pricing page, the
// homepage, structured data, Account → AI / Facturatie and — most
// importantly — the server, which enforces everything here.
//
// The public top plan is "Premium"; its technical id stays "autopilot" for
// database and Stripe compatibility. Prices are excl. VAT and are starting
// points: changing them here does not change Stripe (Price IDs live in env).

export type PlanId = "starter" | "growth" | "autopilot";
export const PLAN_IDS: PlanId[] = ["starter", "growth", "autopilot"];

/** AI actions customers see; every metered AI feature maps to one. */
export type AiAction =
  | "instagram_caption"
  | "review_reply"
  | "email_draft"
  | "image_generate"
  | "image_edit"
  | "inbox_reply"
  | "inbox_summary"
  | "seo_advice"
  | "campaign"
  | "research"
  | "agent_task"
  | "brand_improve"
  | "text_edit"
  | "marketing_copy"
  | "carousel";

export const ACTIONS: Record<AiAction, { label: string; credits: number }> = {
  instagram_caption: { label: "Instagram-captions", credits: 1 },
  review_reply: { label: "AI-reviewantwoorden", credits: 1 },
  email_draft: { label: "AI-e-mailconcepten", credits: 2 },
  image_generate: { label: "Nieuwe AI-afbeeldingen", credits: 10 },
  image_edit: { label: "AI-afbeeldingsbewerkingen", credits: 12 },
  inbox_reply: { label: "Inbox AI-antwoorden", credits: 2 },
  inbox_summary: { label: "Inbox-samenvattingen", credits: 1 },
  seo_advice: { label: "SEO AI-adviezen", credits: 3 },
  campaign: { label: "AI-campagnevoorstellen", credits: 6 },
  research: { label: "Bedrijfsonderzoeken met AI", credits: 20 },
  agent_task: { label: "Mavix Agent-taken", credits: 8 },
  brand_improve: { label: "Brand Hub AI-verbeteringen", credits: 2 },
  text_edit: { label: "AI-tekstbewerkingen", credits: 1 },
  marketing_copy: { label: "AI-marketingteksten", credits: 1 },
  // The carousel plan: story, slide texts, image briefs and one caption. Each
  // AI slide image is a separate image_generate action (10 credits, image limit).
  carousel: { label: "AI-carrousels", credits: 2 },
};

/** Metered server feature (ai_usage.feature) → customer action. Keep complete: unmapped AI is refused. */
export const FEATURE_ACTION: Record<string, AiAction> = {
  content_instagram: "instagram_caption",
  review_reply: "review_reply",
  content_email: "email_draft",
  image_generate: "image_generate",
  // A new image with inspiration images (or a carousel slide with the first
  // slide as style reference): counts as a new AI image.
  image_inspire: "image_generate",
  image_edit: "image_edit",
  carousel_plan: "carousel",
  inbox_reply: "inbox_reply",
  inbox_rewrite: "inbox_reply",
  inbox_summary: "inbox_summary",
  seo_suggest: "seo_advice",
  content_campaign: "campaign",
  research: "research",
  agent: "agent_task",
  brand_improve: "brand_improve",
  brand_preview: "brand_improve",
  content_edit: "text_edit",
  content_copy: "marketing_copy",
};

export type Entitlement = "agent" | "inbox_ai" | "seo_ai" | "seo_intelligence" | "campaigns" | "research" | "team" | "advice_call" | "extended_insights" | "carousels";

export type Plan = {
  id: PlanId;
  name: string;
  audience: string;
  summary: string;
  positioning: string;
  monthlyPrice: number;
  credits: number;
  recommended?: boolean;
  users: number;
  contacts: number;
  storageBytes: number;
  seoScansPerMonth: number;
  /** Inspiration images per AI image request. */
  inspirationMax: number;
  /** Slides per AI carousel (0 = no carousel generator; minimum is always 2). */
  carouselSlides: number;
  entitlements: Entitlement[];
  /** Monthly maximum per action; missing = only the shared credits limit apply; 0 = not included. */
  limits: Partial<Record<AiAction, number>>;
  highlights: string[];
};

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    audience: "Kleine ondernemers en zelfstandigen",
    summary: "Betaalbaar beginnen met AI-marketing.",
    positioning: "Alles wat je nodig hebt om eenvoudig met AI-marketing te beginnen.",
    monthlyPrice: 29,
    credits: 150,
    users: 1,
    contacts: 500,
    storageBytes: 500 * MB,
    seoScansPerMonth: 1,
    inspirationMax: 1,
    carouselSlides: 0,
    entitlements: [],
    limits: { instagram_caption: 8, image_generate: 6, image_edit: 2, email_draft: 4, review_reply: 20, brand_improve: 4, inbox_reply: 0, inbox_summary: 0, seo_advice: 0, campaign: 0, research: 0, agent_task: 0, carousel: 0 },
    highlights: [],
  },
  growth: {
    id: "growth",
    name: "Growth",
    audience: "Actieve bedrijven",
    summary: "Complete marketingondersteuning.",
    positioning: "Maak, plan en verbeter je marketing vanuit één slimme werkruimte.",
    monthlyPrice: 69,
    credits: 600,
    recommended: true,
    users: 2,
    contacts: 3000,
    storageBytes: 2 * GB,
    seoScansPerMonth: 4,
    inspirationMax: 3,
    carouselSlides: 5,
    entitlements: ["inbox_ai", "seo_ai", "seo_intelligence", "campaigns", "research", "team", "extended_insights", "carousels"],
    limits: { instagram_caption: 20, image_generate: 16, image_edit: 5, email_draft: 12, review_reply: 75, inbox_reply: 40, seo_advice: 8, campaign: 5, research: 1, brand_improve: 10, agent_task: 0, carousel: 4 },
    highlights: [],
  },
  autopilot: {
    id: "autopilot",
    name: "Premium",
    audience: "Groeiende bedrijven",
    summary: "Alle functies en persoonlijk advies.",
    positioning: "Alle kracht van Mavix, met extra AI-capaciteit en persoonlijk marketingadvies.",
    monthlyPrice: 119,
    credits: 1500,
    users: 5,
    contacts: 10000,
    storageBytes: 5 * GB,
    seoScansPerMonth: 12,
    inspirationMax: 5,
    carouselSlides: 10,
    entitlements: ["agent", "inbox_ai", "seo_ai", "seo_intelligence", "campaigns", "research", "team", "advice_call", "extended_insights", "carousels"],
    limits: { instagram_caption: 40, image_generate: 35, image_edit: 10, email_draft: 30, review_reply: 150, inbox_reply: 100, seo_advice: 20, campaign: 12, research: 1, agent_task: 30, brand_improve: 20, carousel: 10 },
    highlights: [],
  },
};

export const YEARLY_DISCOUNT_PERCENT = 20;
/** Yearly price per month and per year, in cents to avoid rounding errors. */
export function yearlyPrice(p: Plan) {
  const perMonthCents = Math.round(p.monthlyPrice * 100 * (1 - YEARLY_DISCOUNT_PERCENT / 100));
  return { perMonth: perMonthCents / 100, perYear: (perMonthCents * 12) / 100 };
}
export const euro = (n: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);

/** Which entitlement an action needs (if any). */
export const ACTION_ENTITLEMENT: Partial<Record<AiAction, Entitlement>> = {
  agent_task: "agent",
  inbox_reply: "inbox_ai",
  inbox_summary: "inbox_ai",
  seo_advice: "seo_ai",
  campaign: "campaigns",
  research: "research",
  carousel: "carousels",
};

/** Cheapest plan that offers more of `action` than `current` (for upgrade hints). */
export function upgradeFor(current: PlanId | null, action: AiAction): Plan | null {
  const from = current ? PLAN_IDS.indexOf(current) : -1;
  for (const id of PLAN_IDS.slice(from + 1)) {
    const p = PLANS[id];
    const need = ACTION_ENTITLEMENT[action];
    if ((!need || p.entitlements.includes(need)) && (p.limits[action] === undefined || (p.limits[action] || 0) > (current ? PLANS[current].limits[action] || 0 : 0))) return p;
  }
  return null;
}

/**
 * Current monthly credit period. Credits renew on the billing day (also for
 * yearly subscriptions, every month); without a paid subscription the
 * calendar month is used. Unused credits do not carry over.
 */
export function creditPeriod(anchor: string | null, now = new Date()) {
  if (!anchor || Number.isNaN(Date.parse(anchor))) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { start, end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
  }
  const day = new Date(anchor).getUTCDate();
  const at = (y: number, m: number) => new Date(Date.UTC(y, m, Math.min(day, new Date(Date.UTC(y, m + 1, 0)).getUTCDate())));
  let start = at(now.getUTCFullYear(), now.getUTCMonth());
  if (start > now) start = at(now.getUTCFullYear(), now.getUTCMonth() - 1);
  const end = at(start.getUTCFullYear(), start.getUTCMonth() + 1);
  return { start, end };
}

/** Sum of the per-action maxima in credits (must fit within the plan's credits). */
export const maxActionCredits = (p: Plan) => (Object.entries(p.limits) as [AiAction, number][]).reduce((s, [a, n]) => s + n * ACTIONS[a].credits, 0);

// Card highlights, built from the numbers above (never typed twice).
const nl = (n: number) => n.toLocaleString("nl-NL");
PLANS.starter.highlights = [
  `${nl(PLANS.starter.credits)} AI-credits per maand`,
  `${PLANS.starter.limits.image_generate} AI-afbeeldingen per maand`,
  `${PLANS.starter.limits.instagram_caption} Instagram-captions per maand`,
  `${PLANS.starter.limits.review_reply} AI-reviewantwoorden per maand`,
  `${PLANS.starter.inspirationMax} inspiratiebeeld per AI-afbeelding`,
  "Contentkalender",
  "Brand Hub",
];
PLANS.growth.highlights = [
  `${nl(PLANS.growth.credits)} AI-credits per maand`,
  `${PLANS.growth.limits.image_generate} AI-afbeeldingen per maand`,
  `AI-carrousels tot ${PLANS.growth.carouselSlides} slides`,
  `${PLANS.growth.limits.review_reply} AI-reviewantwoorden per maand`,
  "SEO Intelligence met AI-adviezen",
  "AI-antwoorden in je Inbox",
  "AI-campagnevoorstellen",
  `${PLANS.growth.users} gebruikers`,
];
PLANS.autopilot.highlights = [
  `${nl(PLANS.autopilot.credits)} AI-credits per maand`,
  `${PLANS.autopilot.limits.image_generate} AI-afbeeldingen per maand`,
  `AI-carrousels tot ${PLANS.autopilot.carouselSlides} slides`,
  "Mavix Agent",
  `${PLANS.autopilot.limits.review_reply} AI-reviewantwoorden per maand`,
  `${PLANS.autopilot.users} gebruikers · ${nl(PLANS.autopilot.contacts)} contacten`,
  "Maandelijks 20 minuten persoonlijk advies",
];