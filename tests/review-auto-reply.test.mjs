import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";

// Auto Reply on real Google reviews (src/lib/server/automation.ts):
// only with the explicit permission, only positive reviews without sensitive
// content, never twice, every decision recorded. Google and OpenAI are mocked.

const origin = "https://mavix.webbo-solutions.nl";
const MANAGE = "https://www.googleapis.com/auth/business.manage";
const REVIEWS = "https://mybusiness.googleapis.com/v4/accounts/1/locations/11/reviews";
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
const review = (id, stars, comment, replied = false) => ({
  name: "accounts/1/locations/11/reviews/" + id,
  reviewId: id,
  reviewer: { displayName: "Sanne de Vries" },
  starRating: ["ONE", "TWO", "THREE", "FOUR", "FIVE"][stars - 1],
  comment,
  createTime: "2026-11-01T10:00:00Z",
  updateTime: "2026-11-01T10:00:00Z",
  ...(replied ? { reviewReply: { comment: "Dank!", updateTime: "2026-11-02T00:00:00Z" } } : {}),
});

function setup(t, { permitted = true, updatedBy = "u1", minRating = 4, connected = true } = {}) {
  process.env.OAUTH_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.CRON_SECRET = "cron-fixture-secret";
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-fixture-000000000000";
  t.after(() => (oldKey === undefined ? delete process.env.OPENAI_API_KEY : (process.env.OPENAI_API_KEY = oldKey)));
  const tables = {
    workspace_members: [{ user_id: "u1", workspace_id: "w1", role: "OWNER", created_at: "1" }],
    workspaces: [{ id: "w1", deleted_at: null, access_status: "approved" }],
    business_profiles: [{ workspace_id: "w1", version: 1, data: { profile: { name: "Trattoria Gouda" }, posts: [], review: { settings: { mode: "auto", enabled: true, requireApproval: false, autoPublishMinRating: minRating, manualBelowRating: 3, tone: "Warm en kort", signature: "Team Trattoria", notifyOnLowRating: true }, reviews: [] } } }],
    integration_connections: [],
    automation_permissions: permitted ? [{ workspace_id: "w1", workflow: "review_auto_reply", enabled: true, updated_by: updatedBy }] : [],
    automation_runs: [],
    ai_usage: [],
    audit_logs: [],
  };
  const db = memoryDb(tables, { uuid: true });
  db.auth = { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) };
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
  });
  const { encrypt } = load("src/lib/server/crypto.ts");
  if (connected)
    tables.integration_connections.push({
      id: "c1",
      workspace_id: "w1",
      provider: "google_business",
      status: "connected",
      scopes: ["openid", "email", MANAGE],
      encrypted_credentials: encrypt({ access_token: "access-fixture", refresh_token: "refresh-fixture", expires_in: 3600 }, "w1:google_business"),
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      connection_generation: "g1",
      provider_account_id: "g",
      account_email: "o@r.nl",
      display_name: "Trattoria Gouda",
      connected_user: "u1",
      metadata: { account: "accounts/1", location: "locations/11", locationTitle: "Trattoria Gouda" },
    });
  const ai = [];
  load("src/lib/server/openai.ts").__setOpenAIClient({
    responses: { create: async (p) => (ai.push(p), { status: "completed", output_text: "Dank je wel, Sanne! Fijn dat het gesmaakt heeft. Team Trattoria", usage: { input_tokens: 500, output_tokens: 60 } }) },
  });
  const google = { reviews: [review("r1", 5, "Heerlijk gegeten, super service!"), review("r2", 2, "Lang wachten en koud eten."), review("r3", 5, "Top!", true), review("r4", 5, "Lekker, maar ik werd er ziek van."), review("r5", 4, "Prima pizza.")], posted: [] };
  t.mock.method(globalThis, "fetch", async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith(REVIEWS + "?")) return reply({ reviews: google.reviews, averageRating: 4.2, totalReviewCount: google.reviews.length });
    const m = /\/reviews\/(r\d)\/reply$/.exec(u);
    if (m && init.method === "PUT") {
      const body = JSON.parse(init.body);
      google.posted.push({ id: m[1], comment: body.comment });
      const r = google.reviews.find((x) => x.reviewId === m[1]);
      r.reviewReply = { comment: body.comment, updateTime: "2026-11-03T00:00:00Z" };
      return reply({ comment: body.comment, updateTime: "2026-11-03T00:00:00Z" });
    }
    throw new Error("Unexpected fixture request " + u);
  });
  const quiet = () => {
    t.mock.method(console, "info", () => {});
    t.mock.method(console, "error", () => {});
  };
  quiet();
  return { tables, load, ai, google, auto: load("src/lib/server/automation.ts") };
}

test("auto reply: positive reviews get one AI reply on Google; low scores, sensitive content and answered reviews stay with the owner", async (t) => {
  const f = setup(t);
  await f.auto.runScheduled();
  assert.deepEqual(f.google.posted.map((p) => p.id).sort(), ["r1", "r5"], "4 and 5 stars without sensitive content");
  assert.equal(f.ai.length, 2, "one AI call per reply");
  assert.match(f.google.posted[0].comment, /Dank je wel/);
  const runs = f.tables.automation_runs.filter((r) => r.workflow === "review_auto_reply");
  const by = (id) => runs.find((r) => r.item_id === id);
  assert.equal(by("r1").status, "ok");
  assert.equal(by("r5").status, "ok");
  assert.deepEqual([by("r2").status, by("r2").detail], ["skipped", "Lage score: altijd persoonlijk beantwoorden."]);
  assert.match(by("r4").detail, /Gevoelig onderwerp/);
  assert.equal(by("r3"), undefined, "an answered review is not even recorded");
  assert.equal(f.tables.ai_usage.filter((u) => u.status === "succeeded").length, 2, "AI costs are metered on the owner's account");
  assert.ok(f.tables.ai_usage.every((u) => u.user_id === "u1"));
  // Second run: nothing new. No second reply, no second AI call, no duplicate skip records.
  await f.auto.runScheduled();
  assert.equal(f.google.posted.length, 2);
  assert.equal(f.ai.length, 2);
  assert.equal(runs.length, f.tables.automation_runs.filter((r) => r.workflow === "review_auto_reply").length);
});

test("auto reply: threshold 5 leaves a 4-star review to the owner; without permission nothing happens at all", async (t) => {
  const f = setup(t, { minRating: 5 });
  await f.auto.runScheduled();
  assert.deepEqual(f.google.posted.map((p) => p.id), ["r1"]);
  assert.match(f.tables.automation_runs.find((r) => r.item_id === "r5").detail, /Onder jouw drempel/);
  const g = setup(t, { permitted: false });
  await g.auto.runScheduled();
  assert.equal(g.google.posted.length, 0);
  assert.equal(g.ai.length, 0);
  assert.equal(g.tables.automation_runs.length, 0);
});

test("auto reply: no owner for the AI costs = no reply; the permission needs a working Google connection; status reports it", async (t) => {
  const f = setup(t, { updatedBy: null });
  await f.auto.runScheduled();
  assert.equal(f.google.posted.length, 0);
  assert.equal(f.ai.length, 0);
  assert.match(f.tables.automation_runs[0].detail, /Geen eigenaar/);
  const g = setup(t, { permitted: false, connected: false });
  await assert.rejects(g.auto.setPermission({ workspaceId: "w1", userId: "u1" }, "review_auto_reply", true), /Koppel eerst Google/);
  const h = setup(t, { permitted: false });
  await h.auto.setPermission({ workspaceId: "w1", userId: "u1" }, "review_auto_reply", true);
  assert.deepEqual([h.tables.automation_permissions[0].enabled, h.tables.automation_permissions[0].updated_by], [true, "u1"]);
  const status = (await h.auto.automationStatus("w1")).find((w) => w.id === "review_auto_reply");
  assert.equal(status.state, "running");
  assert.ok(status.requirements.every((r) => r.met));
  await h.auto.setPermission({ workspaceId: "w1", userId: "u1" }, "review_auto_reply", false);
  await h.auto.runScheduled();
  assert.equal(h.google.posted.length, 0, "switched off = nothing posted");
});

test("the Reviews page offers the automatic tab to real workspaces, with a confirmation before switching on", () => {
  const ws = fs.readFileSync("src/components/review/workspace.tsx", "utf8");
  assert.match(ws, /ReviewAutoReplyLive/);
  assert.doesNotMatch(ws, /tabs\.filter\(\(\[key\]\) => key !== "auto-reply"\)/, "the tab is no longer test-mode only");
  const live = fs.readFileSync("src/components/review/auto-reply-live.tsx", "utf8");
  assert.match(live, /ConfirmDialog/);
  assert.match(live, /confirm: true/);
  assert.match(live, /1 tot 3 sterren: altijd jij/);
});
