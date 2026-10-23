import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { healthFor, STATUS_LABEL } from "../src/lib/integration-health.ts";
import { CAPABILITIES } from "../src/lib/agent/capabilities.ts";

// Phase 3: one status vocabulary for every integration. Connected is not the
// same as "everything is allowed": missing permissions make it "Beperkt".

const conn = (status, scopes = [], extra = {}) => ({ status, scopes, lastSyncedAt: null, expiresAt: null, ...extra });
const s = (f) => {
  const h = healthFor(f);
  return [h.status, h.statusLabel];
};

test("every state maps to exactly one Dutch status label", () => {
  const GMAIL = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"];
  assert.deepEqual(s({ provider: "gmail", platformReady: true, connection: conn("connected", GMAIL) }), ["connected", "Verbonden"]);
  assert.deepEqual(s({ provider: "gmail", platformReady: true, connection: conn("connected", [GMAIL[0]]) }), ["limited", "Beperkt"]);
  assert.deepEqual(s({ provider: "google_business", platformReady: true, connection: conn("selection_required") }), ["action", "Actie nodig"]);
  assert.deepEqual(s({ provider: "instagram", platformReady: true, connection: conn("reconnect_required") }), ["reconnect", "Opnieuw koppelen"]);
  assert.deepEqual(s({ provider: "google_business", platformReady: true, connection: conn("api_access_required") }), ["waiting", "Wacht op provider"]);
  assert.deepEqual(s({ provider: "messenger", platformReady: false, connection: null }), ["not_configured", "Nog niet ingericht"]);
  assert.deepEqual(s({ provider: "google_ads", platformReady: false, connection: null }), ["coming_soon", "Binnenkort"]);
  assert.deepEqual(s({ provider: "google_calendar", platformReady: true, connection: null }), ["not_connected", "Niet gekoppeld"]);
  assert.equal(new Set(Object.values(STATUS_LABEL)).size, Object.keys(STATUS_LABEL).length, "no two states share a label");
});

test("a connected Instagram account without publish permission is not presented as able to publish", () => {
  const h = healthFor({ provider: "instagram", platformReady: true, connection: conn("connected", ["instagram_business_basic", "instagram_business_manage_messages"]) });
  assert.equal(h.status, "connected");
  const publish = h.extras.find((x) => x.label === "Posts publiceren");
  assert.equal(publish.granted, false);
  assert.match(publish.note, /goedkeuring van Meta/);
});

test("Google Ads and Google Business Profile are separate: Ads is in development, GBP waits for its own API approval", () => {
  const ads = healthFor({ provider: "google_ads", platformReady: true, connection: null });
  assert.equal(ads.status, "coming_soon");
  assert.match(ads.summary, /Google Ads API/);
  const gbp = healthFor({ provider: "google_business", platformReady: true, connection: conn("api_access_required") });
  assert.equal(gbp.status, "waiting");
  assert.equal(gbp.actor, "mavix");
  assert.doesNotMatch(gbp.summary, /Ads/);
});

test("e-mail sending reports the platform switch honestly, without a customer OAuth step", () => {
  const off = healthFor({ provider: "email_sending", platformReady: false, pendingApproval: "Testmails werken. Echte campagnes versturen staat nog uit.", connection: null });
  assert.deepEqual([off.status, off.actor, off.next], ["not_configured", "mavix", null]);
  assert.match(off.summary, /Testmails werken/);
  assert.equal(healthFor({ provider: "email_sending", platformReady: true, connection: null }).status, "connected");
});

/* ---------------- AI action safety ---------------- */



test("Mavix Agent: only reading tools plus one proposal tool; nothing that publishes, sends, schedules or deletes", () => {
  const src = fs.readFileSync("src/lib/server/agent/tools.ts", "utf8");
  const tools = [...src.matchAll(/name:\s*"([a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(tools.length >= 10);
  for (const t of tools) assert.match(t, /^(get_|list_|search_|prepare_)/, t + " must read or prepare, not act");
  // Reading the planning (get_schedule) is fine; acting on it is not.
  assert.ok(!tools.filter((t) => !/^(get_|list_|search_)/.test(t)).some((t) => /publish|send|delete|remove|schedule|post|reply/.test(t)));
  assert.deepEqual(tools.filter((t) => t.startsWith("prepare_")), ["prepare_campaign_drafts"]);
  // The registry the model sees says the same.
  const writes = CAPABILITIES.filter((c) => c.kind === "write");
  assert.deepEqual(writes.filter((c) => c.status === "available").map((c) => c.id), ["save_campaign_drafts"]);
  assert.equal(CAPABILITIES.find((c) => c.id === "publish_or_send").status, "unavailable");
});

test("Mavix Agent: a write is a proposal that needs an owner/admin confirmation and expires", () => {
  const src = fs.readFileSync("src/lib/server/agent/actions.ts", "utf8");
  assert.match(src, /WRITE_ROLES: Role\[\] = \["OWNER", "ADMIN"\]/);
  assert.match(src, /expires_at: new Date\(now\.getTime\(\) \+ 24 \* 3600_000\)/);
  assert.match(src, /Idempotent: a repeated confirm of a finished action returns its result/);
});