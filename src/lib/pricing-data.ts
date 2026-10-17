// Kept for existing imports (structured data, older components). Everything
// is derived from the central plan configuration in ./plans.ts.
import { PLAN_IDS, PLANS, YEARLY_DISCOUNT_PERCENT, type PlanId } from "./plans";

export type PricingPlan = { id: PlanId; name: string; tagline: string; monthlyPrice: number; recommended?: boolean; features: string[] };
export { YEARLY_DISCOUNT_PERCENT };

export const pricingPlans: PricingPlan[] = PLAN_IDS.map((id) => ({
  id,
  name: PLANS[id].name,
  tagline: PLANS[id].positioning,
  monthlyPrice: PLANS[id].monthlyPrice,
  recommended: PLANS[id].recommended,
  features: PLANS[id].highlights,
}));
