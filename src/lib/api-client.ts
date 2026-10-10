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

export type ContentEditAction = "rewrite" | "shorter" | "longer" | "professional" | "friendly" | "clearer" | "cta" | "alternatives";
export const CONTENT_EDIT_LABELS: [ContentEditAction, string][] = [
  ["rewrite", "Herschrijven"],
  ["shorter", "Korter"],
  ["longer", "Uitgebreider"],
  ["professional", "Professioneler"],
  ["friendly", "Vriendelijker"],
  ["clearer", "Duidelijker"],
  ["cta", "Sterkere call-to-action"],
  ["alternatives", "3 alternatieven"],
];

/** AI quick action on the editor's own text. Returns suggestions; never edits by itself. */
export async function editContentText(action: ContentEditAction, text: string, channel: "instagram" | "email"): Promise<string[]> {
  if (isBrowserDemo()) throw new Error("AI-bewerken werkt alleen met een echt account. In de testmodus is je tekst niet gewijzigd.");
  const { results } = await postJson<{ results: string[] }>("/api/generate/edit", { action, text, channel });
  return results;
}
