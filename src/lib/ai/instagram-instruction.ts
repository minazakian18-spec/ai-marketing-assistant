import type { ContentType } from "../instagram-model";
import type { Profile } from "../types";
import type { AudienceSegment, Product } from "../brand-model";
import { buildBrandContext, findSegment, findProduct, type BrandContext } from "./brand-context.ts";

// Goals: few, concrete and recognisable for a shop or restaurant owner. Each
// one says what the post is for; the weekly plan (InstagramSettings.goalPlan)
// can give every weekday its own goal.
export type InstagramGoal = "bekendheid" | "aanbieding" | "product" | "tip" | "achter-de-schermen" | "review" | "evenement";

export const instagramGoals: { id: InstagramGoal; label: string; hint: string }[] = [
  { id: "bekendheid", label: "Meer bekendheid", hint: "Laat zien wie je bent en waar je voor staat." },
  { id: "aanbieding", label: "Aanbieding of actie", hint: "Een korting, deal of tijdelijke actie." },
  { id: "product", label: "Product in de spotlight", hint: "Eén gerecht, product of dienst centraal." },
  { id: "tip", label: "Tip of weetje", hint: "Deel kennis; zo blijf je top of mind." },
  { id: "achter-de-schermen", label: "Achter de schermen", hint: "Je team, je keuken, hoe het gemaakt wordt." },
  { id: "review", label: "Klantreview", hint: "Een tevreden klant aan het woord." },
  { id: "evenement", label: "Evenement of seizoen", hint: "Feestdag, seizoen, opening of event." },
];

/** Older goal ids (saved concepts, links, tests) map onto the current ones. */
const LEGACY_GOALS: Record<string, InstagramGoal> = {
  "product-promotie": "product",
  "nieuw-product": "product",
  merkbekendheid: "bekendheid",
  engagement: "bekendheid",
  informatief: "tip",
  educatief: "tip",
  seizoensgebonden: "evenement",
  testimonial: "review",
};

export function goalLabel(id: InstagramGoal): string {
  return instagramGoals.find((g) => g.id === id)?.label || id;
}

export function isInstagramGoal(value: string): value is InstagramGoal {
  return instagramGoals.some((g) => g.id === value) || value in LEGACY_GOALS;
}

/** The current goal id for any (possibly older) value; "bekendheid" when unknown. */
export function normalizeGoal(value: string | undefined | null): InstagramGoal {
  const v = String(value || "");
  if (instagramGoals.some((g) => g.id === v)) return v as InstagramGoal;
  return LEGACY_GOALS[v] || "bekendheid";
}

/** Weekday ("0" = Sunday) of a local "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" value. */
export const weekdayOfDate = (date: string): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || "");
  return m ? String(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()) : null;
};

/** The goal the weekly plan gives this date (undefined when the plan has none for that day). */
export function plannedGoal(plan: Record<string, string> | undefined | null, date: string): InstagramGoal | undefined {
  const day = weekdayOfDate(date);
  if (!plan || day === null || !plan[day]) return undefined;
  return normalizeGoal(plan[day]);
}

export type InstagramInstruction = {
  brand: BrandContext;
  goal: InstagramGoal;
  contentType: ContentType;
  segment?: AudienceSegment;
  product?: Product;
  cta: string;
  userInstruction: string;
  useWebsite: boolean;
};

export function buildInstagramInstruction(input: {
  profile: Profile;
  prompt: string;
  type: ContentType;
  goal: InstagramGoal;
  product?: string;
  segmentId?: string;
  cta?: string;
  useWebsite: boolean;
}): InstagramInstruction {
  const brand = buildBrandContext(input.profile);
  return {
    brand,
    goal: normalizeGoal(input.goal),
    contentType: input.type,
    segment: findSegment(brand, input.segmentId),
    product: findProduct(brand, input.product),
    // The CTA typed for this post wins; otherwise the Brand Hub default.
    cta: input.cta?.trim() || brand.ctas[0] || "",
    userInstruction: input.prompt,
    useWebsite: input.useWebsite,
  };
}

// A structured brief for a future real image-generation provider. Nothing
// generates an actual image from this yet (see providers/mock.ts), but the
// shape is what a real provider should receive instead of a single string.
export type ImagePromptSpec = {
  mainSubject: string;
  product: string;
  environment: string;
  composition: string;
  cameraAngle: string;
  lighting: string;
  brandColors: string[];
  style: string;
  background: string;
  mood: string;
  aspectRatio: string;
  textRestrictions: string;
  negativePrompt: string;
};

function goalMood(goal: InstagramGoal): string {
  switch (goal) {
    case "aanbieding":
      return "Energiek en urgent";
    case "review":
      return "Warm en persoonlijk";
    case "bekendheid":
      return "Herkenbaar en consistent";
    case "achter-de-schermen":
      return "Echt en ongedwongen";
    case "evenement":
      return "Feestelijk en uitnodigend";
    default:
      return "Uitnodigend en positief";
  }
}

export function buildImagePromptSpec(
  instruction: InstagramInstruction,
): ImagePromptSpec {
  const { brand, product, goal, contentType } = instruction;
  return {
    mainSubject: product?.name || instruction.userInstruction,
    product: product?.description || "",
    environment:
      goal === "evenement"
        ? "Sfeer passend bij het huidige seizoen"
        : "Past bij de merkomgeving en huisstijl",
    composition: "Gecentreerd hoofdonderwerp, ruimte voor tekst boven of onder",
    cameraAngle: "Ooghoogte, natuurlijk perspectief",
    lighting: "Zacht, natuurlijk licht",
    brandColors: brand.brandVoice.colors,
    style: brand.brandVoice.marketingStyle || brand.designStyles.join(", ") || "Clean en herkenbaar",
    background: "Rustig, niet afleidend van het hoofdonderwerp",
    mood: goalMood(goal),
    aspectRatio: ["Story", "Reel", "Animate Image", "Photos to Reel"].includes(
      contentType,
    )
      ? "9:16"
      : "4:5",
    textRestrictions: "Geen tekst in beeld tenzij expliciet gevraagd",
    negativePrompt: [
      brand.brandVoice.avoidWords,
      "geen concurrerende merken",
      "geen verzonnen prijzen of claims",
    ]
      .filter(Boolean)
      .join(", "),
  };
}
