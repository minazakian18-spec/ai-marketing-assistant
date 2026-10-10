import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";
import { mergeSubscribers, normalizeEmail, isNewsletterContact } from "../src/lib/newsletter.ts";
import { contactValid } from "../src/lib/contact-data.ts";
import { toImportedContacts } from "../src/lib/contact-import.ts";

const origin = "https://mavix.webbo-solutions.nl";
const KEY_A = "formkeyAAAAAAAAAAAAAAAAAAAAAAAA";
const KEY_B = "formkeyBBBBBBBBBBBBBBBBBBBBBBBB";
const sub = (over = {}) => ({
  id: "s-" + Math.random().toString(16).slice(2),
  email: "sanne@example.com",
  name: "Sanne de Vries",
  status: "subscribed",
  source: "form",
  subscribed_at: "2026-10-09T10:00:00.000Z",
  unsubscribed_at: null,
  privacy_policy_version: "2",
  created_at: "2026-10-09T10:00:00.000Z",
  ...over,
});
const contact = (over = {}) => ({ id: "c1", firstName: "", lastName: "", email: "x@example.com", status: "Niet bevestigd", source: "manual", createdAt: "2026-01-01T00:00:00.000Z", ...over });

// ---------------------------------------------------------------- Pure merge

test("merge: an existing contact with the same normalized e-mail is updated, never duplicated", () => {
  const existing = [contact({ id: "c1", email: "  Sanne@Example.COM ", firstName: "Sanne", group: "Vaste klanten" })];
  const { contacts, changed } = mergeSubscribers(existing, [sub()], () => "new");
  assert.equal(changed, true);
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].id, "c1");
  assert.equal(contacts[0].status, "Ingeschreven");
  assert.equal(contacts[0].group, "Vaste klanten", "existing group kept");
  assert.equal(contacts[0].firstName, "Sanne", "existing name kept");
  assert.equal(contacts[0].newsletter.status, "subscribed");
  assert.equal(contacts[0].newsletter.privacyPolicyVersion, "2");
  assert.equal(existing[0].status, "Niet bevestigd", "input not mutated");
});

test("merge: new subscribers become newsletter contacts; repeated rows in one batch do not duplicate", () => {
  let n = 0;
  const { contacts } = mergeSubscribers([], [sub(), sub({ email: "SANNE@example.com", status: "unsubscribed", unsubscribed_at: "2026-10-10T00:00:00.000Z" }), sub({ email: "daan@example.com", name: "Daan" })], () => "new-" + n++);
  assert.equal(contacts.length, 2);
  const sanne = contacts.find((c) => c.email === "sanne@example.com");
  assert.deepEqual([sanne.firstName, sanne.lastName, sanne.source, sanne.group, sanne.status], ["Sanne", "de Vries", "newsletter", "Nieuwsbrieflezers", "Uitgeschreven"]);
  assert.ok(contacts.every(isNewsletterContact));
  assert.ok(contacts.every((c) => contactValid(c)), "merged contacts pass workspace validation");
});

test("merge: nothing changes -> same array, changed=false; pending maps to Niet bevestigd", () => {
  const first = mergeSubscribers([], [sub({ status: "pending", subscribed_at: null })], () => "x");
  assert.equal(first.contacts[0].status, "Niet bevestigd");
  const again = mergeSubscribers(first.contacts, [sub({ id: first.contacts[0].newsletter.subscriberId, status: "pending", subscribed_at: null })], () => "y");
  assert.equal(again.changed, false);
  assert.equal(again.contacts, first.contacts);
  assert.equal(normalizeEmail("  A@B.NL "), "a@b.nl");
});

test("contacts: imports and validation do not assume marketing consent", () => {
  const rows = [{ data: { email: "a@example.com", firstName: "A" }, status: "valid" }];
  assert.equal(toImportedContacts(rows)[0].status, "Niet bevestigd");
  assert.equal(toImportedContacts(rows, true)[0].status, "Ingeschreven");
  assert.equal(contactValid(contact({ source: "newsletter", newsletter: { subscriberId: "s1", status: "subscribed", source: "form" } })), true);
  assert.equal(contactValid(contact({ newsletter: { subscriberId: "s1", status: "maybe", source: "form" } })), false);
});

// ---------------------------------------------------------------- Server

function setup(t, { forms, email = false } = {}) {
  process.env.OAUTH_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
  if (email) {
    process.env.EMAIL_API_KEY = "re_fixture";
    process.env.EMAIL_FROM = "Mavix <noreply@example.com>";
  } else {
    delete process.env.EMAIL_API_KEY;
    delete process.env.EMAIL_FROM;
  }
  const tables = {
    workspace_members: [
      { user_id: "u1", workspace_id: "w1", role: "OWNER" },
      { user_id: "u2", workspace_id: "w2", role: "OWNER" },
      { user_id: "u3", workspace_id: "w1", role: "MEMBER" },
    ],
    workspaces: [{ id: "w1", deleted_at: null }, { id: "w2", deleted_at: null }],
    profiles: [{ id: "u1", full_name: "Eigenaar" }, { id: "u2", full_name: "Ander" }, { id: "u3", full_name: "Lid" }],
    business_profiles: [
      { workspace_id: "w1", version: 3, data: { profile: { name: "Trattoria Gouda" }, posts: [], contacts: [contact({ id: "c-sanne", email: "SANNE@example.com", firstName: "Sanne", status: "Niet bevestigd" })] } },
      { workspace_id: "w2", version: 1, data: { profile: { name: "Bakkerij Delft" }, posts: [], contacts: [] } },
    ],
    newsletter_forms: forms ?? [
      { id: "f-a", workspace_id: "w1", public_key: KEY_A, name: "Website", consent_text: "Ja, ik wil de nieuwsbrief van Trattoria Gouda ontvangen.", privacy_policy_url: "https://trattoria.example/privacy", privacy_policy_version: "2", allowed_origins: [], redirect_url: null, double_opt_in: false, active: true },
      { id: "f-b", workspace_id: "w2", public_key: KEY_B, name: "Website", consent_text: "Ja, ik wil de nieuwsbrief van Bakkerij Delft ontvangen.", privacy_policy_url: null, privacy_policy_version: "1", allowed_origins: ["https://bakkerij.example"], redirect_url: "https://bakkerij.example/bedankt", double_opt_in: false, active: true },
    ],
    newsletter_subscribers: [],
    newsletter_consent_events: [],
    email_suppressions: [],
    audit_logs: [],
  };
  const db = memoryDb(tables);
  const state = { user: { id: "u1" } };
  db.auth = { getUser: async () => ({ data: { user: { ...state.user, email: state.user.id + "@example.com" } }, error: null }) };
  const sent = [];
  const logs = [];
  for (const level of ["error", "warn", "info"]) t.mock.method(console, level, (line) => logs.push(String(line)));
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    [path.resolve("src/lib/server/notifications.ts")]: { emailProvider: { send: async (to, subject, text) => (sent.push({ to, subject, text }), { id: "mail" }) } },
    "next/headers": { cookies: async () => ({ get: () => undefined, set() {}, delete() {} }) },
  });
  const subscribeRoute = load("src/app/api/newsletter/subscribe/route.ts");
  const unsubscribeRoute = load("src/app/api/newsletter/unsubscribe/route.ts");
  const confirmRoute = load("src/app/api/newsletter/confirm/route.ts");
  const formsRoute = load("src/app/api/newsletter/forms/route.ts");
  const subscriberRoute = load("src/app/api/newsletter/subscribers/[id]/route.ts");
  const workspaceRoute = load("src/app/api/workspace/route.ts");
  const lib = load("src/lib/server/newsletter.ts");
  const headers = { "x-forwarded-for": "203.0.113.9, 10.0.0.1", "user-agent": "Mozilla/5.0 fixture" };
  const json = (body, extra = {}) =>
    subscribeRoute.POST(new Request(origin + "/api/newsletter/subscribe", { method: "POST", headers: { ...headers, "Content-Type": "application/json", ...extra }, body: JSON.stringify(body) }));
  const formPost = (fields, extra = {}) =>
    subscribeRoute.POST(new Request(origin + "/api/newsletter/subscribe", { method: "POST", headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded", ...extra }, body: new URLSearchParams(fields) }));
  const as = (user) => (state.user = { id: user });
  const workspaceGet = () => workspaceRoute.GET();
  const workspacePut = (data, version) =>
    workspaceRoute.PUT(new Request(origin + "/api/workspace", { method: "PUT", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ data, version }) }));
  return { tables, db, state, sent, logs, lib, json, formPost, as, unsubscribeRoute, confirmRoute, formsRoute, subscriberRoute, workspaceGet, workspacePut, headers };
}
const subs = (f, ws) => f.tables.newsletter_subscribers.filter((s) => !ws || s.workspace_id === ws);
// memoryDb generates "id-N"; Supabase uses UUIDs (which the routes validate).
function uuidify(f) {
  for (const s of f.tables.newsletter_subscribers) {
    if (/^[0-9a-f-]{36}$/.test(s.id)) continue;
    const id = crypto.randomUUID();
    for (const e of f.tables.newsletter_consent_events) if (e.subscriber_id === s.id) e.subscriber_id = id;
    s.id = id;
  }
}

test("signup stores one normalized subscriber per workspace with consent evidence (no raw IP)", async (t) => {
  const f = setup(t);
  const res = await f.json({ form: KEY_A, email: " Sanne@Example.com ", name: "Sanne", consent: true, page: "https://trattoria.example/nieuwsbrief" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, status: "subscribed" });
  const [s] = subs(f);
  assert.deepEqual([s.workspace_id, s.email_normalized, s.status, s.privacy_policy_version, s.synced_at], ["w1", "sanne@example.com", "subscribed", "2", null]);
  assert.ok(s.subscribed_at);
  const [e] = f.tables.newsletter_consent_events;
  assert.deepEqual([e.event, e.method, e.consent_text, e.privacy_policy_version, e.page_url], ["subscribe", "form", "Ja, ik wil de nieuwsbrief van Trattoria Gouda ontvangen.", "2", "https://trattoria.example/nieuwsbrief"]);
  assert.ok(e.ip_hash && !e.ip_hash.includes("203.0.113.9"), "IP only as keyed hash");
  assert.ok(!JSON.stringify(f.tables).includes("203.0.113.9"));
  // Same person again (other casing): still one subscriber, a second consent record.
  assert.equal((await f.json({ form: KEY_A, email: "SANNE@example.com", consent: "on" })).status, 200);
  assert.equal(subs(f).length, 1);
  assert.equal(f.tables.newsletter_consent_events.length, 2);
  assert.ok(!f.logs.some((l) => l.includes("sanne@example.com")), "no addresses in logs");
});

test("signup is refused without explicit consent, with a bad address, an unknown/paused form or a foreign website", async (t) => {
  const f = setup(t);
  assert.equal((await f.json({ form: KEY_A, email: "a@example.com" })).status, 400, "no consent");
  assert.equal((await f.json({ form: KEY_A, email: "a@example.com", consent: "no" })).status, 400);
  assert.equal((await f.json({ form: KEY_A, email: "geen-email", consent: true })).status, 400);
  assert.equal((await f.json({ form: "unknownkeyXXXXXXXXXXXXXXXXXX", email: "a@example.com", consent: true })).status, 400);
  f.tables.newsletter_forms[0].active = false;
  assert.equal((await f.json({ form: KEY_A, email: "a@example.com", consent: true })).status, 400, "paused form");
  assert.equal((await f.json({ form: KEY_B, email: "a@example.com", consent: true }, { origin: "https://evil.example" })).status, 403, "origin not allowed");
  assert.equal(subs(f).length, 0);
});

test("honeypot submissions look successful but store nothing", async (t) => {
  const f = setup(t);
  const res = await f.json({ form: KEY_A, email: "bot@example.com", consent: true, website: "http://spam" });
  assert.equal(res.status, 200);
  assert.equal(subs(f).length, 0);
});

test("plain HTML form posts redirect; allowed websites and own thank-you page work", async (t) => {
  const f = setup(t);
  const a = await f.formPost({ form: KEY_A, email: "noor@example.com", consent: "yes" });
  assert.equal(a.status, 303);
  assert.equal(a.headers.get("location"), origin + "/nieuwsbrief/status?s=subscribed");
  const b = await f.formPost({ form: KEY_B, email: "noor@example.com", consent: "yes" }, { origin: "https://bakkerij.example" });
  assert.equal(b.headers.get("location"), "https://bakkerij.example/bedankt");
  const bad = await f.formPost({ form: KEY_A, email: "noor@example.com" });
  assert.equal(bad.headers.get("location"), origin + "/nieuwsbrief/status?s=invalid");
  // Same address in two businesses: two separate subscribers, one per workspace.
  assert.deepEqual(subs(f).map((s) => s.workspace_id).sort(), ["w1", "w2"]);
});

test("unsubscribe link: suppresses (hashed), records the event; tampered links do nothing; re-subscribing is a new opt-in", async (t) => {
  const f = setup(t);
  await f.json({ form: KEY_A, email: "milan@example.com", consent: true });
  uuidify(f);
  const s = subs(f)[0];
  const token = f.lib.unsubscribeToken(s.id);
  const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
  const bad = await f.unsubscribeRoute.POST(new Request(origin + "/api/newsletter/unsubscribe", { method: "POST", headers: f.headers, body: new URLSearchParams({ token: tampered }) }));
  assert.match(bad.headers.get("location"), /s=invalid_link/);
  assert.equal(subs(f)[0].status, "subscribed");

  const res = await f.unsubscribeRoute.POST(new Request(origin + "/api/newsletter/unsubscribe", { method: "POST", headers: f.headers, body: new URLSearchParams({ token }) }));
  assert.match(res.headers.get("location"), /s=unsubscribed$/);
  assert.equal(subs(f)[0].status, "unsubscribed");
  assert.equal(subs(f)[0].synced_at, null, "contacts will pick up the change");
  const [sup] = f.tables.email_suppressions;
  assert.equal(sup.reason, "unsubscribed");
  assert.ok(!sup.email_hash.includes("milan"));
  assert.deepEqual(f.tables.newsletter_consent_events.map((e) => e.event), ["subscribe", "unsubscribe"]);

  // RFC 8058 one-click from a mail client.
  const one = await f.unsubscribeRoute.POST(
    new Request(origin + "/api/newsletter/unsubscribe?token=" + encodeURIComponent(token), { method: "POST", headers: { ...f.headers, "Content-Type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" }),
  );
  assert.equal(one.status, 200);

  await f.json({ form: KEY_A, email: "milan@example.com", consent: true });
  assert.equal(subs(f)[0].status, "subscribed");
  assert.equal(f.tables.email_suppressions.length, 0, "a new explicit opt-in lifts the suppression");
});

test("double opt-in: pending until confirmed through the e-mailed link; tokens are single use", async (t) => {
  const f = setup(t);
  f.tables.newsletter_forms[0].double_opt_in = true;
  const blocked = await f.json({ form: KEY_A, email: "eva@example.com", consent: true });
  assert.equal(blocked.status, 503, "no e-mail provider: no silent single opt-in");
  assert.equal(f.sent.length, 0);

  const g = setup(t, { email: true });
  g.tables.newsletter_forms[0].double_opt_in = true;
  const res = await g.json({ form: KEY_A, email: "eva@example.com", consent: true });
  assert.deepEqual(await res.json(), { ok: true, status: "pending" });
  assert.equal(subs(g)[0].status, "pending");
  assert.equal(g.sent.length, 1);
  assert.equal(g.sent[0].to, "eva@example.com");
  const link = g.sent[0].text.match(/https:\/\/\S+/)[0];
  assert.ok(link.startsWith(origin + "/nieuwsbrief/bevestigen?token="));
  const token = new URL(link).searchParams.get("token");
  assert.ok(!JSON.stringify(g.tables.newsletter_subscribers).includes(token), "only a hash of the token is stored");
  // A second signup within 5 minutes does not send another e-mail.
  await g.json({ form: KEY_A, email: "eva@example.com", consent: true });
  assert.equal(g.sent.length, 1);

  const confirm = (tok) => g.confirmRoute.POST(new Request(origin + "/api/newsletter/confirm", { method: "POST", headers: g.headers, body: new URLSearchParams({ token: tok }) }));
  assert.match((await confirm(token)).headers.get("location"), /s=confirmed$/);
  assert.equal(subs(g)[0].status, "subscribed");
  assert.ok(subs(g)[0].confirmed_at);
  assert.match((await confirm(token)).headers.get("location"), /s=expired$/, "single use");
});

test("contacts sync on workspace load: no duplicates, status updated, version bumped once", async (t) => {
  const f = setup(t);
  await f.json({ form: KEY_A, email: "sanne@example.com", name: "Sanne", consent: true });
  await f.json({ form: KEY_A, email: "daan@example.com", name: "Daan Bakker", consent: true });
  await f.json({ form: KEY_B, email: "other@example.com", consent: true }); // other workspace

  const res = await f.workspaceGet();
  const body = await res.json();
  assert.equal(body.version, 4);
  const contacts = body.data.contacts;
  assert.equal(contacts.length, 2, "Sanne merged into the existing contact, Daan added");
  const sanne = contacts.find((c) => c.id === "c-sanne");
  assert.deepEqual([sanne.status, sanne.newsletter.status], ["Ingeschreven", "subscribed"]);
  const daan = contacts.find((c) => c.email === "daan@example.com");
  assert.deepEqual([daan.firstName, daan.lastName, daan.source], ["Daan", "Bakker", "newsletter"]);
  assert.ok(!contacts.some((c) => c.email === "other@example.com"), "never another workspace's subscribers");
  assert.ok(subs(f, "w1").every((s) => s.synced_at), "marked as synced");
  assert.equal(subs(f, "w2")[0].synced_at, null);

  const again = await (await f.workspaceGet()).json();
  assert.equal(again.version, 4, "nothing new: no extra save");
});

test("contacts sync is skipped safely when the newsletter tables do not exist yet", async (t) => {
  const f = setup(t);
  f.tables.failTable = "newsletter_subscribers";
  const body = await (await f.workspaceGet()).json();
  assert.equal(body.version, 3);
  assert.equal(body.data.contacts.length, 1);
});

test("workspace saves: unsubscribing a contact suppresses it; suppressed addresses cannot be set back to Ingeschreven", async (t) => {
  const f = setup(t);
  await f.json({ form: KEY_A, email: "sanne@example.com", consent: true });
  const loaded = await (await f.workspaceGet()).json();
  const sanne = loaded.data.contacts.find((c) => c.id === "c-sanne");

  const off = structuredClone(loaded.data);
  off.contacts = off.contacts.map((c) => (c.id === "c-sanne" ? { ...c, status: "Uitgeschreven" } : c));
  assert.equal((await f.workspacePut(off, loaded.version)).status, 200);
  assert.equal(subs(f)[0].status, "unsubscribed");
  assert.equal(f.tables.email_suppressions.length, 1);
  assert.equal(f.tables.newsletter_consent_events.at(-1).method, "mavix_user");

  const on = structuredClone(off);
  on.contacts = on.contacts.map((c) => (c.id === sanne.id ? { ...c, status: "Ingeschreven" } : c));
  const refused = await f.workspacePut(on, loaded.version + 1);
  assert.equal(refused.status, 409);
  assert.match((await refused.json()).error, /afgemeld/);

  // A manual contact marked "Uitgeschreven" is suppressed too.
  const manual = structuredClone(off);
  manual.contacts.push(contact({ id: "c-new", email: "jan@example.com", status: "Niet bevestigd" }));
  assert.equal((await f.workspacePut(manual, loaded.version + 1)).status, 200);
  const manualOff = structuredClone(manual);
  manualOff.contacts = manualOff.contacts.map((c) => (c.id === "c-new" ? { ...c, status: "Uitgeschreven" } : c));
  assert.equal((await f.workspacePut(manualOff, loaded.version + 2)).status, 200);
  assert.deepEqual(f.tables.email_suppressions.map((s) => s.reason).sort(), ["manual", "unsubscribed"]);
});

test("GDPR erasure removes the subscriber but keeps a hashed suppression; members cannot erase", async (t) => {
  const f = setup(t);
  await f.json({ form: KEY_A, email: "sanne@example.com", consent: true });
  uuidify(f);
  const id = subs(f)[0].id;
  const call = (method, user) => {
    f.as(user);
    return f.subscriberRoute[method](new Request(origin + "/api/newsletter/subscribers/" + id, { method, headers: { origin } }), { params: Promise.resolve({ id }) });
  };
  const detail = await (await call("GET", "u3")).json();
  assert.equal(detail.events[0].consent_text, "Ja, ik wil de nieuwsbrief van Trattoria Gouda ontvangen.");
  // memoryDb ignores column lists; the route must not even ask for ip_hash.
  assert.ok(!fs.readFileSync("src/app/api/newsletter/subscribers/[id]/route.ts", "utf8").includes("ip_hash"));
  assert.equal((await call("DELETE", "u3")).status, 403);
  assert.equal((await call("GET", "u2")).status, 404, "other workspace cannot see it");
  assert.equal((await call("DELETE", "u2")).status, 404, "other workspace cannot erase it");
  assert.equal((await call("DELETE", "u1")).status, 200);
  assert.equal(subs(f).length, 0);
  assert.deepEqual(f.tables.email_suppressions.map((s) => s.reason), ["erased"]);
});

test("forms API: owners create forms; members cannot; double opt-in needs e-mail; origins are validated", async (t) => {
  const f = setup(t, { forms: [] });
  const create = (body, user = "u1") => {
    f.as(user);
    return f.formsRoute.POST(new Request(origin + "/api/newsletter/forms", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  };
  const valid = { name: "Website", consentText: "Ja, ik wil de nieuwsbrief ontvangen.", privacyPolicyVersion: "1", allowedOrigins: ["https://trattoria.example"] };
  assert.equal((await create(valid, "u3")).status, 403);
  assert.equal((await create({ ...valid, doubleOptIn: true })).status, 400);
  assert.equal((await create({ ...valid, allowedOrigins: ["https://trattoria.example/pad"] })).status, 400);
  assert.equal((await create({ ...valid, allowedOrigins: ["http://evil.example"] })).status, 400);
  const res = await create(valid);
  assert.equal(res.status, 200);
  const form = (await res.json()).form;
  assert.match(form.public_key, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(f.tables.newsletter_forms[0].workspace_id, "w1");
  f.as("u2");
  const list = await (await f.formsRoute.GET()).json();
  assert.equal(list.forms.length, 0, "other workspace sees none");
});
