import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";
import { healthFor } from "../src/lib/integration-health.ts";
import { scheduleState, postTitle } from "../src/lib/instagram-publish.ts";

// P0-1: a real check per Google connection (token refresh at Google), only
// invalid_grant marks a connection as expired, owners get a notification.
// P0-2: one definition of upcoming / missed for scheduled posts.

const origin = "https://mavix.webbo-solutions.nl";
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });

function setup(t, grant = "ok") {
  process.env.GOOGLE_CLIENT_ID = "client-fixture";
  process.env.GOOGLE_CLIENT_SECRET = "secret-fixture";
  process.env.OAUTH_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  delete process.env.EMAIL_API_KEY;
  const tables = {
    workspace_members: [
      { user_id: "u1", workspace_id: "w1", role: "OWNER" },
      { user_id: "u2", workspace_id: "w1", role: "MEMBER" },
    ],
    integration_connections: [],
    notifications: [],
  };
  const db = memoryDb(tables, { uuid: true });
  const load = serverLoader({ [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin } });
  const { encrypt, decrypt } = load("src/lib/server/crypto.ts");
  for (const provider of ["gmail", "google_search_console"])
    tables.integration_connections.push({
      id: "c-" + provider,
      workspace_id: "w1",
      provider,
      status: "connected",
      connection_generation: "g1",
      encrypted_credentials: encrypt({ access_token: "old-access", refresh_token: "refresh-fixture", expires_in: 3600 }, "w1:" + provider),
      metadata: {},
    });
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init = {}) => {
    calls.push(String(url));
    if (String(url) === "https://oauth2.googleapis.com/token") {
      if (grant === "ok") return reply({ access_token: "new-access", expires_in: 3599, token_type: "Bearer" });
      if (grant === "revoked") return reply({ error: "invalid_grant" }, 400);
      return reply({ error: "backend_error" }, 503);
    }
    throw new Error("unexpected " + url);
  });
  t.mock.method(console, "info", () => {});
  return { tables, load, decrypt, calls, health: load("src/lib/server/google-health.ts") };
}

test("google check: a working grant stores the fresh token and records the check", async (t) => {
  const f = setup(t);
  const out = await f.health.checkWorkspaceGoogle("w1");
  assert.deepEqual(out, { gmail: "ok", google_search_console: "ok" });
  const c = f.tables.integration_connections[0];
  assert.equal(c.status, "connected");
  assert.equal(f.decrypt(c.encrypted_credentials, "w1:gmail").access_token, "new-access");
  assert.equal(f.decrypt(c.encrypted_credentials, "w1:gmail").refresh_token, "refresh-fixture", "the refresh token is kept");
  assert.equal(c.metadata.check.ok, true);
  assert.ok(!JSON.stringify(c.metadata).includes("access"), "no token in metadata");
  assert.equal(f.tables.notifications.length, 0);
});

test("google check: only invalid_grant means reconnect; owners and admins get one notification", async (t) => {
  const f = setup(t, "revoked");
  await f.health.checkWorkspaceGoogle("w1");
  assert.ok(f.tables.integration_connections.every((c) => c.status === "reconnect_required"));
  assert.equal(f.tables.notifications.length, 2, "one per connection, owner only (members are not notified)");
  assert.ok(f.tables.notifications.every((n) => n.recipient_id === "u1" && /opnieuw/.test(n.title)));
  // Already marked: a later run skips it and sends nothing new.
  f.calls.length = 0;
  await f.health.runGoogleHealth();
  assert.equal(f.calls.length, 0);
});

test("google check: a temporary Google error never marks the connection as expired", async (t) => {
  const f = setup(t, "down");
  await f.health.checkWorkspaceGoogle("w1");
  assert.ok(f.tables.integration_connections.every((c) => c.status === "connected"));
  assert.equal(f.tables.integration_connections[0].metadata.check.reason, "temporary");
  assert.equal(f.tables.notifications.length, 0);
});

test("health: a Google connection without a recent real check shows 'Controleren…', not 'Verbonden en werkt'", () => {
  const facts = { provider: "gmail", platformReady: true, connection: { status: "connected", scopes: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"], lastSyncedAt: null, expiresAt: null } };
  assert.equal(healthFor({ ...facts, verified: false }).status, "checking");
  assert.equal(healthFor({ ...facts, verified: false }).statusLabel, "Controleren…");
  assert.equal(healthFor({ ...facts, verified: true }).status, "connected");
});

test("scheduled posts: one definition of upcoming and missed; titles without markdown", () => {
  const now = Date.parse("2026-11-19T12:00:00Z");
  assert.equal(scheduleState({ status: "scheduled", date: "2026-11-19T18:00" }, now), "upcoming");
  assert.equal(scheduleState({ status: "scheduled", date: "2026-11-04T23:00" }, now), "missed");
  assert.equal(scheduleState({ status: "approved", date: "2026-11-04T23:00" }, now), null);
  assert.equal(postTitle({ prompt: "**Maak een post** over onze pizza.\n## Belangrijk\n- geen prijzen", caption: "" }), "Maak een post over onze pizza.");
  assert.equal(postTitle({ prompt: "", caption: "" }), "Instagram-post");
  assert.ok(postTitle({ prompt: "x".repeat(10) + " " + "lang ".repeat(30), caption: "" }).length <= 61);
});
