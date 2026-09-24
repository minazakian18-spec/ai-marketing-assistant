import type { Profile } from "../types";
import {
  defaultBrandVoice,
  type BrandVoice,
  type AudienceSegment,
  type Product,
} from "../brand-model.ts";

// The single, reusable "brand brain" that every AI feature (Instagram,
// Email, Review) is built from. Real AI providers should be handed this
// object, never raw Profile fields, so every feature stays consistent when
// Brand Hub grows.
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
};

export function buildBrandContext(profile: Profile): BrandContext {
  return {
    name: profile.name || "Jouw bedrijf",
    industry: profile.industry,
    description: profile.description,
    website: profile.website,
    location: [profile.city, profile.country].filter(Boolean).join(", "),
    toneOfVoice: profile.voice,
    brandVoice: profile.brandVoice || defaultBrandVoice,
    segments: profile.segments || [],
    products: (profile.productList || []).filter((p) => p.active),
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
