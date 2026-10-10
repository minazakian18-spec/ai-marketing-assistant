import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";
import { parseRobots, robotsAllowed, crawlDelayMs } from "../src/lib/seo/robots.ts";
import { parsePage, parseSitemap, keywordRelevance, sameSite } from "../src/lib/seo/parse.ts";
import { runChecks, computeScores, CATEGORY_WEIGHT } from "../src/lib/seo/checks.ts";
import { buildRecommendations } from "../src/lib/seo/recommendations.ts";
import { parsePsi } from "../src/lib/seo/psi.ts";

const origin = "https://mavix.webbo-solutions.nl";
const nextServer = createRequire(import.meta.url)("next/server");

// ---------------------------------------------------------------- robots.txt

test("robots.txt: specific group wins, longest rule wins, Allow wins ties, wildcards and $", () => {
  const r = parseRobots(`# comment
User-agent: *
Disallow: /admin
Allow: /admin/public
Disallow: /*.pdf$
Crawl-delay: 30

User-agent: MavixBot
Disallow: /private
Sitemap: https://example.com/sitemap.xml`);
  assert.deepEqual(r.sitemaps, ["https://example.com/sitemap.xml"]);
  // MavixBot has its own group: only /private applies to us.
  assert.equal(robotsAllowed(r, "/admin"), true);
  assert.equal(robotsAllowed(r, "/private/x"), false);
  // Other crawlers use "*".
  assert.equal(robotsAllowed(r, "/admin/x", "otherbot"), false);
  assert.equal(robotsAllowed(r, "/admin/public/a", "otherbot"), true);
  assert.equal(robotsAllowed(r, "/files/menu.pdf", "otherbot"), false);
  assert.equal(robotsAllowed(r, "/files/menu.pdf?x=1", "otherbot"), true, "$ anchors the end");
  assert.equal(crawlDelayMs(r, "otherbot"), 5000, "crawl-delay is capped at 5 s");
  const tie = parseRobots("User-agent: *\nDisallow: /a\nAllow: /a");
  assert.equal(robotsAllowed(tie, "/a"), true);
  assert.equal(robotsAllowed(parseRobots("User-agent: *\nDisallow:"), "/x"), true, "empty Disallow allows all");
  assert.equal(robotsAllowed(null, "/x"), true);
});

// ---------------------------------------------------------------- page parsing

const HTML = `<!doctype html><html lang="nl"><head>
<title>Trattoria Gouda &amp; Pasta | Italiaans restaurant</title>
<meta name="description" content="Verse pasta en pizza in hartje Gouda.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="/">
<meta property="og:title" content="Trattoria">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Restaurant"},{"@type":["LocalBusiness","Organization"]}]}</script>
<script type="application/ld+json">{ broken json</script>
</head><body>
<h1>Welkom bij Trattoria</h1><h3>Overgeslagen niveau</h3><h2>Menu</h2>
<img src="/a.jpg" alt="Pasta"><img src="/b.jpg"><img src="http://cdn.example.com/c.jpg" alt="">
<a href="/menu">Menu</a><a href="https://www.example.com/contact">Contact</a><a href="https://other.com/x">Ander</a>
<a href="/insta"><svg></svg></a><a href="#top">Top</a><a href="mailto:a@b.nl">Mail</a>
<script>var hidden = "geen tekst";</script><p>Italiaanse pasta pasta pizza in Gouda.</p>
</body></html>`;

test("page parsing: metadata, headings, images, links, structured data, mixed content", () => {
  const p = parsePage({ url: "https://example.com/", status: 200, html: HTML, headers: { "x-robots-tag": "noarchive", "content-type": "text/html" } });
  assert.equal(p.title, "Trattoria Gouda & Pasta | Italiaans restaurant");
  assert.equal(p.metaDescription, "Verse pasta en pizza in hartje Gouda.");
  assert.equal(p.canonical, "https://example.com/");
  assert.equal(p.lang, "nl");
  assert.match(p.viewport, /device-width/);
  assert.deepEqual(p.h1, ["Welkom bij Trattoria"]);
  assert.deepEqual(p.headings, [1, 3, 2]);
  assert.equal(p.headingSkips, 1);
  assert.equal(p.images, 3);
  assert.equal(p.imagesMissingAlt, 1, "alt=\"\" counts as present (decorative)");
  assert.deepEqual(p.missingAltSamples, ["https://example.com/b.jpg"]);
  assert.deepEqual(p.internalLinks.sort(), ["https://example.com/insta", "https://example.com/menu", "https://www.example.com/contact"]);
  assert.deepEqual(p.externalLinks, ["https://other.com/x"]);
  assert.equal(p.emptyLinks, 1);
  assert.deepEqual(p.structuredData.sort(), ["(ongeldige JSON-LD)", "LocalBusiness", "Organization", "Restaurant"]);
  assert.equal(p.mixedContent, 1);
  assert.equal(p.noindex, false);
  assert.ok(!p.textSample.includes("geen tekst"), "script content is not visible text");
  assert.ok(sameSite("https://www.example.com/a", "https://example.com/"));
});

test("noindex via meta robots or X-Robots-Tag; none = noindex+nofollow", () => {
  assert.equal(parsePage({ url: "https://e.nl/", status: 200, html: '<meta name="robots" content="noindex, follow">' }).noindex, true);
  assert.equal(parsePage({ url: "https://e.nl/", status: 200, html: "<p>x</p>", headers: { "x-robots-tag": "none" } }).nofollow, true);
  assert.equal(parsePage({ url: "https://e.nl/", status: 200, html: '<meta name="robots" content="index">' }).noindex, false);
});

test("sitemaps and keyword relevance", () => {
  assert.deepEqual(parseSitemap("<urlset><url><loc>https://e.nl/a</loc></url><url><loc> https://e.nl/b?x=1&amp;y=2 </loc></url></urlset>").urls, ["https://e.nl/a", "https://e.nl/b?x=1&y=2"]);
  assert.deepEqual(parseSitemap("<sitemapindex><sitemap><loc>https://e.nl/s1.xml</loc></sitemap></sitemapindex>"), { urls: [], sitemaps: ["https://e.nl/s1.xml"] });
  const p = parsePage({ url: "https://example.com/italiaans-restaurant", status: 200, html: HTML });
  const k = keywordRelevance(p, "Italiaans Restaurant");
  assert.deepEqual([k.inTitle, k.inH1, k.inDescription, k.inUrl], [true, false, false, true]);
  const auto = keywordRelevance(p, "");
  assert.ok(auto.topTerms.includes("pasta") && auto.topTerms.includes("menu"), "most frequent terms (stop words excluded)");
  assert.ok(!auto.topTerms.includes("bij"));
});

// ---------------------------------------------------------------- checks, scores, recommendations

const stored = (url, over = {}) => ({
  ...parsePage({ url, status: 200, html: HTML, headers: { "content-type": "text/html" } }),
  internalLinkCount: 3,
  externalLinkCount: 1,
  ...over,
});
const siteFacts = (over = {}) => ({
  startUrl: "https://example.com/",
  finalUrl: "https://example.com/",
  reachable: true,
  startStatus: 200,
  https: true,
  httpRedirectsToHttps: true,
  hsts: false,
  nosniff: true,
  robots: { found: true, status: 200, blocksStart: false, sitemaps: [], crawlDelayMs: 0 },
  sitemap: { found: false, url: null, urls: 0 },
  crawl: { limit: 10, crawled: 2, skippedByRobots: 0, stopped: "done" },
  links: { checked: 10, broken: [{ url: "https://example.com/oud", status: 404, foundOn: ["https://example.com/"], internal: true }], unverified: 0 },
  keyword: "",
  ...over,
});

test("checks measure shares; unmeasurable checks and categories are excluded from scores", () => {
  const pages = [stored("https://example.com/"), stored("https://example.com/menu", { title: "", metaDescription: "" })];
  const checks = runChecks({ site: siteFacts(), pages, psi: null });
  const c = Object.fromEntries(checks.map((x) => [x.id, x]));
  assert.equal(c.title.ratio, 0.5);
  assert.deepEqual(c.title.failing, ["https://example.com/menu"]);
  assert.equal(c["broken-links"].ratio, 0.9);
  assert.equal(c.sitemap.ratio, 0);
  assert.equal(c.keyword.ratio, null, "no keyword set");
  assert.equal(c["lh-performance-mobile"].ratio, null, "no PageSpeed result: not measured");
  const scores = computeScores(checks);
  assert.equal(scores.categories.performance, null);
  // Overall = weighted average of the measured categories only.
  const measured = Object.entries(scores.categories).filter(([, v]) => v !== null);
  const w = measured.reduce((s, [k]) => s + CATEGORY_WEIGHT[k], 0);
  const expected = Math.round(measured.reduce((s, [k, v]) => s + CATEGORY_WEIGHT[k] * v, 0) / w);
  assert.equal(scores.overall, expected);
  assert.ok(scores.overall > 0 && scores.overall < 100);
});

test("an unreachable site scores 0 on reachability and gets a critical recommendation first", () => {
  const checks = runChecks({ site: siteFacts({ reachable: false, startStatus: null, links: { checked: 0, broken: [], unverified: 0 }, robots: { found: false, status: null, blocksStart: false, sitemaps: [], crawlDelayMs: 0 } }), pages: [], psi: null });
  const recs = buildRecommendations(checks, null);
  const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
  for (const id of ["https", "hsts", "nosniff", "sitemap", "robots", "robots-blocks"]) assert.equal(byId[id].ratio, null, id + " is not measured when the site does not answer");
  assert.equal(computeScores(checks).overall, 0);
  assert.equal(recs[0].id, "reachable");
  assert.equal(recs[0].severity, "critical");
  assert.ok(recs.every((r, i) => i === 0 || ["critical", "high", "medium", "low"].indexOf(recs[i - 1].severity) <= ["critical", "high", "medium", "low"].indexOf(r.severity)), "ordered by severity");
});

test("recommendations: problem, why, action, guidance, affected URLs and AI suggestion kinds", () => {
  const pages = [stored("https://example.com/"), stored("https://example.com/menu", { title: "", metaDescription: "" })];
  const recs = buildRecommendations(runChecks({ site: siteFacts(), pages, psi: null }), null);
  const title = recs.find((r) => r.id === "title");
  assert.ok(title.problem && title.why && title.action && title.guidance.length);
  assert.deepEqual(title.urls, ["https://example.com/menu"]);
  assert.equal(title.suggest, "title");
  assert.equal(recs.find((r) => r.id === "description").suggest, "description");
  assert.equal(recs.find((r) => r.id === "broken-links").urls[0], "https://example.com/oud");
  assert.ok(!recs.some((r) => r.id === "https"), "passed checks give no recommendation");
  assert.ok(!recs.some((r) => r.id === "lh-performance-mobile"), "unmeasured checks give no recommendation");
});

// ---------------------------------------------------------------- PageSpeed Insights

const PSI = {
  lighthouseResult: {
    lighthouseVersion: "12.6.0",
    finalDisplayedUrl: "https://example.com/",
    categories: { performance: { score: 0.43 }, accessibility: { score: 0.91 }, "best-practices": { score: 1 }, seo: { score: 0.82 } },
    audits: {
      "largest-contentful-paint": { numericValue: 5234.5, displayValue: "5,2 s", score: 0.2 },
      "cumulative-layout-shift": { numericValue: 0.02, displayValue: "0,02", score: 1 },
      "render-blocking-resources": { title: "Verwijder bronnen die weergave blokkeren", displayValue: "Mogelijke besparing van 1,2 s", score: 0.3, details: { type: "opportunity", overallSavingsMs: 1200 } },
      "unused-css": { title: "Ongebruikte CSS", score: 0.95, details: { type: "opportunity", overallSavingsMs: 50 } },
      "font-size": { score: 1 },
      viewport: { score: 1 },
    },
  },
  loadingExperience: { origin_fallback: true, metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 9999, category: "SLOW" } } },
  originLoadingExperience: {
    overall_category: "AVERAGE",
    metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2900, category: "AVERAGE" }, CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 3, category: "FAST" }, INTERACTION_TO_NEXT_PAINT: { percentile: 180, category: "FAST" } },
  },
};

test("PageSpeed: real Lighthouse scores, lab vs field data, origin fallback, opportunities", () => {
  const r = parsePsi(PSI, "mobile");
  assert.equal(r.ok, true);
  assert.deepEqual(r.categories, { performance: 43, accessibility: 91, bestPractices: 100, seo: 82 });
  assert.equal(r.lab.lcp.value, 5234.5);
  assert.equal(r.lab.fcp, undefined, "missing audits stay missing");
  assert.equal(r.field.scope, "origin", "page data with origin_fallback is not used as page data");
  assert.equal(r.field.metrics.lcp.percentile, 2900);
  assert.equal(r.field.overall, "AVERAGE");
  assert.deepEqual(r.opportunities.map((o) => o.id), ["render-blocking-resources"]);
  assert.equal(parsePsi({ lighthouseResult: {} }, "desktop").ok, false, "no categories: no invented scores");
  const checks = runChecks({ site: siteFacts(), pages: [stored("https://example.com/")], psi: { mobile: r, desktop: parsePsi({}, "desktop") } });
  const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
  assert.equal(byId["lh-performance-mobile"].ratio, 0.43);
  assert.equal(byId["lh-performance-desktop"].ratio, null);
  assert.equal(Math.round(byId["core-web-vitals"].ratio * 100), 67);
});

// ---------------------------------------------------------------- crawler

function fakeWeb(site) {
  const calls = [];
  const safeFetch = async (input, opts = {}) => {
    calls.push(input);
    let url = input;
    const chain = [];
    for (let i = 0; i < 5; i++) {
      const page = site[url];
      if (!page) return { url, status: 404, body: "<h1>Niet gevonden</h1>", type: "text/html", headers: {}, chain, truncated: false, ms: 5 };
      if (page.error) throw Object.assign(new Error(page.error), { code: page.code });
      if (page.redirect) {
        chain.push({ url, status: 301 });
        url = page.redirect;
        continue;
      }
      return { url, status: page.status || 200, body: page.body || "", type: page.type || "text/html", headers: page.headers || {}, chain, truncated: false, ms: 12, opts };
    }
    throw new Error("too_many_redirects");
  };
  return { calls, safeFetch, assertPublicUrl: async (u) => new URL(u) };
}
const page = (title, links = [], extra = "") =>
  `<html lang="nl"><head><title>${title}</title><meta name="viewport" content="width=device-width"></head><body><h1>${title}</h1>${links.map((l) => `<a href="${l}">${l}</a>`).join("")}${extra}</body></html>`;

function crawler(web) {
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => memoryDb({}), appUrl: () => origin },
    [path.resolve("src/lib/server/safe-fetch.ts")]: web,
  });
  return load("src/lib/server/seo.ts");
}

test("crawler: respects robots.txt, stays on the site, follows the page limit and finds broken links", async () => {
  const web = fakeWeb({
    "https://example.com/robots.txt": { type: "text/plain", body: "User-agent: *\nDisallow: /geheim\nSitemap: https://example.com/sitemap.xml" },
    "https://example.com/": { body: page("Home", ["/menu", "/geheim", "/kapot", "https://andere-site.nl/", "/menu.pdf", "/a", "/b"]), headers: { "strict-transport-security": "max-age=1", "x-content-type-options": "nosniff" } },
    "http://example.com/": { redirect: "https://example.com/" },
    "https://example.com/sitemap.xml": { type: "application/xml", body: "<urlset><url><loc>https://example.com/uit-sitemap</loc></url><url><loc>https://elders.nl/x</loc></url></urlset>" },
    "https://example.com/menu": { body: page("Menu", ["/", "/oude-link"]) },
    "https://example.com/a": { body: page("A") },
    "https://example.com/b": { body: page("B") },
    "https://example.com/uit-sitemap": { body: page("Sitemap") },
    "https://andere-site.nl/": { body: page("Extern") },
  });
  const seo = crawler(web);
  const stages = [];
  const { site, pages } = await seo.crawlSite("https://example.com/", { limit: 4, keyword: "", delay: async () => {}, progress: async (s) => stages.push(s) });
  assert.equal(web.calls[0], "https://example.com/robots.txt", "robots.txt is read first");
  assert.ok(!web.calls.includes("https://example.com/geheim"), "disallowed URL never fetched");
  assert.ok(!web.calls.includes("https://example.com/menu.pdf"), "files are not crawled");
  assert.ok(!web.calls.includes("https://elders.nl/x"), "sitemap URLs of other sites are ignored");
  assert.equal(pages.length, 4, "page limit");
  assert.ok(pages.every((p) => sameSite(p.url, "https://example.com/")));
  assert.equal(site.crawl.stopped, "limit");
  assert.equal(site.crawl.skippedByRobots, 1);
  assert.deepEqual([site.reachable, site.https, site.hsts, site.nosniff, site.httpRedirectsToHttps], [true, true, true, true, true]);
  assert.deepEqual([site.robots.found, site.sitemap.found, site.sitemap.urls], [true, true, 2]);
  assert.ok(site.links.broken.some((b) => b.url === "https://example.com/kapot" && b.status === 404 && b.internal));
  assert.ok(stages.includes("robots") && stages.includes("crawl") && stages.includes("links"));
});

test("crawler: robots.txt that blocks the start page means no pages are fetched", async () => {
  const web = fakeWeb({ "https://example.com/robots.txt": { type: "text/plain", body: "User-agent: *\nDisallow: /" }, "https://example.com/": { body: page("Home") } });
  const { site, pages } = await crawler(web).crawlSite("https://example.com/", { limit: 10, keyword: "", delay: async () => {} });
  assert.deepEqual(web.calls, ["https://example.com/robots.txt"]);
  assert.equal(pages.length, 0);
  assert.equal(site.robots.blocksStart, true);
  assert.equal(site.crawl.stopped, "robots");
});

test("crawler: an unreachable website ends cleanly as unreachable", async () => {
  const web = fakeWeb({ "https://example.com/robots.txt": { error: "timeout" }, "https://example.com/": { error: "getaddrinfo", code: "ENOTFOUND" } });
  const { site, pages } = await crawler(web).crawlSite("https://example.com/", { limit: 10, keyword: "", delay: async () => {} });
  assert.equal(site.reachable, false);
  assert.equal(site.crawl.stopped, "unreachable");
  assert.equal(pages.length, 0);
});

// ---------------------------------------------------------------- API, limits and isolation

function api(t, { verified = false } = {}) {
  const tables = {
    workspace_members: [
      { user_id: "u1", workspace_id: "w1", role: "OWNER" },
      { user_id: "u2", workspace_id: "w2", role: "OWNER" },
      { user_id: "u3", workspace_id: "w1", role: "MEMBER" },
    ],
    workspaces: [{ id: "w1", deleted_at: null }, { id: "w2", deleted_at: null }],
    seo_sites: [
      { id: "11111111-1111-4111-8111-111111111111", workspace_id: "w1", url: "https://example.com/", host: "example.com", focus_keyword: "", verification_token: "tok123", verified_at: verified ? "2026-10-01T00:00:00Z" : null, verification_method: null, schedule: "off", next_scan_at: null, gsc_property: null, created_at: "2026-10-01T00:00:00Z" },
    ],
    seo_scans: [],
    integration_connections: [],
    oauth_states: [],
    audit_logs: [],
  };
  const db = memoryDb(tables);
  const state = { user: { id: "u1" } };
  db.auth = { getUser: async () => ({ data: { user: state.user }, error: null }) };
  const queued = [];
  const web = fakeWeb({ "https://example.com/": { body: '<head><meta name="mavix-site-verification" content="tok123"></head>' }, "https://evil.example/": { body: "x" } });
  t.mock.method(console, "info", () => {});
  t.mock.method(console, "warn", () => {});
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    [path.resolve("src/lib/server/safe-fetch.ts")]: web,
    "next/headers": { cookies: async () => ({ get: () => undefined, set() {}, delete() {} }) },
    "next/server": { ...nextServer, NextResponse: nextServer.NextResponse, after: (fn) => queued.push(fn) },
  });
  const siteId = tables.seo_sites[0].id;
  const call = (file, method, { body, params = {}, headers = {}, user = "u1", query = "" } = {}) => {
    state.user = { id: user };
    const route = load("src/app/api/seo/" + file);
    return route[method](
      new Request(origin + "/api/seo" + query, { method, headers: { origin, "Content-Type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),
      { params: Promise.resolve(params) },
    );
  };
  return { tables, call, queued, siteId };
}

test("starting a scan: answered at once, crawl queued after the response; daily limit enforced", async (t) => {
  const f = api(t);
  const res = await f.call("sites/[id]/scans/route.ts", "POST", { params: { id: f.siteId } });
  assert.equal(res.status, 202);
  assert.equal(f.queued.length, 1, "the crawl runs in after(), not in the request");
  assert.equal(f.tables.seo_scans[0].status, "queued");
  assert.equal(f.tables.seo_scans[0].workspace_id, "w1");
  // (memoryDb sets no created_at default, so the first scan does not count here.)
  for (let i = 0; i < 10; i++) f.tables.seo_scans.push({ id: "x" + i, workspace_id: "w1", site_id: "other", status: "completed", created_at: new Date().toISOString() });
  const limited = await f.call("sites/[id]/scans/route.ts", "POST", { params: { id: f.siteId } });
  assert.equal(limited.status, 429);
  assert.match((await limited.json()).error, /maximum van 10 analyses per dag/);
});

test("isolation: another workspace cannot read, scan or change this website", async (t) => {
  const f = api(t);
  f.tables.seo_scans.push({ id: "22222222-2222-4222-8222-222222222222", workspace_id: "w1", site_id: f.siteId, status: "completed", stage: "done", progress: {}, trigger: "manual", scores: { overall: 70 }, report: { pages: [] }, created_at: new Date().toISOString() });
  assert.equal((await f.call("scans/[id]/route.ts", "GET", { params: { id: "22222222-2222-4222-8222-222222222222" }, user: "u2" })).status, 404);
  assert.equal((await f.call("sites/[id]/scans/route.ts", "POST", { params: { id: f.siteId }, user: "u2" })).status, 404);
  assert.equal((await f.call("sites/[id]/route.ts", "PATCH", { params: { id: f.siteId }, user: "u2", body: { focusKeyword: "x" } })).status, 404);
  const list = await (await f.call("sites/route.ts", "GET", { user: "u2" })).json();
  assert.equal(list.sites.length, 0);
  assert.equal((await f.call("scans/[id]/route.ts", "GET", { params: { id: "22222222-2222-4222-8222-222222222222" } })).status, 200);
});

test("websites: members cannot add; schedules need verification; verification checks the meta tag", async (t) => {
  const f = api(t);
  assert.equal((await f.call("sites/route.ts", "POST", { user: "u3", body: { url: "andere.nl" } })).status, 403);
  const sched = await f.call("sites/[id]/route.ts", "PATCH", { params: { id: f.siteId }, body: { schedule: "weekly" } });
  assert.equal(sched.status, 409);
  const v = await f.call("sites/[id]/verify/route.ts", "POST", { params: { id: f.siteId } });
  assert.equal(v.status, 200);
  assert.equal((await v.json()).site.verified, true);
  assert.equal(f.tables.seo_sites[0].verification_method, "meta");
  const ok = await f.call("sites/[id]/route.ts", "PATCH", { params: { id: f.siteId }, body: { schedule: "weekly" } });
  assert.equal(ok.status, 200);
  assert.ok(f.tables.seo_sites[0].next_scan_at > new Date().toISOString());
});

test("cron endpoint requires the secret", async (t) => {
  const f = api(t, { verified: true });
  process.env.CRON_SECRET = "cron-secret-fixture";
  assert.equal((await f.call("cron/route.ts", "POST", { headers: { authorization: "Bearer wrong" } })).status, 401);
  delete process.env.CRON_SECRET;
  assert.equal((await f.call("cron/route.ts", "POST", { headers: { authorization: "Bearer " } })).status, 401, "no secret configured: always refused");
});

// ---------------------------------------------------------------- Search Console

test("Search Console: property matching and OAuth with read-only scope, PKCE and encrypted tokens", async (t) => {
  process.env.GOOGLE_CLIENT_ID = "client-fixture";
  process.env.GOOGLE_CLIENT_SECRET = "secret-fixture";
  process.env.OAUTH_ENCRYPTION_KEY = Buffer.alloc(32, 6).toString("base64");
  const tables = { workspace_members: [{ user_id: "u1", workspace_id: "w1", role: "OWNER" }], workspaces: [{ id: "w1", deleted_at: null }], integration_connections: [], oauth_states: [], audit_logs: [], seo_sites: [] };
  const db = memoryDb(tables);
  db.auth = { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) };
  const jar = new Map();
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: (n) => jar.get(n), set: (n, value) => jar.set(n, { value }), delete: (n) => jar.delete(n) }) },
  });
  const gsc = load("src/lib/server/search-console.ts");
  const props = [{ siteUrl: "https://www.example.com/" }, { siteUrl: "sc-domain:example.com" }, { siteUrl: "https://other.nl/" }];
  assert.equal(gsc.matchProperty("www.example.com", props), "sc-domain:example.com", "domain property preferred");
  assert.equal(gsc.matchProperty("example.com", props.slice(0, 1)), "https://www.example.com/");
  assert.equal(gsc.matchProperty("nope.nl", props), null);

  const route = load("src/app/api/integrations/[provider]/[action]/route.ts");
  const req = (action, method, query = "") =>
    route[method](new Request(origin + "/api/integrations/google_search_console/" + action + query, { method, headers: { origin, "Content-Type": "application/json" } }), { params: Promise.resolve({ provider: "google_search_console", action }) });
  const connect = await req("connect", "POST");
  const url = new URL((await connect.json()).url);
  assert.deepEqual(url.searchParams.get("scope").split(" "), ["openid", "email", "https://www.googleapis.com/auth/webmasters.readonly"]);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("redirect_uri"), origin + "/api/integrations/google_search_console/callback");
  t.mock.method(globalThis, "fetch", async (u) => {
    if (String(u).includes("/token")) return new Response(JSON.stringify({ access_token: "gsc-access", refresh_token: "gsc-refresh", expires_in: 3600, scope: "openid email https://www.googleapis.com/auth/webmasters.readonly" }));
    return new Response(JSON.stringify({ sub: "g-1", email: "eigenaar@example.com", email_verified: true }));
  });
  const cb = await req("callback", "GET", "?code=abc&state=" + url.searchParams.get("state"));
  assert.equal(cb.status, 303);
  assert.equal(cb.headers.get("location"), origin + "/seo?gsc=connected");
  const c = tables.integration_connections[0];
  assert.equal(c.status, "connected");
  assert.ok(!c.encrypted_credentials.includes("gsc-access") && !c.encrypted_credentials.includes("gsc-refresh"));
  assert.equal(gsc.gscStatus(c), "connected");
  assert.match((await req("callback", "GET", "?code=abc&state=" + url.searchParams.get("state"))).headers.get("location"), /gsc=expired/, "state is single use");
});
