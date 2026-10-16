// Billing state as Mavix shows it. Beta access (approved workspace, no paid
// plan) is not the same as a paid subscription; a Stripe subscription only
// counts once Stripe itself reports it (webhook, server-verified).

export type SubscriptionRow = { plan: string | null; status: string; billing_interval: string | null; current_period_end: string | null } | null;
export type BillingState = "beta" | "active" | "trialing" | "past_due" | "incomplete" | "canceled";

export function billingState(s: SubscriptionRow): BillingState {
  if (!s || !s.plan) return "beta";
  if (s.status === "active") return "active";
  if (s.status === "trialing") return "trialing";
  if (s.status === "past_due" || s.status === "unpaid") return "past_due";
  if (s.status === "incomplete") return "incomplete";
  if (s.status === "canceled" || s.status === "incomplete_expired") return "canceled";
  return "beta";
}

export const BILLING_LABEL: Record<BillingState, { title: string; text: string }> = {
  beta: { title: "Besloten beta", text: "Je werkruimte is goedgekeurd voor de beta. Je betaalt nu niets." },
  active: { title: "Abonnement actief", text: "Je betaalde abonnement loopt. Facturen en je betaalmethode beheer je in het betaalportaal." },
  trialing: { title: "Proefperiode", text: "Je proefperiode loopt. Daarna start je abonnement volgens het gekozen plan." },
  past_due: { title: "Betaling mislukt", text: "Een betaling is niet gelukt. Werk je betaalmethode bij in het betaalportaal; Stripe probeert het automatisch opnieuw." },
  incomplete: { title: "Betaling niet afgerond", text: "De eerste betaling is nog niet bevestigd. Rond hem af of probeer het opnieuw." },
  canceled: { title: "Abonnement beëindigd", text: "Je abonnement is opgezegd of verlopen." },
};

export const PLANS = ["starter", "growth", "autopilot"] as const;
export const INTERVALS = ["month", "year"] as const;
/** Checkout is only possible when the owner explicitly enabled it and the workspace is approved. */
export const checkoutAllowed = (o: { enabled: boolean; approved: boolean; state: BillingState }) => o.enabled && o.approved && (o.state === "beta" || o.state === "canceled");
