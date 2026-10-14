// Customer onboarding states (demo request -> account application -> owner
// review -> payment -> activation). Pure rules shared by the server (which
// enforces them) and the admin page (which only shows allowed actions).
//
// Order (see docs/LAUNCH-READINESS.md): the owner reviews BEFORE any payment,
// so rejected applicants never pay and need no refund. Activation always
// needs an administrator, and a completed demo (or an explicit demo
// confirmation by the administrator).

export const APPLICATION_STATUSES = [
  "demo_requested",
  "demo_completed",
  "application_pending",
  "awaiting_payment",
  "payment_confirmed",
  "active",
  "rejected",
  "suspended",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const PAYMENT_STATUSES = ["not_started", "pending", "paid", "failed", "refunded", "waived"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  demo_requested: "Demo aangevraagd",
  demo_completed: "Demo gehouden",
  application_pending: "Wacht op beoordeling",
  awaiting_payment: "Goedgekeurd, wacht op betaling",
  payment_confirmed: "Betaling bevestigd",
  active: "Actief",
  rejected: "Afgewezen",
  suspended: "Gepauzeerd",
};
export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  not_started: "Nog niet gestart",
  pending: "In behandeling",
  paid: "Betaald",
  failed: "Mislukt",
  refunded: "Terugbetaald",
  waived: "Niet van toepassing (pilot of handmatige factuur)",
};

// Administrator actions. Each names the target status and its preconditions.
export type AdminAction = "complete_demo" | "approve" | "confirm_payment_manually" | "waive_payment" | "activate" | "reject" | "suspend" | "reopen";
export const ACTION_LABEL: Record<AdminAction, string> = {
  complete_demo: "Demo gehouden",
  approve: "Goedkeuren",
  confirm_payment_manually: "Betaling handmatig bevestigen",
  waive_payment: "Zonder online betaling (pilot/factuur)",
  activate: "Account activeren",
  reject: "Afwijzen",
  suspend: "Pauzeren",
  reopen: "Opnieuw beoordelen",
};

type App = { status: ApplicationStatus; payment_status: PaymentStatus; demo_completed_at: string | null };
type Rule = { from: ApplicationStatus[]; to: ApplicationStatus; payment?: PaymentStatus; check?: (a: App) => string | null };

const RULES: Record<AdminAction, Rule> = {
  complete_demo: { from: ["demo_requested", "application_pending"], to: "demo_completed" },
  // Approval needs a completed demo: the onboarding policy cannot be skipped.
  approve: {
    from: ["demo_completed", "application_pending"],
    to: "awaiting_payment",
    check: (a) => (a.demo_completed_at ? null : "Markeer eerst dat de demo heeft plaatsgevonden."),
  },
  // Only for payments received outside Mavix (bank transfer); audited.
  confirm_payment_manually: { from: ["awaiting_payment"], to: "payment_confirmed", payment: "paid" },
  waive_payment: { from: ["awaiting_payment"], to: "payment_confirmed", payment: "waived" },
  activate: {
    from: ["payment_confirmed"],
    to: "active",
    check: (a) => (a.payment_status === "paid" || a.payment_status === "waived" ? null : "Activeren kan pas na een bevestigde betaling of een vrijstelling."),
  },
  reject: { from: ["demo_requested", "demo_completed", "application_pending", "awaiting_payment"], to: "rejected" },
  suspend: { from: ["active"], to: "suspended" },
  reopen: { from: ["rejected", "suspended"], to: "application_pending" },
};

/** Target status and payment change for an action, or a Dutch reason why it is not allowed. */
export function transition(app: App, action: AdminAction): { ok: true; to: ApplicationStatus; payment?: PaymentStatus } | { ok: false; reason: string } {
  const rule = RULES[action];
  if (!rule) return { ok: false, reason: "Onbekende actie." };
  if (!rule.from.includes(app.status)) return { ok: false, reason: `Niet mogelijk vanuit "${STATUS_LABEL[app.status]}".` };
  const problem = rule.check?.(app);
  if (problem) return { ok: false, reason: problem };
  if (action === "complete_demo" && app.demo_completed_at) return { ok: false, reason: "De demo is al gemarkeerd als gehouden." };
  // An application that came in without a demo keeps its status; only the
  // demo date is recorded (the server sets demo_completed_at for this action).
  if (action === "complete_demo" && app.status === "application_pending") return { ok: true, to: "application_pending" };
  return { ok: true, to: rule.to, payment: rule.payment };
}

/** Actions the admin page may show for an application. */
export function allowedActions(app: App): AdminAction[] {
  return (Object.keys(RULES) as AdminAction[]).filter((a) => transition(app, a).ok);
}
