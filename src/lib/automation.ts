// Shared automation model for Social, E-mail and Reviews.
//
// Three levels, the same in every module:
//   assist   = Mavix only acts when the user asks (always available);
//   prepare  = Mavix prepares drafts that wait for approval (Auto Create);
//   auto     = Mavix acts on its own, ONLY with an explicit server-side
//              permission (automation_permissions) and a working integration.
//
// Settings in the workspace document are PREFERENCES. Whether something
// actually runs is decided here from real facts: the permission row, the
// provider capability and the scheduler. The UI shows both, never one as
// the other.

export type WorkflowId = "instagram_auto_create" | "instagram_publish_scheduled" | "email_auto_create" | "email_send_scheduled" | "review_auto_reply";
export type Level = "prepare" | "auto";

export type Workflow = {
  id: WorkflowId;
  module: "social" | "email" | "reviews";
  level: Level;
  label: string;
  description: string;
  /** Only "auto" workflows with permission: true can be switched on via automation_permissions. */
  permission: boolean;
  /** Implemented and allowed to run unattended today. */
  runnable: boolean;
};

export const WORKFLOWS: Workflow[] = [
  { id: "instagram_auto_create", module: "social", level: "prepare", label: "Auto Create voor Instagram", description: "Mavix stelt volgens je planning concepten voor die op goedkeuring wachten.", permission: false, runnable: false },
  { id: "instagram_publish_scheduled", module: "social", level: "auto", label: "Ingeplande posts automatisch publiceren", description: "Goedgekeurde, ingeplande posts worden op het geplande moment via de officiële Instagram-API gepubliceerd.", permission: true, runnable: true },
  { id: "email_auto_create", module: "email", level: "prepare", label: "Auto Create voor e-mail", description: "Mavix stelt nieuwsbrieven en acties voor die op goedkeuring wachten.", permission: false, runnable: false },
  { id: "email_send_scheduled", module: "email", level: "auto", label: "Ingeplande campagnes automatisch versturen", description: "Goedgekeurde, ingeplande campagnes worden op het geplande moment verstuurd naar ontvangers met toestemming.", permission: true, runnable: true },
  { id: "review_auto_reply", module: "reviews", level: "auto", label: "Auto Reply op Google-reviews", description: "Mavix beantwoordt positieve reviews volgens jouw regels; klachten en gevoelige reviews blijven altijd bij jou.", permission: true, runnable: false },
];

export type WorkflowFacts = {
  /** The user's preference in the workspace settings (mode/enabled). */
  preference: boolean;
  /** Server-side permission row (automation_permissions.enabled). */
  permitted: boolean;
  /** Requirements with whether they are met right now. */
  requirements: { label: string; met: boolean }[];
  pendingApprovals: number;
  lastRun: { at: string; status: "ok" | "failed" | "skipped"; detail?: string } | null;
  recentFailures: number;
};

export type WorkflowStatus = Workflow & WorkflowFacts & { configured: boolean; operational: boolean; state: "off" | "preference_only" | "waiting" | "running" | "not_available" ; explanation: string };

/** Combines a workflow with its facts into an honest status. */
export function workflowStatus(w: Workflow, f: WorkflowFacts): WorkflowStatus {
  const configured = w.permission ? f.permitted : f.preference;
  const unmet = f.requirements.filter((r) => !r.met);
  let state: WorkflowStatus["state"];
  let explanation: string;
  if (!w.runnable) {
    state = configured || f.preference ? "preference_only" : "not_available";
    explanation =
      w.level === "prepare"
        ? "Je voorkeur is opgeslagen. Een achtergrondtaak die automatisch concepten maakt draait nog niet; je kunt de planning wel simuleren."
        : "Deze automatisering is ontworpen maar nog niet actief. Mavix plaatst niets zonder jouw klik.";
  } else if (!configured) {
    state = f.preference ? "preference_only" : "off";
    explanation = f.preference ? "Je voorkeur staat aan, maar je hebt Mavix nog geen toestemming gegeven om zelfstandig te handelen." : "Uit. Mavix doet niets zonder jouw klik.";
  } else if (unmet.length) {
    state = "waiting";
    explanation = "Toestemming gegeven, maar nog niet actief: " + unmet.map((r) => r.label.toLowerCase()).join(", ") + ".";
  } else {
    state = "running";
    explanation = "Actief. Mavix handelt op het geplande moment en legt elke actie vast.";
  }
  return { ...w, ...f, configured, operational: state === "running", state, explanation };
}

// ---------- Scheduling ----------

/** UTC time of a local Europe/Amsterdam "YYYY-MM-DDTHH:mm" moment. */
export function amsterdamToUtc(local: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local)) return NaN;
  const guess = Date.parse(local.slice(0, 16) + ":00Z");
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const shown = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);
  return guess - (shown - guess);
}

/** Items whose scheduled moment has come (not older than `graceHours`, so old backlogs never fire). */
export function dueItems<T extends { status: string; date: string }>(items: T[], now = Date.now(), graceHours = 6) {
  return items.filter((i) => {
    if (i.status !== "scheduled" || !i.date) return false;
    const t = amsterdamToUtc(i.date);
    return t <= now && t >= now - graceHours * 3600_000;
  });
}

// ---------- Review Auto Reply safeguards (design, used for previews and tests) ----------

const SENSITIVE = /(klacht|allergi|ziek|vergiftig|braak|letsel|gewond|advocaat|politie|rechter|aangifte|discrimin|racis|onveilig|terugbetal|geld terug|refund|oplichting|fraude|privacy|gezondheid|inspectie|ongedierte|kakkerla|muis|muizen)/i;

export type ReplyRules = { enabled: boolean; autoPublishMinRating: number; manualBelowRating: number };

/**
 * What Auto Reply may do with one review. Unattended replies are only ever
 * allowed for a high rating without sensitive content and without an existing
 * reply; everything else goes to the owner.
 */
export function replyDecision(r: { rating: number | null; comment: string; hasReply: boolean }, rules: ReplyRules): { action: "skip" | "manual" | "auto"; reason: string } {
  if (r.hasReply) return { action: "skip", reason: "Al beantwoord." };
  if (!rules.enabled) return { action: "manual", reason: "Auto Reply staat uit." };
  if (r.rating === null) return { action: "manual", reason: "Geen sterrenscore." };
  if (r.rating < Math.max(rules.manualBelowRating, 1) || r.rating <= 2) return { action: "manual", reason: "Lage score: altijd persoonlijk beantwoorden." };
  if (SENSITIVE.test(r.comment)) return { action: "manual", reason: "Gevoelig onderwerp of klacht: altijd persoonlijk beantwoorden." };
  if (r.rating < Math.max(rules.autoPublishMinRating, 4)) return { action: "manual", reason: "Onder jouw drempel voor automatisch antwoorden." };
  return { action: "auto", reason: "Positieve review zonder gevoelige inhoud." };
}
