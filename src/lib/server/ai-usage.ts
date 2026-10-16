import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { adminClient } from "./supabase";
import { HttpError } from "./access";

// AI usage control around every AI request (ai_usage ledger, migration
// 202610120001). Order: quota check -> concurrency/duplicate guard -> request
// -> tokens recorded. Prompts and outputs are never stored, only counts.
//
// Costs: Mavix only multiplies tokens by prices you configure
// Costs: tokens x the OpenAI price of the model that answered (PRICES).
// For a model not in the table, AI_PRICE_INPUT/OUTPUT_PER_MTOK is used.
// A global monthly budget (AI_GLOBAL_MONTHLY_BUDGET_USD, default 8 of the
// 10 USD prepaid credit) stops all AI before the provider credit runs out.

export type AiFeature =
  | "inbox_reply"
  | "inbox_rewrite"
  | "inbox_summary"
  | "content_instagram"
  | "content_email"
  | "content_edit"
  | "content_copy"
  | "content_campaign"
  | "brand_preview"
  | "brand_improve"
  | "seo_suggest"
  | "review_reply"
  | "research"
  | "agent";

// Output cap per feature (tokens); short drafts never need the model maximum.
// Output cap per feature (tokens, including reasoning tokens). Deliberately
// short: drafts never need more, and output tokens cost the most.
export const OUTPUT_LIMIT: Record<AiFeature, number> = {
  inbox_reply: 900,
  inbox_rewrite: 900,
  inbox_summary: 500,
  content_instagram: 1000,
  content_email: 1800,
  content_edit: 1400,
  content_copy: 1200,
  // A full campaign: Instagram post, e-mail, copy, CTAs, brief and schedule in one answer.
  content_campaign: 2600,
  brand_preview: 700,
  brand_improve: 600,
  seo_suggest: 700,
  review_reply: 600,
  research: 900,
  // Room for a full campaign proposal (prepare_campaign_drafts) in one step.
  agent: 1800,
};

// OpenAI standard prices, USD per 1M tokens (pricing page, October 2026).
export const PRICES: Record<string, { input: number; output: number }> = {
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-5.6-terra": { input: 2, output: 12 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, output: 1.25 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
};
// Model calls one metered request may make (the agent's tool loop: each step
// is one call). The budget reservation covers all of them, so a multi-step
// request can never spend more than was reserved up front.
export const MAX_STEPS: Partial<Record<AiFeature, number>> = { agent: 4 };
// Input cap per model call, in tokens. The agent carries tool results and a
// compact history, so it gets more room; everything else keeps the default.
export const INPUT_LIMIT: Partial<Record<AiFeature, number>> = { agent: 12_000 };
export const stepsFor = (feature: AiFeature) => MAX_STEPS[feature] ?? 1;
export const inputLimitFor = (feature: AiFeature) => INPUT_LIMIT[feature] ?? MAX_INPUT_TOKENS;

type Store = { feature: AiFeature; maxTokens: number; maxInput: number; steps: number; usage: { input: number; output: number; model: string } | null };
const als = new AsyncLocalStorage<Store>();

/** Called by the AI service after each model response. */
export function recordTokens(model: string, input: number, output: number) {
  const s = als.getStore();
  if (!s) return;
  const prev = s.usage;
  s.usage = { model, input: (prev?.input || 0) + input, output: (prev?.output || 0) + output };
}
/** Output limit for the current metered request (fallback for unmetered calls). */
export function currentOutputLimit(fallback = 2000) {
  return als.getStore()?.maxTokens ?? fallback;
}
/** Input limit (tokens) per model call for the current metered request. */
export function currentInputLimit() {
  return als.getStore()?.maxInput ?? MAX_INPUT_TOKENS;
}
/**
 * Counts one model call against the current request's step allowance. The
 * reservation was made for exactly that many calls; one more is refused
 * before it reaches the provider.
 */
export function takeStep() {
  const s = als.getStore();
  if (!s) return;
  if (s.steps <= 0) throw new HttpError(429, "Mavi heeft te veel stappen nodig voor deze vraag. Maak de vraag kleiner.");
  s.steps--;
}

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
};
export const limits = () => ({
  monthlyTokens: num(process.env.AI_MONTHLY_TOKEN_LIMIT, 300_000),
  dailyRequestsPerUser: num(process.env.AI_DAILY_REQUESTS_PER_USER, 40),
  globalMonthlyMicroUsd: Math.round(num(process.env.AI_GLOBAL_MONTHLY_BUDGET_USD, 8) * 1_000_000),
  concurrentPerUser: 2,
});
export function priceFor(model: string) {
  const known = PRICES[model] || PRICES[Object.keys(PRICES).find((k) => model.startsWith(k + "-")) || ""];
  if (known) return known;
  const input = num(process.env.AI_PRICE_INPUT_PER_MTOK, 0),
    output = num(process.env.AI_PRICE_OUTPUT_PER_MTOK, 0);
  return input || output ? { input, output } : null;
}
export function costMicroUsd(model: string, input: number, output: number) {
  const p = priceFor(model);
  return p ? Math.round(input * p.input + output * p.output) : 0; // per-MTok price * tokens = micro-USD
}const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};
const notReady = (e: { code?: string } | null) => !!e && ["42P01", "PGRST205", "42703"].includes(e.code || "");

// Models (defaults here so both the client and the budget use the same ones).
export const DEFAULT_MODEL = "gpt-5.6-luna";
export const DEFAULT_ADVANCED_MODEL = "gpt-5.4-mini";
export const configuredModels = () => [
  (process.env.OPENAI_MODEL || "").trim() || DEFAULT_MODEL,
  (process.env.OPENAI_ADVANCED_MODEL || "").trim() || DEFAULT_ADVANCED_MODEL,
];
// Longest input a request can carry (inputs are length-validated on every
// route: about 6,000 characters of text plus the Brand Hub context).
export const MAX_INPUT_TOKENS = 8000;
// A pending reservation older than this is a crashed request; it stops
// counting so it cannot block the budget forever.
const PENDING_TTL_MS = 15 * 60_000;
// Unknown model without a configured price: assume an expensive one.
const FALLBACK_PRICE = { input: 5, output: 30 };
export function reservationMicroUsd(feature: AiFeature) {
  const prices = configuredModels().map((m) => priceFor(m) || FALLBACK_PRICE);
  const input = Math.max(...prices.map((p) => p.input)),
    output = Math.max(...prices.map((p) => p.output));
  return Math.round(stepsFor(feature) * (inputLimitFor(feature) * input + OUTPUT_LIMIT[feature] * output));
}
export async function usageSummary(workspaceId: string) {
  const db = adminClient();
  const { data, error } = await db
    .from("ai_usage")
    .select("feature,status,input_tokens,output_tokens,cost_micro_usd,user_id,created_at")
    .eq("workspace_id", workspaceId)
    .gte("created_at", monthStart())
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) {
    if (notReady(error)) throw new HttpError(503, "AI-gebruik wordt nog ingericht.");
    throw new HttpError(503, "AI-gebruik kon niet worden geladen.");
  }
  const { data: ws } = await db.from("workspaces").select("ai_monthly_token_limit").eq("id", workspaceId).maybeSingle();
  const rows = data || [];
  const tokens = rows.reduce((s, r) => s + (r.input_tokens as number) + (r.output_tokens as number), 0);
  const byFeature: Record<string, { requests: number; tokens: number }> = {};
  for (const r of rows) {
    const f = (byFeature[r.feature as string] ||= { requests: 0, tokens: 0 });
    f.requests++;
    f.tokens += (r.input_tokens as number) + (r.output_tokens as number);
  }
  return {
    since: monthStart(),
    requests: rows.length,
    failed: rows.filter((r) => r.status === "failed").length,
    tokens,
    costMicroUsd: rows.reduce((s, r) => s + Number(r.cost_micro_usd || 0), 0),
    pricesConfigured: true,
    limit: (ws?.ai_monthly_token_limit as number | null) ?? limits().monthlyTokens,
    byFeature,
  };
}

/**
 * Run one AI request under the usage controls. `requestKey` (optional, from
 * the client's Idempotency-Key) makes a double click or retry of the same
 * request a no-op instead of a second paid call.
 */
export async function metered<T>(
  auth: { workspaceId: string; user: { id: string } },
  feature: AiFeature,
  fn: () => Promise<T>,
  requestKey?: string | null,
): Promise<T> {
  const db = adminClient();
  const l = limits();
  const day = new Date(Date.now() - 86_400_000).toISOString();
  const fail = (err: { code?: string }) => {
    // Fail closed: without the ledger there is no cost control.
    console.error(JSON.stringify({ event: notReady(err) ? "ai_usage_not_provisioned" : "ai_usage_failed", code: err.code || "error" }));
    return new HttpError(503, "AI is tijdelijk niet beschikbaar. Probeer het later opnieuw.");
  };
  const [{ data: ws, error: wsError }, month, today] = await Promise.all([
    db.from("workspaces").select("ai_monthly_token_limit").eq("id", auth.workspaceId).maybeSingle(),
    db.from("ai_usage").select("input_tokens,output_tokens").eq("workspace_id", auth.workspaceId).gte("created_at", monthStart()).limit(20000),
    db.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id).neq("model", "refused").gte("created_at", day),
  ]);
  const err = wsError || month.error || today.error;
  if (err) throw fail(err);
  const limit = (ws?.ai_monthly_token_limit as number | null) ?? l.monthlyTokens;
  const used = (month.data || []).reduce((s, r) => s + (r.input_tokens as number) + (r.output_tokens as number), 0);
  if (used >= limit) throw new HttpError(429, "Het AI-tegoed van deze maand is op. Neem contact op met Mavix om het te verhogen.");
  if ((today.count || 0) >= l.dailyRequestsPerUser) throw new HttpError(429, "Je hebt vandaag het maximale aantal AI-verzoeken gebruikt. Morgen kun je verder.");

  // 1. Reserve first: the row carries the worst-case cost of this request
  //    (longest allowed input, full output limit, priciest configured model).
  const key = requestKey && /^[\w-]{8,100}$/.test(requestKey) ? feature + ":" + requestKey : null;
  const reserved = reservationMicroUsd(feature);
  const startedAt = new Date().toISOString();
  const { data: row, error: insertError } = await db
    .from("ai_usage")
    .insert({ workspace_id: auth.workspaceId, user_id: auth.user.id, feature, model: "reserved", status: "pending", request_key: key, cost_micro_usd: reserved, created_at: startedAt })
    .select("id")
    .single();
  if (insertError) {
    if (insertError.code === "23505") throw new HttpError(409, "Dit verzoek is al verwerkt of wordt nog verwerkt.");
    throw fail(insertError);
  }
  const settle = (values: Record<string, unknown>) => db.from("ai_usage").update({ ...values, finished_at: new Date().toISOString() }).eq("id", row.id);

  // 2. Then check, counting every reservation that exists now (including
  //    concurrent ones). Whichever request checks last sees all earlier
  //    reservations, so simultaneous requests can never spend past the
  //    budget together; at worst they are all refused.
  const recent = new Date(Date.now() - PENDING_TTL_MS).toISOString();
  const [settled, pending, running] = await Promise.all([
    db.from("ai_usage").select("cost_micro_usd").in("status", ["succeeded", "failed"]).gte("created_at", monthStart()).limit(100000),
    db.from("ai_usage").select("cost_micro_usd").eq("status", "pending").gte("created_at", recent).limit(10000),
    db.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id).eq("status", "pending").gte("created_at", recent),
  ]);
  const checkError = settled.error || pending.error || running.error;
  const sum = (rows: { cost_micro_usd: unknown }[] | null) => (rows || []).reduce((s, r) => s + Number(r.cost_micro_usd || 0), 0);
  const refusal = checkError
    ? fail(checkError)
    : sum(settled.data) + sum(pending.data) > l.globalMonthlyMicroUsd
      ? new HttpError(503, "Het AI-budget van Mavix voor deze maand is bereikt. Er is niets gegenereerd.")
      : (running.count || 0) > l.concurrentPerUser
        ? new HttpError(429, "Mavi is nog bezig met je vorige verzoek. Even geduld.")
        : null;
  if (refusal) {
    if (refusal.status === 503 && !checkError) console.error(JSON.stringify({ event: "ai_global_budget_reached" }));
    await settle({ status: "failed", model: "refused", cost_micro_usd: 0 });
    throw refusal;
  }

  // 3. Run, then replace the reservation by the real tokens and cost.
  const store: Store = { feature, maxTokens: OUTPUT_LIMIT[feature], maxInput: inputLimitFor(feature), steps: stepsFor(feature), usage: null };
  let ok = false;
  try {
    const result = await als.run(store, fn);
    ok = true;
    return result;
  } finally {
    const u = store.usage;
    const { error } = await settle({
      status: ok ? "succeeded" : "failed",
      model: u?.model || "none",
      input_tokens: u?.input || 0,
      output_tokens: u?.output || 0,
      cost_micro_usd: costMicroUsd(u?.model || "", u?.input || 0, u?.output || 0),
    });
    if (error) console.error(JSON.stringify({ event: "ai_usage_update_failed", code: error.code || "error" }));
  }
}