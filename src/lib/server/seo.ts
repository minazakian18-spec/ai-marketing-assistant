import "server-only";
import { randomBytes } from "node:crypto";
import { adminClient } from "./supabase";
import { HttpError } from "./access";
import { assertPublicUrl, safeFetch } from "./safe-fetch";
import { parsePage, parseSitemap, sameSite, type PageFacts } from "../seo/parse";
import { crawlDelayMs, parseRobots, robotsAllowed, type Robots } from "../seo/robots";
import { parsePsi } from "../seo/psi";
import { computeScores, runChecks } from "../seo/checks";
import { buildRecommendations } from "../seo/recommendations";
import type { PsiResult, ScanReport, SiteFacts, StoredPage } from "../seo/types";

// SEO scans. A scan is created by a request (manual) or the cron endpoint
// (scheduled) and runs after the response (next/server `after`), so no request
// handler waits for a crawl. Progress is written to the scan row; the browser
// polls it. Limits keep every scan small and polite:
// - only the website's own host (www and non-www), http(s) on 80/443, every
//   hop validated against private networks (safe-fetch);
// - robots.txt (MavixBot, else *) and crawl-delay are respected;
// - at most PAGE_LIMIT pages, a delay between requests, per-request timeouts
//   and size limits, and an overall time budget;
// - at most DAILY_SCANS scans per workspace per 24 hours (crawl + Google API cost).

const db = () => adminClient();
const log = (event: string, extra: Record<string, string | number> = {}) => console.info(JSON.stringify({ event, ...extra }));

export const PAGE_LIMIT = { unverified: 10, verified: 30 };
const CRAWL_BUDGET_MS = 100_000;
const TOTAL_BUDGET_MS = 150_000;
const MIN_DELAY_MS = 500;
const INTERNAL_LINK_CHECKS = 30;
const EXTERNAL_LINK_CHECKS = 15;
export const DAILY_SCANS = 10;
export const MAX_SITES = 5;
const STALE_MS = 4 * 60_000;
const SKIP_EXT = /\.(jpe?g|png|gif|webp|avif|svg|ico|pdf|zip|rar|gz|mp4|mov|webm|mp3|wav|docx?|xlsx?|pptx?|css|js|json|xml|txt|woff2?|ttf|eot)$/i;

export type SiteRow = {
  id: string;
  workspace_id: string;
  url: string;
  host: string;
  focus_keyword: string;
  verification_token: string;
  verified_at: string | null;
  verification_method: string | null;
  schedule: "off" | "weekly" | "monthly";
  next_scan_at: string | null;
  gsc_property: string | null;
  created_at: string;
};
export type ScanRow = {
  id: string;
  workspace_id: string;
  site_id: string;
  status: "queued" | "running" | "completed" | "failed";
  stage: string | null;
  progress: { pages?: number; limit?: number; links?: number };
  trigger: "manual" | "scheduled";
  error: string | null;
  scores: ScanReport["scores"] | null;
  report: ScanReport | null;
  created_at: string;
  started_at: string | null;
  heartbeat_at: string | null;
  completed_at: string | null;
};
const SITE_COLUMNS = "id,workspace_id,url,host,focus_keyword,verification_token,verified_at,verification_method,schedule,next_scan_at,gsc_property,created_at";
const SUMMARY_COLUMNS = "id,site_id,status,stage,progress,trigger,error,scores,created_at,started_at,heartbeat_at,completed_at";

// ---------------------------------------------------------------- Sites

/** Normalize user input to a public website URL (scheme + host + path). */
export async function normalizeSiteUrl(input: string) {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : "https://" + input.trim());
  } catch {
    throw new HttpError(400, "Vul een geldig webadres in, bijvoorbeeld jouwbedrijf.nl.");
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) || url.hostname.length > 253) throw new HttpError(400, "Vul een geldig webadres in, bijvoorbeeld jouwbedrijf.nl.");
  try {
    await assertPublicUrl(url.toString());
  } catch (e) {
    const code = (e as { code?: string; message?: string }).code || (e as Error).message;
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") throw new HttpError(400, "Deze website bestaat niet of is (nog) niet bereikbaar. Controleer het adres.");
    throw new HttpError(400, "Dit adres kan Mavix niet analyseren. Gebruik het openbare adres van je website.");
  }
  url.hash = "";
  url.search = "";
  return { url: url.origin + (url.pathname || "/"), host: url.hostname.toLowerCase().replace(/^www\./, "") };
}

const isStale = (s: Pick<ScanRow, "status" | "heartbeat_at" | "created_at">) =>
  (s.status === "running" || s.status === "queued") && Date.now() - Date.parse(s.heartbeat_at || s.created_at) > STALE_MS;
const view = <T extends Pick<ScanRow, "status" | "heartbeat_at" | "created_at" | "error">>(s: T): T =>
  isStale(s) ? { ...s, status: "failed", error: s.error || "De analyse is onderbroken. Start hem opnieuw." } : s;

export async function listSites(workspaceId: string) {
  const { data: sites, error } = await db().from("seo_sites").select(SITE_COLUMNS).eq("workspace_id", workspaceId).order("created_at");
  if (error) throw new HttpError(503, "SEO Intelligence is nog niet beschikbaar.");
  const out = [];
  for (const s of (sites || []) as SiteRow[]) {
    const { data: scans } = await db().from("seo_scans").select(SUMMARY_COLUMNS).eq("site_id", s.id).order("created_at", { ascending: false }).limit(1);
    out.push({ ...publicSite(s), latest: scans?.[0] ? view(scans[0] as ScanRow) : null });
  }
  return out;
}

export function publicSite(s: SiteRow) {
  return {
    id: s.id,
    url: s.url,
    host: s.host,
    focusKeyword: s.focus_keyword,
    verified: !!s.verified_at,
    verifiedAt: s.verified_at,
    verificationToken: s.verification_token,
    schedule: s.schedule,
    nextScanAt: s.next_scan_at,
    gscProperty: s.gsc_property,
    pageLimit: s.verified_at ? PAGE_LIMIT.verified : PAGE_LIMIT.unverified,
  };
}

export async function siteRow(workspaceId: string, id: string): Promise<SiteRow> {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, "Website niet gevonden.");
  const { data, error } = await db().from("seo_sites").select(SITE_COLUMNS).eq("workspace_id", workspaceId).eq("id", id).maybeSingle();
  if (error) throw new HttpError(503, "SEO Intelligence is nog niet beschikbaar.");
  if (!data) throw new HttpError(404, "Website niet gevonden.");
  return data as SiteRow;
}

export async function createSite(workspaceId: string, userId: string, input: { url: string; focusKeyword?: string }) {
  const { url, host } = await normalizeSiteUrl(input.url);
  const { data: existing, error: countError } = await db().from("seo_sites").select("id,host").eq("workspace_id", workspaceId);
  if (countError) throw new HttpError(503, "SEO Intelligence is nog niet beschikbaar.");
  if ((existing || []).some((s) => s.host === host)) throw new HttpError(409, "Deze website staat al in je SEO-overzicht.");
  if ((existing || []).length >= MAX_SITES) throw new HttpError(409, `Je kunt maximaal ${MAX_SITES} websites toevoegen.`);
  const { data, error } = await db()
    .from("seo_sites")
    .insert({ workspace_id: workspaceId, url, host, focus_keyword: (input.focusKeyword || "").trim().slice(0, 80), verification_token: randomBytes(16).toString("hex"), created_by: userId })
    .select(SITE_COLUMNS)
    .single();
  if (error?.code === "23505") throw new HttpError(409, "Deze website staat al in je SEO-overzicht.");
  if (error) throw error;
  return publicSite(data as SiteRow);
}

export function nextRun(schedule: SiteRow["schedule"], from = new Date()) {
  if (schedule === "off") return null;
  const d = new Date(from);
  if (schedule === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

export async function updateSite(workspaceId: string, id: string, patch: { focusKeyword?: string; schedule?: SiteRow["schedule"]; gscProperty?: string | null }) {
  const site = await siteRow(workspaceId, id);
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.focusKeyword !== undefined) row.focus_keyword = patch.focusKeyword.trim().slice(0, 80);
  if (patch.schedule !== undefined) {
    if (patch.schedule !== "off" && !site.verified_at) throw new HttpError(409, "Verifieer eerst dat de website van jou is om automatische analyses in te plannen.");
    row.schedule = patch.schedule;
    row.next_scan_at = nextRun(patch.schedule);
  }
  if (patch.gscProperty !== undefined) row.gsc_property = patch.gscProperty;
  const { data, error } = await db().from("seo_sites").update(row).eq("workspace_id", workspaceId).eq("id", id).select(SITE_COLUMNS).single();
  if (error) throw error;
  return publicSite(data as SiteRow);
}

export async function deleteSite(workspaceId: string, id: string) {
  await siteRow(workspaceId, id);
  const { error } = await db().from("seo_sites").delete().eq("workspace_id", workspaceId).eq("id", id);
  if (error) throw error;
}

/**
 * Ownership check: <meta name="mavix-site-verification" content="TOKEN"> on
 * the start page, or the file /mavix-verification.txt containing the token.
 */
export async function verifySite(workspaceId: string, id: string) {
  const site = await siteRow(workspaceId, id);
  let method: "meta" | "file" | null = null;
  try {
    const page = await safeFetch(site.url, { timeoutMs: 8000, maxBytes: 600_000, maxRedirects: 4 });
    for (const tag of page.body.match(/<meta\b[^>]*>/gi) || []) {
      if (!/name\s*=\s*["']?mavix-site-verification\b/i.test(tag)) continue;
      const content = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1]?.trim();
      if (content === site.verification_token) method = "meta";
    }
  } catch {
    /* try the file */
  }
  if (!method) {
    try {
      const file = await safeFetch(new URL("/mavix-verification.txt", site.url).toString(), { timeoutMs: 6000, maxBytes: 4_000, maxRedirects: 3 });
      if (file.status === 200 && file.body.trim() === site.verification_token) method = "file";
    } catch {
      /* not verified */
    }
  }
  if (!method) throw new HttpError(422, "We vonden de verificatiecode niet op je website. Controleer of de code online staat en probeer het opnieuw.");
  const { data, error } = await db().from("seo_sites").update({ verified_at: new Date().toISOString(), verification_method: method, updated_at: new Date().toISOString() }).eq("id", site.id).select(SITE_COLUMNS).single();
  if (error) throw error;
  log("seo_site_verified", { method });
  return publicSite(data as SiteRow);
}

// ---------------------------------------------------------------- Scans

export async function startScan(workspaceId: string, siteId: string, userId: string | null, trigger: "manual" | "scheduled" = "manual") {
  const site = await siteRow(workspaceId, siteId);
  // Clear interrupted scans so the "one active scan" rule does not block forever.
  const { data: active } = await db().from("seo_scans").select("id,status,heartbeat_at,created_at,error").eq("site_id", site.id).in("status", ["queued", "running"]);
  for (const a of (active || []) as ScanRow[])
    if (isStale(a)) await db().from("seo_scans").update({ status: "failed", error: "De analyse is onderbroken. Start hem opnieuw." }).eq("id", a.id).in("status", ["queued", "running"]);
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count, error: countError } = await db().from("seo_scans").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gt("created_at", since);
  if (countError) throw new HttpError(503, "SEO Intelligence is nog niet beschikbaar.");
  if ((count || 0) >= DAILY_SCANS) throw new HttpError(429, `Je hebt het maximum van ${DAILY_SCANS} analyses per dag bereikt. Probeer het morgen opnieuw.`);
  const { data, error } = await db()
    .from("seo_scans")
    .insert({ workspace_id: workspaceId, site_id: site.id, status: "queued", stage: "queued", progress: { pages: 0, limit: site.verified_at ? PAGE_LIMIT.verified : PAGE_LIMIT.unverified }, trigger, requested_by: userId })
    .select("id")
    .single();
  if (error?.code === "23505") throw new HttpError(409, "Er loopt al een analyse voor deze website.");
  if (error) throw error;
  return data.id as string;
}

export async function listScans(workspaceId: string, siteId: string) {
  await siteRow(workspaceId, siteId);
  const { data, error } = await db().from("seo_scans").select(SUMMARY_COLUMNS).eq("workspace_id", workspaceId).eq("site_id", siteId).order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return ((data || []) as ScanRow[]).map(view);
}

export async function getScan(workspaceId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, "Analyse niet gevonden.");
  const { data, error } = await db().from("seo_scans").select(`${SUMMARY_COLUMNS},report`).eq("workspace_id", workspaceId).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Analyse niet gevonden.");
  return view(data as unknown as ScanRow);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const keyOf = (u: string) => {
  const x = new URL(u);
  return x.hostname.replace(/^www\./, "").toLowerCase() + (x.pathname.replace(/\/+$/, "") || "/") + x.search;
};
const BROKEN = (s: number | string) => s === "dns" || (typeof s === "number" && (s === 404 || s === 410 || s >= 500));
const UNCERTAIN = (s: number | string) => typeof s === "string" ? s !== "dns" : [401, 403, 405, 429].includes(s) || s === 0;

async function fetchPsi(url: string, strategy: "mobile" | "desktop"): Promise<PsiResult> {
  const q = new URLSearchParams({ url, strategy, locale: "nl" });
  for (const c of ["performance", "accessibility", "best-practices", "seo"]) q.append("category", c);
  if (process.env.PAGESPEED_API_KEY) q.set("key", process.env.PAGESPEED_API_KEY);
  try {
    const r = await fetch("https://www.googleapis.com/pagespeedonline/v5/runPagespeed?" + q, { cache: "no-store", signal: AbortSignal.timeout(70_000) });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      const reason = r.status === 429 ? "De dagelijkse limiet van PageSpeed Insights is bereikt." : "PageSpeed Insights kon deze pagina niet meten.";
      log("seo_psi_failed", { strategy, status: r.status });
      return { ok: false, strategy, error: reason };
    }
    return parsePsi(json, strategy);
  } catch {
    log("seo_psi_failed", { strategy, status: 0 });
    return { ok: false, strategy, error: "PageSpeed Insights reageerde niet op tijd." };
  }
}

const toStored = (p: PageFacts): StoredPage => {
  const { internalLinks, externalLinks, ...rest } = p;
  return { ...rest, textSample: p.textSample.slice(0, 800), internalLinkCount: internalLinks.length, externalLinkCount: externalLinks.length };
};

type Progress = (stage: string, progress: ScanRow["progress"]) => Promise<void>;

/** The crawl itself (no database access except progress). Exported for tests. */
export async function crawlSite(siteUrl: string, opts: { limit: number; keyword: string; progress?: Progress; now?: () => number; delay?: (ms: number) => Promise<void> }) {
  const now = opts.now || Date.now;
  const wait = opts.delay || sleep;
  const started = now();
  const progress = opts.progress || (async () => {});
  const start = new URL(siteUrl);
  const site: SiteFacts = {
    startUrl: siteUrl,
    finalUrl: siteUrl,
    reachable: false,
    startStatus: null,
    https: start.protocol === "https:",
    httpRedirectsToHttps: null,
    hsts: false,
    nosniff: false,
    robots: { found: false, status: null, blocksStart: false, sitemaps: [], crawlDelayMs: 0 },
    sitemap: { found: false, url: null, urls: 0 },
    crawl: { limit: opts.limit, crawled: 0, skippedByRobots: 0, stopped: "done" },
    links: { checked: 0, broken: [], unverified: 0 },
    keyword: opts.keyword,
  };
  const pages: PageFacts[] = [];
  const statuses = new Map<string, number | string>();

  // 1. robots.txt first, so nothing else is fetched against the owner's wishes.
  await progress("robots", { pages: 0, limit: opts.limit });
  let robots: Robots | null = null;
  try {
    const r = await safeFetch(start.origin + "/robots.txt", { timeoutMs: 6000, maxBytes: 500_000, maxRedirects: 3 });
    site.robots.status = r.status;
    if (r.status === 200 && !/html/i.test(r.type)) {
      robots = parseRobots(r.body);
      site.robots.found = true;
      site.robots.sitemaps = robots.sitemaps.slice(0, 10);
      site.robots.crawlDelayMs = crawlDelayMs(robots);
    } else if (r.status >= 500) {
      // RFC 9309: a server error on robots.txt means "assume disallowed".
      robots = parseRobots("User-agent: *\nDisallow: /");
    }
  } catch {
    /* unreachable robots.txt = no rules; the start page fetch decides reachability */
  }
  const delay = Math.max(MIN_DELAY_MS, site.robots.crawlDelayMs);
  const allowed = (u: string) => {
    const x = new URL(u);
    return robotsAllowed(robots, x.pathname + x.search);
  };

  if (!allowed(siteUrl)) {
    site.robots.blocksStart = true;
    site.reachable = site.robots.status !== null;
    site.crawl.stopped = "robots";
  } else {
    // 2. Start page: reachability, final URL, security headers.
    try {
      const first = await safeFetch(siteUrl, { timeoutMs: 10_000, maxBytes: 1_500_000, maxRedirects: 5 });
      site.finalUrl = first.url;
      site.startStatus = first.status;
      site.reachable = first.status >= 200 && first.status < 300;
      site.https = first.url.startsWith("https:");
      site.hsts = site.https && !!first.headers["strict-transport-security"];
      site.nosniff = /nosniff/i.test(first.headers["x-content-type-options"] || "");
      statuses.set(keyOf(siteUrl), first.status);
      statuses.set(keyOf(first.url), first.status);
      if (/html/i.test(first.type)) pages.push(parsePage({ url: first.url, status: first.status, html: first.body, headers: first.headers, redirects: first.chain, loadMs: first.ms }));
      else pages.push(parsePage({ url: first.url, status: first.status, html: "", headers: first.headers, redirects: first.chain, loadMs: first.ms }));
    } catch (e) {
      site.startError = (e as Error).message === "timeout" ? "timeout" : "unreachable";
      site.crawl.stopped = "unreachable";
    }
  }

  if (site.reachable && site.crawl.stopped === "done") {
    // 3. http:// -> https:// redirect.
    if (site.https) {
      try {
        const plain = await safeFetch("http://" + new URL(site.finalUrl).host + "/", { timeoutMs: 6000, maxBytes: 2_000, maxRedirects: 4 });
        site.httpRedirectsToHttps = plain.url.startsWith("https:");
      } catch {
        site.httpRedirectsToHttps = null;
      }
    } else site.httpRedirectsToHttps = false;

    // 4. XML sitemap (robots.txt references first, then common locations), same site only.
    await progress("sitemap", { pages: pages.length, limit: opts.limit });
    const origin = new URL(site.finalUrl).origin;
    const candidates = [...site.robots.sitemaps.filter((u) => sameSite(u, site.finalUrl)), origin + "/sitemap.xml", origin + "/sitemap_index.xml", origin + "/wp-sitemap.xml"];
    const seeds: string[] = [];
    for (const candidate of [...new Set(candidates)].slice(0, 5)) {
      try {
        if (!allowed(candidate)) continue;
        const r = await safeFetch(candidate, { timeoutMs: 8000, maxBytes: 5_000_000, maxRedirects: 3 });
        if (r.status !== 200 || !/<(urlset|sitemapindex)\b/i.test(r.body)) continue;
        let parsed = parseSitemap(r.body);
        if (parsed.sitemaps.length) {
          const child = parsed.sitemaps.find((u) => sameSite(u, site.finalUrl));
          if (child) {
            const c = await safeFetch(child, { timeoutMs: 8000, maxBytes: 5_000_000, maxRedirects: 3 }).catch(() => null);
            if (c && c.status === 200) parsed = { urls: parseSitemap(c.body).urls, sitemaps: parsed.sitemaps };
          }
        }
        site.sitemap = { found: true, url: candidate, urls: parsed.urls.length };
        seeds.push(...parsed.urls.filter((u) => sameSite(u, site.finalUrl)).slice(0, 15));
        break;
      } catch {
        /* next candidate */
      }
    }

    // 5. Crawl: breadth-first from the start page plus sitemap URLs.
    const queue: string[] = [...(pages[0]?.internalLinks || []), ...seeds];
    const seen = new Set<string>([keyOf(siteUrl), keyOf(site.finalUrl)]);
    while (queue.length && pages.length < opts.limit) {
      if (now() - started > CRAWL_BUDGET_MS) {
        site.crawl.stopped = "time";
        break;
      }
      const next = queue.shift()!;
      let k: string;
      try {
        k = keyOf(next);
      } catch {
        continue;
      }
      if (seen.has(k) || !sameSite(next, site.finalUrl) || SKIP_EXT.test(new URL(next).pathname)) continue;
      seen.add(k);
      if (!allowed(next)) {
        site.crawl.skippedByRobots++;
        continue;
      }
      await wait(delay);
      try {
        const r = await safeFetch(next, { timeoutMs: 8000, maxBytes: 1_500_000, maxRedirects: 4 });
        statuses.set(k, r.status);
        statuses.set(keyOf(r.url), r.status);
        if (r.chain.length && seen.has(keyOf(r.url)) && r.status < 400) continue; // a redirect to a page we already have
        seen.add(keyOf(r.url));
        const page = parsePage({ url: r.url, status: r.status, html: /html/i.test(r.type) ? r.body : "", headers: r.headers, redirects: r.chain, loadMs: r.ms });
        pages.push(page);
        for (const link of page.internalLinks) if (queue.length < 400) queue.push(link);
      } catch (e) {
        statuses.set(k, (e as Error).message === "timeout" ? "timeout" : (e as { code?: string }).code === "ENOTFOUND" ? "dns" : "error");
      }
      await progress("crawl", { pages: pages.length, limit: opts.limit });
    }
    if (pages.length >= opts.limit && queue.some((u) => !seen.has(keyOf(u)))) site.crawl.stopped = "limit";

    // 6. Links: every internal and (a sample of) external link found.
    await progress("links", { pages: pages.length, limit: opts.limit });
    const foundOn = new Map<string, { url: string; internal: boolean; on: Set<string> }>();
    for (const p of pages)
      for (const [list, internal] of [[p.internalLinks, true], [p.externalLinks, false]] as const)
        for (const l of list) {
          let k: string;
          try {
            k = keyOf(l);
          } catch {
            continue;
          }
          const e = foundOn.get(k) || { url: l, internal, on: new Set<string>() };
          e.on.add(p.url);
          foundOn.set(k, e);
        }
    const toCheck = [...foundOn.entries()].filter(([k]) => !statuses.has(k));
    let internalChecks = 0;
    let externalChecks = 0;
    for (const [k, e] of toCheck) {
      if (now() - started > TOTAL_BUDGET_MS - 20_000) break;
      if (e.internal ? internalChecks >= INTERNAL_LINK_CHECKS : externalChecks >= EXTERNAL_LINK_CHECKS) continue;
      if (e.internal && (!allowed(e.url) || SKIP_EXT.test(new URL(e.url).pathname))) continue;
      if (e.internal) internalChecks++;
      else externalChecks++;
      await wait(e.internal ? delay : 200);
      try {
        const r = await safeFetch(e.url, { timeoutMs: 5000, maxBytes: 16_000, maxRedirects: 4 });
        statuses.set(k, r.status);
      } catch (err) {
        const m = (err as Error).message;
        const code = (err as { code?: string }).code;
        statuses.set(k, code === "ENOTFOUND" ? "dns" : m.startsWith("blocked") ? "blocked" : "error");
      }
      await progress("links", { pages: pages.length, limit: opts.limit, links: internalChecks + externalChecks });
    }
    for (const [k, e] of foundOn) {
      const s = statuses.get(k);
      if (s === undefined || s === "blocked") continue;
      if (UNCERTAIN(s)) {
        site.links.unverified++;
        continue;
      }
      site.links.checked++;
      if (BROKEN(s)) site.links.broken.push({ url: e.url, status: s, foundOn: [...e.on].slice(0, 5), internal: e.internal });
    }
    site.links.broken = site.links.broken.slice(0, 100);
  }
  site.crawl.crawled = pages.length;
  return { site, pages };
}

/** Run a queued scan to completion. Never throws (errors end up on the row). */
export async function runScan(scanId: string) {
  const started = Date.now();
  const { data: scan } = await db().from("seo_scans").select("id,workspace_id,site_id,status").eq("id", scanId).maybeSingle();
  if (!scan || scan.status !== "queued") return;
  const { data: claimed } = await db()
    .from("seo_scans")
    .update({ status: "running", stage: "start", started_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() })
    .eq("id", scanId)
    .eq("status", "queued")
    .select("id");
  if (!claimed?.length) return;
  try {
    const { data: site } = await db().from("seo_sites").select(SITE_COLUMNS).eq("id", scan.site_id).maybeSingle();
    if (!site) throw new Error("site_missing");
    const s = site as SiteRow;
    const limit = s.verified_at ? PAGE_LIMIT.verified : PAGE_LIMIT.unverified;
    const progress: Progress = async (stage, p) => {
      await db().from("seo_scans").update({ stage, progress: p, heartbeat_at: new Date().toISOString() }).eq("id", scanId);
    };
    // PageSpeed Insights runs in parallel with the crawl (Google fetches the page, not Mavix).
    const psiPromise = Promise.all([fetchPsi(s.url, "mobile"), fetchPsi(s.url, "desktop")]);
    const { site: facts, pages } = await crawlSite(s.url, { limit, keyword: s.focus_keyword, progress });
    await progress("pagespeed", { pages: pages.length, limit });
    const [mobile, desktop] = await psiPromise;
    const psi = { mobile, desktop };
    const stored = pages.map(toStored);
    const checks = runChecks({ site: facts, pages: stored, psi });
    const scores = computeScores(checks);
    const report: ScanReport = { version: 1, site: facts, pages: stored, psi, checks, scores, recommendations: buildRecommendations(checks, psi) };
    await db()
      .from("seo_scans")
      .update({ status: "completed", stage: "done", scores, report, completed_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() })
      .eq("id", scanId);
    if (s.schedule !== "off") await db().from("seo_sites").update({ next_scan_at: nextRun(s.schedule) }).eq("id", s.id);
    log("seo_scan_completed", { pages: pages.length, ms: Date.now() - started, psi: mobile.ok ? 1 : 0 });
  } catch (e) {
    console.error(JSON.stringify({ event: "seo_scan_failed", code: (e as Error).message?.slice(0, 40) || "error" }));
    await db().from("seo_scans").update({ status: "failed", stage: "failed", error: "De analyse kon niet worden afgerond. Probeer het later opnieuw.", completed_at: new Date().toISOString() }).eq("id", scanId);
  }
}

/** Scheduled scans that are due (verified sites only). */
export async function dueSites(limit = 3) {
  const { data, error } = await db()
    .from("seo_sites")
    .select(SITE_COLUMNS)
    .neq("schedule", "off")
    .lte("next_scan_at", new Date().toISOString())
    .order("next_scan_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return ((data || []) as SiteRow[]).filter((s) => s.verified_at);
}

