import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { adminClient } from "./supabase";
import { HttpError } from "./access";

// AI usage control around every AI request (ai_usage ledger, migration
// 202610120001). Order: quota check -> concurrency/duplicate guard -> request
// -> tokens recorded. Prompts and outputs are never stored, only counts.
//
// Costs: Mavix only multiplies tokens by prices you configure
// (AI_PRICE_INPUT_PER_MTOK / AI_PRICE_OUTPUT_PER_MTOK, USD per million
// tokens). Without them the cost stays 0 and the admin view shows tokens.

export type AiFeature =
  | "inbox_reply"
  | "inbox_rewrite"
  | "inbox_summary"
  | "content_instagram"
  | "content_email"
  | "content_edit"
  | "brand_preview"
  | "brand_improve"
  | "seo_suggest"
  | "review_reply"
  | "research";

// Output cap per feature (tokens); short drafts never need the model maximum.
export const OUTPUT_LIMIT: Record<AiFeature, number> = {
  inbox_reply: 2000,
  inbox_rewrite: 2000,
  inbox_summary: 1200,
  content_instagram: 3000,
  content_email: 6000,
  content_edit: 4000,
  brand_preview: 2000,
  brand_improve: 1500,
  seo_suggest: 1500,
  review_reply: 1500,
  research: 2500,
};

type Store = { feature: AiFeature; maxTokens: number; usage: { input: number; output: number; model: string } | null };
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

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
};
export const limits = () => ({
  monthlyTokens: num(process.env.AI_MONTHLY_TOKEN_LIMIT, 2_000_000),
  dailyRequestsPerUser: num(process.env.AI_DAILY_REQUESTS_PER_USER, 150),
  concurrentPerUser: 2,
});
export function costMicroUsd(input: number, output: number) {
  const pin = num(process.env.AI_PRICE_INPUT_PER_MTOK, 0),
    pout = num(process.env.AI_PRICE_OUTPUT_PER_MTOK, 0);
  return Math.round(input * pin + output * pout); // per-MTok price * tokens = micro-USD
}
const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};
const notReady = (e: { code?: string } | null) => !!e && ["42P01", "PGRST205", "42703"].includes(e.code || "");

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
    pricesConfigured: !!process.env.AI_PRICE_INPUT_PER_MTOK && !!process.env.AI_PRICE_OUTPUT_PER_MTOK,
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
  const [{ data: ws, error: wsError }, month, today, running] = await Promise.all([
    db.from("workspaces").select("ai_monthly_token_limit").eq("id", auth.workspaceId).maybeSingle(),
    db.from("ai_usage").select("input_tokens,output_tokens").eq("workspace_id", auth.workspaceId).gte("created_at", monthStart()).limit(20000),
    db.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id).gte("created_at", day),
    db
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .eq("status", "pending")
      .gte("created_at", new Date(Date.now() - 120_000).toISOString()),
  ]);
  const err = wsError || month.error || today.error || running.error;
  if (err) {
    // Fail closed: without the ledger there is no cost control.
    console.error(JSON.stringify({ event: notReady(err) ? "ai_usage_not_provisioned" : "ai_usage_failed", code: err.code || "error" }));
    throw new HttpError(503, "AI is tijdelijk niet beschikbaar. Probeer het later opnieuw.");
  }
  const limit = (ws?.ai_monthly_token_limit as number | null) ?? l.monthlyTokens;
  const used = (month.data || []).reduce((s, r) => s + (r.input_tokens as number) + (r.output_tokens as number), 0);
  if (used >= limit) throw new HttpError(429, "Het AI-tegoed van deze maand is op. Neem contact op met Mavix om het te verhogen.");
  if ((today.count || 0) >= l.dailyRequestsPerUser) throw new HttpError(429, "Je hebt vandaag het maximale aantal AI-verzoeken gebruikt. Morgen kun je verder.");
  if ((running.count || 0) >= l.concurrentPerUser) throw new HttpError(429, "Mavi is nog bezig met je vorige verzoek. Even geduld.");

  const key = requestKey && /^[\w-]{8,100}$/.test(requestKey) ? feature + ":" + requestKey : null;
  const { data: row, error: insertError } = await db
    .from("ai_usage")
    .insert({ workspace_id: auth.workspaceId, user_id: auth.user.id, feature, model: "pending", status: "pending", request_key: key })
    .select("id")
    .single();
  if (insertError) {
    if (insertError.code === "23505") throw new HttpError(409, "Dit verzoek is al verwerkt of wordt nog verwerkt.");
    throw new HttpError(503, "AI is tijdelijk niet beschikbaar. Probeer het later opnieuw.");
  }
  const store: Store = { feature, maxTokens: OUTPUT_LIMIT[feature], usage: null };
  let ok = false;
  try {
    const result = await als.run(store, fn);
    ok = true;
    return result;
  } finally {
    const u = store.usage;
    const { error } = await db
      .from("ai_usage")
      .update({
        status: ok ? "succeeded" : "failed",
        model: u?.model || "none",
        input_tokens: u?.input || 0,
        output_tokens: u?.output || 0,
        cost_micro_usd: costMicroUsd(u?.input || 0, u?.output || 0),
        finished_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) console.error(JSON.stringify({ event: "ai_usage_update_failed", code: error.code || "error" }));
  }
}
