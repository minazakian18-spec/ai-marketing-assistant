import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";

// Phase 6: billing safety (no accidental payments), beta vs paid state,
// deactivation guard, admin authorization and data exposure.

const origin = "https://mavix.webbo-solutions.nl";

test("billing state: beta is not a paid subscription; checkout only when enabled and approved", () => {
  const b = serverLoader({})("src/lib/billing-state.ts");
  assert.equal(b.billingState(null), "beta");
  assert.equal(b.billingState({ plan: null, status: "incomplete", billing_interval: null, current_period_end: null }), "beta", "a customer record alone is not a subscription");
  assert.equal(b.billingState({ plan: "growth", status: "active", billing_interval: "month", current_period_end: null }), "active");
  assert.equal(b.billingState({ plan: "growth", status: "unpaid", billing_interval: "month", current_period_end: null }), "past_due");
  assert.equal(b.checkoutAllowed({ enabled: false, approved: true, state: "beta" }), false);
  assert.equal(b.checkoutAllowed({ enabled: true, approved: false, state: "beta" }), false);
  assert.equal(b.checkoutAllowed({ enabled: true, approved: true, state: "active" }), false, "no second subscription");
  assert.equal(b.checkoutAllowed({ enabled: true, approved: true, state: "beta" }), true);
});

function env({ user = "u1", tables = {}, stripeCalls = [] } = {}) {
  tables.workspace_members ??= [{ user_id: "u1", workspace_id: "w1", role: "OWNER", created_at: "1" }, { user_id: "u2", workspace_id: "w1", role: "ADMIN", created_at: "1" }];
  tables.workspaces ??= [{ id: "w1", name: "Telepizza", deleted_at: null, access_status: "approved", created_at: "1" }];
  tables.subscriptions ??= [];
  tables.audit_logs ??= [];
  tables.business_profiles ??= [{ workspace_id: "w1", data: {} }];
  tables.platform_admins ??= [];
  const db = memoryDb(tables, { uuid: true });
  db.auth = { getUser: async () => ({ data: { user: user ? { id: user, email: user + "@x.test" } : null }, error: null }), admin: { getUserById: async () => ({ data: { user: { email: "owner@x.test" } } }) } };
  db.rpc = async () => ({ data: true, error: null });
  const fakeStripe = { customers: { create: async () => (stripeCalls.push("customer"), { id: "cus_1" }) }, checkout: { sessions: { create: async (p) => (stripeCalls.push(p), { url: "https://checkout.stripe.test/s" }) } }, billingPortal: { sessions: { create: async () => ({ url: "https://billing.stripe.test" }) } }, invoices: { list: async () => ({ data: [] }) } };
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    [path.resolve("src/lib/server/billing.ts")]: { stripe: () => fakeStripe, priceId: (p, i) => "price_" + p + "_" + i },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
  });
  return { load, tables, stripeCalls };
}
const post = (route, body, url = "/api/billing") => route.POST(new Request(origin + url, { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }));

test("checkout is refused while paid plans are closed; nothing is created at Stripe", async (t) => {
  t.mock.method(console, "error", () => {});
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  delete process.env.BILLING_CHECKOUT_ENABLED;
  const e = env();
  const r = await post(e.load("src/app/api/billing/route.ts"), { action: "checkout", plan: "growth", interval: "month" });
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /nog niet open/);
  assert.equal(e.stripeCalls.length, 0);
});

test("checkout when enabled: owner only, dashboard payment methods (iDEAL possible), workspace metadata", async (t) => {
  t.mock.method(console, "error", () => {});
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  process.env.BILLING_CHECKOUT_ENABLED = "1";
  try {
    const admin = env({ user: "u2" });
    assert.equal((await post(admin.load("src/app/api/billing/route.ts"), { action: "checkout", plan: "growth", interval: "month" })).status, 403);
    const e = env();
    const route = e.load("src/app/api/billing/route.ts");
    assert.equal((await post(route, { action: "checkout", plan: "enterprise", interval: "month" })).status, 400);
    const r = await post(route, { action: "checkout", plan: "growth", interval: "month" });
    assert.equal(r.status, 200);
    const session = e.stripeCalls.find((c) => typeof c === "object");
    assert.equal(session.payment_method_types, undefined, "no card-only restriction");
    assert.equal(session.subscription_data.metadata.workspace_id, "w1");
    assert.equal(e.tables.subscriptions[0].status ?? "incomplete", "incomplete", "nothing activated by the browser");
  } finally {
    delete process.env.BILLING_CHECKOUT_ENABLED;
  }
});

test("billing overview: beta workspaces show beta and no checkout", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  const e = env();
  const d = await (await e.load("src/app/api/billing/route.ts").GET()).json();
  assert.equal(d.state, "beta");
  assert.equal(d.checkout, false);
});

test("deactivating a workspace with a running paid subscription is refused", async (t) => {
  t.mock.method(console, "error", () => {});
  const e = env({ tables: { subscriptions: [{ workspace_id: "w1", plan: "growth", status: "active" }] } });
  const r = await post(e.load("src/app/api/privacy/route.ts"), { confirm: "VERWIJDER WERKRUIMTE" }, "/api/privacy");
  assert.equal(r.status, 409);
  assert.equal(e.tables.workspaces[0].deleted_at, null);
});

test("admin overview: platform admins only; billing and integration status without secrets", async (t) => {
  t.mock.method(console, "error", () => {});
  const normal = env();
  assert.equal((await normal.load("src/app/api/admin/workspaces/route.ts").GET()).status, 403);
  const e = env({ tables: { platform_admins: [{ user_id: "u1" }], integration_connections: [{ workspace_id: "w1", provider: "gmail", status: "connected", encrypted_credentials: "SECRET" }, { workspace_id: "w1", provider: "instagram", status: "reconnect_required" }], ai_usage: [], audit_logs: [{ workspace_id: "w1", event: "beta_access_approved", created_at: "2026-10-17T10:00:00Z" }] } });
  const res = await e.load("src/app/api/admin/workspaces/route.ts").GET();
  const text = await res.text();
  assert.equal(res.status, 200, text);
  assert.ok(!text.includes("SECRET"));
  const d = JSON.parse(text);
  assert.equal(d.workspaces[0].billing, "beta");
  assert.deepEqual(d.workspaces[0].integrations, { connected: ["gmail"], attention: ["instagram"] });
  assert.equal(d.audit[0].event, "beta_access_approved");
});
