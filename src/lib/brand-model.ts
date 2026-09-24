export type AudienceType = "B2C" | "B2B" | "Beide";

export type AudienceSegment = {
  id: string;
  name: string;
  type: AudienceType;
  ageRange: string;
  location: string;
  interests: string;
  problems: string;
  goals: string;
  whyTheyChoose: string;
  pricePositioning: string;
  buyingBehavior: string;
};

export type Product = {
  id: string;
  name: string;
  photo?: string;
  description: string;
  category: string;
  price: string;
  url: string;
  features: string;
  targetCustomer: string;
  active: boolean;
  source: "manual" | "import";
};

export type EmojiUsage = "geen" | "af en toe" | "veel";
export type Formality = "formeel" | "neutraal" | "informeel";
export const formalityOptions: Formality[] = ["formeel", "neutraal", "informeel"];

export type BrandVoice = {
  colors: string[];
  preferredWords: string;
  avoidWords: string;
  emojiUsage: EmojiUsage;
  formality: Formality;
  marketingStyle: string;
};

export const defaultBrandVoice: BrandVoice = {
  colors: [],
  preferredWords: "",
  avoidWords: "",
  emojiUsage: "af en toe",
  formality: "neutraal",
  marketingStyle: "",
};

export function newSegment(): AudienceSegment {
  return {
    id: crypto.randomUUID(),
    name: "",
    type: "B2C",
    ageRange: "",
    location: "",
    interests: "",
    problems: "",
    goals: "",
    whyTheyChoose: "",
    pricePositioning: "",
    buyingBehavior: "",
  };
}

export function newProduct(): Product {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    category: "",
    price: "",
    url: "",
    features: "",
    targetCustomer: "",
    active: true,
    source: "manual",
  };
}

const segmentStringFields = [
  "id",
  "name",
  "ageRange",
  "location",
  "interests",
  "problems",
  "goals",
  "whyTheyChoose",
  "pricePositioning",
  "buyingBehavior",
] as const;

export function segmentValid(s: Record<string, unknown>): boolean {
  return !!(
    s &&
    segmentStringFields.every((k) => typeof s[k] === "string") &&
    ["B2C", "B2B", "Beide"].includes(String(s.type))
  );
}

const productStringFields = [
  "id",
  "name",
  "description",
  "category",
  "price",
  "url",
  "features",
  "targetCustomer",
] as const;

const imageValid = (v: unknown) =>
  typeof v === "string" &&
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v);

export function productValid(p: Record<string, unknown>): boolean {
  return !!(
    p &&
    productStringFields.every((k) => typeof p[k] === "string") &&
    typeof p.active === "boolean" &&
    ["manual", "import"].includes(String(p.source)) &&
    (p.photo === undefined || imageValid(p.photo))
  );
}

export function brandVoiceValid(b: Record<string, unknown>): boolean {
  return !!(
    b &&
    Array.isArray(b.colors) &&
    b.colors.every((c) => typeof c === "string") &&
    typeof b.preferredWords === "string" &&
    typeof b.avoidWords === "string" &&
    typeof b.marketingStyle === "string" &&
    ["geen", "af en toe", "veel"].includes(String(b.emojiUsage)) &&
    ["formeel", "neutraal", "informeel"].includes(String(b.formality))
  );
}

export const audienceTypeLabel: Record<AudienceType, string> = {
  B2C: "Consumenten (B2C)",
  B2B: "Zakelijk (B2B)",
  Beide: "Beide",
};
