import "server-only";
import { adminClient } from "./supabase";
import { billingState } from "../billing-state";
import { creditPeriod, PLANS, type Entitlement, type Plan, type PlanId } from "../plans";

// Which plan a workspace has right now, decided on the server only.
//   paid (active / trialing / past_due during Stripe's retries) → that plan;
//   no paid subscription (approved beta workspace)              → "Beta":
//     every available feature, BETA_CREDITS (default 1,500) per calendar
//     month, no per-action maxima — existing beta users keep what they have;
//   subscription ended                                          → no AI credits,
//     data and non-AI features stay available.

export type WorkspacePlan = {
  state: "beta" | "paid" | "past_due" | "inactive";
  planId: PlanId | null;
  plan: Plan;
  period: { start: Date; end: Date };
};

const ALL: Entitlement[] = ["agent", "inbox_ai", "seo_ai", "seo_intelligence", "campaigns", "research", "team", "advice_call", "extended_insights", "carousels"];
const num = (v: string | undefined, d: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 && v !== "" && v !== undefined ? Number(v) : d);

export function betaPlan(): Plan {
  const top = PLANS.autopilot;
  return { ...top, name: "Beta", audience: "Besloten beta", summary: "Alle beschikbare functies tijdens de besloten beta.", positioning: "", monthlyPrice: 0, credits: num(process.env.BETA_CREDITS, 1500), limits: {}, entitlements: ALL.filter((e) => e !== "advice_call") };
}
const inactivePlan = (): Plan => ({ ...PLANS.starter, name: "Geen actief abonnement", credits: 0, entitlements: [], limits: {} });
// Older records may carry a display name instead of the id.
const normalize = (p: string | null): PlanId | null => (p === "starter" || p === "growth" || p === "autopilot" ? p : p === "premium" ? "autopilot" : null);

export async function workspacePlan(workspaceId: string, now = new Date()): Promise<WorkspacePlan> {
  const { data } = await adminClient().from("subscriptions").select("plan,status,billing_interval,current_period_end").eq("workspace_id", workspaceId).maybeSingle();
  const state = billingState(data ? { plan: data.plan, status: data.status, billing_interval: data.billing_interval, current_period_end: data.current_period_end } : null);
  const id = normalize(data?.plan ?? null);
  if ((state === "active" || state === "trialing" || state === "past_due") && id)
    return { state: state === "past_due" ? "past_due" : "paid", planId: id, plan: PLANS[id], period: creditPeriod(data?.current_period_end || null, now) };
  // An unfinished first payment ("incomplete") keeps the existing beta access.
  if (state === "canceled") return { state: "inactive", planId: null, plan: inactivePlan(), period: creditPeriod(null, now) };
  return { state: "beta", planId: null, plan: betaPlan(), period: creditPeriod(null, now) };
}

export async function hasEntitlement(workspaceId: string, e: Entitlement) {
  return (await workspacePlan(workspaceId)).plan.entitlements.includes(e);
}
