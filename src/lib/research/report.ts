// Builds the research report from classified findings. Deterministic; an
// AI layer may later rewrite the summary/plan wording, but never the facts.
import { byImportance } from "./rules.ts";
import type { ActionWeek, Finding, ResearchInput, ResearchReport } from "./types.ts";

const TZ = "Europe/Amsterdam";

// Calendar month in the Netherlands, e.g. "2026-10".
export function researchPeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

// First moment of the next calendar month in Amsterdam, as an ISO instant.
export function nextEligibleAt(period: string) {
  const [y, m] = period.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  // Midnight Amsterdam = 22:00 or 23:00 UTC the day before; find it exactly.
  for (const hour of [22, 23]) {
    const guess = new Date(Date.UTC(ny, nm - 1, 1, 0, 0) - (24 - hour) * 3600000);
    if (researchPeriod(guess) === `${ny}-${String(nm).padStart(2, "0")}` && researchPeriod(new Date(guess.getTime() - 1)) === period) return guess.toISOString();
  }
  return new Date(Date.UTC(ny, nm - 1, 1)).toISOString();
}

export function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("nl-NL", { month: "long", year: "numeric", timeZone: "UTC" });
}

function summary(input: ResearchInput, findings: Finding[]) {
  const good = findings.filter((f) => f.status === "good").length;
  const improve = findings.filter((f) => f.status === "improve");
  const uncertain = findings.filter((f) => f.status === "uncertain").length;
  const subject = input.profile.name || (input.businessKind === "restaurant" ? "je restaurant" : "je bedrijf");
  const top = [...improve].sort(byImportance)[0];
  const counts = [
    improve.length ? `${improve.length} ${improve.length === 1 ? "verbeterpunt" : "verbeterpunten"}` : "",
    good ? `${good} ${good === 1 ? "sterk punt" : "sterke punten"}` : "",
  ].filter(Boolean);
  return [
    counts.length ? `Mavix vond voor ${subject} ${counts.join(" en ")}.` : `Mavix vond voor ${subject} nog geen duidelijke conclusies.`,
    uncertain ? `${uncertain} ${uncertain === 1 ? "onderdeel kon" : "onderdelen konden"} niet worden beoordeeld omdat de gegevens ontbreken.` : "",
    top ? `De grootste winst zit nu in: ${top.title.charAt(0).toLowerCase() + top.title.slice(1)}.` : "Er zijn geen dringende verbeterpunten gevonden.",
  ]
    .filter(Boolean)
    .join(" ");
}
function plan(findings: Finding[]): ActionWeek[] {
  const todo = findings.filter((f) => f.status === "improve").sort(byImportance);
  const weeks: ActionWeek[] = [
    { week: 1, title: "Snelle winst", actions: [] },
    { week: 2, title: "Zichtbaarheid", actions: [] },
    { week: 3, title: "Klanten en reviews", actions: [] },
    { week: 4, title: "Vasthouden en meten", actions: [] },
  ];
  const slot = (f: Finding) => (f.area === "google" || f.area === "website" ? 1 : f.area === "reviews" || f.area === "customers" ? 2 : f.area === "profile" ? 0 : 3);
  for (const f of todo) {
    const w = f.priority === "high" && weeks[0].actions.length < 2 ? 0 : slot(f);
    weeks[w].actions.push(f.action);
  }
  weeks[3].actions.push("Kijk terug: welke acties zijn gedaan? Het volgende maandelijkse onderzoek laat zien wat er veranderd is.");
  return weeks.filter((w) => w.actions.length);
}

const NOT_YET = [
  { label: "Concurrenten in de buurt", reason: "Een vergelijking met concurrenten is nog niet beschikbaar in Mavix." },
  { label: "Drukte per dag en tijdstip", reason: "Mavix heeft nog geen koppeling met reserverings- of kassasystemen." },
];

export function buildReport(input: ResearchInput, findings: Finding[], period: string, now = new Date()): ResearchReport {
  const sorted = [...findings].sort(byImportance);
  const top = sorted.filter((f) => f.status === "improve").slice(0, 3);
  return {
    version: 1,
    businessName: input.profile.name,
    businessKind: input.businessKind,
    period,
    generatedAt: now.toISOString(),
    summary: summary(input, findings),
    summarySource: "rules",
    topPriorities: top.map((f) => ({ findingId: f.id, title: f.title, action: f.action })),
    findings: sorted,
    plan: plan(findings),
    sources: input.sources,
    notResearched: [
      ...input.sources.filter((s) => s.status !== "used").map((s) => ({ label: s.label, reason: s.note })),
      ...NOT_YET,
    ],
  };
}

// Offline answer to a follow-up question, using only the report.
export function answerFromReport(question: string, report: ResearchReport) {
  const q = question.toLowerCase();
  const words = q.split(/[^a-zà-ÿ0-9]+/).filter((w) => w.length > 3);
  const scored = report.findings
    .map((f) => ({ f, score: words.filter((w) => (f.title + " " + f.found + " " + f.action + " " + f.area).toLowerCase().includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || byImportance(a.f, b.f));
  if (/eerst|begin|belangrijkst|prioriteit/.test(q) || !scored.length) {
    const first = report.topPriorities[0];
    return first
      ? `Begin met: ${first.title}. ${first.action}` + (report.topPriorities[1] ? ` Daarna: ${report.topPriorities[1].title.charAt(0).toLowerCase() + report.topPriorities[1].title.slice(1)}.` : "")
      : "Het onderzoek vond geen dringende verbeterpunten. Houd vast wat goed gaat en kijk volgende maand opnieuw.";
  }
  const best = scored.slice(0, 2).map((x) => x.f);
  return best.map((f) => `${f.title}. ${f.found} ${f.status === "uncertain" ? "Dit kon Mavix nog niet goed beoordelen." : f.action}`).join("\n\n");
}
