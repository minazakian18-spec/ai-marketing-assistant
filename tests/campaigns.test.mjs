import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";

// Content Studio campaigns: records, links, versions, validation, the
// generate route (auth, metering, sanitizing) and the workspace PUT checks.

const origin = "https://mavix.webbo-solutions.nl";
const lib = serverLoader({})("src/lib/campaigns.ts");

const draft = {
  title: "Weekendmenu",
  goal: "Promoot het weekendmenu",
  instagram: { caption: "Caption", hashtags: "#a", visual_brief: "Foto van een bord" },
  email: { subject: "Onderwerp", preview: "Preview", body: "Tekst", cta: "Reserveer" },
  copy: { title: "Tekst", body: "Korte tekst" },
  ctas: ["Reserveer"],
  schedule: [
    { channel: "instagram", day_offset: 1, time: "17:00" },
    { channel: "email", day_offset: 3, time: "09:30" },
  ],
};

test("buildCampaignRecords: one campaign, linked draft items, suggested dates, nothing scheduled", () => {
  let n = 0;
  const r = lib.buildCampaignRecords(draft, { source: "studio", profile: { name: "Telepizza", website: "https://t.test", city: "Amstelveen" }, now: new Date(2026, 9, 16, 12), id: () => "id" + n++ });
  assert.equal(r.campaign.id, "id0");
  assert.equal(r.post.campaignId, "id0");
  assert.equal(r.email.campaignId, "id0");
  assert.equal(r.copy.campaignId, "id0");
  assert.equal(r.post.status, "draft");
  assert.equal(r.email.status, "draft");
  assert.equal(r.copy.status, "draft");
  assert.equal(r.post.date, "2026-10-17T17:00");
  assert.equal(r.email.date, "2026-10-19T09:30");
  assert.equal(r.copy.date, undefined);
  assert.equal(r.post.visualBrief, "Foto van een bord");
  assert.deepEqual(r.post.media, [], "no fake images");
  assert.equal(r.email.ctaUrl, "https://t.test");
  assert.match(r.email.footer, /Telepizza · Amstelveen/);
  assert.ok(lib.campaignValid(r.campaign));
});

test("addCampaign keeps existing records and e-mail settings; adds settings when missing", () => {
  const r = lib.buildCampaignRecords(draft, { source: "agent", profile: {} });
  const ws = { posts: [{ id: "old" }], email: { settings: { time: "08:00" }, campaigns: [{ id: "e-old" }] }, copies: [] };
  const next = lib.addCampaign(ws, r);
  assert.deepEqual(next.posts.map((p) => p.id), [r.post.id, "old"]);
  assert.deepEqual(next.email.settings, { time: "08:00" });
  assert.equal(next.email.campaigns.length, 2);
  assert.equal(ws.posts.length, 1, "input untouched");
  const fresh = lib.addCampaign({ posts: [] }, r);
  assert.ok(fresh.email.settings && typeof fresh.email.settings === "object", "test-mode data stays loadable");
});

test("campaignItems and campaignSummary read the items from the modules that own them", () => {
  const ws = {
    posts: [{ id: "p", campaignId: "c", status: "scheduled" }, { id: "q", status: "draft" }],
    email: { campaigns: [{ id: "e", campaignId: "c", status: "draft" }] },
    copies: [{ id: "x", campaignId: "c", status: "ready" }],
    campaigns: [{ id: "c" }],
  };
  const items = lib.campaignItems(ws, "c");
  assert.equal(items.posts.length + items.emails.length + items.copies.length, 3);
  assert.deepEqual(lib.campaignSummary(ws, { id: "c" }), { total: 3, drafts: 1, approved: 1, scheduled: 1, done: 0 });
});

test("withVersion keeps the previous text, newest first, capped, only when something changed", () => {
  let item = { caption: "v0" };
  item = lib.withVersion(item, { caption: "v0" }, { caption: "v0" });
  assert.equal(item.history, undefined, "no entry without a change");
  for (let i = 1; i <= 12; i++) item = lib.withVersion(item, { caption: item.caption }, { caption: "v" + i }, "2026-10-16T10:" + String(i).padStart(2, "0"));
  assert.equal(item.caption, "v12");
  assert.equal(item.history.length, lib.VERSION_LIMIT);
  assert.equal(item.history[0].caption, "v11");
  assert.ok(lib.historyValid(item.history));
});

test("validation refuses dangling links, malformed history and invalid campaigns", () => {
  assert.equal(lib.campaignLinksValid({ posts: [{ campaignId: "nope" }], campaigns: [] }), false);
  assert.equal(lib.campaignLinksValid({ posts: [{ campaignId: "c" }], campaigns: [{ id: "c" }] }), true);
  assert.equal(lib.campaignLinksValid({ posts: [{ history: [{ at: "1", secret: "x" }] }] }), false);
  assert.equal(lib.campaignLinksValid({ copies: [{ history: "x" }] }), false);
  assert.equal(lib.campaignValid({ id: "c", title: "t", goal: "g", source: "hacker", createdAt: "1", updatedAt: "1" }), false);
  assert.equal(lib.campaignValid({ id: "c", title: "x".repeat(161), goal: "g", source: "studio", createdAt: "1", updatedAt: "1" }), false);
});

// Fixture key for this test process only (each test file runs in its own process).
process.env.OPENAI_API_KEY = "sk-test-fixture-campaign";
function routeSetup({ user = "u1" } = {}) {
  const tables = {
    workspace_members: [
      { user_id: "u1", workspace_id: "w1", role: "OWNER", created_at: "1" },
      { user_id: "u2", workspace_id: "w1", role: "MEMBER", created_at: "1" },
    ],
    workspaces: [{ id: "w1", deleted_at: null, access_status: "approved" }],
    business_profiles: [{ workspace_id: "w1", version: 1, data: { profile: { name: "Telepizza", description: "Pizza" }, posts: [] } }],
    ai_usage: [],
  };
  const db = memoryDb(tables, { uuid: true });
  db.auth = { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) };
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
  });
  const calls = [];
  load("src/lib/server/openai.ts").__setOpenAIClient({
    responses: {
      create: async (p) => {
        calls.push(p);
        const out = { title: "Weekend", instagram: { caption: "C".repeat(3000), hashtags: "#a", visual_brief: "Brief" }, email: { subject: "S", preview: "P", body: "B", cta: "R" }, copy: { title: "T", body: "X" }, ctas: ["A", "B", "C", "D", "E"], schedule: [{ channel: "instagram", day_offset: 99, time: "nu" }, { channel: "copy", day_offset: 1, time: "10:00" }], missing_facts: ["Prijs"] };
        return { status: "completed", output: [], output_text: JSON.stringify(out), usage: { input_tokens: 500, output_tokens: 700 } };
      },
    },
  });
  const route = load("src/app/api/generate/campaign/route.ts");
  const wsRoute = load("src/app/api/workspace/route.ts");
  const put = async (data, version = 1) => {
    const r = await wsRoute.PUT(new Request(origin + "/api/workspace", { method: "PUT", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ data, version }) }));
    return { status: r.status, body: await r.json() };
  };
  const post = async (body) => {
    const r = await route.POST(new Request(origin + "/api/generate/campaign", { method: "POST", headers: { origin, "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) }));
    return { status: r.status, body: await r.json() };
  };
  return { tables, calls, post, put };
}

test("workspace save: campaigns persist; dangling links, invalid campaigns and bad history are refused", async (t) => {
  t.mock.method(console, "error", () => {});
  const env = routeSetup();
  const r = lib.buildCampaignRecords(draft, { source: "studio", profile: {} });
  const base = { profile: { name: "Telepizza" }, posts: [] };
  const good = lib.addCampaign(base, r);
  const ok = await env.put(good);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(env.tables.business_profiles[0].data.campaigns[0].id, r.campaign.id);
  assert.equal(env.tables.business_profiles[0].data.posts[0].campaignId, r.campaign.id);
  const dangling = await env.put({ ...good, campaigns: [] }, 2);
  assert.equal(dangling.status, 400);
  const invalid = await env.put({ ...good, campaigns: [{ ...r.campaign, source: "x" }] }, 2);
  assert.equal(invalid.status, 400);
  const history = await env.put({ ...good, posts: [{ ...good.posts[0], history: [{ at: "1", script: "x" }] }] }, 2);
  assert.equal(history.status, 400);
  assert.equal(env.tables.business_profiles[0].version, 2, "refused saves change nothing");
});

test("generate route: owner gets a sanitized draft with only the requested channels, metered as content_campaign", async (t) => {
  t.mock.method(console, "info", () => {});
  const env = routeSetup();
  const r = await env.post({ goal: "Promoot het weekendmenu", channels: ["instagram", "email"] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.draft.copy, null, "copy not requested");
  assert.equal(r.body.draft.instagram.caption.length, 2200);
  assert.equal(r.body.draft.ctas.length, 4);
  assert.deepEqual(r.body.draft.schedule, [{ channel: "instagram", day_offset: 14, time: "10:00" }]);
  assert.deepEqual(r.body.draft.missing_facts, ["Prijs"]);
  assert.equal(env.calls[0].text.format.type, "json_schema");
  assert.equal(env.calls[0].text.format.strict, true);
  assert.equal(env.tables.ai_usage.length, 1);
  assert.equal(env.tables.ai_usage[0].feature, "content_campaign");
  assert.equal(env.tables.business_profiles[0].version, 1, "nothing saved by generating");
});

test("generate route: members, signed-out users and invalid input are refused without an AI call", async () => {
  const member = routeSetup({ user: "u2" });
  assert.equal((await member.post({ goal: "Promoot het weekendmenu", channels: ["instagram"] })).status, 403);
  const anon = routeSetup({ user: null });
  assert.equal((await anon.post({ goal: "Promoot het weekendmenu", channels: ["instagram"] })).status, 401);
  const bad = routeSetup();
  assert.equal((await bad.post({ goal: "x", channels: [] })).status, 400);
  assert.equal((await bad.post({ goal: "Promoot iets moois", channels: ["reel"] })).status, 400);
  assert.equal(member.calls.length + anon.calls.length + bad.calls.length, 0);
});
