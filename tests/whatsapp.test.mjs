import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";

const origin = "https://mavix.webbo-solutions.nl";
const SECRET = "app-secret-fixture";
const VERIFY = "verify-token-fixture";
const TOKEN = "EAAfixturetoken1234567890";
const nextServer = createRequire(import.meta.url)("next/server");
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
const sign = (body, secret = SECRET) => "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

function setup(t, { connections = [] } = {}) {
  process.env.OAUTH_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.META_CLIENT_SECRET = SECRET;
  process.env.META_WEBHOOK_VERIFY_TOKEN = VERIFY;
  process.env.INSTAGRAM_APP_SECRET = "instagram-secret-fixture";
  const tables = {
    workspace_members: [
      { user_id: "u1", workspace_id: "w1", role: "OWNER" },
      { user_id: "u2", workspace_id: "w2", role: "OWNER" },
    ],
    workspaces: [{ id: "w1", deleted_at: null }, { id: "w2", deleted_at: null }],
    integration_connections: connections.map((c, i) => ({ id: "c" + i, ...c })),
    audit_logs: [],
  };
  const db = memoryDb(tables);
  const state = { user: { id: "u1" } };
  db.auth = { getUser: async () => ({ data: { user: state.user }, error: null }) };
  const queued = [];
  const logs = [];
  for (const level of ["error", "warn", "info"]) t.mock.method(console, level, (line) => logs.push(String(line)));
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined, set() {}, delete() {} }) },
    "next/server": { ...nextServer, NextResponse: nextServer.NextResponse, after: (fn) => queued.push(fn) },
  });
  const integrations = load("src/app/api/integrations/[provider]/[action]/route.ts");
  const webhook = load("src/app/api/webhooks/meta/route.ts");
  const crypto = load("src/lib/server/crypto.ts");
  const requests = [];
  const meta = {
    numbers: { 100000001: [{ id: "111111", display_phone_number: "+31 20 123 4567", verified_name: "Trattoria Gouda" }], 100000002: [{ id: "222222" }] },
  };
  t.mock.method(globalThis, "fetch", async (url, init = {}) => {
    url = String(url);
    requests.push({ url, method: init.method || "GET" });
    const m = url.match(/graph\.facebook\.com\/v[\d.]+\/(\w+)\/(phone_numbers|subscribed_apps)/);
    if (!m || !meta.numbers[m[1]]) return reply({ error: { code: 100, message: "Unsupported get request" } }, 400);
    return m[2] === "subscribed_apps" ? reply({ success: true }) : reply({ data: meta.numbers[m[1]] });
  });
  const connect = (body, user = "u1") => {
    state.user = { id: user };
    return integrations.POST(
      new Request(origin + "/api/integrations/whatsapp/connect", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      { params: Promise.resolve({ provider: "whatsapp", action: "connect" }) },
    );
  };
  const disconnect = (user = "u1") => {
    state.user = { id: user };
    return integrations.POST(new Request(origin + "/api/integrations/whatsapp/disconnect", { method: "POST", headers: { origin } }), {
      params: Promise.resolve({ provider: "whatsapp", action: "disconnect" }),
    });
  };
  const verify = (query) => webhook.GET(new Request(origin + "/api/webhooks/meta?" + new URLSearchParams(query)));
  const deliver = async (payload, signature) => {
    const body = JSON.stringify(payload);
    const res = await webhook.POST(
      new Request(origin + "/api/webhooks/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(signature === null ? {} : { "x-hub-signature-256": signature ?? sign(body) }) },
        body,
      }),
    );
    while (queued.length) await queued.shift()();
    return res;
  };
  const raw = (body, signature) =>
    webhook.POST(new Request(origin + "/api/webhooks/meta", { method: "POST", headers: { "x-hub-signature-256": signature }, body }));
  return { tables, db, state, logs, requests, meta, crypto, connect, disconnect, verify, deliver, raw };
}

const whatsappEvent = (phoneNumberId, id = "wamid." + phoneNumberId, text = "Hallo") => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: phoneNumberId, display_phone_number: "+31 20 000" },
            contacts: [{ wa_id: "31612345678", profile: { name: "Sanne" } }],
            messages: [{ id, from: "31612345678", timestamp: "1760000000", type: "text", text: { body: text } }],
          },
        },
      ],
    },
  ],
});
const input = (over = {}) => ({ phoneNumberId: "111111", wabaId: "100000001", token: TOKEN, ...over });
const connection = (workspace_id, provider_account_id, status = "connected") => ({ workspace_id, provider: "whatsapp", provider_account_id, status });

// ---------------------------------------------------------------- GET handshake

test("GET verification echoes the challenge only for the right verify token", async (t) => {
  const f = setup(t);
  const ok = await f.verify({ "hub.mode": "subscribe", "hub.verify_token": VERIFY, "hub.challenge": "1158201444" });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "text/plain");
  assert.equal(await ok.text(), "1158201444");
  for (const query of [
    { "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "1" },
    { "hub.mode": "subscribe", "hub.verify_token": VERIFY.slice(0, -1), "hub.challenge": "1" },
    { "hub.mode": "unsubscribe", "hub.verify_token": VERIFY, "hub.challenge": "1" },
    { "hub.mode": "subscribe", "hub.challenge": "1" },
    { "hub.mode": "subscribe", "hub.verify_token": VERIFY, "hub.challenge": "<script>" },
    {},
  ]) {
    const res = await f.verify(query);
    assert.equal(res.status, 403, JSON.stringify(query));
    assert.equal(await res.text(), "Forbidden");
  }
});

test("GET verification without a configured verify token fails closed and logs only the variable name", async (t) => {
  const f = setup(t);
  delete process.env.META_WEBHOOK_VERIFY_TOKEN;
  const res = await f.verify({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "1" });
  assert.equal(res.status, 503);
  assert.ok(!(await res.text()).includes("1"));
  assert.ok(f.logs.some((l) => l.includes("meta_webhook_not_configured") && l.includes("META_WEBHOOK_VERIFY_TOKEN")));
});

// ---------------------------------------------------------------- POST signature

test("POST accepts only bodies signed with the Meta App Secret and processes after the response", async (t) => {
  const f = setup(t, { connections: [connection("w1", "111111")] });
  const event = whatsappEvent("111111");
  const body = JSON.stringify(event);
  assert.equal((await f.deliver(event, null)).status, 401, "missing signature");
  assert.equal((await f.deliver(event, sign(body, "another-secret"))).status, 401, "wrong secret");
  assert.equal((await f.deliver(event, sign(body + " "))).status, 401, "signature of a different body");
  assert.equal((await f.deliver(event, "sha1=" + createHmac("sha1", SECRET).update(body).digest("hex"))).status, 401, "sha1 is not accepted");
  assert.equal((await f.deliver(event, sign(body, "instagram-secret-fixture"))).status, 401, "WhatsApp is not signed with the Instagram secret");
  assert.equal(f.tables.inbox_messages, undefined, "nothing stored for rejected deliveries");
  assert.ok(!f.logs.some((l) => l.includes(SECRET) || l.includes("Hallo")), "no secret or message content in logs");

  const res = await f.deliver(event);
  assert.equal(res.status, 200);
  assert.equal(f.tables.inbox_messages.length, 1);
  assert.equal(f.tables.inbox_messages[0].body, "Hallo");
});

test("POST without a configured App Secret answers 503 so Meta retries, and stores nothing", async (t) => {
  const f = setup(t, { connections: [connection("w1", "111111")] });
  delete process.env.META_CLIENT_SECRET;
  const event = whatsappEvent("111111");
  const res = await f.deliver(event, sign(JSON.stringify(event), ""));
  assert.equal(res.status, 503);
  assert.equal(f.tables.inbox_messages, undefined);
  assert.ok(f.logs.some((l) => l.includes("meta_webhook_not_configured") && l.includes("META_CLIENT_SECRET")));
});

test("Instagram webhooks keep using the Instagram app secret", async (t) => {
  const f = setup(t);
  const event = { object: "instagram", entry: [] };
  const body = JSON.stringify(event);
  assert.equal((await f.deliver(event, sign(body, "instagram-secret-fixture"))).status, 200);
  assert.equal((await f.deliver(event, sign(body))).status, 401);
});

test("malformed and oversized bodies are rejected before any processing", async (t) => {
  const f = setup(t, { connections: [connection("w1", "111111")] });
  const bad = "{not json";
  assert.equal((await f.raw(bad, sign(bad))).status, 400);
  const big = JSON.stringify({ ...whatsappEvent("111111"), pad: "x".repeat(1_000_001) });
  assert.equal((await f.raw(big, sign(big))).status, 413);
  assert.equal(f.tables.inbox_messages, undefined);
});

// ---------------------------------------------------------------- Workspace isolation

test("incoming WhatsApp messages land only in the workspace that connected that number", async (t) => {
  const f = setup(t, {
    connections: [connection("w1", "111111"), connection("w2", "222222"), connection("w2", "333333", "disconnected")],
  });
  await f.deliver(whatsappEvent("111111", "wamid.A", "Tafel voor twee?"));
  await f.deliver(whatsappEvent("222222", "wamid.B", "Openingstijden?"));
  await f.deliver(whatsappEvent("333333", "wamid.C", "Naar ontkoppeld nummer"));
  await f.deliver(whatsappEvent("999999", "wamid.D", "Onbekend nummer"));
  const byWorkspace = (ws) => f.tables.inbox_messages.filter((m) => m.workspace_id === ws).map((m) => m.body);
  assert.deepEqual(byWorkspace("w1"), ["Tafel voor twee?"]);
  assert.deepEqual(byWorkspace("w2"), ["Openingstijden?"]);
  assert.equal(f.tables.inbox_messages.length, 2, "disconnected and unknown numbers are not stored anywhere");
  for (const c of f.tables.inbox_conversations) {
    const msgs = f.tables.inbox_messages.filter((m) => m.conversation_id === c.id);
    assert.ok(msgs.every((m) => m.workspace_id === c.workspace_id && m.provider_account_id === c.provider_account_id));
    assert.equal(c.provider, "whatsapp");
  }
  const w1 = f.tables.inbox_conversations.find((c) => c.workspace_id === "w1");
  assert.deepEqual([w1.provider_account_id, w1.provider_thread_id, w1.external_contact.name], ["111111", "31612345678", "Sanne"]);
});

test("a legacy duplicate number is delivered to no workspace instead of to both", async (t) => {
  const f = setup(t, { connections: [connection("w1", "444444"), connection("w2", "444444")] });
  assert.equal((await f.deliver(whatsappEvent("444444"))).status, 200);
  assert.equal(f.tables.inbox_messages, undefined);
  assert.ok(f.logs.some((l) => l.includes("inbox_webhook_ambiguous_account")));
});

// ---------------------------------------------------------------- Connecting a number

test("connecting verifies the number against the WABA, subscribes, and stores the token encrypted", async (t) => {
  const f = setup(t);
  const res = await f.connect(input());
  assert.equal(res.status, 200);
  const c = f.tables.integration_connections[0];
  assert.deepEqual([c.workspace_id, c.provider, c.provider_account_id, c.status], ["w1", "whatsapp", "111111", "connected"]);
  assert.equal(c.display_name, "Trattoria Gouda (+31 20 123 4567)");
  assert.deepEqual(c.metadata, { wabaId: "100000001" });
  assert.ok(!c.encrypted_credentials.includes(TOKEN));
  assert.equal(f.crypto.decrypt(c.encrypted_credentials, "w1:whatsapp").access_token, TOKEN);
  assert.deepEqual(
    f.requests.map((r) => r.method + " " + r.url.replace(/\?.*/, "").replace(/^.*\/v[\d.]+/, "")),
    ["GET /100000001/phone_numbers", "POST /100000001/subscribed_apps"],
  );
});

test("a Phone Number ID that is not in the given WABA is refused before anything is subscribed or stored", async (t) => {
  const f = setup(t);
  const res = await f.connect(input({ phoneNumberId: "222222" }));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /hoort niet bij het opgegeven WhatsApp Business-account/);
  assert.equal(f.tables.integration_connections.length, 0);
  assert.ok(!f.requests.some((r) => r.url.includes("subscribed_apps")));

  const unknown = await f.connect(input({ wabaId: "12345678" }));
  assert.equal(unknown.status, 400);
  assert.match((await unknown.json()).error, /kon dit WhatsApp Business-account niet controleren/);
  assert.equal(f.tables.integration_connections.length, 0);

  const malformed = await f.connect(input({ phoneNumberId: "abc" }));
  assert.equal(malformed.status, 400);
  assert.equal(f.tables.integration_connections.length, 0);
});

test("a temporary Meta outage is reported as temporary, not as wrong IDs", async (t) => {
  const f = setup(t);
  t.mock.method(globalThis, "fetch", async () => reply({ error: { code: 2, message: "Service temporarily unavailable" } }, 503));
  const res = await f.connect(input());
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /tijdelijk niet bereikbaar/);
  assert.equal(f.tables.integration_connections.length, 0);
});

test("the same number cannot be connected to a second workspace (409), until the first disconnects", async (t) => {
  const f = setup(t);
  assert.equal((await f.connect(input(), "u1")).status, 200);
  const before = structuredClone(f.tables.integration_connections);
  const subscribes = f.requests.filter((r) => r.url.includes("subscribed_apps")).length;

  const res = await f.connect(input(), "u2");
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, "Dit WhatsApp-nummer is al gekoppeld aan een andere Mavix-werkruimte. Ontkoppel het daar eerst.");
  assert.deepEqual(f.tables.integration_connections, before, "workspace 1 untouched, nothing stored for workspace 2");
  assert.equal(f.requests.filter((r) => r.url.includes("subscribed_apps")).length, subscribes, "no subscription for the refused workspace");

  assert.equal((await f.connect(input(), "u1")).status, 200, "the owning workspace may reconnect its own number");

  assert.equal((await f.disconnect("u1")).status, 200);
  assert.equal((await f.connect(input(), "u2")).status, 200, "a disconnected number can move to another workspace");
  const active = f.tables.integration_connections.filter((c) => c.provider_account_id === "111111" && c.status !== "disconnected");
  assert.deepEqual(active.map((c) => c.workspace_id), ["w2"]);
});

test("a concurrent connection that hits the unique index also returns 409", async (t) => {
  const f = setup(t);
  const from = f.db.from;
  f.db.from = (table) => {
    const q = from(table);
    if (table === "integration_connections")
      q.upsert = () => ({ then: (ok, fail) => Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key" } }).then(ok, fail) });
    return q;
  };
  const res = await f.connect(input());
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /al gekoppeld aan een andere Mavix-werkruimte/);
});

test("missing server configuration gives a generic Dutch error without names or values", async (t) => {
  const f = setup(t);
  delete process.env.META_WEBHOOK_VERIFY_TOKEN;
  const res = await f.connect(input());
  assert.equal(res.status, 503);
  const body = JSON.stringify(await res.json());
  assert.match(body, /Meta-configuratie van Mavix is nog niet compleet/);
  assert.ok(!/META_|OAUTH_|secret/i.test(body));
  assert.ok(!body.includes(SECRET) && !body.includes(TOKEN));
  assert.equal(f.requests.length, 0, "Meta is not called");
  const log = f.logs.find((l) => l.includes("whatsapp_not_configured"));
  assert.deepEqual(JSON.parse(log).missing, ["META_WEBHOOK_VERIFY_TOKEN"]);
  assert.ok(!f.logs.some((l) => l.includes(SECRET)));
});

test("members cannot connect WhatsApp", async (t) => {
  const f = setup(t);
  f.tables.workspace_members[0].role = "MEMBER";
  assert.equal((await f.connect(input())).status, 403);
  assert.equal(f.tables.integration_connections.length, 0);
  assert.equal(f.requests.length, 0);
});
