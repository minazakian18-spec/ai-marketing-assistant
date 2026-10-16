import { CATEGORY_LABEL, CATEGORY_WEIGHT } from "./checks.ts";
import type { Category, ScanReport } from "./types";

// How complete an analysis is, so the headline score can be read correctly.
// Derived from the stored report only, so it also works for historical scans.
//
// A category counts as "missing" when its measurements failed (for example
// PageSpeed Insights did not answer), not when a check simply does not apply
// (no focus keyword set, no images on the site). Coverage is the share of the
// overall score weight whose categories were actually measured.

export type CategoryState = "measured" | "partial" | "missing";
export type Completeness = {
  /** 0..100: share of the score weight that was measured. */
  coverage: number;
  complete: boolean;
  categories: Record<Category, CategoryState>;
  /** Plain-language reasons, most important first. */
  reasons: string[];
};

const CATS = Object.keys(CATEGORY_WEIGHT) as Category[];

export function analysisCompleteness(report: Pick<ScanReport, "checks" | "psi" | "site" | "pages">): Completeness {
  const reasons: string[] = [];
  const categories = {} as Record<Category, CategoryState>;
  const mobile = report.psi?.mobile;
  const desktop = report.psi?.desktop;

  for (const cat of CATS) {
    const checks = report.checks.filter((c) => c.category === cat);
    const measured = checks.filter((c) => c.ratio !== null);
    categories[cat] = !measured.length ? "missing" : "measured";
  }
  // Performance depends entirely on Google PageSpeed Insights.
  if (!mobile || !mobile.ok) {
    categories.performance = "missing";
    reasons.push(`${CATEGORY_LABEL.performance} niet gemeten: ${!report.psi ? "PageSpeed Insights is bij deze analyse niet uitgevoerd." : mobile && !mobile.ok ? mobile.error : "geen resultaat van PageSpeed Insights."}`);
  } else if (!desktop?.ok) {
    categories.performance = "partial";
    reasons.push(`Desktopsnelheid niet gemeten${desktop && !desktop.ok ? ": " + desktop.error : "."} De mobiele meting is wel gelukt.`);
  }
  // Mobile font size and the Lighthouse accessibility score also come from PageSpeed.
  if ((!mobile || !mobile.ok) && categories.accessibility === "measured") categories.accessibility = "partial";
  if ((!mobile || !mobile.ok) && categories.mobile === "measured") categories.mobile = "partial";

  if (!report.site.reachable) reasons.unshift("De website gaf geen geldig antwoord; de meeste onderdelen konden niet worden gecontroleerd.");
  else if (!report.pages.length) reasons.unshift("Er zijn geen pagina's bekeken (bijvoorbeeld omdat robots.txt dat verbiedt).");
  if (report.site.crawl.stopped === "time") reasons.push("De analyse stopte op de tijdslimiet; niet alle pagina's zijn bekeken.");

  const total = CATS.reduce((s, c) => s + CATEGORY_WEIGHT[c], 0);
  const share = (s: CategoryState) => (s === "measured" ? 1 : s === "partial" ? 0.5 : 0);
  const coverage = Math.round((CATS.reduce((s, c) => s + CATEGORY_WEIGHT[c] * share(categories[c]), 0) / total) * 100);
  const complete = report.site.reachable && report.pages.length > 0 && CATS.every((c) => categories[c] === "measured");
  for (const c of CATS) if (categories[c] === "missing" && c !== "performance") reasons.push(`${CATEGORY_LABEL[c]} kon niet worden gemeten.`);
  return { coverage, complete, categories, reasons };
}
