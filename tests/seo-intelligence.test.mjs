import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import * as nextServer from "next/server.js";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";
import { parsePage } from "../src/lib/seo/parse.ts";
import { runChecks, computeScores } from "../src/lib/seo/checks.ts";
import { buildRecommendations } from "../src/lib/seo/recommendations.ts";
import { psiFailure } from "../src/lib/seo/psi.ts";
import { classifyPage, intentionalNoindex, isPrimary } from "../src/lib/seo/classify.ts";
import { analysisCompleteness } from "../src/lib/seo/completeness.ts";
import { compareChecks, scoreDelta } from "../src/lib/seo/compare.ts";

const origin = "https://mavix.webbo-solutions.nl";
const HTML = `<!doctype html><html lang="nl"><head><title>Italiaans restaurant in Gouda | Trattoria Test</title>
<meta name="description" content="Verse pasta en pizza uit de houtoven in het centrum van Gouda. Reserveer online of bestel om af te halen.">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="canonical" href="/"></head>
<body><h1>Trattoria Test</h1><h2>Menu</h2><p>${"Huisgemaakte pasta ".repeat(140)}</p></body></html>`;

const page = (url, over = {}) => ({
  ...parsePage({ url, status: 200, html: HTML, headers: { "content-type": "text/html" } }),
  internalLinkCount: 3,
  externalLinkCount: 1,
  ...over,
});
const site = (over = {}) => ({
  startUrl: "https://example.com/",
  finalUrl: "https://example.com/",
  reachable: true,
  startStatus: 200,
  https: true,
  httpRedirectsToHttps: true,
  hsts: true,
  nosniff: true,
  robots: { found: true, status: 200, blocksStart: false, sitemaps: [], crawlDelayMs: 0 },
  sitemap: { found: true, url: "https://example.com/sitemap.xml", urls: 5 },
  crawl: { limit: 10, crawled: 3, skippedByRobots: 0, stopped: "done" },
  links: { checked: 5, broken: [], unverified: 0 },
  keyword: "",
  ...over,
});
const okPsi = (strategy) => ({ ok: true, strategy, finalUrl: "https://example.com/", lighthouseVersion: "12", categories: { performance: 80, accessibility: 95, bestPractices: 100, seo: 100 }, lab: {}, field: null, opportunities: [], audits: { viewport: 1, fontSize: 1 } });
const failPsi = (strategy, error = "De gedeelde limiet is op.") => ({ ok: false, strategy, error, code: "quota" });
const report = (pages, psi, siteOver) => {
  const s = site(siteOver);
  const checks = runChecks({ site: s, pages, psi });
  return { version: 1, site: s, pages, psi, checks, scores: computeScores(checks), recommendations: buildRecommendations(checks, psi) };
};

// ---------------------------------------------------------------- completeness

test("completeness: without PageSpeed the score is partial, with honest reasons; with it the analysis is complete", () => {
  const pages = [page("https://example.com/")];
  const none = analysisCompleteness(report(pages, null));
  assert.equal(none.complete, false);
  assert.equal(none.categories.performance, "missing");
  // Performance (20) missing; mobile font size (half of 10) and the Lighthouse
  // accessibility score (half of 5) also come from PageSpeed: 100 - 20 - 5 - 2.5.
  assert.equal(none.coverage, 73);
  assert.match(none.reasons[0], /niet gemeten/);

  const failed = analysisCompleteness(report(pages, { mobile: failPsi("mobile", "Google gaf geen meting (mobiel)."), desktop: failPsi("desktop") }));
  assert.equal(failed.complete, false);
  assert.ok(failed.reasons.some((r) => r.includes("Google gaf geen meting (mobiel).")), "the real PageSpeed error is shown");
  assert.equal(failed.categories.mobile, "partial", "font size comes from PageSpeed too");

  const partial = analysisCompleteness(report(pages, { mobile: okPsi("mobile"), desktop: failPsi("desktop") }));
  assert.equal(partial.categories.performance, "partial");
  assert.ok(partial.coverage > 80 && partial.coverage < 100);

  const full = analysisCompleteness(report(pages, { mobile: okPsi("mobile"), desktop: okPsi("desktop") }));
  assert.deepEqual([full.complete, full.coverage, full.reasons.length], [true, 100, 0]);
});

test("completeness: an unreachable site is never complete and says so first", () => {
  const r = report([], null, { reachable: false, startStatus: null, links: { checked: 0, broken: [], unverified: 0 } });
  const c = analysisCompleteness(r);
  assert.equal(c.complete, false);
  assert.match(c.reasons[0], /geen geldig antwoord/);
});

test("scores: missing categories are excluded, not counted as 0 or 100", () => {
  const pages = [page("https://example.com/")];
  const without = report(pages, null);
  const withPsi = report(pages, { mobile: { ...okPsi("mobile"), categories: { performance: 20, accessibility: 95, bestPractices: 100, seo: 100 } }, desktop: okPsi("desktop") });
  assert.equal(without.scores.categories.performance, null);
  assert.ok(withPsi.scores.overall < without.scores.overall, "a measured slow site scores lower than an unmeasured one: so the unmeasured one must be labelled partial");
});

// ---------------------------------------------------------------- classification

test("page classification: home, ordinary, archives, sample content, legal and account pages", () => {
  const home = "https://example.com/";
  const k = (url, over) => classifyPage(page(url, over), home);
  assert.equal(k("https://example.com/"), "home");
  assert.equal(k("https://example.com/menu/"), "page");
  assert.equal(k("https://example.com/hello-world/"), "sample");
  assert.equal(k("https://example.com/nieuws-item/", { title: "Hello world! | Test" }), "sample");
  assert.equal(k("https://example.com/author/admin/"), "archive");
  assert.equal(k("https://example.com/category/uncategorized/"), "archive");
  assert.equal(k("https://example.com/2026/10/"), "archive");
  assert.equal(k("https://example.com/privacy/"), "legal");
  assert.equal(k("https://example.com/mijn-account/"), "utility");
  assert.equal(k("https://example.com/kapot/", { status: 404 }), "error");
  assert.equal(isPrimary(page("https://example.com/menu/", { noindex: true }), home), false);
  assert.equal(intentionalNoindex(page("https://example.com/author/admin/", { noindex: true }), home), true);
  assert.equal(intentionalNoindex(page("https://example.com/menu/", { noindex: true }), home), false);
});

test("intentional noindex on archives is not a problem; noindex on an important page is", () => {
  const archiveOnly = report([page("https://example.com/"), page("https://example.com/author/admin/", { noindex: true }), page("https://example.com/category/uncategorized/", { noindex: true })], null);
  const idx = archiveOnly.checks.find((c) => c.id === "indexable");
  assert.equal(idx.ratio, 1);
  assert.match(idx.detail, /tellen niet mee/);
  assert.ok(!archiveOnly.recommendations.some((r) => r.id === "indexable"), "no advice to remove a deliberate noindex");

  const important = report([page("https://example.com/"), page("https://example.com/menu/", { noindex: true })], null);
  const rec = important.recommendations.find((r) => r.id === "indexable");
  assert.deepEqual(rec.urls, ["https://example.com/menu/"]);
  assert.match(rec.guidance.join(" "), /bewust niet in Google/);
});

test("content checks focus on important pages; archives and sample pages are reported, not mixed in", () => {
  const r = report(
    [
      page("https://example.com/"),
      page("https://example.com/category/uncategorized/", { title: "", metaDescription: "", h1: [], wordCount: 10 }),
      page("https://example.com/hello-world/", { title: "Hello world!", wordCount: 30 }),
    ],
    null,
  );
  const by = Object.fromEntries(r.checks.map((c) => [c.id, c]));
  assert.equal(by.title.ratio, 1, "the empty archive title does not count against the site");
  assert.equal(by["word-count"].ratio, 1);
  assert.equal(by["sample-content"].ratio, 0);
  assert.deepEqual(by["sample-content"].failing, ["https://example.com/hello-world/"]);
  const sample = r.recommendations.find((x) => x.id === "sample-content");
  assert.equal(sample.severity, "low");
  assert.match(sample.guidance.join(" "), /Twijfel/);
  // A sample page that is already noindex is fine.
  const hidden = report([page("https://example.com/"), page("https://example.com/hello-world/", { noindex: true })], null);
  assert.equal(hidden.checks.find((c) => c.id === "sample-content").ratio, 1);
});

test("headings: several H1s are allowed; a missing H1 is a finding", () => {
  const r = report([page("https://example.com/", { h1: ["A", "B"] }), page("https://example.com/over/", { h1: [] })], null);
  const h1 = r.checks.find((c) => c.id === "h1");
  assert.equal(h1.ratio, 0.5);
  assert.deepEqual(h1.failing, ["https://example.com/over/"]);
  assert.match(r.recommendations.find((x) => x.id === "h1").why, /Meerdere H1's zijn voor Google geen probleem/);
});

test("recommendations stay ordered by severity, critical first", () => {
  const r = report([page("https://example.com/", { noindex: true }), page("https://example.com/hello-world/")], null, { https: false, httpRedirectsToHttps: false });
  const order = ["critical", "high", "medium", "low"];
  assert.equal(r.recommendations[0].severity, "critical");
  assert.ok(r.recommendations.every((x, i) => i === 0 || order.indexOf(r.recommendations[i - 1].severity) <= order.indexOf(x.severity)));
});

// ---------------------------------------------------------------- PageSpeed errors

test("PageSpeed failures are explained specifically and never turned into a score", () => {
  const daily = { error: { code: 429, message: "Quota exceeded for quota metric 'Queries' and limit 'Queries per day'", errors: [{ reason: "rateLimitExceeded" }] } };
  const noKey = psiFailure(429, daily, "mobile", false);
  assert.deepEqual([noKey.ok, noKey.code], [false, "quota"]);
  assert.match(noKey.error, /PAGESPEED_API_KEY/);
  assert.match(psiFailure(429, daily, "mobile", true).error, /dagelijkse limiet/);
  assert.equal(psiFailure(403, { error: { message: "PageSpeed Insights API has not been used in project 1" } }, "desktop", true).code, "config");
  assert.equal(psiFailure(400, { error: { message: "Lighthouse returned error: FAILED_DOCUMENT_REQUEST" } }, "mobile", true).code, "page");
  assert.equal(psiFailure(503, {}, "mobile", true).code, "unavailable");
  const checks = runChecks({ site: site(), pages: [page("https://example.com/")], psi: { mobile: noKey, desktop: noKey } });
  assert.equal(checks.find((c) => c.id === "lh-performance-mobile").ratio, null);
});

function seoServer(t, { tables: extra = {}, fetchImpl, missingTables = [] } = {}) {
  const tables = {
    workspace_members: [
      { user_id: "u1", workspace_id: "w1", role: "OWNER" },
      { user_id: "u3", workspace_id: "w1", role: "MEMBER" },
      { user_id: "u2", workspace_id: "w2", role: "OWNER" },
    ],
    workspaces: [{ id: "w1", deleted_at: null }, { id: "w2", deleted_at: null }],
    seo_sites: [{ id: "11111111-1111-4111-8111-111111111111", workspace_id: "w1", url: "https://example.com/", host: "example.com", focus_keyword: "", verification_token: "tok", verified_at: null, verification_method: null, schedule: "off", next_scan_at: null, gsc_property: null, created_at: "2026-10-01T00:00:00Z" }],
    seo_scans: [],
    seo_task_states: [],
    ...extra,
  };
  const db = memoryDb(tables);
  // A table that does not exist yet answers like PostgREST: error 42P01.
  const missing = () => {
    const q = new Proxy(function () {}, { get: (_t, k) => (k === "then" ? (resolve) => resolve({ data: null, error: { code: "42P01" } }) : () => q) });
    return q;
  };
  const from = db.from;
  db.from = (name) => (missingTables.includes(name) ? missing() : from(name));
  const state = { user: { id: "u1" } };
  db.auth = { getUser: async () => ({ data: { user: state.user }, error: null }) };
  t.mock.method(console, "info", () => {});
  t.mock.method(console, "error", () => {});
  if (fetchImpl) t.mock.method(globalThis, "fetch", fetchImpl);
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined, set() {}, delete() {} }) },
    "next/server": { ...nextServer, NextResponse: nextServer.NextResponse, after: () => {} },
  });
  const siteId = tables.seo_sites[0].id;
  const call = (file, method, { body, params = {}, user = "u1" } = {}) => {
    state.user = { id: user };
    return load("src/app/api/seo/" + file)[method](
      new Request(origin + "/api/seo", { method, headers: { origin, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),
      { params: Promise.resolve(params) },
    );
  };
  return { tables, call, siteId, load };
}

test("PageSpeed: one retry for temporary errors only; quota errors are not retried", async (t) => {
  let calls = 0;
  const env = seoServer(t, {
    fetchImpl: async () => {
      calls++;
      return calls === 1 ? new Response("{}", { status: 503 }) : new Response(JSON.stringify({ lighthouseResult: { categories: { performance: { score: 0.7 } }, audits: {} } }), { status: 200 });
    },
  });
  const { fetchPsi } = env.load("src/lib/server/seo.ts");
  const t0 = Date.now();
  const ok = await fetchPsi("https://example.com/", "mobile");
  assert.equal(ok.ok, true);
  assert.equal(calls, 2);
  assert.ok(Date.now() - t0 >= 2900, "waits before the retry");

  calls = 0;
  t.mock.restoreAll();
  const env2 = seoServer(t, { fetchImpl: async () => (calls++, new Response(JSON.stringify({ error: { code: 429, message: "Queries per day" } }), { status: 429 })) });
  const quota = await env2.load("src/lib/server/seo.ts").fetchPsi("https://example.com/", "desktop");
  assert.deepEqual([quota.ok, quota.code, calls], [false, "quota", 1]);
});

// ---------------------------------------------------------------- action plan statuses

test("action plan: members save statuses for their own website; other workspaces and unknown items are refused", async (t) => {
  const f = seoServer(t);
  const put = (body, user = "u3") => f.call("sites/[id]/tasks/route.ts", "PUT", { params: { id: f.siteId }, body, user });
  assert.equal((await put({ checkId: "title", status: "in_progress" })).status, 200, "a member may track progress");
  assert.deepEqual(
    f.tables.seo_task_states.map((r) => [r.workspace_id, r.site_id, r.check_id, r.status, r.updated_by]),
    [["w1", f.siteId, "title", "in_progress", "u3"]],
  );
  assert.equal((await put({ checkId: "title", status: "resolved" })).status, 200);
  assert.equal(f.tables.seo_task_states.length, 1, "one row per website and item");
  assert.equal((await put({ checkId: "bestaat-niet", status: "todo" })).status, 400);
  assert.equal((await put({ checkId: "title", status: "klaar" })).status, 400);
  assert.equal((await put({ checkId: "title", status: "ignored" }, "u2")).status, 404, "other workspace");
  const list = await (await f.call("sites/[id]/tasks/route.ts", "GET", { params: { id: f.siteId } })).json();
  assert.deepEqual([list.available, list.tasks.title.status], [true, "resolved"]);
  assert.equal((await f.call("sites/[id]/tasks/route.ts", "GET", { params: { id: f.siteId }, user: "u2" })).status, 404);
});

test("action plan: before the migration the list says unavailable and saving explains why", async (t) => {
  const f = seoServer(t, { missingTables: ["seo_task_states"] });
  const list = await f.call("sites/[id]/tasks/route.ts", "GET", { params: { id: f.siteId } });
  assert.equal(list.status, 200);
  assert.deepEqual(await list.json(), { available: false, tasks: {} });
  const r = await f.call("sites/[id]/tasks/route.ts", "PUT", { params: { id: f.siteId }, body: { checkId: "title", status: "todo" } });
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /wordt nog ingericht/);
});

// ---------------------------------------------------------------- comparison

test("comparison: fixed, new, improved and unknown come only from measurements", () => {
  const prev = [
    { id: "title", ratio: 0.5 },
    { id: "https", ratio: 1 },
    { id: "lh-performance-mobile", ratio: null },
    { id: "alt", ratio: 0.4 },
  ];
  const now = [
    { id: "title", ratio: 1 },
    { id: "https", ratio: 0 },
    { id: "lh-performance-mobile", ratio: 0.8 },
    { id: "alt", ratio: 0.7 },
    { id: "sample-content", ratio: 0 },
  ];
  assert.deepEqual(compareChecks(now, prev), { title: "fixed", https: "new", "lh-performance-mobile": "unknown", alt: "improved", "sample-content": "unknown" });
  assert.deepEqual(compareChecks(now, null).title, "unknown");
  assert.equal(scoreDelta({ overall: 80 }, { overall: 74 }), 6);
  assert.equal(scoreDelta({ overall: 80 }, { overall: null }), null);
});

// ---------------------------------------------------------------- AI suggestions and verification

test("AI suggestions: page facts come from the stored scan; unknown pages are refused; nothing is applied", async (t) => {
  const scanId = "22222222-2222-4222-8222-222222222222";
  const pageFacts = page("https://example.com/");
  const f = seoServer(t, {
    tables: {
      seo_scans: [{ id: scanId, workspace_id: "w1", site_id: "11111111-1111-4111-8111-111111111111", status: "completed", stage: "done", progress: {}, trigger: "manual", scores: { overall: 80 }, report: { site: { keyword: "pizza gouda" }, pages: [pageFacts] }, created_at: new Date().toISOString() }],
      business_profiles: [{ workspace_id: "w1", data: { profile: { name: "Trattoria Test" } } }],
      ai_usage: [],
      platform_admins: [],
    },
  });
  process.env.OPENAI_API_KEY = "sk-test-seo";
  const calls = [];
  f.load("src/lib/server/openai.ts").__setOpenAIClient({
    responses: { create: async (p) => (calls.push(p), { status: "completed", output_text: "Pizza in Gouda | Trattoria Test\nVerse pizza in Gouda | Trattoria Test\nTrattoria Test: pizza uit Gouda", usage: { input_tokens: 10, output_tokens: 10 } }) },
  });
  try {
    const bad = await f.call("scans/[id]/suggest/route.ts", "POST", { params: { id: scanId }, body: { url: "https://evil.example/", kind: "title" } });
    assert.equal(bad.status, 404);
    const r = await f.call("scans/[id]/suggest/route.ts", "POST", { params: { id: scanId }, body: { url: "https://example.com/", kind: "title" } });
    assert.equal(r.status, 200);
    const { suggestions } = await r.json();
    assert.equal(suggestions.length, 3);
    const sent = JSON.stringify(calls[0]);
    assert.match(sent, /Trattoria Test/);
    assert.match(sent, /pizza gouda/, "the focus keyword is used");
    assert.match(calls[0].instructions, /never change any website/);
  } finally {
    delete process.env.OPENAI_API_KEY;
  }
});
