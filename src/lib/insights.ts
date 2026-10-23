// Shapes and pure helpers for Insights (browser, server and tests).

export type Metric = { label: string; value: number | null; previous: number | null };
export type SourceBlock = {
  id: string;
  source: string;
  title: string;
  available: boolean;
  /** Why a source has no numbers (shown instead of zeros). */
  reason?: string;
  period?: string;
  href: string;
  metrics?: Metric[];
};

const DAY = 86400_000;

/** Count of timestamps in the last `days` days vs. the `days` before. */
export function periodCompare(label: string, times: number[], now = Date.now(), days = 30): Metric {
  const ok = times.filter((t) => Number.isFinite(t));
  const cur = ok.filter((t) => t > now - days * DAY && t <= now).length;
  const prev = ok.filter((t) => t > now - 2 * days * DAY && t <= now - days * DAY).length;
  return { label, value: cur, previous: prev };
}

/** Change for display; null when there is nothing honest to compare with. */
export function change(m: Metric): { pct: number | null; direction: "up" | "down" | "same" | null } {
  if (m.value === null || m.previous === null) return { pct: null, direction: null };
  if (m.value === m.previous) return { pct: 0, direction: "same" };
  if (m.previous === 0) return { pct: null, direction: m.value > 0 ? "up" : "same" };
  return { pct: Math.round(((m.value - m.previous) / m.previous) * 100), direction: m.value > m.previous ? "up" : "down" };
}

// ---------- Goals ----------

export type GoalKind = "posts_per_month" | "emails_per_month" | "review_rating";
export type Goal = { kind: GoalKind; target: number };
export const GOALS: { kind: GoalKind; label: string; unit: string; min: number; max: number; step: number; source: string }[] = [
  { kind: "posts_per_month", label: "Instagram-posts per maand", unit: "posts", min: 1, max: 60, step: 1, source: "Gepubliceerde of ingeplande posts in Mavix" },
  { kind: "emails_per_month", label: "E-mailcampagnes per maand", unit: "campagnes", min: 1, max: 20, step: 1, source: "Verstuurde of ingeplande campagnes in Mavix" },
  { kind: "review_rating", label: "Gemiddelde Google-score", unit: "sterren", min: 1, max: 5, step: 0.1, source: "Score volgens Google" },
];

export function goalsValid(g: unknown) {
  return g === undefined || (Array.isArray(g) && g.length <= 3 && g.every((x) => x && GOALS.some((d) => d.kind === x.kind && typeof x.target === "number" && x.target >= d.min && x.target <= d.max)) && new Set(g.map((x) => x.kind)).size === g.length);
}

/** Progress this calendar month from real records. Rating comes from the reviews block. */
export function goalProgress(goal: Goal, d: { posts: { status: string; date: string; instagram?: unknown }[]; emails: { status: string; date: string; delivery?: { sentAt: string } }[]; rating: number | null }, now = new Date()) {
  const month = now.toISOString().slice(0, 7);
  const inMonth = (s?: string) => !!s && s.slice(0, 7) === month;
  let value: number | null;
  if (goal.kind === "posts_per_month") value = d.posts.filter((p) => (p.status === "published" || p.status === "scheduled") && inMonth(p.date)).length;
  else if (goal.kind === "emails_per_month") value = d.emails.filter((c) => (c.status === "sent" || c.status === "scheduled") && inMonth(c.delivery?.sentAt || c.date)).length;
  else value = d.rating;
  return { value, pct: value === null ? null : Math.min(100, Math.round((value / goal.target) * 100)) };
}

// ---------- Next actions (rules over real facts, labelled as suggestions) ----------

export type NextAction = { title: string; why: string; href: string; cta: string };

export function nextActions(blocks: SourceBlock[], counts: { drafts: number; scheduledNext7: number; brandScore: number }): NextAction[] {
  const out: NextAction[] = [];
  const get = (id: string, label: string) => blocks.find((b) => b.id === id)?.metrics?.find((m) => m.label === label);
  const unanswered = get("reviews", "Onbeantwoord")?.value || 0;
  if (unanswered > 0) out.push({ title: `Beantwoord ${unanswered} ${unanswered === 1 ? "review" : "reviews"}`, why: "Gemeten: onbeantwoorde reviews in je laatste 50 Google-reviews.", href: "/reviews?tab=inbox", cta: "Naar reviews" });
  if (counts.drafts > 0) out.push({ title: `Keur ${counts.drafts} ${counts.drafts === 1 ? "concept" : "concepten"} goed of af`, why: "Gemeten: concepten in je werkruimte wachten op jou.", href: "/studio", cta: "Naar Content Studio" });
  if (counts.scheduledNext7 === 0) out.push({ title: "Plan content voor de komende 7 dagen", why: "Gemeten: er staat niets ingepland voor de komende week.", href: "/calendar", cta: "Naar de kalender" });
  const clicks = get("search", "Klikken");
  if (clicks && change(clicks).direction === "down" && (change(clicks).pct ?? 0) <= -15) out.push({ title: "Bekijk waarom je minder klikken uit Google krijgt", why: `Gemeten: ${clicks.value} klikken tegenover ${clicks.previous} in de periode ervoor.`, href: "/seo", cta: "Naar SEO Intelligence" });
  if (counts.brandScore < 80) out.push({ title: "Vul je Brand Hub verder aan", why: `Gemeten: je Brand Hub is voor ${Math.round(counts.brandScore)}% compleet; Mavix schrijft beter met meer context.`, href: "/brand-hub", cta: "Naar Brand Hub" });
  return out.slice(0, 3);
}
