import { isBrowserDemo } from "./demo";
import type { GenerationRequest } from "./providers/contracts";
import type { EmailRequest } from "./providers/email-mock";
import type { Post } from "./types";
import type { EmailCampaign } from "./email-model";

// Thin client-side wrappers around the Mavix backend's generation routes
// (src/app/api/generate/*). AI calls never happen directly in the browser.
// Every request carries an Idempotency-Key so a double click or network retry
// of the same action is not billed twice (see server/ai-usage.ts). The Auto
// Create/Full Autopilot simulation loops still call the local mock functions.
async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Er ging iets mis bij het genereren.");
  }
  return response.json();
}

export function generateInstagramContent(request: GenerationRequest): Promise<Post> {
  if (isBrowserDemo()) return import("./providers/mock").then((module) => module.generateContent(request));
  return postJson<Post>("/api/generate/instagram", request);
}

export function generateEmailCampaign(request: EmailRequest): Promise<EmailCampaign> {
  if (isBrowserDemo()) return import("./providers/email-mock").then((module) => module.generateEmail(request));
  return postJson<EmailCampaign>("/api/generate/email", request);
}

export type ContentEditAction = "rewrite" | "shorter" | "longer" | "professional" | "friendly" | "clearer" | "cta" | "alternatives" | "hashtags" | "spelling" | "translate_en" | "translate_nl" | "headline";
export const CONTENT_EDIT_LABELS: [ContentEditAction, string][] = [
  ["rewrite", "Herschrijven"],
  ["shorter", "Korter"],
  ["longer", "Uitgebreider"],
  ["professional", "Professioneler"],
  ["friendly", "Vriendelijker"],
  ["clearer", "Duidelijker"],
  ["cta", "Sterkere call-to-action"],
  ["alternatives", "3 alternatieven"],
  ["headline", "Andere openingszin"],
  ["spelling", "Spelling en grammatica"],
  ["translate_en", "Vertaal naar Engels"],
  ["translate_nl", "Vertaal naar Nederlands"],
];

/** AI quick action on the editor's own text. Returns suggestions; never edits by itself. */
export async function editContentText(action: ContentEditAction, text: string, channel: "instagram" | "email" | "copy"): Promise<string[]> {
  if (isBrowserDemo()) throw new Error("AI-bewerken werkt alleen met een echt account. In de testmodus is je tekst niet gewijzigd.");
  const { results } = await postJson<{ results: string[] }>("/api/generate/edit", { action, text, channel });
  return results;
}

/** Marketing copy for Content Studio (server-side AI, metered). */
export type CampaignDraft = {
  title: string;
  instagram: { caption: string; hashtags: string; visual_brief: string } | null;
  email: { subject: string; preview: string; body: string; cta: string } | null;
  copy: { title: string; body: string } | null;
  ctas: string[];
  schedule: { channel: "instagram" | "email" | "copy"; day_offset: number; time: string }[];
  missing_facts: string[];
};

/** A multi-channel campaign draft (nothing is saved). In test mode: a labelled example, no AI. */
export async function generateCampaignDraft(goal: string, channels: ("instagram" | "email" | "copy")[], businessName = ""): Promise<{ draft: CampaignDraft; example: boolean }> {
  if (isBrowserDemo()) {
    const who = businessName || "[bedrijfsnaam]";
    const has = (c: string) => channels.includes(c as "instagram");
    return {
      example: true,
      draft: {
        title: goal.slice(0, 60),
        instagram: has("instagram") ? { caption: `${goal}\n\nKom langs bij ${who} en ontdek het zelf. [voeg een concreet detail toe]\n\nReserveer via de link in onze bio.`, hashtags: "#lokaal #nieuw #genieten", visual_brief: "Een close-up van het product in natuurlijk licht, met de zaak op de achtergrond." } : null,
        email: has("email") ? { subject: goal.slice(0, 55), preview: `Nieuw bij ${who}`, body: `Beste [voornaam],\n\n${goal}\n\n[voeg details toe: wat, wanneer en waarom het de moeite waard is]\n\nWe zien je graag!\n\nGroet,\n${who}`, cta: "Reserveer nu" } : null,
        copy: has("copy") ? { title: goal.slice(0, 60), body: `${goal}. Bij ${who} [beschrijf wat het bijzonder maakt]. Kom langs of reserveer online.` } : null,
        ctas: ["Reserveer nu", "Bekijk het menu"],
        schedule: channels.map((c, i) => ({ channel: c, day_offset: i * 2 + 1, time: c === "email" ? "09:30" : "17:00" })),
        missing_facts: ["Testmodus: dit is een voorbeeld zonder AI. Met een echt account schrijft Mavix op basis van je Brand Hub."],
      },
    };
  }
  const { draft } = await postJson<{ draft: CampaignDraft }>("/api/generate/campaign", { goal, channels });
  return { draft, example: false };
}

/** A real AI image (OpenAI Images API, server-side). In test mode there is no AI: a clear error, no placeholder. */
export type SlideRequest = { visualStyle: string; slideBrief: string; index: number; total: number; styleReference?: string };
export async function generateImage(o: { mode: "generate" | "edit"; brief: string; format: "square" | "portrait"; photo?: string; references?: string[]; slide?: SlideRequest; useBrand?: boolean }): Promise<string> {
  if (isBrowserDemo()) throw new Error("In de testmodus maakt Mavix geen AI-afbeeldingen. Met een echt account genereert Mavix hier een nieuwe afbeelding.");
  const { image } = await postJson<{ image: string }>("/api/generate/image", o);
  return image;
}

export type CarouselPlanResult = { title: string; concept: string; audience: string; goal: string; visual_style: string; slides: { headline: string; body: string; image_brief: string }[]; caption: string; hashtags: string };
/** Phase A of a carousel: one coherent plan (server-side AI, metered as one carousel). */
export async function generateCarouselPlan(o: { brief: string; goal: string; slides: number; product?: string; cta?: string; useBrand?: boolean }): Promise<CarouselPlanResult> {
  if (isBrowserDemo()) throw new Error("In de testmodus maakt Mavix geen AI-carrousels. Met een echt account bedenkt Mavix hier het verhaal en de beelden.");
  const { plan } = await postJson<{ plan: CarouselPlanResult }>("/api/generate/carousel", o);
  return plan;
}

export async function generateCopyText(kind: string, prompt: string): Promise<string> {
  if (isBrowserDemo()) throw new Error("AI-teksten maken werkt alleen met een echt account. Je kunt de tekst wel zelf schrijven.");
  const { text } = await postJson<{ text: string }>("/api/generate/copy", { kind, prompt });
  return text;
}