import type { Profile } from "../types";
import type { EmailKind } from "../email-model";
import type { Product } from "../brand-model";
import { buildBrandContext, findProduct, type BrandContext } from "./brand-context.ts";

export type EmailLength = "kort" | "gemiddeld" | "lang";
export const emailLengths: { id: EmailLength; label: string }[] = [
  { id: "kort", label: "Kort" },
  { id: "gemiddeld", label: "Gemiddeld" },
  { id: "lang", label: "Uitgebreid" },
];

export type EmailInstruction = {
  brand: BrandContext;
  kind: EmailKind;
  audience: string;
  product?: Product;
  offer: string;
  tone: string;
  length: EmailLength;
  cta: string;
  userInstruction: string;
  useWebsite: boolean;
};

export function buildEmailInstruction(input: {
  profile: Profile;
  prompt: string;
  kind: EmailKind;
  audience: string;
  product?: string;
  offer?: string;
  tone?: string;
  length?: EmailLength;
  cta?: string;
  useWebsite: boolean;
}): EmailInstruction {
  const brand = buildBrandContext(input.profile);
  return {
    brand,
    kind: input.kind,
    audience: input.audience,
    product: findProduct(brand, input.product),
    offer: input.offer?.trim() || "",
    tone: input.tone?.trim() || brand.toneOfVoice,
    length: input.length || "gemiddeld",
    cta: input.cta?.trim() || "",
    userInstruction: input.prompt,
    useWebsite: input.useWebsite,
  };
}
