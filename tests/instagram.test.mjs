import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";

const origin = "https://mavix.webbo-solutions.nl";
const APP_ID = "1234567890";
const CONFIG_ID = "555000555";
const SECRET = "meta-app-secret-fixture";
const IG_SECRET = "instagram-app-secret-fixture";
const PAGE_TOKEN = "EAApagetokenfixture";
const USER_TOKEN = "EAAlonglivedusertokenfixture";
const REQUIRED = ["instagram_basic", "instagram_manage_messages", "pages_show_list", "pages_manage_metadata"];
const nextServer = createRequire(import.meta.url)("next/server");
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
const sign = (body, secret = SECRET) => "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
const page = (id, igId, over = {}) => ({
  id,
  name: "Pagina " + id,
  access_token: PAGE_TOKEN + id,
  tasks: ["MANAGE", "MESSAGING"],
  instagram_business_account: { id: igId, username: "account" + igId, name: "Account " + igId },
  ...over,
});

function setup(t, { pages = [page("700001", "178001")], connections = [] } = {}) {
  process.env.OAUTH_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  process.env.META_CLIENT_ID = APP_ID;
  process.env.META_CLIENT_SECRET = SECRET;
  process.env.META_INSTAGRAM_CONFIG_ID = CONFIG_ID;
  process.env.META_WEBHOOK_VERIFY_TOKEN = "verify-fixture";
  process.env.INSTAGRAM_APP_SECRET = IG_SECRET;
  delete process.env.INSTAGRAM_APP_ID;
  const tables = {
    workspace_members: [
      { user_id: "u1", workspace_id: "w1", role: "OWNER" },
      { user_id: "u2", workspace_id: "w2", role: "OWNER" },
    ],
    workspaces: [{ id: "w1", deleted_at: null }, { id: "w2", deleted_at: null }],
    integration_connections: connections.map((c, i) => ({ id: "c" + i, ...c })),
    oauth_states: [],
    audit_logs: [],
  };
  const db = memoryDb(tables);
  const state = { user: { id: "u1" } };
  db.auth = { getUser: async () => ({ data: { user: state.user }, error: null }) };
  const jars = { u1: new Map(), u2: new Map() };
  const jar = () => jars[state.user.id];
  const logs = [];
  for (const level of ["error", "warn", "info"]) t.mock.method(console, level, (line) => logs.push(String(line)));
  const queued = [];
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": {
      cookies: async () => ({ get: (n) => jar().get(n), set: (n, value, options) => jar().set(n, { value, options }), delete: (n) => jar().delete(n) }),
    },
    "next/server": { ...nextServer, NextResponse: nextServer.NextResponse, after: (fn) => queued.push(fn) },
  });
  const route = load("src/app/api/integrations/[provider]/[action]/route.ts");
  const webhook = load("src/app/api/webhooks/meta/route.ts");
  const meta = load("src/lib/server/meta.ts");
  const crypto = load("src/lib/server/crypto.ts");
  const requests = [];
  const net = {
    pages,
    tokenType: "USER",
    appId: APP_ID,
    scopes: [...REQUIRED, "instagram_content_publish", "pages_read_engagement", "business_management"],
    handle: async (url, init = {}) => {
      const u = new URL(url);
      const p = u.pathname.replace(/^\/v[\d.]+/, "");
      if (u.hostname !== "graph.facebook.com") throw Error("Unexpected host " + u.hostname);
      if (p === "/oauth/access_token" && u.searchParams.get("code"))
        return u.searchParams.get("code") === "used" ? reply({ error: { code: 100, message: "code used" } }, 400) : reply({ access_token: "short-user-token" });
      if (p === "/oauth/access_token" && u.searchParams.get("grant_type") === "fb_exchange_token") return reply({ access_token: USER_TOKEN, expires_in: 5183944 });
      if (p === "/debug_token")
        return reply({ data: { app_id: net.appId, type: net.tokenType, is_valid: true, scopes: net.scopes, data_access_expires_at: 1900000000 } });
      if (p === "/me/accounts") return reply({ data: net.pages });
      let m = p.match(/^\/(\d+)\/subscribed_apps$/);
      if (m && init.method === "POST") return reply({ success: true });
      m = p.match(/^\/(\d+)\/messages$/);
      if (m && init.method === "POST") return net.send ? net.send(init) : reply({ recipient_id: "IGSID", message_id: "mid.out1" });
      m = p.match(/^\/(\d+)$/);
      if (m) return reply({ name: "Sanne de Vries", username: "sanne" });
      throw Error("Unexpected fixture request " + url);
    },
  };
  t.mock.method(globalThis, "fetch", async (url, init = {}) => {
    requests.push({ url: String(url), method: init.method || "GET", headers: init.headers || {}, body: init.body });
    return net.handle(String(url), init);
  });
  const as = (user) => (state.user = { id: user });
  const action = (name, method = "GET", { query = "", body } = {}) =>
    route[method](
      new Request(origin + "/api/integrations/instagram/" + name + query, {
        method,
        headers: { origin, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      { params: Promise.resolve({ provider: "instagram", action: name }) },
    );
  const start = async () => {
    const res = await action("connect", "POST", { body: {} });
    assert.equal(res.status, 200);
    return new URL((await res.json()).url);
  };
  const complete = (url, code = "fixture-code") => action("callback", "GET", { query: "?code=" + code + "&state=" + url.searchParams.get("state") });
  const connect = async () => {
    const res = await complete(await start());
    return res.headers.get("location") || String(res.status);
  };
  const row = (ws) => tables.integration_connections.find((c) => c.workspace_id === ws && c.provider === "instagram");
  const deliver = async (payload, secret = SECRET) => {
    const body = JSON.stringify(payload);
    const res = await webhook.POST(new Request(origin + "/api/webhooks/meta", { method: "POST", headers: { "x-hub-signature-256": sign(body, secret) }, body }));
    while (queued.length) await queued.shift()();
    return res;
  };
  return { tables, db, state, logs, requests, net, meta, crypto, route, as, action, start, complete, connect, row, deliver };
}

const dm = (igId, mid, text = "Hebben jullie nog plek?", sender = "9910001") => ({
  object: "instagram",
  entry: [{ id: igId, time: 1760000000, messaging: [{ sender: { id: sender }, recipient: { id: igId }, timestamp: 1760000000000, message: { mid, text } }] }],
});
const fbConnection = (workspace_id, igId, over = {}) => ({
  workspace_id,
  provider: "instagram",
  provider_account_id: igId,
  status: "connected",
  metadata: { authMode: "facebook", pageId: "700001" },
  ...over,
});

// ---------------------------------------------------------------- OAuth

test("connect uses Facebook Login for Business with the configuration id and a single-use state", async (t) => {
  const f = setup(t);
  const url = await f.start();
  assert.equal(url.origin + url.pathname, "https://www.facebook.com/v25.0/dialog/oauth");
  assert.equal(url.searchParams.get("client_id"), APP_ID);
  assert.equal(url.searchParams.get("config_id"), CONFIG_ID);
  assert.equal(url.searchParams.get("redirect_uri"), origin + "/api/integrations/instagram/callback");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), null, "permissions come from the configuration");
  assert.ok(url.searchParams.get("state").length >= 40);
  assert.equal(f.tables.oauth_states.length, 1);
  assert.notEqual(f.tables.oauth_states[0].token_hash, url.searchParams.get("state"), "only a hash of the state is stored");
});

test("missing configuration gives a generic error and logs only variable names", async (t) => {
  const f = setup(t);
  delete process.env.META_INSTAGRAM_CONFIG_ID;
  const res = await f.action("connect", "POST", { body: {} });
  assert.equal(res.status, 503);
  const body = JSON.stringify(await res.json());
  assert.ok(!body.includes("META_") && !body.includes(SECRET));
  const log = JSON.parse(f.logs.find((l) => l.includes("meta_not_configured")));
  assert.deepEqual(log.missing, ["META_INSTAGRAM_CONFIG_ID"]);
  assert.equal(f.requests.length, 0);
});

test("callback stores the Page token encrypted, picks the only account and subscribes its Page", async (t) => {
  const f = setup(t);
  const url = await f.start();
  const res = await f.complete(url);
  assert.match(res.headers.get("location"), /connected=instagram$/);
  const c = f.row("w1");
  assert.deepEqual([c.status, c.provider_account_id, c.display_name], ["connected", "178001", "@account178001"]);
  assert.deepEqual(c.metadata, { authMode: "facebook", pageId: "700001", pageName: "Pagina 700001", username: "account178001" });
  assert.equal(c.expires_at, new Date(1900000000 * 1000).toISOString(), "Meta data-access expiry is tracked");
  assert.ok(c.scopes.includes("instagram_manage_messages") && c.scopes.includes("instagram_content_publish"));
  for (const token of [PAGE_TOKEN, USER_TOKEN, "short-user-token"]) assert.ok(!c.encrypted_credentials.includes(token));
  const creds = f.crypto.decrypt(c.encrypted_credentials, "w1:instagram");
  assert.deepEqual([creds.access_token, creds.user_token, creds.page_id], [PAGE_TOKEN + "700001", USER_TOKEN, "700001"]);
  assert.throws(() => f.crypto.decrypt(c.encrypted_credentials, "w2:instagram"), "bound to the workspace");
  const sub = f.requests.find((r) => r.url.includes("/subscribed_apps"));
  assert.match(sub.url, /\/700001\/subscribed_apps\?subscribed_fields=messages$/);
  assert.equal(sub.headers.Authorization, "Bearer " + PAGE_TOKEN + "700001");
  const debug = f.requests.find((r) => r.url.includes("/debug_token"));
  assert.equal(new URL(debug.url).searchParams.get("input_token"), "short-user-token");
  // The state cannot be replayed.
  assert.equal((await f.complete(url)).status, 400);
  assert.ok(!f.logs.some((l) => l.includes(SECRET) || l.includes(PAGE_TOKEN) || l.includes(USER_TOKEN)), "no secrets in logs");
});

test("a System-user token configuration is refused and nothing is stored", async (t) => {
  const f = setup(t);
  f.net.tokenType = "SYSTEM_USER";
  assert.match(await f.connect(), /error=token_type&provider=instagram$/);
  assert.equal(f.row("w1"), undefined);
  assert.ok(!f.requests.some((r) => r.url.includes("fb_exchange_token") || r.url.includes("/me/accounts")));
  assert.ok(f.logs.some((l) => l.includes("instagram_config_token_type") && l.includes("SYSTEM_USER")));
});

test("a token issued to another app, missing permissions or a used code never connect", async (t) => {
  const f = setup(t);
  f.net.appId = "999";
  assert.match(await f.connect(), /error=failed&provider=instagram$/);
  assert.equal(f.row("w1"), undefined);

  const g = setup(t);
  g.net.scopes = ["instagram_basic", "pages_show_list"];
  assert.match(await g.connect(), /error=permission&provider=instagram$/);
  assert.equal(g.row("w1"), undefined);

  const h = setup(t);
  assert.match((await h.complete(await h.start(), "used")).headers.get("location"), /error=expired&provider=instagram$/);
  assert.equal(h.row("w1"), undefined);

  const i = setup(t);
  const url = await i.start();
  const denied = await i.action("callback", "GET", { query: "?error=access_denied&state=" + url.searchParams.get("state") });
  assert.match(denied.headers.get("location"), /error=denied&provider=instagram$/);
  assert.equal(i.row("w1"), undefined);
});

// ---------------------------------------------------------------- Account selection

test("several accounts ask for a choice; only accounts Meta returns can be selected", async (t) => {
  const f = setup(t, {
    pages: [
      page("700001", "178001"),
      page("700002", "178002"),
      page("700003", "178003", { tasks: ["ANALYZE"] }),
      { id: "700004", name: "Zonder Instagram", access_token: "x", tasks: ["MANAGE"] },
    ],
  });
  assert.match(await f.connect(), /select=instagram$/);
  const c = f.row("w1");
  assert.deepEqual([c.status, c.provider_account_id], ["selection_required", null]);
  assert.ok(!f.requests.some((r) => r.url.includes("subscribed_apps")));

  const list = await (await f.action("accounts")).json();
  assert.deepEqual(list.accounts.map((a) => a.id), ["178001", "178002"], "no IG account or no MESSAGING task → not offered");
  assert.ok(!JSON.stringify(list).includes(PAGE_TOKEN) && !JSON.stringify(list).includes(USER_TOKEN), "tokens never reach the browser");

  assert.equal((await f.action("select", "POST", { body: { account: "178003" } })).status, 403);
  assert.equal((await f.action("select", "POST", { body: { account: "../me" } })).status, 400);
  assert.equal(f.row("w1").status, "selection_required");

  assert.equal((await f.action("select", "POST", { body: { account: "178002" } })).status, 200);
  assert.deepEqual([f.row("w1").status, f.row("w1").provider_account_id, f.row("w1").metadata.pageId], ["connected", "178002", "700002"]);
  assert.match(f.requests.at(-1).url, /\/700002\/subscribed_apps/);
});

test("no professional account found keeps the existing connection untouched", async (t) => {
  const f = setup(t, { pages: [], connections: [fbConnection("w1", "178001", { encrypted_credentials: "kept" })] });
  assert.match(await f.connect(), /error=no_instagram_account&provider=instagram$/);
  assert.deepEqual([f.row("w1").status, f.row("w1").encrypted_credentials], ["connected", "kept"]);
});

test("members cannot connect or choose accounts; other origins are refused", async (t) => {
  const f = setup(t);
  f.tables.workspace_members[0].role = "MEMBER";
  assert.equal((await f.action("connect", "POST", { body: {} })).status, 403);
  assert.equal((await f.action("accounts")).status, 403);
  f.tables.workspace_members[0].role = "OWNER";
  const crossSite = await f.route.POST(
    new Request(origin + "/api/integrations/instagram/select", { method: "POST", headers: { origin: "https://evil.example", "Content-Type": "application/json" }, body: '{"account":"178001"}' }),
    { params: Promise.resolve({ provider: "instagram", action: "select" }) },
  );
  assert.equal(crossSite.status, 403);
  assert.equal(f.requests.length, 0);
});

// ---------------------------------------------------------------- Duplicates

test("an Instagram account connected in one workspace cannot be connected in another (409)", async (t) => {
  const f = setup(t);
  assert.match(await f.connect(), /connected=instagram$/);
  const before = structuredClone(f.row("w1"));
  const subscribes = f.requests.filter((r) => r.url.includes("subscribed_apps")).length;

  f.as("u2");
  assert.match(await f.connect(), /error=instagram_taken&provider=instagram$/);
  assert.deepEqual(f.row("w1"), before, "workspace 1 untouched");
  assert.notEqual(f.row("w2").status, "connected");
  assert.equal(f.row("w2").provider_account_id, null);
  assert.equal(f.requests.filter((r) => r.url.includes("subscribed_apps")).length, subscribes, "no subscription for the refused workspace");
  const select = await f.action("select", "POST", { body: { account: "178001" } });
  assert.equal(select.status, 409);
  assert.equal((await select.json()).error, "Dit Instagram-account is al gekoppeld aan een andere Mavix-werkruimte. Ontkoppel het daar eerst.");

  f.as("u1");
  assert.equal((await f.action("disconnect", "POST", { body: {} })).status, 200);
  f.as("u2");
  assert.equal((await f.action("select", "POST", { body: { account: "178001" } })).status, 200, "free again after disconnect");
  assert.equal(f.row("w2").status, "connected");
});

test("a concurrent selection that hits the unique index also returns 409", async (t) => {
  const f = setup(t, { pages: [page("700001", "178001"), page("700002", "178002")] });
  assert.match(await f.connect(), /select=instagram$/);
  const from = f.db.from;
  f.db.from = (table) => {
    const q = from(table);
    const update = q.update;
    if (table === "integration_connections")
      q.update = (values) =>
        values.provider_account_id ? { eq: () => Promise.resolve({ data: null, error: { code: "23505", message: "duplicate key" } }) } : update(values);
    return q;
  };
  const res = await f.action("select", "POST", { body: { account: "178001" } });
  assert.equal(res.status, 409);
});

// ---------------------------------------------------------------- Webhooks

test("Instagram DMs signed with the Meta App Secret land only in the owning workspace", async (t) => {
  const f = setup(t, {
    connections: [
      fbConnection("w1", "178001"),
      fbConnection("w2", "178002", { metadata: { authMode: "facebook", pageId: "700002" } }),
      fbConnection("w2", "178003", { status: "disconnected" }),
    ],
  });
  for (const c of f.tables.integration_connections)
    c.encrypted_credentials = f.crypto.encrypt({ access_token: PAGE_TOKEN + c.metadata.pageId, page_id: c.metadata.pageId }, c.workspace_id + ":instagram");
  assert.equal((await f.deliver(dm("178001", "mid.A", "Tafel voor vier?"))).status, 200);
  assert.equal((await f.deliver(dm("178002", "mid.B", "Openingstijden?"))).status, 200);
  await f.deliver(dm("178003", "mid.C", "Naar ontkoppeld account"));
  await f.deliver(dm("178999", "mid.D", "Onbekend account"));
  const bodies = (ws) => f.tables.inbox_messages.filter((m) => m.workspace_id === ws).map((m) => m.body);
  assert.deepEqual(bodies("w1"), ["Tafel voor vier?"]);
  assert.deepEqual(bodies("w2"), ["Openingstijden?"]);
  assert.equal(f.tables.inbox_messages.length, 2);
  const conv = f.tables.inbox_conversations.find((c) => c.workspace_id === "w1");
  assert.deepEqual([conv.provider, conv.provider_account_id, conv.provider_thread_id], ["instagram", "178001", "9910001"]);
  assert.equal(conv.external_contact.username, "sanne", "profile looked up with the Page token on graph.facebook.com");
  const profile = f.requests.find((r) => r.url.includes("/9910001?"));
  assert.match(profile.url, /^https:\/\/graph\.facebook\.com\/v[\d.]+\/9910001\?fields=name,username$/);
  assert.equal(profile.headers.Authorization, "Bearer " + PAGE_TOKEN + "700001", "w1's own Page token");
  assert.ok(!f.logs.some((l) => l.includes("Tafel voor vier")), "no message content in logs");
});

test("webhook signatures: Meta secret and legacy Instagram secret accepted, anything else rejected", async (t) => {
  const f = setup(t, { connections: [fbConnection("w1", "178001")] });
  assert.equal((await f.deliver(dm("178001", "mid.1"), "wrong-secret")).status, 401);
  assert.equal(f.tables.inbox_messages, undefined);
  assert.equal((await f.deliver(dm("178001", "mid.2"), IG_SECRET)).status, 200, "older Instagram Login connections keep working");
  // Page and WhatsApp events are never accepted with the Instagram secret.
  assert.equal((await f.deliver({ object: "page", entry: [] }, IG_SECRET)).status, 401);
  assert.equal((await f.deliver({ object: "whatsapp_business_account", entry: [] }, IG_SECRET)).status, 401);
  delete process.env.META_CLIENT_SECRET;
  delete process.env.INSTAGRAM_APP_SECRET;
  assert.equal((await f.deliver(dm("178001", "mid.3"), "")).status, 503);
});

test("a legacy duplicate Instagram account is delivered to no workspace", async (t) => {
  const f = setup(t, { connections: [fbConnection("w1", "178001"), fbConnection("w2", "178001")] });
  assert.equal((await f.deliver(dm("178001", "mid.X"))).status, 200);
  assert.equal(f.tables.inbox_messages, undefined);
  assert.ok(f.logs.some((l) => l.includes("inbox_webhook_ambiguous_account")));
});

// ---------------------------------------------------------------- Messaging

test("replies go to /{page-id}/messages with the Page token and the IGSID as recipient", async (t) => {
  const f = setup(t);
  assert.match(await f.connect(), /connected=instagram$/);
  const id = await f.meta.sendMetaText("w1", "instagram", "9910001", "Ja, om 19:00 is er plek.");
  assert.equal(id, "mid.out1");
  const sent = f.requests.at(-1);
  assert.match(sent.url, /^https:\/\/graph\.facebook\.com\/v[\d.]+\/700001\/messages$/);
  assert.equal(sent.method, "POST");
  assert.equal(sent.headers.Authorization, "Bearer " + PAGE_TOKEN + "700001");
  assert.deepEqual(JSON.parse(sent.body), { recipient: { id: "9910001" }, messaging_type: "RESPONSE", message: { text: "Ja, om 19:00 is er plek." } });
});

test("token problems: expired data access and revoked tokens require reconnecting; no sending while choosing", async (t) => {
  const f = setup(t);
  assert.match(await f.connect(), /connected=instagram$/);
  f.net.send = () => reply({ error: { code: 190, message: "Error validating access token" } }, 400);
  await assert.rejects(f.meta.sendMetaText("w1", "instagram", "9910001", "Hoi"), (e) => e.status === 409);
  assert.equal(f.row("w1").status, "reconnect_required");

  const g = setup(t);
  assert.match(await g.connect(), /connected=instagram$/);
  g.row("w1").expires_at = new Date(Date.now() - 1000).toISOString();
  await assert.rejects(g.meta.sendMetaText("w1", "instagram", "9910001", "Hoi"), /verlopen/);
  assert.equal(g.row("w1").status, "reconnect_required");
  assert.ok(!g.requests.some((r) => r.url.includes("/messages")), "nothing sent with expired access");

  const h = setup(t, { pages: [page("700001", "178001"), page("700002", "178002")] });
  assert.match(await h.connect(), /select=instagram$/);
  await assert.rejects(h.meta.sendMetaText("w1", "instagram", "9910001", "Hoi"), (e) => e.status === 409);
});

test("connections made earlier with Instagram Login keep using graph.instagram.com", async (t) => {
  const f = setup(t);
  const creds = f.crypto.encrypt({ access_token: "IGlegacytoken", obtained_at: Date.now() }, "w1:instagram");
  f.tables.integration_connections.push({
    id: "legacy",
    workspace_id: "w1",
    provider: "instagram",
    provider_account_id: "178777",
    status: "connected",
    encrypted_credentials: creds,
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    metadata: {},
  });
  f.net.handle = async (url) => {
    assert.match(url, /^https:\/\/graph\.instagram\.com\/v[\d.]+\/me\/messages$/);
    return reply({ message_id: "mid.legacy" });
  };
  assert.equal(await f.meta.sendMetaText("w1", "instagram", "9910001", "Hoi"), "mid.legacy");
});
