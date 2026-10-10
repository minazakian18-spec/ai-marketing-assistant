// Pure HTML analysis of one page. No DOM library: regular expressions over a
// size-limited document, good enough for SEO signals (titles, meta, headings,
// links, images, structured data). Untrusted input: nothing here executes or
// renders the page.

export type PageFacts = {
  url: string;
  status: number;
  /** Redirect chain before this URL (each hop with its status). */
  redirects: { url: string; status: number }[];
  contentType: string;
  bytes: number;
  loadMs: number;
  title: string;
  metaDescription: string;
  canonical: string | null;
  robotsMeta: string;
  xRobotsTag: string;
  noindex: boolean;
  nofollow: boolean;
  lang: string;
  viewport: string;
  h1: string[];
  headings: number[];
  headingSkips: number;
  images: number;
  imagesMissingAlt: number;
  missingAltSamples: string[];
  internalLinks: string[];
  externalLinks: string[];
  emptyLinks: number;
  structuredData: string[];
  mixedContent: number;
  wordCount: number;
  /** First ~1500 characters of visible text (for keyword checks and AI suggestions). */
  textSample: string;
  ogTitle: string;
  ogDescription: string;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeEntities(s: string) {
  return s
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}
const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, " "));

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? "") : null;
}

function metaContent(html: string, key: string, by: "name" | "property" = "name") {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const v = attr(m[0], by);
    if (v && v.toLowerCase() === key) return attr(m[0], "content") || "";
  }
  return "";
}

export function resolveUrl(href: string, base: string): string | null {
  const h = href.trim();
  if (!h || /^(javascript|mailto|tel|data|sms|ftp):/i.test(h) || h.startsWith("#")) return null;
  try {
    const u = new URL(h, base);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** Same site: identical host, ignoring a leading "www.". */
export const sameSite = (a: string, b: string) => {
  try {
    const x = new URL(a).hostname.replace(/^www\./, "");
    const y = new URL(b).hostname.replace(/^www\./, "");
    return x === y;
  } catch {
    return false;
  }
};

export function parsePage(input: {
  url: string;
  status: number;
  html: string;
  headers?: Record<string, string>;
  redirects?: { url: string; status: number }[];
  loadMs?: number;
}): PageFacts {
  const html = input.html.slice(0, 2_000_000);
  const headers = input.headers || {};
  const head = html.match(/<head\b[\s\S]*?<\/head>/i)?.[0] || html.slice(0, 50_000);
  const body = html.replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const base = (() => {
    const href = head.match(/<base\b[^>]*>/i)?.[0];
    const b = href ? attr(href, "href") : null;
    return (b && resolveUrl(b, input.url)) || input.url;
  })();

  const title = stripTags(head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const robotsMeta = [metaContent(head, "robots"), metaContent(head, "mavixbot")].filter(Boolean).join(", ").toLowerCase();
  const xRobotsTag = (headers["x-robots-tag"] || "").toLowerCase();
  const directives = robotsMeta + "," + xRobotsTag;
  let canonical: string | null = null;
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (attr(m[0], "rel") || "").toLowerCase().split(/\s+/);
    if (rel.includes("canonical")) {
      canonical = resolveUrl(attr(m[0], "href") || "", base);
      break;
    }
  }

  const headingMatches = [...body.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
  const headings = headingMatches.map((m) => Number(m[1]));
  let skips = 0;
  for (let i = 1; i < headings.length; i++) if (headings[i] > headings[i - 1] + 1) skips++;
  if (headings.length && headings[0] > 1 && !headings.includes(1)) skips++;

  const images = [...body.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const missingAlt = images.filter((t) => attr(t, "alt") === null);
  const isHttps = input.url.startsWith("https:");
  const mixed = isHttps ? [...html.matchAll(/<(?:img|script|iframe|audio|video|source|embed)\b[^>]*\ssrc\s*=\s*["']http:\/\//gi)].length + [...html.matchAll(/<link\b[^>]*rel=["']?stylesheet[^>]*href\s*=\s*["']http:\/\//gi)].length : 0;

  const internal = new Set<string>();
  const external = new Set<string>();
  let emptyLinks = 0;
  for (const m of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const tag = "<a" + m[1] + ">";
    const href = attr(tag, "href");
    const name = stripTags(m[2]) || attr(tag, "aria-label") || attr(tag, "title") || (/<img\b[^>]*\salt\s*=\s*["'][^"']+["']/i.test(m[2]) ? "img" : "");
    if (href !== null && !name) emptyLinks++;
    const abs = href ? resolveUrl(href, base) : null;
    if (!abs) continue;
    if ((attr(tag, "rel") || "").toLowerCase().includes("nofollow") && !sameSite(abs, input.url)) continue;
    (sameSite(abs, input.url) ? internal : external).add(abs);
  }

  const types = new Set<string>();
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (v: unknown) => {
        if (Array.isArray(v)) return v.forEach(walk);
        if (v && typeof v === "object") {
          const t = (v as Record<string, unknown>)["@type"];
          if (typeof t === "string") types.add(t);
          if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x));
          const graph = (v as Record<string, unknown>)["@graph"];
          if (graph) walk(graph);
        }
      };
      walk(JSON.parse(m[1].trim()));
    } catch {
      types.add("(ongeldige JSON-LD)");
    }
  }
  for (const m of html.matchAll(/itemtype\s*=\s*["']https?:\/\/schema\.org\/([A-Za-z]+)["']/gi)) types.add(m[1]);

  const text = stripTags(body.match(/<body\b[\s\S]*<\/body>/i)?.[0] || body);
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));

  return {
    url: input.url,
    status: input.status,
    redirects: input.redirects || [],
    contentType: headers["content-type"] || "",
    bytes: new TextEncoder().encode(input.html).length,
    loadMs: input.loadMs || 0,
    title,
    metaDescription: metaContent(head, "description"),
    canonical,
    robotsMeta,
    xRobotsTag,
    noindex: /(^|[\s,])(noindex|none)([\s,]|$)/.test(directives),
    nofollow: /(^|[\s,])(nofollow|none)([\s,]|$)/.test(directives),
    lang: attr(html.match(/<html\b[^>]*>/i)?.[0] || "", "lang") || "",
    viewport: metaContent(head, "viewport"),
    h1: headingMatches.filter((m) => m[1] === "1").map((m) => stripTags(m[2]).slice(0, 200)),
    headings: headings.slice(0, 60),
    headingSkips: skips,
    images: images.length,
    imagesMissingAlt: missingAlt.length,
    missingAltSamples: missingAlt.slice(0, 5).map((t) => resolveUrl(attr(t, "src") || attr(t, "data-src") || "", base) || "(zonder bron)"),
    internalLinks: [...internal].slice(0, 300),
    externalLinks: [...external].slice(0, 100),
    emptyLinks,
    structuredData: [...types].slice(0, 20),
    mixedContent: mixed,
    wordCount: words.length,
    textSample: text.slice(0, 1500),
    ogTitle: metaContent(head, "og:title", "property"),
    ogDescription: metaContent(head, "og:description", "property"),
  };
}

/** <loc> entries of a sitemap or sitemap index (first 500). */
export function parseSitemap(xml: string): { urls: string[]; sitemaps: string[] } {
  const locs = (inner: string) => [...inner.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)].map((m) => decodeEntities(m[1])).filter((u) => /^https?:\/\//i.test(u));
  const isIndex = /<sitemapindex\b/i.test(xml);
  const all = locs(xml.slice(0, 5_000_000)).slice(0, 500);
  return isIndex ? { urls: [], sitemaps: all } : { urls: all, sitemaps: [] };
}

const STOP = new Set(
  "de het een en van in op te dat die is voor met zijn er aan als bij ook om of naar dan maar door over uit nog wel ze we je jij u hij zij wij ons onze uw meer niet geen tot wordt worden kan kunnen heeft hebben was the and for with your our are you this that from have has will can not all".split(" "),
);
const words = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[\p{L}\p{N}]{3,}/gu) || [];

/** Basic keyword relevance: where the focus keyword appears, or the page's main terms. */
export function keywordRelevance(page: Pick<PageFacts, "title" | "metaDescription" | "h1" | "textSample" | "url">, keyword: string) {
  const kw = words(keyword).join(" ");
  if (!kw) {
    const counts = new Map<string, number>();
    for (const w of words(page.textSample)) if (!STOP.has(w)) counts.set(w, (counts.get(w) || 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
    const titleWords = new Set(words(page.title));
    return { keyword: "", inTitle: false, inH1: false, inDescription: false, inUrl: false, inText: false, topTerms: top, titleMatchesContent: top.some((w) => titleWords.has(w)) };
  }
  const has = (s: string) => words(s).join(" ").includes(kw);
  const slug = (() => {
    try {
      return decodeURIComponent(new URL(page.url).pathname).replace(/[-_/]+/g, " ");
    } catch {
      return "";
    }
  })();
  return {
    keyword: kw,
    inTitle: has(page.title),
    inH1: page.h1.some(has),
    inDescription: has(page.metaDescription),
    inUrl: has(slug),
    inText: has(page.textSample),
    topTerms: [] as string[],
    titleMatchesContent: true,
  };
}
