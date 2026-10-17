import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";

// Subscriptions: central configuration, credits and per-action limits
// enforced in metered(), entitlements, workspace limits (users, contacts,
// storage, SEO scans), the Premium advice call and the pricing content.
// No real AI request or payment is made.

const origin = "https://mavix.webbo-solutions.nl";
process.env.AI_DAILY_REQUESTS_PER_USER = "1000"; // these tests make many requests; the daily cap has its own tests
const pure = serverLoader({});
const plans = pure("src/lib/plans.ts");

test("prices, yearly prices and credits match the agreed model", () => {
  const { PLANS, yearlyPrice } = plans;
  assert.deepEqual([PLANS.starter.monthlyPrice, PLANS.growth.monthlyPrice, PLANS.autopilot.monthlyPrice], [29, 69, 119]);
  assert.deepEqual([PLANS.starter.credits, PLANS.growth.credits, PLANS.autopilot.credits], [150, 600, 1500]);
  assert.equal(PLANS.autopilot.name, "Premium", "public name; technical id stays autopilot");
  assert.equal(PLANS.growth.recommended, true);
  assert.deepEqual(yearlyPrice(PLANS.starter), { perMonth: 23.2, perYear: 278.4 });
  assert.deepEqual(yearlyPrice(PLANS.growth), { perMonth: 55.2, perYear: 662.4 });
  assert.deepEqual(yearlyPrice(PLANS.autopilot), { perMonth: 95.2, perYear: 1142.4 });
});

test("credit prices per action and limits that fit inside each plan's credits", () => {
  const { ACTIONS, PLANS, PLAN_IDS, maxActionCredits } = plans;
  const expected = { instagram_caption: 1, review_reply: 1, email_draft: 2, image_generate: 10, image_edit: 12, inbox_reply: 2, seo_advice: 3, campaign: 6, research: 20, agent_task: 8, brand_improve: 2 };
  for (const [a, c] of Object.entries(expected)) assert.equal(ACTIONS[a].credits, c, a);
  for (const id of PLAN_IDS) assert.ok(maxActionCredits(PLANS[id]) <= PLANS[id].credits, `${id}: maxima fit within credits`);
  assert.equal(PLANS.starter.limits.image_generate, 6);
  assert.equal(PLANS.growth.limits.inbox_reply, 40);
  assert.equal(PLANS.autopilot.limits.agent_task, 30);
  // Website example: 13 posts with image, 9 e-mails, 40 reviews = 201; 399 left in Growth.
  const total = 13 * (ACTIONS.instagram_caption.credits + ACTIONS.image_generate.credits) + 9 * ACTIONS.email_draft.credits + 40 * ACTIONS.review_reply.credits;
  assert.equal(total, 201);
  assert.equal(PLANS.growth.credits - total, 399);
});

test("every metered AI feature is mapped to a credit action (no unmetered AI)", () => {
  const usage = serverLoader({ [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => ({}) } })("src/lib/server/ai-usage.ts");
  for (const f of Object.keys(usage.OUTPUT_LIMIT)) assert.ok(plans.FEATURE_ACTION[f], "mapped: " + f);
});

test("credit period renews on the billing day, monthly also for yearly plans; calendar month without one", () => {
  const { creditPeriod } = plans;
  const p = creditPeriod("2027-01-31T10:00:00Z", new Date("2026-11-15T12:00:00Z"));
  assert.equal(p.start.toISOString().slice(0, 10), "2026-10-31");
  assert.equal(p.end.toISOString().slice(0, 10), "2026-11-30", "clamped to the last day of a shorter month");
  const yearly = creditPeriod("2027-10-05T00:00:00Z", new Date("2026-11-20T00:00:00Z"));
  assert.equal(yearly.start.toISOString().slice(0, 10), "2026-11-05");
  const beta = creditPeriod(null, new Date("2026-11-20T00:00:00Z"));
  assert.equal(beta.start.toISOString().slice(0, 10), "2026-11-01");
});

function env({ plan = null, status = "active", user = "u1", tables = {} } = {}) {
  tables.workspace_members ??= [{ user_id: "u1", workspace_id: "w1", role: "OWNER", created_at: "1" }, { user_id: "u2", workspace_id: "w1", role: "ADMIN", created_at: "1" }];
  tables.workspaces ??= [{ id: "w1", deleted_at: null, access_status: "approved" }];
  tables.subscriptions ??= plan ? [{ workspace_id: "w1", plan, status, billing_interval: "month", current_period_end: new Date(Date.now() + 10 * 86400000).toISOString() }] : [];
  tables.ai_usage ??= [];
  tables.business_profiles ??= [{ workspace_id: "w1", version: 1, data: { profile: { name: "T" }, posts: [], contacts: [] } }];
  tables.workspace_invites ??= [];
  tables.audit_logs ??= [];
  tables.library_files ??= [];
  const db = memoryDb(tables, { uuid: true });
  db.auth = { getUser: async () => ({ data: { user: user ? { id: user, email: user + "@x.test" } : null }, error: null }) };
  db.rpc = async () => ({ data: true, error: null });
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
  });
  const usage = load("src/lib/server/ai-usage.ts");
  const auth = { workspaceId: "w1", user: { id: user } };
  const run = (feature, key) => usage.metered(auth, feature, async () => "ok", key);
  return { tables, load, usage, run, db };
}
const quiet = (t) => {
  t.mock.method(console, "info", () => {});
  t.mock.method(console, "error", () => {});
};

test("Starter: no Mavix Agent, no Inbox AI; Growth: Inbox AI, no Agent; Premium: Agent", async (t) => {
  quiet(t);
  const s = env({ plan: "starter" });
  await assert.rejects(s.run("agent"), (e) => e.status === 402 && /Premium/.test(e.message));
  await assert.rejects(s.run("inbox_reply"), (e) => e.status === 402);
  assert.equal(s.tables.ai_usage.length, 0, "refused before anything is reserved");
  assert.equal(await s.run("content_instagram"), "ok");
  const g = env({ plan: "growth" });
  assert.equal(await g.run("inbox_reply"), "ok");
  await assert.rejects(g.run("agent"), (e) => e.status === 402);
  const p = env({ plan: "autopilot" });
  assert.equal(await p.run("agent"), "ok");
});

test("per-action monthly limit: the 9th Starter caption is refused with renewal date and upgrade hint", async (t) => {
  quiet(t);
  const s = env({ plan: "starter" });
  for (let i = 0; i < 8; i++) await s.run("content_instagram");
  await assert.rejects(s.run("content_instagram"), (e) => e.status === 402 && /alle 8 instagram-captions/.test(e.message) && /vernieuwt op/.test(e.message) && e.upgrade === "growth");
  assert.equal(s.tables.ai_usage.filter((r) => r.status === "succeeded").length, 8);
});

test("shared credits: running out blocks every AI action, shows what is left; no negative credits", async (t) => {
  quiet(t);
  // 145 of 150 credits used by earlier image/edit requests this period.
  const now = new Date().toISOString();
  const used = [...Array(6)].map(() => ({ workspace_id: "w1", user_id: "u1", feature: "image_generate", status: "succeeded", cost_micro_usd: 0, created_at: now }))
    .concat([...Array(2)].map(() => ({ workspace_id: "w1", user_id: "u1", feature: "image_edit", status: "succeeded", cost_micro_usd: 0, created_at: now })))
    .concat([...Array(4)].map(() => ({ workspace_id: "w1", user_id: "u1", feature: "content_email", status: "succeeded", cost_micro_usd: 0, created_at: now })))
    .concat([...Array(7)].map(() => ({ workspace_id: "w1", user_id: "u1", feature: "content_edit", status: "succeeded", cost_micro_usd: 0, created_at: now })));
  const s = env({ plan: "starter", tables: { ai_usage: used } }); // 60 + 24 + 8 + 7 = 99 credits
  for (let i = 0; i < 51; i++) await s.run("content_edit"); // 150
  await assert.rejects(s.run("review_reply"), (e) => e.status === 402 && /nog 0 van de 150 credits/.test(e.message));
  const summary = await s.usage.creditSummary("w1");
  assert.equal(summary.credits.used, 150);
  assert.equal(summary.credits.remaining, 0);
});

test("failed requests use no credits; concurrent reservations count (duplicate keys: unique index, see private-beta tests)", async (t) => {
  quiet(t);
  const s = env({ plan: "starter" });
  await assert.rejects(s.usage.metered({ workspaceId: "w1", user: { id: "u1" } }, "content_instagram", async () => { throw new Error("boom"); }));
  assert.equal((await s.usage.creditSummary("w1")).credits.used, 0, "failed = free");
  // Eight live reservations by another tab: this request would be the 9th.
  const now = new Date().toISOString();
  s.tables.ai_usage.push(...[...Array(8)].map(() => ({ workspace_id: "w1", user_id: "u2", feature: "content_instagram", status: "pending", cost_micro_usd: 0, created_at: now })));
  await assert.rejects(s.run("content_instagram"), (e) => e.status === 402, "pending requests count against the limit");
});

test("upgrade keeps what was used and gives the new room immediately; beta keeps everything; ended subscription stops AI only", async (t) => {
  quiet(t);
  const s = env({ plan: "starter" });
  for (let i = 0; i < 8; i++) await s.run("content_instagram");
  s.tables.subscriptions[0].plan = "growth";
  assert.equal(await s.run("content_instagram"), "ok", "Growth allows 20");
  const sum = await s.usage.creditSummary("w1");
  assert.equal(sum.credits.used, 9);
  assert.equal(sum.credits.remaining, 591);
  const beta = env();
  assert.equal(await beta.run("agent"), "ok", "beta workspaces keep all features");
  assert.equal((await beta.usage.creditSummary("w1")).plan.name, "Beta");
  const ended = env({ plan: "growth", status: "canceled" });
  await assert.rejects(ended.run("content_instagram"), (e) => e.status === 402 && /niet meer actief/.test(e.message));
});

test("workspace limits: contacts and users per plan, storage per plan", async (t) => {
  quiet(t);
  const s = env({ plan: "starter" });
  const ws = s.load("src/app/api/workspace/route.ts");
  const contacts = (n) => [...Array(n)].map((_, i) => ({ id: "c" + i, firstName: "", lastName: "", email: `c${i}@x.test`, status: "Niet bevestigd", source: "import", createdAt: "1" }));
  const put = (n, version) => ws.PUT(new Request(origin + "/api/workspace", { method: "PUT", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ version, data: { ...s.tables.business_profiles[0].data, contacts: contacts(n) } }) }));
  assert.equal((await put(500, 1)).status, 200);
  const over = await put(501, 2);
  assert.equal(over.status, 402);
  assert.match((await over.json()).error, /500 contacten/);
  // Users: Starter = 1 user, owner already uses it.
  const team = s.load("src/app/api/team/route.ts");
  process.env.EMAIL_API_KEY = "re_fixture";
  const invite = await team.POST(new Request(origin + "/api/team", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ email: "a@x.test", role: "MEMBER" }) }));
  assert.equal(invite.status, 402);
  const lib = s.load("src/lib/server/library.ts");
  assert.equal(await lib.quotaFor("w1"), 500 * 1024 * 1024);
});

test("Premium advice call: Premium only, honest without booking link, once per period", async (t) => {
  quiet(t);
  const call = (e, method) => e.load("src/app/api/advice/route.ts")[method](new Request(origin + "/api/advice", { method, headers: { origin, "Content-Type": "application/json" }, body: method === "POST" ? "{}" : undefined }));
  assert.equal((await call(env({ plan: "growth" }), "POST")).status, 402);
  const p = env({ plan: "autopilot" });
  delete process.env.MAVIX_ADVICE_BOOKING_URL;
  assert.equal((await call(p, "POST")).status, 503, "no invented slots without a booking link");
  process.env.MAVIX_ADVICE_BOOKING_URL = "https://cal.example.test/mavix";
  const first = await call(p, "POST");
  assert.equal(first.status, 200);
  assert.equal((await first.json()).url, "https://cal.example.test/mavix");
  assert.equal((await call(p, "POST")).status, 409, "one call per period");
  delete process.env.MAVIX_ADVICE_BOOKING_URL;
});

test("pricing content: honest availability, Agent only in Premium, FAQ, differences filter", () => {
  const c = pure("src/lib/pricing-content.ts");
  const row = (label) => c.uniqueRows().find((r) => r.label === label);
  assert.deepEqual(row("Mavix Agent").values, { starter: false, growth: false, autopilot: true });
  assert.deepEqual(row("Google Ads-campagnes").values, { starter: "soon", growth: "soon", autopilot: "soon" }, "not sold as available");
  assert.equal(row("Automatisch publiceren op Instagram").values.autopilot, "soon");
  assert.equal(row("AI-credits per maand").values.growth, 600);
  assert.equal(row("AI-afbeeldingen per maand").values.autopilot, 35);
  // The agreed Instagram rows, exactly as on the pricing page.
  const exact = {
    "AI-afbeeldingen genereren": [true, true, true],
    "Inspiratiebeelden gebruiken": [true, true, true],
    "Max. inspiratiebeelden": [1, 3, 5],
    "AI-carrousels maken": ["Nee", true, true],
    "Max. carrousels per maand": [0, 4, 10],
    "Slides per carrousel": [false, "2–5", "2–10"],
    "Individuele slides bewerken": [false, true, true],
    "Individuele slides opnieuw genereren": [false, true, true],
    "Carrousels downloaden": [false, true, true],
    "AI-afbeeldingen per maand": [6, 16, 35],
    "AI-credits per maand": [150, 600, 1500],
    "Persoonlijk advies": [false, false, "20 minuten per maand"],
  };
  for (const [label, [s, g, p]] of Object.entries(exact)) assert.deepEqual(row(label).values, { starter: s, growth: g, autopilot: p }, label);
  assert.equal(c.differs(row("Dashboard")), false);
  assert.equal(c.differs(row("Mavix Agent")), true);
  assert.ok(c.FAQ.length >= 23);
  assert.ok(!c.FAQ.some((f) => /gratis proef|24\/7|geld terug/i.test(f.a)), "no unsupported promises");
  assert.ok(c.CATEGORIES.find((x) => x.id === "key").open && c.CATEGORIES.find((x) => x.id === "credits").open);
});
