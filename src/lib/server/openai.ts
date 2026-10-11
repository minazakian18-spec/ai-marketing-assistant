import "server-only";
import OpenAI from "openai";
import { HttpError } from "./access";
import { currentOutputLimit, recordTokens } from "./ai-usage";

// Central OpenAI configuration for every Mavix AI feature (Responses API,
// official SDK). The key is read only on the server (OPENAI_API_KEY) and is
// never logged, returned or sent to the browser.
//
// Models (server-side env, defaults chosen for cost):
//   OPENAI_MODEL           ordinary marketing tasks       default gpt-5.6-luna
//   OPENAI_ADVANCED_MODEL  e-mails, inbox replies, agent  default gpt-5.4-mini
// Reasoning effort stays low/none: these are short writing tasks, and
// reasoning tokens are billed as output.

export const DEFAULT_MODEL = "gpt-5.6-luna";
export const DEFAULT_ADVANCED_MODEL = "gpt-5.4-mini";
export type AiTier = "standard" | "advanced";
export type AiMessage = { role: "user"; content: { type: "text"; text: string }[] };

export const aiConfigured = () => !!process.env.OPENAI_API_KEY;
export function modelFor(tier: AiTier) {
  const v = tier === "advanced" ? process.env.OPENAI_ADVANCED_MODEL : process.env.OPENAI_MODEL;
  return (v || "").trim() || (tier === "advanced" ? DEFAULT_ADVANCED_MODEL : DEFAULT_MODEL);
}

let client: OpenAI | null = null;
let clientFor: unknown = null;
function openai() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new HttpError(503, "AI is nog niet geconfigureerd. Er is niets gegenereerd.");
  // One retry at most: a retry is a second paid request.
  if (!client || clientFor !== key) {
    client = new OpenAI({ apiKey: key, timeout: 45_000, maxRetries: 1 });
    clientFor = key;
  }
  return client;
}
/** Test hook: inject a fake client (never used in production code paths). */
export function __setOpenAIClient(fake: unknown) {
  client = fake as OpenAI;
  clientFor = process.env.OPENAI_API_KEY;
}

const toInput = (messages: AiMessage[]) =>
  messages.map((m) => ({ role: m.role, content: m.content.map((c) => ({ type: "input_text" as const, text: c.text })) }));

/** One text generation. Records tokens for the current metered request. */
export async function aiText(instructions: string, messages: AiMessage[], tier: AiTier = "standard"): Promise<string> {
  const model = modelFor(tier);
  try {
    const response = await openai().responses.create({
      model,
      instructions,
      input: toInput(messages),
      max_output_tokens: currentOutputLimit(1500),
      reasoning: { effort: tier === "advanced" ? "low" : "none" },
      store: false,
    });
    const usage = response.usage;
    if (usage) recordTokens(model, usage.input_tokens || 0, usage.output_tokens || 0);
    const text = (response.output_text || "").trim();
    if (response.status === "incomplete" && !text) throw new HttpError(502, "Mavi kreeg geen volledig antwoord. Probeer een kortere opdracht.");
    if (!text) throw new HttpError(502, "Mavi gaf geen voorstel terug. Probeer het opnieuw.");
    console.info(JSON.stringify({ event: "ai_generated", model, input: usage?.input_tokens || 0, output: usage?.output_tokens || 0 }));
    return text;
  } catch (e) {
    throw aiError(e);
  }
}

// Provider errors become short Dutch messages; details never reach the user.
export function aiError(e: unknown): unknown {
  if (e instanceof HttpError) return e;
  if (e instanceof OpenAI.APIError) {
    const code = (e as { code?: string | null }).code || "";
    console.error(JSON.stringify({ event: "ai_failed", status: e.status ?? 0, code }));
    if (code === "insufficient_quota" || code === "billing_hard_limit_reached")
      return new HttpError(503, "Het AI-tegoed van Mavix is op. Er is niets gegenereerd; probeer het later opnieuw.");
    if (e instanceof OpenAI.RateLimitError) return new HttpError(429, "Mavi is even druk. Probeer het over een minuut opnieuw.");
    if (e instanceof OpenAI.AuthenticationError || e instanceof OpenAI.PermissionDeniedError) return new HttpError(503, "AI is nog niet goed geconfigureerd. Er is niets gegenereerd.");
    if (e instanceof OpenAI.NotFoundError) return new HttpError(503, "Het ingestelde AI-model is niet beschikbaar. Er is niets gegenereerd.");
    if (e instanceof OpenAI.APIConnectionError) return new HttpError(503, "Mavi is tijdelijk niet bereikbaar. Probeer het opnieuw.");
    if (e instanceof OpenAI.BadRequestError) return new HttpError(502, "Mavi kon geen voorstel maken voor deze opdracht.");
    return new HttpError(503, "Mavi is tijdelijk niet beschikbaar. Probeer het opnieuw.");
  }
  return e;
}
