import type { ContentType } from "../instagram-model";
import type { Profile } from "../types";
import type { AudienceSegment, Product } from "../brand-model";
import { buildBrandContext, findSegment, findProduct, type BrandContext } from "./brand-context.ts";

export type InstagramGoal =
  | "product-promotie"
  | "aanbieding"
  | "merkbekendheid"
  | "informatief"
  | "educatief"
  | "seizoensgebonden"
  | "evenement"
  | "nieuw-product"
  | "testimonial"
  | "engagement";

export const instagramGoals: { id: InstagramGoal; label: string }[] = [
  { id: "product-promotie", label: "Product promoten" },
  { id: "aanbieding", label: "Aanbieding" },
  { id: "merkbekendheid", label: "Merkbekendheid" },
  { id: "informatief", label: "Informatief" },
  { id: "educatief", label: "Educatief" },
  { id: "seizoensgebonden", label: "Seizoensgebonden" },
  { id: "evenement", label: "Evenement" },
  { id: "nieuw-product", label: "Nieuw product" },
  { id: "testimonial", label: "Testimonial" },
  { id: "engagement", label: "Engagement" },
];

export function goalLabel(id: InstagramGoal): string {
  return instagramGoals.find((g) => g.id === id)?.label || id;
}

export function isInstagramGoal(value: string): value is InstagramGoal {
  return instagramGoals.some((g) => g.id === value);
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
    goal: input.goal,
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
    case "testimonial":
      return "Warm en persoonlijk";
    case "merkbekendheid":
      return "Herkenbaar en consistent";
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
      goal === "seizoensgebonden"
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
