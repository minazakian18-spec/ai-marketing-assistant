import type { Profile } from "./types";
import { defaultBrandVoice, type BrandVoice, type EmojiUsage, type Formality } from "./brand-model.ts";

// Brand Hub setup: the extra brand fields (stored as profile.strategy next to
// the existing profile fields), the presets shown in the guided setup, and
// completion/validation. Existing profiles stay valid: every field is
// optional and missing values fall back to defaults.

export type TonePreset = "professioneel" | "vriendelijk" | "speels" | "luxe" | "informatief";

export type BrandStrategy = {
  usps: string;
  audienceInterests: string;
  language: string;
  tonePreset?: TonePreset;
  personality: string[];
  designStyles: string[];
  typography: { heading: string; body: string };
  referenceImages: string[];
  objective: string;
  channels: string[];
  businessGoals: string;
  ctas: string[];
  completedSteps: number[];
  finishedAt?: string;
};

export const defaultStrategy: BrandStrategy = {
  usps: "",
  audienceInterests: "",
  language: "nl",
  personality: [],
  designStyles: [],
  typography: { heading: "", body: "" },
  referenceImages: [],
  objective: "",
  channels: [],
  businessGoals: "",
  ctas: [],
  completedSteps: [],
};

export const strategyOf = (p: Profile): BrandStrategy => ({ ...defaultStrategy, ...(p.strategy || {}), typography: { ...defaultStrategy.typography, ...(p.strategy?.typography || {}) } });
export const voiceOf = (p: Profile): BrandVoice => ({ ...defaultBrandVoice, ...(p.brandVoice || {}) });

export const LANGUAGES: { id: string; label: string }[] = [
  { id: "nl", label: "Nederlands" },
  { id: "en", label: "Engels" },
  { id: "nl+en", label: "Nederlands en Engels" },
  { id: "de", label: "Duits" },
  { id: "fr", label: "Frans" },
];
export const languageLabel = (id: string) => LANGUAGES.find((l) => l.id === id)?.label || "Nederlands";

export const TONE_PRESETS: { id: TonePreset; label: string; description: string; voice: string; formality: Formality; emoji: EmojiUsage; example: string }[] = [
  { id: "professioneel", label: "Professioneel", description: "Helder, betrouwbaar en to the point.", voice: "Professioneel en helder", formality: "neutraal", emoji: "geen", example: "Vanaf maandag zijn we ook op zondag geopend. Reserveer eenvoudig online." },
  { id: "vriendelijk", label: "Vriendelijk", description: "Warm, persoonlijk en toegankelijk.", voice: "Warm en betrokken", formality: "informeel", emoji: "af en toe", example: "Goed nieuws: je bent nu ook op zondag welkom! Zien we je snel? 😊" },
  { id: "speels", label: "Speels", description: "Luchtig, creatief en met een knipoog.", voice: "Speels en creatief", formality: "informeel", emoji: "veel", example: "Zondag = funday 🎉 Vanaf nu staan onze deuren (en ovens) ook dan open!" },
  { id: "luxe", label: "Luxe", description: "Verfijnd, rustig en exclusief.", voice: "Professioneel en helder", formality: "formeel", emoji: "geen", example: "Vanaf heden verwelkomen wij u ook op zondag, voor een avond met aandacht voor elk detail." },
  { id: "informatief", label: "Informatief", description: "Feitelijk, behulpzaam en duidelijk.", voice: "Kort en direct", formality: "neutraal", emoji: "geen", example: "Nieuwe openingstijden: we zijn voortaan ook op zondag open van 12:00 tot 21:00." },
];

export const PERSONALITY = ["Betrouwbaar", "Gastvrij", "Creatief", "Eerlijk", "Ambachtelijk", "Innovatief", "Duurzaam", "Energiek", "Rustig", "Eigenzinnig", "Deskundig", "Lokaal"];
export const DESIGN_STYLES = ["Minimalistisch", "Warm en huiselijk", "Modern", "Klassiek", "Speels", "Luxe", "Natuurlijk", "Industrieel", "Kleurrijk"];
export const TYPOGRAPHY: { id: string; label: string; stack: string }[] = [
  { id: "modern", label: "Modern schreefloos", stack: "var(--font-inter), system-ui, sans-serif" },
  { id: "geometrisch", label: "Geometrisch", stack: "var(--font-lexend), system-ui, sans-serif" },
  { id: "klassiek", label: "Klassiek met schreef", stack: "Georgia, 'Times New Roman', serif" },
  { id: "elegant", label: "Elegant", stack: "'Didot', 'Bodoni 72', Georgia, serif" },
  { id: "afgerond", label: "Afgerond en vriendelijk", stack: "ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif" },
];
export const typeStack = (id: string) => TYPOGRAPHY.find((t) => t.id === id)?.stack || TYPOGRAPHY[0].stack;
export const OBJECTIVES: { id: string; label: string; description: string }[] = [
  { id: "klanten", label: "Meer klanten of reserveringen", description: "Content die aanzet tot een bezoek, boeking of aanvraag." },
  { id: "bekendheid", label: "Naamsbekendheid", description: "Herkenbare content die laat zien wie je bent." },
  { id: "omzet", label: "Meer online verkoop", description: "Producten en aanbiedingen centraal, met een duidelijke koopactie." },
  { id: "binding", label: "Klanten binden", description: "Vaste klanten blijven betrekken met nieuws en aandacht." },
  { id: "lancering", label: "Iets nieuws lanceren", description: "Een nieuw product, menu of dienst onder de aandacht brengen." },
  { id: "lokaal", label: "Lokaal beter gevonden worden", description: "Focus op je locatie, reviews en Google." },
];
export const objectiveLabel = (id: string) => OBJECTIVES.find((o) => o.id === id)?.label || "";
export const CHANNELS = ["Instagram", "Facebook", "E-mail en nieuwsbrief", "Google Bedrijfsprofiel", "Website en SEO", "WhatsApp"];
export const CTA_SUGGESTIONS = ["Reserveer nu", "Bestel online", "Bekijk het menu", "Plan een afspraak", "Bel ons", "Meld je aan", "Kom langs"];

export const HEX = /^#[0-9a-f]{6}$/i;

// ---------------------------------------------------------------- Steps

export const STEPS = [
  { id: 1, title: "Bedrijfsidentiteit", short: "Identiteit" },
  { id: 2, title: "Doelgroep en merkstem", short: "Stem" },
  { id: 3, title: "Visuele identiteit", short: "Visueel" },
  { id: 4, title: "Marketingdoelen", short: "Doelen" },
] as const;

type Field = { step: number; label: string; done: (p: Profile, s: BrandStrategy, v: BrandVoice) => boolean };
export const FIELDS: Field[] = [
  { step: 1, label: "Bedrijfsnaam", done: (p) => !!p.name.trim() },
  { step: 1, label: "Branche", done: (p) => !!p.industry.trim() },
  { step: 1, label: "Omschrijving", done: (p) => p.description.trim().length >= 20 },
  { step: 1, label: "Website", done: (p) => !!p.website.trim() },
  { step: 1, label: "Producten of diensten", done: (p) => !!p.products?.trim() || !!p.productList?.some((x) => x.active) },
  { step: 1, label: "Wat je uniek maakt", done: (_p, s) => !!s.usps.trim() },
  { step: 2, label: "Doelgroep", done: (p) => !!p.audience.trim() || !!p.segments?.length },
  { step: 2, label: "Interesses van klanten", done: (_p, s) => !!s.audienceInterests.trim() },
  { step: 2, label: "Toon", done: (_p, s) => !!s.tonePreset },
  { step: 2, label: "Merkpersoonlijkheid", done: (_p, s) => s.personality.length > 0 },
  { step: 2, label: "Woorden om te vermijden", done: (_p, _s, v) => !!v.avoidWords.trim() },
  { step: 3, label: "Logo", done: (p) => !!p.logo },
  { step: 3, label: "Merkkleuren", done: (_p, _s, v) => v.colors.some((c) => HEX.test(c)) },
  { step: 3, label: "Ontwerpstijl", done: (_p, s) => s.designStyles.length > 0 },
  { step: 3, label: "Lettertype", done: (_p, s) => !!s.typography.heading },
  { step: 4, label: "Hoofddoel", done: (_p, s) => !!s.objective },
  { step: 4, label: "Kanalen", done: (_p, s) => s.channels.length > 0 },
  { step: 4, label: "Call-to-action", done: (_p, s) => s.ctas.length > 0 },
  { step: 4, label: "Marketingvoorkeuren", done: (p, s) => !!p.contentPreferences?.trim() || !!s.businessGoals.trim() },
];

export function completion(p: Profile) {
  const s = strategyOf(p);
  const v = voiceOf(p);
  const results = FIELDS.map((f) => ({ ...f, filled: f.done(p, s, v) }));
  const perStep = STEPS.map((st) => {
    const fs = results.filter((r) => r.step === st.id);
    return { step: st.id, filled: fs.filter((f) => f.filled).length, total: fs.length, missing: fs.filter((f) => !f.filled).map((f) => f.label) };
  });
  return { percent: Math.round((results.filter((r) => r.filled).length / results.length) * 100), perStep };
}

/** Minimum needed to continue from a step (everything else is optional). */
export function stepErrors(step: number, p: Profile): Record<string, string> {
  const s = strategyOf(p);
  const v = voiceOf(p);
  const e: Record<string, string> = {};
  if (step === 1) {
    if (!p.name.trim()) e.name = "Vul je bedrijfsnaam in.";
    if (!p.industry.trim()) e.industry = "Vul je branche in.";
    if (p.description.trim().length < 20) e.description = "Beschrijf je bedrijf in minimaal 20 tekens.";
    if (p.website.trim() && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(p.website.trim())) e.website = "Gebruik een volledig webadres, bijvoorbeeld https://jouwbedrijf.nl.";
  }
  if (step === 2) {
    if (!p.audience.trim() && !p.segments?.length) e.audience = "Beschrijf in een paar woorden voor wie je werkt.";
    if (!s.tonePreset && !p.voice.trim()) e.tonePreset = "Kies een toon die bij je merk past.";
  }
  if (step === 3) {
    if (v.colors.some((c) => c && !HEX.test(c))) e.colors = "Gebruik een kleurcode als #6D28D9.";
  }
  if (step === 4) {
    if (!s.objective) e.objective = "Kies je belangrijkste marketingdoel.";
  }
  return e;
}

// ---------------------------------------------------------------- Validation (server + local storage)

const str = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const strArr = (v: unknown, maxItems: number, maxLen: number) => Array.isArray(v) && v.length <= maxItems && v.every((x) => str(x, maxLen));
export const DATA_IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export function strategyValid(v: unknown): boolean {
  const s = v as Record<string, unknown>;
  if (!s || typeof s !== "object") return false;
  const t = s.typography as Record<string, unknown> | undefined;
  return (
    str(s.usps, 2000) &&
    str(s.audienceInterests, 1000) &&
    LANGUAGES.some((l) => l.id === s.language) &&
    (s.tonePreset === undefined || TONE_PRESETS.some((x) => x.id === s.tonePreset)) &&
    strArr(s.personality, 12, 40) &&
    strArr(s.designStyles, 9, 40) &&
    !!t &&
    str(t.heading, 40) &&
    str(t.body, 40) &&
    Array.isArray(s.referenceImages) &&
    s.referenceImages.length <= 6 &&
    s.referenceImages.every((x) => typeof x === "string" && DATA_IMAGE.test(x) && x.length <= 400_000) &&
    (s.objective === "" || OBJECTIVES.some((o) => o.id === s.objective)) &&
    strArr(s.channels, 10, 40) &&
    str(s.businessGoals, 2000) &&
    strArr(s.ctas, 6, 60) &&
    Array.isArray(s.completedSteps) &&
    s.completedSteps.length <= 4 &&
    s.completedSteps.every((x) => Number.isInteger(x) && (x as number) >= 1 && (x as number) <= 4) &&
    (s.finishedAt === undefined || str(s.finishedAt, 40))
  );
}
