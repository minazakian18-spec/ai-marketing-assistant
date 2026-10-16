import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";

// Phase 5: Insights (measured only), goals, Brand Hub website import,
// contacts consent/segments/merge, integration health, dashboard to-dos.

const origin = "https://mavix.webbo-solutions.nl";
const pure = serverLoader({});

test("insights helpers: period comparison, honest change, goals validation and progress", () => {
  const i = pure("src/lib/insights.ts");
  const now = Date.parse("2026-10-17T12:00:00Z");
  const d = (days) => now - days * 86400_000;
  const m = i.periodCompare("Posts", [d(1), d(5), d(40), d(70), NaN], now);
  assert.deepEqual([m.value, m.previous], [2, 1]);
  assert.deepEqual(i.change(m), { pct: 100, direction: "up" });
  assert.deepEqual(i.change({ label: "", value: 3, previous: 0 }), { pct: null, direction: "up" }, "no fake percentage from zero");
  assert.deepEqual(i.change({ label: "", value: 3, previous: null }), { pct: null, direction: null });
  assert.equal(i.goalsValid([{ kind: "posts_per_month", target: 8 }]), true);
  assert.equal(i.goalsValid([{ kind: "posts_per_month", target: 8 }, { kind: "posts_per_month", target: 4 }]), false);
  assert.equal(i.goalsValid([{ kind: "review_rating", target: 9 }]), false);
  assert.equal(i.goalsValid([{ kind: "revenue", target: 1 }]), false);
  const p = i.goalProgress({ kind: "posts_per_month", target: 4 }, { posts: [{ status: "published", date: "2026-10-02T10:00" }, { status: "scheduled", date: "2026-10-20T10:00" }, { status: "draft", date: "2026-10-03T10:00" }, { status: "published", date: "2026-09-30T10:00" }], emails: [], rating: null }, new Date(now));
  assert.deepEqual(p, { value: 2, pct: 50 });
  assert.equal(i.goalProgress({ kind: "review_rating", target: 4.5 }, { posts: [], emails: [], rating: null }).value, null, "no rating, no invented progress");
});

test("next actions only come from measured facts and point to the module", () => {
  const { nextActions } = pure("src/lib/insights.ts");
  const blocks = [
    { id: "reviews", available: true, metrics: [{ label: "Onbeantwoord", value: 2, previous: null }] },
    { id: "search", available: true, metrics: [{ label: "Klikken", value: 60, previous: 100 }] },
  ];
  const a = nextActions(blocks, { drafts: 3, scheduledNext7: 0, brandScore: 100 });
  assert.equal(a.length, 3);
  assert.match(a[0].title, /2 reviews/);
  assert.ok(a.every((x) => x.href.startsWith("/") && /Gemeten/.test(x.why)));
  assert.deepEqual(nextActions([], { drafts: 0, scheduledNext7: 2, brandScore: 100 }), []);
});

function env({ user = "u1", conns = [], tables = {} } = {}) {
  tables.workspace_members ??= [{ user_id: "u1", workspace_id: "w1", role: "OWNER", created_at: "1" }, { user_id: "u2", workspace_id: "w1", role: "MEMBER", created_at: "1" }, { user_id: "u3", workspace_id: "w2", role: "OWNER", created_at: "1" }];
  tables.workspaces ??= [{ id: "w1", deleted_at: null, access_status: "approved" }, { id: "w2", deleted_at: null, access_status: "approved" }];
  tables.business_profiles ??= [
    { workspace_id: "w1", version: 1, data: { profile: { name: "Telepizza" }, posts: [{ id: "p1", status: "draft", createdAt: new Date().toISOString(), date: "" }], email: { campaigns: [] } } },
    { workspace_id: "w2", version: 1, data: { profile: { name: "Ander" }, posts: [{ id: "x", status: "draft", createdAt: new Date().toISOString(), date: "" }, { id: "y", status: "draft", createdAt: new Date().toISOString(), date: "" }] } },
  ];
  tables.integration_connections ??= conns;
  tables.seo_sites ??= [];
  tables.email_campaign_runs ??= [];
  tables.email_deliveries ??= [];
  const db = memoryDb(tables, { uuid: true });
  db.auth = { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) };
  db.rpc = async () => ({ data: true, error: null });
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
  });
  return { load, tables };
}

test("insights route: own workspace only, unavailable sources explain why instead of showing zeros", async (t) => {
  t.mock.method(console, "error", () => {});
  const e = env();
  const res = await e.load("src/app/api/insights/route.ts").GET();
  assert.equal(res.status, 200);
  const { blocks } = await res.json();
  const activity = blocks.find((b) => b.id === "activity");
  assert.equal(activity.metrics[0].value, 1, "only w1's post, not w2's");
  for (const id of ["search", "reviews", "email", "instagram"]) {
    const b = blocks.find((x) => x.id === id);
    assert.equal(b.available, false, id);
    assert.ok(b.reason && !b.metrics, id + " has a reason and no numbers");
  }
  const anon = env({ user: null });
  assert.equal((await anon.load("src/app/api/insights/route.ts").GET()).status, 401);
});

test("workspace save validates goals", async (t) => {
  t.mock.method(console, "error", () => {});
  const e = env();
  const ws = e.load("src/app/api/workspace/route.ts");
  const put = (goals) => ws.PUT(new Request(origin + "/api/workspace", { method: "PUT", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ version: 1, data: { ...e.tables.business_profiles[0].data, goals } }) }));
  assert.equal((await put([{ kind: "posts_per_month", target: 500 }])).status, 400);
  assert.equal((await put([{ kind: "posts_per_month", target: 8 }])).status, 200);
});

test("website import: literal facts with sources, never overwrites without confirmation", () => {
  const b = pure("src/lib/brand-import.ts");
  const html = `<html><head><title>Telepizza Amstelveen | Pizza bezorgen</title><meta name="description" content="Verse pizza &amp; pasta uit de steenoven.">
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Restaurant","name":"Telepizza Amstelveen","telephone":"+31 20 123 4567","address":{"@type":"PostalAddress","streetAddress":"Stadsplein 1","postalCode":"1181 ZM","addressLocality":"Amstelveen","addressCountry":"NL"}}]}</script>
  </head><body><a href="tel:+31201234567">Bel</a><script>alert(1)</script></body></html>`;
  const facts = b.extractFacts(html);
  assert.equal(facts.name.value, "Telepizza Amstelveen");
  assert.equal(facts.description.value, "Verse pizza & pasta uit de steenoven.");
  assert.equal(facts.phone.value, "+31 20 123 4567");
  assert.equal(facts.city.value, "Amstelveen");
  assert.equal(facts.country.value, "Nederland");
  assert.match(facts.address.source, /schema\.org/);
  const profile = { name: "Telepizza", description: "", phone: "", address: "", postalCode: "", city: "Amstelveen", country: "" };
  const s = b.suggestionsFor(profile, facts);
  assert.ok(!s.some((x) => x.field === "city"), "same value is not suggested");
  assert.equal(s.find((x) => x.field === "name").replace, false, "filled field not preselected");
  assert.equal(s.find((x) => x.field === "description").replace, true);
  const next = b.applyConfirmed(profile, s, ["description"]);
  assert.equal(next.name, "Telepizza", "unconfirmed field untouched");
  assert.equal(next.description, "Verse pizza & pasta uit de steenoven.");
  assert.deepEqual(b.extractFacts("<html><body>Niets</body></html>"), {}, "nothing invented");
});

test("website import route: owners only, private addresses refused", async (t) => {
  t.mock.method(console, "error", () => {});
  const member = env({ user: "u2" });
  const req = (url) => new Request(origin + "/api/brand/import", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
  assert.equal((await member.load("src/app/api/brand/import/route.ts").POST(req("https://example.test"))).status, 403);
  const owner = env();
  const r = await owner.load("src/app/api/brand/import/route.ts").POST(req("http://127.0.0.1:8080/admin"));
  assert.equal(r.status, 400);
});

test("contacts: consent provenance, smart segments, merge fills only empty fields", () => {
  const c = pure("src/lib/contact-segments.ts");
  const base = { id: "1", firstName: "", lastName: "", email: "a@x.test", status: "Ingeschreven", source: "import", createdAt: "1" };
  assert.equal(c.consentOf(base), "stated", "imported 'Ingeschreven' is not proven consent");
  assert.equal(c.consentOf({ ...base, newsletter: { subscriberId: "s", status: "subscribed", source: "form" } }), "proven");
  assert.equal(c.consentOf({ ...base, status: "Uitgeschreven" }), "none");
  const smart = (id, x) => c.SMART_SEGMENTS.find((s) => s.id === id).test(x);
  assert.equal(smart("smart:stated", base), true);
  assert.equal(smart("smart:proven", base), false);
  assert.equal(smart("smart:noname", base), true);
  const m = c.mergeInto({ ...base, firstName: "An", phone: "" }, { firstName: "Anna", phone: "0612345678", company: "Bakkerij" });
  assert.equal(m.contact.firstName, "An", "existing value kept");
  assert.equal(m.contact.phone, "0612345678");
  assert.deepEqual(m.changed, ["phone", "company"]);
  assert.equal(m.contact.status, "Ingeschreven", "consent untouched");
});

test("integration health: customer vs Mavix steps, missing permissions, optional extras", () => {
  const { healthFor } = pure("src/lib/integration-health.ts");
  assert.equal(healthFor({ provider: "gmail", platformReady: false, connection: null }).actor, "mavix");
  assert.equal(healthFor({ provider: "gmail", platformReady: true, connection: null }).state, "not_connected");
  const g = healthFor({ provider: "gmail", platformReady: true, connection: { status: "connected", scopes: ["https://www.googleapis.com/auth/gmail.send"], lastSyncedAt: null, expiresAt: null } });
  assert.equal(g.state, "attention");
  assert.deepEqual(g.missing, ["E-mail lezen"]);
  const ig = healthFor({ provider: "instagram", platformReady: true, connection: { status: "connected", scopes: ["instagram_basic", "instagram_manage_messages"], lastSyncedAt: null, expiresAt: null } });
  assert.equal(ig.state, "ready");
  assert.equal(ig.extras.find((x) => x.label === "Posts publiceren").granted, false);
  assert.equal(healthFor({ provider: "google_business", platformReady: true, connection: { status: "api_access_required", scopes: [], lastSyncedAt: null, expiresAt: null } }).actor, "mavix");
  assert.equal(healthFor({ provider: "messenger", platformReady: true, connection: { status: "reconnect_required", scopes: [], lastSyncedAt: null, expiresAt: null } }).next.label, "Opnieuw koppelen");
});

test("integration health route never exposes configuration names or tokens", async () => {
  process.env.GOOGLE_CLIENT_ID = "id";
  process.env.GOOGLE_CLIENT_SECRET = "secret-value-123";
  process.env.OAUTH_ENCRYPTION_KEY = Buffer.alloc(32).toString("base64");
  const e = env({ conns: [{ workspace_id: "w1", provider: "gmail", status: "connected", scopes: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"], last_synced_at: "2026-10-17T10:00:00Z", encrypted_credentials: "SECRET-CREDS" }] });
  const res = await e.load("src/app/api/integrations/health/route.ts").GET();
  const text = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!/SECRET-CREDS|secret-value|GOOGLE_CLIENT/.test(text));
  assert.equal(JSON.parse(text).health.find((h) => h.provider === "gmail").state, "ready");
});

test("dashboard to-dos flag broken connections for every provider first", () => {
  const { buildTodos } = pure("src/lib/dashboard-todos.ts");
  const todos = buildTodos({ brandScore: 50, review: { count: 0, href: "/" }, failed: { count: 0, href: "/" }, campaigns: 0, plannedThisWeek: 0, status: (p) => (p === "whatsapp" ? "reconnect_required" : "disconnected") });
  assert.equal(todos[0].id, "reconnect-whatsapp");
  assert.equal(todos[0].urgent, true);
});
