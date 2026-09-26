export type PricingPlan = {
  id: "starter" | "growth" | "autopilot";
  name: string;
  tagline: string;
  monthlyPrice: number;
  recommended?: boolean;
  features: string[];
  mutedFeatures?: string[];
};

// Yearly discount percentage lives in one place so marketing copy never
// hardcodes a specific claim in multiple spots.
export const YEARLY_DISCOUNT_PERCENT = 20;

export const pricingPlans: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Voor kleine bedrijven die starten met AI-marketing.",
    monthlyPrice: 29,
    features: [
      "1 gebruiker",
      "Review AI (Assist)",
      "Instagram AI (Assist)",
      "Contentkalender",
      "Library",
      "1 Google Business Profile-locatie",
    ],
    mutedFeatures: ["Email AI", "Auto Create & Full Pilot", "Meerdere teamleden"],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Voor bedrijven die meerdere kanalen willen automatiseren.",
    monthlyPrice: 79,
    recommended: true,
    features: [
      "Tot 5 gebruikers",
      "Review AI, Instagram AI en Email AI",
      "Assist en Auto Create",
      "Contentkalender en Library",
      "Basis-analytics per kanaal",
      "3 Google Business Profile-locaties",
    ],
    mutedFeatures: ["Full Pilot voor alle kanalen"],
  },
  {
    id: "autopilot",
    name: "Autopilot",
    tagline: "Voor bedrijven die terugkerende marketing willen uitbesteden aan AI.",
    monthlyPrice: 149,
    features: [
      "Onbeperkt aantal gebruikers",
      "Review AI, Instagram AI en Email AI",
      "Assist, Auto Create en Full Pilot",
      "Onbeperkt Google Business Profile-locaties",
      "Uitgebreide analytics per kanaal",
      "Prioriteit bij nieuwe functies",
    ],
  },
];

export const compareRows: { label: string; values: [string, string, string] }[] = [
  { label: "Gebruikers", values: ["1", "Tot 5", "Onbeperkt"] },
  { label: "Review AI", values: ["Assist", "Assist + Auto Create", "Assist + Auto Create + Full Pilot"] },
  { label: "Instagram AI", values: ["Assist", "Assist + Auto Create", "Assist + Auto Create + Full Pilot"] },
  { label: "Email AI", values: ["—", "Assist + Auto Create", "Assist + Auto Create + Full Pilot"] },
  { label: "Google Business Profile-locaties", values: ["1", "3", "Onbeperkt"] },
  { label: "Analytics", values: ["—", "Basis", "Uitgebreid"] },
];
