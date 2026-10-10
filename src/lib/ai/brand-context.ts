import type { Profile } from "../types";
import {
  defaultBrandVoice,
  type BrandVoice,
  type AudienceSegment,
  type Product,
} from "../brand-model.ts";
import {
  languageLabel,
  objectiveLabel,
  strategyOf,
  TONE_PRESETS,
} from "../brand-strategy.ts";

// The single, reusable "brand brain" that every AI feature (Instagram,
// Email, Review, Inbox, SEO) is built from. Real AI providers should be
// handed this object, never raw Profile fields, so every feature stays
// consistent when Brand Hub grows. Only marketing-relevant fields: no
// addresses, VAT numbers, phone numbers or images.
export type BrandContext = {
  name: string;
  industry: string;
  description: string;
  website: string;
  location: string;
  toneOfVoice: string;
  brandVoice: BrandVoice;
  segments: AudienceSegment[];
  products: Product[];
  productDescription: string;
  contentPreferences: string;
  /** Brand Hub setup (empty strings/arrays when not filled in). */
  usps: string;
  audience: string;
  audienceInterests: string;
  language: string;
  tone: { preset: string; description: string } | null;
  personality: string[];
  designStyles: string[];
  typography: { heading: string; body: string };
  objective: string;
  channels: string[];
  businessGoals: string;
  ctas: string[];
};

export function buildBrandContext(profile: Profile): BrandContext {
  const s = strategyOf(profile);
  const preset = TONE_PRESETS.find((t) => t.id === s.tonePreset);
  return {
    name: profile.name || "Jouw bedrijf",
    industry: profile.industry,
    description: profile.description,
    website: profile.website,
    location: [profile.city, profile.country].filter(Boolean).join(", "),
    toneOfVoice: preset
      ? `${preset.label}: ${preset.description}`
      : profile.voice,
    brandVoice: { ...defaultBrandVoice, ...profile.brandVoice },
    segments: profile.segments || [],
    products: (profile.productList || [])
      .filter((p) => p.active)
      .map((p) => ({ ...p, photo: undefined })),
    productDescription: profile.products || "",
    contentPreferences: profile.contentPreferences || "",
    usps: s.usps,
    audience: profile.audience,
    audienceInterests: s.audienceInterests,
    language: languageLabel(s.language),
    tone: preset
      ? { preset: preset.label, description: preset.description }
      : null,
    personality: s.personality,
    designStyles: s.designStyles,
    typography: s.typography,
    objective: objectiveLabel(s.objective),
    channels: s.channels,
    businessGoals: s.businessGoals,
    ctas: s.ctas,
  };
}

export function findSegment(
  context: BrandContext,
  id?: string,
): AudienceSegment | undefined {
  return id ? context.segments.find((s) => s.id === id) : undefined;
}

export function findProduct(
  context: BrandContext,
  name?: string,
): Product | undefined {
  return name ? context.products.find((p) => p.name === name) : undefined;
}
