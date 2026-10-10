import type { PageFacts } from "./parse";

// Shapes of a stored SEO scan. Everything in a report was measured during the
// scan (crawler, robots.txt, sitemap, PageSpeed Insights); nothing is estimated.

export type Category = "technical" | "content" | "performance" | "mobile" | "security" | "accessibility";
export type Severity = "critical" | "high" | "medium" | "low";

export type Metric = { value: number; display: string; score: number | null };
export type FieldMetric = { percentile: number; category: "FAST" | "AVERAGE" | "SLOW" };
export type PsiResult =
  | {
      ok: true;
      strategy: "mobile" | "desktop";
      finalUrl: string;
      lighthouseVersion: string;
      categories: { performance: number | null; accessibility: number | null; bestPractices: number | null; seo: number | null };
      lab: Partial<Record<"fcp" | "lcp" | "tbt" | "cls" | "si", Metric>>;
      field: null | { scope: "url" | "origin"; overall: FieldMetric["category"] | null; metrics: Partial<Record<"lcp" | "inp" | "cls" | "fcp" | "ttfb", FieldMetric>> };
      opportunities: { id: string; title: string; display: string }[];
      audits: { viewport: number | null; fontSize: number | null };
    }
  | { ok: false; strategy: "mobile" | "desktop"; error: string };

export type StoredPage = Omit<PageFacts, "internalLinks" | "externalLinks"> & { internalLinkCount: number; externalLinkCount: number };

export type SiteFacts = {
  startUrl: string;
  finalUrl: string;
  reachable: boolean;
  startStatus: number | null;
  startError?: string;
  https: boolean;
  httpRedirectsToHttps: boolean | null;
  hsts: boolean;
  nosniff: boolean;
  robots: { found: boolean; status: number | null; blocksStart: boolean; sitemaps: string[]; crawlDelayMs: number };
  sitemap: { found: boolean; url: string | null; urls: number };
  crawl: { limit: number; crawled: number; skippedByRobots: number; stopped: "done" | "limit" | "time" | "robots" | "unreachable" };
  links: { checked: number; broken: { url: string; status: number | string; foundOn: string[]; internal: boolean }[]; unverified: number };
  keyword: string;
};

export type CheckResult = {
  id: string;
  category: Category;
  label: string;
  weight: number;
  /** 0..1 share passed; null = not measurable in this scan (excluded from the score). */
  ratio: number | null;
  detail: string;
  failing: string[];
};

export type Scores = {
  overall: number | null;
  categories: Record<Category, number | null>;
};

export type Recommendation = {
  id: string;
  checkId: string;
  category: Category;
  severity: Severity;
  problem: string;
  why: string;
  action: string;
  guidance: string[];
  urls: string[];
  totalUrls: number;
  /** AI alternatives can be generated for these pages. */
  suggest?: "title" | "description" | "structure";
};

export type ScanReport = {
  version: 1;
  site: SiteFacts;
  pages: StoredPage[];
  psi: { mobile: PsiResult; desktop: PsiResult } | null;
  checks: CheckResult[];
  scores: Scores;
  recommendations: Recommendation[];
};
