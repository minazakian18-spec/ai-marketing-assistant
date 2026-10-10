import { keywordRelevance } from "./parse.ts";
import type { Category, CheckResult, PsiResult, Scores, SiteFacts, StoredPage } from "./types";

// Measurable checks and the Mavix scores built from them.
//
// Every check yields a share between 0 and 1 (for example "8 of 10 pages have
// a title" = 0.8) or null when it cannot be measured in this scan. A category
// score is the weighted average of its measurable checks x 100. The overall
// score is the weighted average of the measurable categories (weights below).
// These are Mavix scores, not Google scores; performance comes from Google's
// Lighthouse (PageSpeed Insights) only when that measurement succeeded.

export const CATEGORY_WEIGHT: Record<Category, number> = {
  technical: 30,
  content: 25,
  performance: 20,
  mobile: 10,
  security: 10,
  accessibility: 5,
};
export const CATEGORY_LABEL: Record<Category, string> = {
  technical: "Technische SEO",
  content: "Content",
  performance: "Prestaties",
  mobile: "Mobiel",
  security: "Beveiliging",
  accessibility: "Toegankelijkheid",
};

type Ctx = { site: SiteFacts; pages: StoredPage[]; psi: { mobile: PsiResult; desktop: PsiResult } | null };
type Def = { id: string; category: Category; label: string; weight: number; run: (c: Ctx) => { ratio: number | null; detail: string; failing?: string[] } };

const ok = (p: StoredPage) => p.status >= 200 && p.status < 300 && /html/i.test(p.contentType || "text/html");
const htmlPages = (c: Ctx) => c.pages.filter(ok);
/** Share of pages for which `pass` holds, with the failing URLs. */
function share(c: Ctx, pass: (p: StoredPage) => boolean, describe: (n: number, of: number) => string, pages = htmlPages(c)) {
  if (!pages.length) return { ratio: null, detail: "Geen pagina's om te controleren." };
  const failing = pages.filter((p) => !pass(p)).map((p) => p.url);
  return { ratio: (pages.length - failing.length) / pages.length, detail: describe(pages.length - failing.length, pages.length), failing };
}
function duplicates(values: [string, string][]) {
  const by = new Map<string, string[]>();
  for (const [v, url] of values) if (v) by.set(v.toLowerCase(), [...(by.get(v.toLowerCase()) || []), url]);
  return [...by.values()].filter((urls) => urls.length > 1).flat();
}
// Site-level facts are only measured when the website answered.
const measured = (c: Ctx) => c.site.reachable && c.site.crawl.stopped !== "unreachable";
const NA = (detail: string) => ({ ratio: null, detail });
const psiScore = (r: PsiResult | undefined, key: "performance" | "accessibility" | "seo") => (r && r.ok && r.categories[key] !== null ? r.categories[key]! / 100 : null);

export const CHECKS: Def[] = [
  // ---------- Technical
  { id: "reachable", category: "technical", label: "Homepage bereikbaar", weight: 3, run: (c) => ({ ratio: c.site.reachable ? 1 : 0, detail: c.site.reachable ? `Antwoord ${c.site.startStatus}` : "De website gaf geen geldig antwoord." }) },
  {
    id: "status",
    category: "technical",
    label: "Pagina's zonder foutcodes",
    weight: 3,
    run: (c) => (c.pages.length ? share(c, (p) => p.status >= 200 && p.status < 400, (n, of) => `${n} van ${of} pagina's geven een geldige statuscode.`, c.pages) : { ratio: null, detail: "Geen pagina's gecontroleerd." }),
  },
  { id: "robots", category: "technical", label: "robots.txt aanwezig", weight: 1, run: (c) => (c.site.robots.status === null ? NA("robots.txt kon niet worden opgehaald.") : { ratio: c.site.robots.found ? 1 : 0, detail: c.site.robots.found ? "robots.txt gevonden." : `Geen robots.txt (status ${c.site.robots.status}).` }) },
  { id: "robots-blocks", category: "technical", label: "robots.txt blokkeert de site niet", weight: 3, run: (c) => (c.site.robots.blocksStart ? { ratio: 0, detail: "robots.txt verbiedt crawlers de startpagina." } : c.site.robots.status === null ? NA("robots.txt kon niet worden opgehaald.") : { ratio: 1, detail: "De startpagina mag gecrawld worden." }) },
  { id: "sitemap", category: "technical", label: "XML-sitemap gevonden", weight: 2, run: (c) => !measured(c) ? NA("Niet gecontroleerd: de website was niet bereikbaar.") : ({ ratio: c.site.sitemap.found ? 1 : 0, detail: c.site.sitemap.found ? `Sitemap met ${c.site.sitemap.urls} URL's.` : "Geen XML-sitemap gevonden (robots.txt en /sitemap.xml)." }) },
  { id: "indexable", category: "technical", label: "Indexeerbare pagina's", weight: 3, run: (c) => share(c, (p) => !p.noindex, (n, of) => `${n} van ${of} pagina's mogen in Google verschijnen.`) },
  {
    id: "canonical",
    category: "technical",
    label: "Canonical-URL ingesteld",
    weight: 2,
    run: (c) => share(c, (p) => !!p.canonical, (n, of) => `${n} van ${of} pagina's hebben een canonical-URL.`),
  },
  { id: "redirects", category: "technical", label: "Korte doorverwijzingen", weight: 1, run: (c) => share(c, (p) => p.redirects.length <= 1, (n, of) => `${n} van ${of} pagina's met hoogstens één doorverwijzing.`, c.pages) },
  {
    id: "broken-links",
    category: "technical",
    label: "Geen kapotte links",
    weight: 3,
    run: (c) => {
      const { checked, broken } = c.site.links;
      if (!checked) return { ratio: null, detail: "Geen links gecontroleerd." };
      return { ratio: (checked - broken.length) / checked, detail: `${broken.length} kapotte van ${checked} gecontroleerde links.`, failing: broken.map((b) => b.url) };
    },
  },
  {
    id: "structured-data",
    category: "technical",
    label: "Gestructureerde data",
    weight: 1,
    run: (c) => {
      const pages = htmlPages(c);
      if (!pages.length) return { ratio: null, detail: "Geen pagina's." };
      const valid = pages.filter((p) => p.structuredData.some((t) => !t.startsWith("(")));
      const invalid = pages.filter((p) => p.structuredData.includes("(ongeldige JSON-LD)")).map((p) => p.url);
      return { ratio: valid.length && !invalid.length ? 1 : valid.length ? 0.5 : 0, detail: valid.length ? `Schema.org gevonden op ${valid.length} pagina('s)${invalid.length ? `, ongeldig op ${invalid.length}` : ""}.` : "Geen schema.org-gegevens gevonden.", failing: invalid };
    },
  },

  // ---------- Content
  { id: "title", category: "content", label: "Paginatitel aanwezig", weight: 3, run: (c) => share(c, (p) => !!p.title, (n, of) => `${n} van ${of} pagina's hebben een titel.`) },
  { id: "title-length", category: "content", label: "Titellengte 30-60 tekens", weight: 1, run: (c) => share(c, (p) => p.title.length >= 30 && p.title.length <= 60, (n, of) => `${n} van ${of} titels hebben een goede lengte.`) },
  {
    id: "title-unique",
    category: "content",
    label: "Unieke titels",
    weight: 2,
    run: (c) => {
      const pages = htmlPages(c);
      if (pages.length < 2) return { ratio: null, detail: "Te weinig pagina's om te vergelijken." };
      const dup = duplicates(pages.map((p) => [p.title, p.url]));
      return { ratio: 1 - dup.length / pages.length, detail: dup.length ? `${dup.length} pagina's delen een titel.` : "Alle titels zijn uniek.", failing: dup };
    },
  },
  { id: "description", category: "content", label: "Metabeschrijving aanwezig", weight: 2, run: (c) => share(c, (p) => !!p.metaDescription, (n, of) => `${n} van ${of} pagina's hebben een metabeschrijving.`) },
  {
    id: "description-length",
    category: "content",
    label: "Beschrijving 70-160 tekens",
    weight: 1,
    run: (c) => share(c, (p) => p.metaDescription.length >= 70 && p.metaDescription.length <= 160, (n, of) => `${n} van ${of} beschrijvingen hebben een goede lengte.`, htmlPages(c).filter((p) => p.metaDescription)),
  },
  {
    id: "description-unique",
    category: "content",
    label: "Unieke metabeschrijvingen",
    weight: 1,
    run: (c) => {
      const pages = htmlPages(c).filter((p) => p.metaDescription);
      if (pages.length < 2) return { ratio: null, detail: "Te weinig beschrijvingen om te vergelijken." };
      const dup = duplicates(pages.map((p) => [p.metaDescription, p.url]));
      return { ratio: 1 - dup.length / pages.length, detail: dup.length ? `${dup.length} pagina's delen een beschrijving.` : "Alle beschrijvingen zijn uniek.", failing: dup };
    },
  },
  { id: "h1", category: "content", label: "Precies één H1-kop", weight: 2, run: (c) => share(c, (p) => p.h1.length === 1, (n, of) => `${n} van ${of} pagina's hebben precies één H1.`) },
  { id: "heading-order", category: "content", label: "Logische kopstructuur", weight: 1, run: (c) => share(c, (p) => p.headingSkips === 0, (n, of) => `${n} van ${of} pagina's slaan geen kopniveau over.`) },
  { id: "word-count", category: "content", label: "Voldoende tekst (250+ woorden)", weight: 1, run: (c) => share(c, (p) => p.wordCount >= 250, (n, of) => `${n} van ${of} pagina's hebben minstens 250 woorden.`) },
  {
    id: "keyword",
    category: "content",
    label: "Zoekwoord op de homepage",
    weight: 2,
    run: (c) => {
      const home = htmlPages(c)[0];
      if (!c.site.keyword) return { ratio: null, detail: "Geen zoekwoord ingesteld." };
      if (!home) return { ratio: null, detail: "Homepage niet gecontroleerd." };
      const k = keywordRelevance(home, c.site.keyword);
      const parts = [k.inTitle, k.inH1, k.inDescription, k.inText];
      const found = parts.filter(Boolean).length;
      return { ratio: found / parts.length, detail: `"${c.site.keyword}" staat in ${found} van 4 plekken (titel, H1, beschrijving, tekst).`, failing: found < 4 ? [home.url] : [] };
    },
  },

  // ---------- Performance (Google Lighthouse via PageSpeed Insights)
  { id: "lh-performance-mobile", category: "performance", label: "Lighthouse-prestaties (mobiel)", weight: 3, run: (c) => lh(c.psi?.mobile, "performance") },
  { id: "lh-performance-desktop", category: "performance", label: "Lighthouse-prestaties (desktop)", weight: 1, run: (c) => lh(c.psi?.desktop, "performance") },
  {
    id: "core-web-vitals",
    category: "performance",
    label: "Core Web Vitals (echte bezoekers)",
    weight: 2,
    run: (c) => {
      const f = c.psi?.mobile.ok ? c.psi.mobile.field : null;
      const metrics = f ? (["lcp", "inp", "cls"] as const).map((k) => f.metrics[k]).filter(Boolean) : [];
      if (!f || !metrics.length) return { ratio: null, detail: "Google heeft (nog) te weinig gegevens van echte bezoekers." };
      const good = metrics.filter((m) => m!.category === "FAST").length;
      return { ratio: good / metrics.length, detail: `${good} van ${metrics.length} Core Web Vitals zijn 'goed' (${f.scope === "origin" ? "hele website" : "deze pagina"}).` };
    },
  },

  // ---------- Mobile
  { id: "viewport", category: "mobile", label: "Mobiele viewport ingesteld", weight: 3, run: (c) => share(c, (p) => /width\s*=\s*device-width/i.test(p.viewport), (n, of) => `${n} van ${of} pagina's passen zich aan het scherm aan.`) },
  {
    id: "zoom",
    category: "mobile",
    label: "Inzoomen niet geblokkeerd",
    weight: 1,
    run: (c) => share(c, (p) => !/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(p.viewport), (n, of) => `${n} van ${of} pagina's laten inzoomen toe.`, htmlPages(c).filter((p) => p.viewport)),
  },
  {
    id: "font-size",
    category: "mobile",
    label: "Leesbare lettergrootte (Lighthouse)",
    weight: 1,
    run: (c) => {
      const v = c.psi?.mobile.ok ? c.psi.mobile.audits.fontSize : null;
      return v === null || v === undefined ? { ratio: null, detail: "Niet gemeten." } : { ratio: v, detail: v >= 0.9 ? "Tekst is leesbaar op mobiel." : "Een deel van de tekst is te klein op mobiel." };
    },
  },

  // ---------- Security
  { id: "https", category: "security", label: "HTTPS", weight: 3, run: (c) => !measured(c) ? NA("Niet gemeten: de website was niet bereikbaar.") : ({ ratio: c.site.https ? 1 : 0, detail: c.site.https ? "De website gebruikt HTTPS." : "De website gebruikt geen HTTPS." }) },
  {
    id: "http-redirect",
    category: "security",
    label: "HTTP stuurt door naar HTTPS",
    weight: 2,
    run: (c) => (c.site.httpRedirectsToHttps === null || !measured(c) ? { ratio: null, detail: "Niet te controleren." } : { ratio: c.site.httpRedirectsToHttps ? 1 : 0, detail: c.site.httpRedirectsToHttps ? "http:// gaat automatisch naar https://." : "http:// stuurt niet door naar https://." }),
  },
  { id: "hsts", category: "security", label: "HSTS-header", weight: 1, run: (c) => (c.site.https && measured(c) ? { ratio: c.site.hsts ? 1 : 0, detail: c.site.hsts ? "Strict-Transport-Security is ingesteld." : "Geen Strict-Transport-Security-header." } : { ratio: null, detail: "Geen HTTPS." }) },
  { id: "mixed-content", category: "security", label: "Geen gemengde inhoud", weight: 2, run: (c) => share(c, (p) => p.mixedContent === 0, (n, of) => `${n} van ${of} pagina's laden niets onbeveiligd.`, htmlPages(c).filter((p) => p.url.startsWith("https:"))) },
  { id: "nosniff", category: "security", label: "X-Content-Type-Options", weight: 1, run: (c) => !measured(c) ? NA("Niet gemeten: de website was niet bereikbaar.") : ({ ratio: c.site.nosniff ? 1 : 0, detail: c.site.nosniff ? "nosniff is ingesteld." : "Header X-Content-Type-Options ontbreekt." }) },

  // ---------- Accessibility
  { id: "lang", category: "accessibility", label: "Taal van de pagina ingesteld", weight: 2, run: (c) => share(c, (p) => !!p.lang, (n, of) => `${n} van ${of} pagina's hebben een lang-attribuut.`) },
  {
    id: "alt",
    category: "accessibility",
    label: "Afbeeldingen met alt-tekst",
    weight: 2,
    run: (c) => {
      const pages = htmlPages(c);
      const total = pages.reduce((s, p) => s + p.images, 0);
      if (!total) return { ratio: null, detail: "Geen afbeeldingen gevonden." };
      const missing = pages.reduce((s, p) => s + p.imagesMissingAlt, 0);
      return { ratio: (total - missing) / total, detail: `${missing} van ${total} afbeeldingen missen een alt-attribuut.`, failing: pages.filter((p) => p.imagesMissingAlt).map((p) => p.url) };
    },
  },
  { id: "link-text", category: "accessibility", label: "Links met beschrijvende tekst", weight: 1, run: (c) => share(c, (p) => p.emptyLinks === 0, (n, of) => `${n} van ${of} pagina's hebben geen links zonder tekst.`) },
  { id: "lh-accessibility", category: "accessibility", label: "Lighthouse-toegankelijkheid (mobiel)", weight: 3, run: (c) => lh(c.psi?.mobile, "accessibility") },
];

function lh(r: PsiResult | undefined, key: "performance" | "accessibility" | "seo") {
  const v = psiScore(r, key);
  if (v === null) return { ratio: null, detail: r && !r.ok ? "PageSpeed Insights gaf geen resultaat." : "Niet gemeten." };
  return { ratio: v, detail: `Lighthouse-score ${Math.round(v * 100)} van 100 (Google, labmeting).` };
}

export function runChecks(ctx: Ctx): CheckResult[] {
  return CHECKS.map((d) => {
    const r = d.run(ctx);
    return { id: d.id, category: d.category, label: d.label, weight: d.weight, ratio: r.ratio === null ? null : Math.max(0, Math.min(1, r.ratio)), detail: r.detail, failing: (r.failing || []).slice(0, 50) };
  });
}

export function computeScores(checks: CheckResult[]): Scores {
  const categories = {} as Record<Category, number | null>;
  for (const cat of Object.keys(CATEGORY_WEIGHT) as Category[]) {
    const measured = checks.filter((c) => c.category === cat && c.ratio !== null);
    const w = measured.reduce((s, c) => s + c.weight, 0);
    categories[cat] = w ? Math.round((measured.reduce((s, c) => s + c.weight * c.ratio!, 0) / w) * 100) : null;
  }
  const present = (Object.keys(CATEGORY_WEIGHT) as Category[]).filter((c) => categories[c] !== null);
  const total = present.reduce((s, c) => s + CATEGORY_WEIGHT[c], 0);
  return {
    overall: total ? Math.round(present.reduce((s, c) => s + CATEGORY_WEIGHT[c] * categories[c]!, 0) / total) : null,
    categories,
  };
}
