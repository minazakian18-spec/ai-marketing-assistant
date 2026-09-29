import { isBrowserDemo } from "./demo";
import type { GenerationRequest } from "./providers/contracts";
import type { EmailRequest } from "./providers/email-mock";
import type { Post } from "./types";
import type { EmailCampaign } from "./email-model";

// Thin client-side wrappers around the Mavix backend's generation routes
// (src/app/api/generate/*). Manual "Assist" generation goes through these so
// AI calls never happen directly in the browser. The Auto Create/Full
// Autopilot simulation loops still call the local mock functions directly
// for now — batching many AI calls per click needs a proper backend job
// design, which is a separate, later step.
async function postJson<TResponse>(
  url: string,
  body: unknown,
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Er ging iets mis bij het genereren.");
  }
  return response.json();
}

export function generateInstagramContent(
  request: GenerationRequest,
): Promise<Post> {
  if (isBrowserDemo())
    return import("./providers/mock").then((module) =>
      module.generateContent(request),
    );
  return postJson<Post>("/api/generate/instagram", request);
}

export function generateEmailCampaign(
  request: EmailRequest,
): Promise<EmailCampaign> {
  if (isBrowserDemo())
    return import("./providers/email-mock").then((module) =>
      module.generateEmail(request),
    );
  return postJson<EmailCampaign>("/api/generate/email", request);
}
