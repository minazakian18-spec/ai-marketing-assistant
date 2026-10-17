import "server-only";
import OpenAI, { toFile } from "openai";
import { HttpError } from "./access";
import type { FunctionTool, ResponseInputItem, ResponseFunctionToolCall } from "openai/resources/responses/responses";
import { currentOutputLimit, currentInputLimit, recordTokens, takeStep, imageModel, DEFAULT_MODEL, DEFAULT_ADVANCED_MODEL } from "./ai-usage";
export { DEFAULT_MODEL, DEFAULT_ADVANCED_MODEL };

// Central OpenAI configuration for every Mavix AI feature (Responses API,
// official SDK). The key is read only on the server (OPENAI_API_KEY) and is
// never logged, returned or sent to the browser.
//
// Models (server-side env, defaults chosen for cost):
//   OPENAI_MODEL           ordinary marketing tasks       default gpt-5.6-luna
//   OPENAI_ADVANCED_MODEL  e-mails, inbox replies, agent  default gpt-5.4-mini
// Reasoning effort stays low/none: these are short writing tasks, and
// reasoning tokens are billed as output.

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
  // Hard input cap (about 3 characters per token, conservative for Dutch):
  // a request can never cost more than the budget reservation assumed.
  const chars = instructions.length + messages.reduce((s, m) => s + m.content.reduce((t, c) => t + c.text.length, 0), 0);
  if (chars > currentInputLimit() * 3) throw new HttpError(413, "Deze opdracht is te lang voor Mavi. Maak hem korter.");
  takeStep();
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
    // output_tokens already includes reasoning tokens (billed as output).
    console.info(JSON.stringify({ event: "ai_generated", model, input: usage?.input_tokens || 0, output: usage?.output_tokens || 0, reasoning: usage?.output_tokens_details?.reasoning_tokens || 0 }));
    return text;
  } catch (e) {
    throw aiError(e);
  }
}

/**
 * One generation with a strict JSON schema (Structured Outputs). Same key
 * handling, input cap, step accounting, token recording and error mapping as
 * aiText. Returns the parsed object; a malformed answer is an error, never
 * a guess.
 */
export async function aiJson<T>(instructions: string, messages: AiMessage[], schema: { name: string; schema: Record<string, unknown> }, tier: AiTier = "standard"): Promise<T> {
  const model = modelFor(tier);
  const chars = instructions.length + messages.reduce((s, m) => s + m.content.reduce((t, c) => t + c.text.length, 0), 0);
  if (chars > currentInputLimit() * 3) throw new HttpError(413, "Deze opdracht is te lang voor Mavi. Maak hem korter.");
  takeStep();
  try {
    const response = await openai().responses.create({
      model,
      instructions,
      input: toInput(messages),
      max_output_tokens: currentOutputLimit(2000),
      reasoning: { effort: tier === "advanced" ? "low" : "none" },
      text: { format: { type: "json_schema", name: schema.name, schema: schema.schema, strict: true } },
      store: false,
    });
    const usage = response.usage;
    if (usage) recordTokens(model, usage.input_tokens || 0, usage.output_tokens || 0);
    const text = (response.output_text || "").trim();
    if (response.status === "incomplete" || !text) throw new HttpError(502, "Mavi kreeg geen volledig antwoord. Probeer een kortere opdracht.");
    console.info(JSON.stringify({ event: "ai_generated", model, input: usage?.input_tokens || 0, output: usage?.output_tokens || 0, format: schema.name }));
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new HttpError(502, "Mavi gaf een onbruikbaar antwoord. Probeer het opnieuw.");
    }
  } catch (e) {
    throw aiError(e);
  }
}

export type AiStepResult = {
  text: string;
  calls: ResponseFunctionToolCall[];
  /** Items to send back on the next step (function calls and reasoning; store is off). */
  carry: ResponseInputItem[];
};

/**
 * One model call that may request tools (Mavix Agent). Same key handling,
 * input cap, token recording and error mapping as aiText; each call uses one
 * step of the request's reservation. `final` forbids further tool calls, so
 * the model must answer in text (the tools stay declared because earlier
 * steps in `input` refer to them).
 */
export async function aiStep(instructions: string, input: ResponseInputItem[], tools: FunctionTool[], final = false, tier: AiTier = "advanced"): Promise<AiStepResult> {
  const model = modelFor(tier);
  const chars = instructions.length + JSON.stringify(input).length;
  if (chars > currentInputLimit() * 3) throw new HttpError(413, "Deze vraag heeft te veel gegevens nodig voor één antwoord. Maak hem kleiner.");
  takeStep();
  try {
    const response = await openai().responses.create({
      model,
      instructions,
      input,
      tools,
      tool_choice: tools.length && !final ? "auto" : "none",
      parallel_tool_calls: true,
      max_output_tokens: currentOutputLimit(1500),
      reasoning: { effort: tier === "advanced" ? "low" : "none" },
      // store is off, so reasoning travels with the next request encrypted.
      include: ["reasoning.encrypted_content"],
      store: false,
    });
    const usage = response.usage;
    if (usage) recordTokens(model, usage.input_tokens || 0, usage.output_tokens || 0);
    const output = response.output || [];
    const calls = output.filter((o): o is ResponseFunctionToolCall => o.type === "function_call");
    const carry = output.filter((o) => o.type === "function_call" || o.type === "reasoning") as ResponseInputItem[];
    const text = (response.output_text || "").trim();
    if (!calls.length && !text) {
      if (response.status === "incomplete") throw new HttpError(502, "Mavi kreeg geen volledig antwoord. Probeer een kortere vraag.");
      throw new HttpError(502, "Mavi gaf geen antwoord terug. Probeer het opnieuw.");
    }
    console.info(JSON.stringify({ event: "ai_step", model, input: usage?.input_tokens || 0, output: usage?.output_tokens || 0, tools: calls.map((c) => c.name) }));
    return { text, calls, carry };
  } catch (e) {
    throw aiError(e);
  }
}

/**
 * One AI image through the OpenAI Images API (gpt-image-1 by default,
 * OPENAI_IMAGE_MODEL to override). "generate" makes a new image from the
 * prompt; "edit" changes the given photo. Returns JPEG bytes. Same step
 * accounting, token recording and error mapping as the text calls.
 */
/**
 * Size to request per format. gpt-image-2.5 accepts custom sizes (multiples
 * of 16), so portrait is generated directly at Instagram's 4:5 (1024x1280).
 * gpt-image-1 only knows fixed sizes: portrait is made at 1024x1536 and
 * cropped to 4:5 afterwards.
 */
export function imagePlan(format: "square" | "portrait", model = imageModel()) {
  if (format === "square") return { size: "1024x1024", crop: false };
  return model.startsWith("gpt-image-1") ? { size: "1024x1536", crop: true } : { size: "1024x1280", crop: false };
}

/**
 * `photo`: one own photo to EDIT. `references`: inspiration images for a NEW
 * image (sent as real image inputs to the edit endpoint, which accepts
 * several; the prompt tells the model to create something new in their style).
 */
export async function aiImage(o: { prompt: string; size: string; photo?: { data: Buffer; mime: string }; references?: { data: Buffer; mime: string }[] }): Promise<Buffer> {
  const model = imageModel();
  if (o.prompt.length > currentInputLimit() * 3) throw new HttpError(413, "Deze beschrijving is te lang. Maak hem korter.");
  takeStep();
  // Worst case of this request, recorded when the outcome (and bill) is unknown.
  const worstCase = () => recordTokens(model, currentInputLimit(), currentOutputLimit());
  try {
    // Quality over price: "high" for agency-grade detail. No automatic retry:
    // a retry would be a second paid image. Images can take a minute.
    const common = { model, prompt: o.prompt, size: o.size as "1024x1024", quality: "high" as const, output_format: "jpeg" as const, output_compression: 90, n: 1 };
    const options = { timeout: 150_000, maxRetries: 0 };
    // Bound the input tokens: every input image at most 1024 px on the long side.
    const shrink = async (img: { data: Buffer; mime: string }) => {
      try {
        const sharp = (await import("sharp")).default;
        return { data: await sharp(img.data).resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer(), mime: "image/jpeg" };
      } catch {
        return img; // without sharp the validated original (max 8 MB) is sent
      }
    };
    const inputs = await Promise.all((o.photo ? [o.photo] : o.references || []).map(shrink));
    const files = await Promise.all(inputs.map((img, i) => toFile(img.data, `beeld-${i + 1}.${img.mime.split("/")[1] || "png"}`, { type: img.mime })));
    const response = files.length
      ? await openai().images.edit({ ...common, image: files.length === 1 ? files[0] : files }, options)
      : await openai().images.generate(common, options);
    const usage = response.usage;
    if (usage) recordTokens(model, usage.input_tokens || 0, usage.output_tokens || 0);
    else worstCase();
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new HttpError(502, "Mavi kon geen afbeelding maken. Probeer een andere beschrijving.");
    console.info(JSON.stringify({ event: "ai_image", model, mode: o.photo ? "edit" : "generate", input: usage?.input_tokens || 0, output: usage?.output_tokens || 0 }));
    return Buffer.from(b64, "base64");
  } catch (e) {
    // Timeout or broken connection: OpenAI may have made (and billed) the
    // image anyway. Count the worst case so the budget never under-counts.
    if (e instanceof OpenAI.APIConnectionError) {
      worstCase();
      return Promise.reject(new HttpError(504, "Het maken van de afbeelding duurde te lang. Probeer het opnieuw; dit verzoek is voor de zekerheid meegeteld in je AI-tegoed."));
    }
    // Refused by the provider's safety system: say so plainly.
    if (e instanceof OpenAI.BadRequestError && /safety|moderation/i.test(String((e as { code?: string }).code || e.message))) return Promise.reject(new HttpError(400, "Deze beschrijving kan Mavi niet als afbeelding maken. Pas de beschrijving aan."));
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
