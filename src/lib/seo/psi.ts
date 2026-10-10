import type { FieldMetric, Metric, PsiResult } from "./types";

// Google PageSpeed Insights v5 response -> the values Mavix stores. Only
// values present in the response are kept; missing ones stay missing.
// "lab" = Lighthouse run by Google during the scan; "field" = Chrome UX
// Report data from real visitors over the last 28 days (when available).

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");

const LAB: [keyof Extract<PsiResult, { ok: true }>["lab"], string][] = [
  ["fcp", "first-contentful-paint"],
  ["lcp", "largest-contentful-paint"],
  ["tbt", "total-blocking-time"],
  ["cls", "cumulative-layout-shift"],
  ["si", "speed-index"],
];
const FIELD: [keyof NonNullable<Extract<PsiResult, { ok: true }>["field"]>["metrics"], string][] = [
  ["lcp", "LARGEST_CONTENTFUL_PAINT_MS"],
  ["inp", "INTERACTION_TO_NEXT_PAINT"],
  ["cls", "CUMULATIVE_LAYOUT_SHIFT_SCORE"],
  ["fcp", "FIRST_CONTENTFUL_PAINT_MS"],
  ["ttfb", "EXPERIMENTAL_TIME_TO_FIRST_BYTE"],
];
const CATEGORY = new Set(["FAST", "AVERAGE", "SLOW"]);

function field(exp: Json): NonNullable<Extract<PsiResult, { ok: true }>["field"]>["metrics"] {
  const metrics = obj(exp.metrics);
  const out: Record<string, FieldMetric> = {};
  for (const [key, name] of FIELD) {
    const m = obj(metrics[name]);
    const p = num(m.percentile);
    const c = str(m.category);
    if (p !== null && CATEGORY.has(c)) out[key] = { percentile: p, category: c as FieldMetric["category"] };
  }
  return out;
}

export function parsePsi(json: unknown, strategy: "mobile" | "desktop"): PsiResult {
  const root = obj(json);
  const lr = obj(root.lighthouseResult);
  const cats = obj(lr.categories);
  const score = (k: string) => {
    const s = num(obj(cats[k]).score);
    return s === null ? null : Math.round(s * 100);
  };
  const audits = obj(lr.audits);
  const lab: Partial<Record<string, Metric>> = {};
  for (const [key, id] of LAB) {
    const a = obj(audits[id]);
    const value = num(a.numericValue);
    if (value !== null) lab[key] = { value, display: str(a.displayValue, 40), score: num(a.score) };
  }
  if (!Object.keys(cats).length) return { ok: false, strategy, error: "PageSpeed Insights gaf geen Lighthouse-resultaat." };

  // Field data: the page itself if Google has enough visits, else the origin.
  const page = obj(root.loadingExperience);
  const origin = obj(root.originLoadingExperience);
  const pageMetrics = page.origin_fallback ? {} : field(page);
  const originMetrics = field(origin);
  const usePage = Object.keys(pageMetrics).length > 0;
  const metrics = usePage ? pageMetrics : originMetrics;
  const overallRaw = str((usePage ? page : origin).overall_category);

  const opportunities = Object.entries(audits)
    .map(([id, v]) => ({ id, a: obj(v) }))
    .filter(({ a }) => obj(a.details).type === "opportunity" && (num(a.score) ?? 1) < 0.9 && (num(obj(a.details).overallSavingsMs) ?? 0) > 0)
    .sort((x, y) => (num(obj(y.a.details).overallSavingsMs) ?? 0) - (num(obj(x.a.details).overallSavingsMs) ?? 0))
    .slice(0, 6)
    .map(({ id, a }) => ({ id: id.slice(0, 80), title: str(a.title, 160), display: str(a.displayValue, 80) }));

  return {
    ok: true,
    strategy,
    finalUrl: str(lr.finalDisplayedUrl || lr.finalUrl, 500),
    lighthouseVersion: str(lr.lighthouseVersion, 20),
    categories: { performance: score("performance"), accessibility: score("accessibility"), bestPractices: score("best-practices"), seo: score("seo") },
    lab,
    field: Object.keys(metrics).length ? { scope: usePage ? "url" : "origin", overall: CATEGORY.has(overallRaw) ? (overallRaw as FieldMetric["category"]) : null, metrics } : null,
    opportunities,
    audits: { viewport: num(obj(audits.viewport).score), fontSize: num(obj(audits["font-size"]).score) },
  };
}
