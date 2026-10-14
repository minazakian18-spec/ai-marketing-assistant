import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";
import { transition, allowedActions } from "../src/lib/applications.ts";

const origin = "https://mavix.webbo-solutions.nl";
const quiet = (t) => {
  t.mock.method(console, "info", () => {});
  t.mock.method(console, "error", () => {});
};

function setup({ user = null, users = [], tables = {} } = {}) {
  tables.platform_admins ??= [{ user_id: "admin1" }];
  tables.account_applications ??= [];
  tables.account_application_events ??= [];
  tables.workspaces ??= [{ id: "w9", name: "Pizzeria Test", deleted_at: null, access_status: "pending" }];
  tables.workspace_members ??= [{ workspace_id: "w9", user_id: "cust1", role: "OWNER", created_at: "1" }];
  tables.audit_logs ??= [];
  const db = memoryDb(tables, { uuid: true });
  const session = { user };
  db.auth = {
    getUser: async () => ({ data: { user: session.user ? { id: session.user } : null }, error: null }),
    admin: { listUsers: async () => ({ data: { users }, error: null }) },
  };
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
  });
  const pub = load("src/app/api/applications/route.ts");
  const admin = load("src/app/api/admin/applications/route.ts");
  const req = (url, method, body) => new Request(origin + url, { method, headers: { origin, "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
  return {
    tables,
    session,
    apply: async (body) => {
      const r = await pub.POST(req("/api/applications", "POST", body));
      return { status: r.status, body: await r.json() };
    },
    list: async () => {
      const r = await admin.GET();
      return { status: r.status, body: await r.json() };
    },
    act: async (id, action, extra = {}) => {
      const r = await admin.PATCH(req("/api/admin/applications", "PATCH", { id, action, ...extra }));
      return { status: r.status, body: await r.json() };
    },
  };
}
const demo = { kind: "demo", name: "Sanne de Vries", email: "Sanne@Pizzeria.test", company: "Pizzeria Test", consent: true };

test("rules: approval needs a completed demo, activation needs payment or a waiver, invalid steps are refused", () => {
  const base = { payment_status: "not_started", demo_completed_at: null };
  assert.equal(transition({ ...base, status: "application_pending" }, "approve").ok, false);
  assert.match(transition({ ...base, status: "application_pending" }, "approve").reason, /demo/);
  assert.deepEqual(transition({ ...base, status: "application_pending", demo_completed_at: "x" }, "approve"), { ok: true, to: "awaiting_payment", payment: undefined });
  assert.equal(transition({ ...base, status: "awaiting_payment" }, "activate").ok, false, "no activation before payment");
  assert.equal(transition({ ...base, status: "payment_confirmed", payment_status: "paid" }, "activate").ok, true);
  assert.equal(transition({ ...base, status: "payment_confirmed", payment_status: "failed" }, "activate").ok, false);
  assert.equal(transition({ ...base, status: "rejected" }, "activate").ok, false);
  assert.equal(transition({ ...base, status: "active" }, "approve").ok, false);
  // A direct application keeps its status when the demo is recorded.
  assert.deepEqual(transition({ ...base, status: "application_pending" }, "complete_demo"), { ok: true, to: "application_pending" });
  assert.deepEqual(allowedActions({ ...base, status: "demo_requested" }).sort(), ["complete_demo", "reject"]);
});

test("public demo request: stored for review, no account, no access, history recorded; e-mail honestly not sent without config", async (t) => {
  quiet(t);
  const env = setup();
  const r = await env.apply(demo);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  const [app] = env.tables.account_applications;
  assert.deepEqual([app.status, app.email, app.payment_status], ["demo_requested", "sanne@pizzeria.test", "not_started"]);
  assert.ok(app.consent_at);
  assert.equal(env.tables.workspaces[0].access_status, "pending", "no access granted");
  const notes = env.tables.account_application_events.map((e) => e.note);
  assert.ok(notes.includes("Demo aangevraagd"));
  assert.ok(notes.some((n) => /E-mail niet verstuurd \(e-mail niet geconfigureerd\)/.test(n)), "no false 'sent' claim");
});

test("public form: consent required, honeypot drops bots silently, closed switch, invalid input refused", async (t) => {
  quiet(t);
  const env = setup();
  assert.equal((await env.apply({ ...demo, consent: false })).status, 400);
  assert.equal((await env.apply({ ...demo, email: "geen-mail" })).status, 400);
  const bot = await env.apply({ ...demo, fax: "spam" });
  assert.equal(bot.status, 200);
  assert.equal(env.tables.account_applications.length, 0, "bot not stored");
  process.env.MAVIX_APPLICATIONS = "closed";
  try {
    assert.equal((await env.apply(demo)).status, 403);
  } finally {
    delete process.env.MAVIX_APPLICATIONS;
  }
  // A client cannot set a status or payment state.
  await env.apply({ ...demo, status: "active", payment_status: "paid" });
  assert.deepEqual([env.tables.account_applications[0].status, env.tables.account_applications[0].payment_status], ["demo_requested", "not_started"]);
});

test("an application after a demo request continues the same record", async (t) => {
  quiet(t);
  const env = setup();
  await env.apply(demo);
  await env.apply({ ...demo, kind: "application", plan: "growth" });
  assert.equal(env.tables.account_applications.length, 1);
  assert.deepEqual([env.tables.account_applications[0].status, env.tables.account_applications[0].plan], ["application_pending", "growth"]);
});

test("admin endpoints: only platform administrators; applicants cannot move their own application", async (t) => {
  quiet(t);
  const env = setup({ user: "cust1" });
  await env.apply({ ...demo, kind: "application", plan: "starter" });
  const id = env.tables.account_applications[0].id;
  assert.equal((await env.list()).status, 403);
  assert.equal((await env.act(id, "approve")).status, 403);
  env.session.user = null;
  assert.equal((await env.act(id, "activate")).status, 401);
  assert.equal(env.tables.account_applications[0].status, "application_pending");
});

test("full owner flow: demo -> approve -> waive payment -> activate approves the customer's own workspace, audited", async (t) => {
  quiet(t);
  const env = setup({ user: "admin1", users: [{ id: "cust1", email: "sanne@pizzeria.test" }] });
  await env.apply({ ...demo, kind: "application", plan: "starter" });
  const id = env.tables.account_applications[0].id;
  const early = await env.act(id, "approve");
  assert.equal(early.status, 409);
  assert.match(early.body.error, /demo/);
  assert.equal((await env.act(id, "complete_demo")).status, 200);
  assert.equal((await env.act(id, "approve")).body.status, "awaiting_payment");
  assert.equal((await env.act(id, "activate")).status, 409, "no activation before payment");
  assert.equal((await env.act(id, "waive_payment")).body.status, "payment_confirmed");
  const act = await env.act(id, "activate");
  assert.equal(act.status, 200);
  assert.equal(env.tables.workspaces[0].access_status, "approved");
  assert.equal(env.tables.account_applications[0].workspace_id, "w9");
  assert.equal(env.tables.account_applications[0].payment_status, "waived");
  assert.ok(env.tables.audit_logs.some((l) => l.event === "application_activate" && l.actor_id === "admin1"));
  const history = (await env.list()).body.applications[0].events.map((e) => e.to_status).filter((s) => s !== "email");
  assert.deepEqual(history, ["application_pending", "application_pending", "awaiting_payment", "payment_confirmed", "active"]);
});

test("activation without an existing account is refused with a clear next step", async (t) => {
  quiet(t);
  const env = setup({ user: "admin1", users: [] });
  await env.apply({ ...demo, kind: "application", plan: "starter" });
  const id = env.tables.account_applications[0].id;
  await env.act(id, "complete_demo");
  await env.act(id, "approve");
  await env.act(id, "confirm_payment_manually");
  const r = await env.act(id, "activate");
  assert.equal(r.status, 409);
  assert.match(r.body.error, /nog geen Mavix-account/);
  assert.equal(env.tables.account_applications[0].status, "payment_confirmed");
});

test("reject stores the reason and blocks further steps until reopened", async (t) => {
  quiet(t);
  const env = setup({ user: "admin1" });
  await env.apply(demo);
  const id = env.tables.account_applications[0].id;
  assert.equal((await env.act(id, "reject", { reason: "Buiten ons werkgebied" })).body.status, "rejected");
  assert.equal(env.tables.account_applications[0].rejection_reason, "Buiten ons werkgebied");
  assert.equal((await env.act(id, "approve")).status, 409);
  assert.equal((await env.act(id, "reopen")).body.status, "application_pending");
});

test("e-mail templates: Dutch, escaped HTML, plain-text fallback, idempotency key and retry", async (t) => {
  quiet(t);
  const load = serverLoader({ [path.resolve("src/lib/server/supabase.ts")]: { appUrl: () => origin } });
  const email = load("src/lib/server/email.ts");
  const r = email.render("application_rejected", { email: "a@b.test", name: "<script>x</script> Jan", reason: "Te <b>vroeg</b>" });
  const html = email.toHtml(r);
  assert.ok(!html.includes("<script>") && !html.includes("<b>vroeg"), "user data escaped");
  assert.match(email.toText(r), /Toelichting: Te <b>vroeg<\/b>/);
  assert.match(r.subject, /aanvraag/);
  for (const name of ["demo_received", "demo_confirmed", "application_received", "application_approved", "application_rejected", "payment_succeeded", "payment_failed", "account_activated", "security_alert"]) {
    const x = email.render(name, { email: "a@b.test", name: "Jan" });
    assert.ok(x.subject && x.paragraphs.length && !/wachtwoord:|token/i.test(email.toText(x)), name);
  }
  process.env.EMAIL_API_KEY = "re_test_fixture";
  process.env.EMAIL_FROM = "Mavix <noreply@example.test>";
  let calls = 0;
  const fetchMock = t.mock.method(globalThis, "fetch", async (_url, init) => {
    calls++;
    assert.equal(init.headers["Idempotency-Key"], "application-1-application_received");
    const body = JSON.parse(init.body);
    assert.ok(body.html && body.text);
    return new Response("{}", { status: calls === 1 ? 500 : 200 });
  });
  try {
    const sent = await email.sendTemplate("application_received", { email: "a@b.test", name: "Jan", plan: "growth" }, "application-1-application_received");
    assert.deepEqual(sent, { sent: true });
    assert.equal(calls, 2, "one retry after a 5xx");
  } finally {
    fetchMock.mock.restore();
    delete process.env.EMAIL_API_KEY;
    delete process.env.EMAIL_FROM;
  }
});
