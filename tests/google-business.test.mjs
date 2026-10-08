import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";
import { normalizeReview, normalizeReviewsPage, matchesFilter, loadedStats } from "../src/lib/reviews/google.ts";

const origin = "https://mavix.webbo-solutions.nl";
const MANAGE = "https://www.googleapis.com/auth/business.manage";
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
const review = (id, over = {}) => ({
  name: "accounts/1/locations/11/reviews/" + id,
  reviewId: id,
  reviewer: { displayName: "Sanne de Vries", profilePhotoUrl: "https://lh3.googleusercontent.com/a/photo" },
  starRating: "FOUR",
  comment: "Heerlijk gegeten",
  createTime: "2026-10-01T10:00:00Z",
  updateTime: "2026-10-01T10:00:00Z",
  ...over,
});
const location = (id, title, over = {}) => ({
  name: "locations/" + id,
  title,
  storefrontAddress: { addressLines: ["Markt 1"], postalCode: "2801 JA", locality: "Gouda" },
  openInfo: { status: "OPEN" },
  metadata: { hasVoiceOfMerchant: true },
  ...over,
});

function setup(t, { locations = [location(11, "Trattoria Gouda")] } = {}) {
  process.env.GOOGLE_CLIENT_ID = "client-fixture";
  process.env.GOOGLE_CLIENT_SECRET = "secret-fixture";
  process.env.OAUTH_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");
  const tables = {
    workspace_members: [{ user_id: "u1", workspace_id: "w1", role: "OWNER" }],
    workspaces: [{ id: "w1", deleted_at: null }, { id: "w2", deleted_at: null }],
    integration_connections: [],
    oauth_states: [],
  };
  const db = memoryDb(tables);
  const jar = new Map();
  const state = { user: { id: "u1" } };
  const requests = [];
  db.auth = { getUser: async () => ({ data: { user: state.user }, error: null }) };
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": {
      cookies: async () => ({ get: (n) => jar.get(n), set: (n, value, options) => jar.set(n, { value, options }), delete: (n) => jar.delete(n) }),
    },
  });
  const route = load("src/app/api/integrations/[provider]/[action]/route.ts");
  const gbp = load("src/lib/server/google-business.ts");
  const crypto = load("src/lib/server/crypto.ts");
  const token = (over = {}) => ({ access_token: "access-fixture", refresh_token: "refresh-fixture", expires_in: 3600, scope: "openid email " + MANAGE, ...over });
  const network = {
    locations,
    handle: async (url, init = {}) => {
      if (url.includes("oauth2.googleapis.com/token")) return reply(token());
      if (url.includes("/userinfo")) return reply({ sub: "g-account", email: "owner@restaurant.nl", email_verified: true });
      if (url.startsWith("https://mybusinessaccountmanagement.googleapis.com/v1/accounts")) return reply({ accounts: [{ name: "accounts/1" }] });
      if (url.includes("mybusinessbusinessinformation.googleapis.com/v1/accounts/1/locations")) return reply({ locations: network.locations });
      if (url.includes("/reviews/r1/reply"))
        return init.method === "DELETE" ? new Response(null, { status: 204 }) : reply({ comment: JSON.parse(init.body).comment, updateTime: "2026-10-07T12:00:00Z" });
      if (url.includes("/reviews/r1")) return reply(review("r1"));
      if (url.includes("/reviews?"))
        return reply({ reviews: [review("r1"), review("r2", { starRating: "TWO", reviewReply: { comment: "Excuses", updateTime: "2026-10-02T00:00:00Z" } })], averageRating: 4.36, totalReviewCount: 87, nextPageToken: "page-2" });
      throw Error("Unexpected fixture request " + url);
    },
  };
  t.mock.method(globalThis, "fetch", async (url, init = {}) => {
    requests.push({ url: String(url), init });
    return network.handle(String(url), init);
  });
  const request = (url, method = "GET", body) =>
    new Request(origin + url, { method, headers: { origin, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const action = (name, method = "GET", query = "", body) =>
    route[method](request("/api/integrations/google_business/" + name + query, method, body), { params: Promise.resolve({ provider: "google_business", action: name }) });
  const start = async () => {
    const res = await action("connect", "POST");
    assert.equal(res.status, 200);
    return new URL((await res.json()).url);
  };
  const complete = (url) => action("callback", "GET", "?code=fixture-code&state=" + url.searchParams.get("state"));
  const connect = async () => {
    const res = await complete(await start());
    assert.equal(res.status, 303);
    return { res, c: tables.integration_connections[0] };
  };
  const reviews = (file) => load("src/app/api/reviews/" + file);
  return { tables, db, jar, state, requests, gbp, crypto, token, network, request, action, start, complete, connect, reviews };
}

test("OAuth asks only openid, email and business.manage with PKCE, offline access and consent", async (t) => {
  const f = setup(t);
  const url = await f.start();
  assert.equal(url.searchParams.get("redirect_uri"), origin + "/api/integrations/google_business/callback");
  assert.deepEqual(url.searchParams.get("scope").split(" "), ["openid", "email", MANAGE]);
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(f.jar.get("mavix_oauth_google_business").options.httpOnly, true);
});

test("callback encrypts credentials, auto-selects the single location and the state cannot be replayed", async (t) => {
  const f = setup(t);
  const url = await f.start();
  const res = await f.complete(url);
  assert.match(res.headers.get("location"), /connected=google_business$/);
  const c = f.tables.integration_connections[0];
  assert.equal(c.status, "connected");
  assert.equal(c.account_email, "owner@restaurant.nl");
  assert.deepEqual([c.metadata.account, c.metadata.location, c.metadata.locationTitle], ["accounts/1", "locations/11", "Trattoria Gouda"]);
  assert.ok(!c.encrypted_credentials.includes("access-fixture"));
  assert.equal(f.crypto.decrypt(c.encrypted_credentials, "w1:google_business").refresh_token, "refresh-fixture");
  assert.throws(() => f.crypto.decrypt(c.encrypted_credentials, "w1:gmail"));
  assert.match((await f.complete(url)).headers.get("location"), /error=expired/);
  const status = await (await f.action("status")).json();
  assert.deepEqual([status.status, status.connected, status.location.name], ["connected", true, "Trattoria Gouda"]);
  assert.ok(!JSON.stringify(status).includes("credentials"));
});

test("missing business.manage scope or refresh token never connects", async (t) => {
  const f = setup(t);
  f.network.handle = async (url) => (url.includes("/token") ? reply(f.token({ scope: "openid email" })) : reply({}));
  assert.match((await f.complete(await f.start())).headers.get("location"), /error=permission&provider=google_business/);
  assert.notEqual(f.tables.integration_connections[0].status, "connected");
  const g = setup(t);
  const base = g.network.handle;
  g.network.handle = (url, init) => (url.includes("/token") ? reply(g.token({ refresh_token: undefined })) : base(url, init));
  assert.match((await g.complete(await g.start())).headers.get("location"), /error=offline_access/);
  assert.equal(g.tables.integration_connections[0].encrypted_credentials, undefined);
});

test("multiple locations ask for a choice; selection is validated against Google", async (t) => {
  const f = setup(t, { locations: [location(11, "Gouda"), location(12, "Delft")] });
  const { res, c } = await f.connect();
  assert.match(res.headers.get("location"), /select=google_business$/);
  assert.equal(c.status, "selection_required");
  const list = await (await f.action("locations")).json();
  assert.deepEqual(list.locations.map((l) => l.title), ["Gouda", "Delft"]);
  assert.equal(list.locations[0].address, "Markt 1, 2801 JA Gouda");
  const foreign = await f.action("select", "POST", "", { account: "accounts/1", location: "locations/999" });
  assert.equal(foreign.status, 403, "a location Google does not return for this account is refused");
  const calls = f.requests.length;
  const bad = await f.action("select", "POST", "", { account: "accounts/1", location: "../../x" });
  assert.equal(bad.status, 400, "malformed IDs are rejected before any Google call");
  assert.equal(f.requests.length, calls);
  assert.equal(c.metadata.location, undefined);
  const ok = await f.action("select", "POST", "", { account: "accounts/1", location: "locations/12" });
  assert.equal(ok.status, 200);
  assert.deepEqual([c.status, c.metadata.location, c.display_name], ["connected", "locations/12", "Delft"]);
});

test("no locations: account stays linked with a clear notice", async (t) => {
  const f = setup(t, { locations: [] });
  const { res, c } = await f.connect();
  assert.match(res.headers.get("location"), /error=no_locations&provider=google_business/);
  assert.equal(c.status, "selection_required");
});

test("API access not approved (quota 0 or disabled API) is api_access_required, never a disconnect", async (t) => {
  for (const body of [
    { error: { status: "RESOURCE_EXHAUSTED", details: [{ reason: "RATE_LIMIT_EXCEEDED", metadata: { quota_limit_value: "0" } }] } },
    { error: { status: "PERMISSION_DENIED", message: "API has not been used in project 123 before or it is disabled.", details: [{ reason: "SERVICE_DISABLED" }] } },
  ]) {
    const f = setup(t);
    f.network.handle = async (url) =>
      url.includes("/token") ? reply(f.token()) : url.includes("/userinfo") ? reply({ sub: "g", email: "o@r.nl", email_verified: true }) : reply(body, body.error.status === "RESOURCE_EXHAUSTED" ? 429 : 403);
    const res = await f.complete(await f.start());
    assert.match(res.headers.get("location"), /error=api_access&provider=google_business/);
    const c = f.tables.integration_connections[0];
    assert.equal(c.status, "api_access_required");
    assert.ok(c.encrypted_credentials, "credentials are kept so access works once Google approves");
    const list = await f.action("locations");
    assert.equal(list.status, 403);
    assert.match((await list.json()).error, /API-toegang moet eerst door Google worden goedgekeurd/);
    t.mock.restoreAll();
  }
});

test("reviews: normalized, paginated, Google summary on page one only", async (t) => {
  const f = setup(t);
  await f.connect();
  const res = await f.reviews("route.ts").GET(f.request("/api/reviews?pageSize=25"));
  assert.equal(res.status, 200);
  const page = await res.json();
  assert.deepEqual([page.averageRating, page.totalReviewCount, page.nextPageToken], [4.4, 87, "page-2"]);
  assert.deepEqual(page.reviews.map((r) => [r.id, r.rating, !!r.reply]), [["r1", 4, false], ["r2", 2, true]]);
  assert.equal(page.reviews[0].reviewer.photoUrl, "https://lh3.googleusercontent.com/a/photo");
  const call = new URL(f.requests.find((r) => r.url.includes("/reviews?")).url);
  assert.equal(call.pathname, "/v4/accounts/1/locations/11/reviews");
  assert.equal(call.searchParams.get("pageSize"), "25");
  const next = await (await f.reviews("route.ts").GET(f.request("/api/reviews?pageToken=page-2"))).json();
  assert.equal(next.averageRating, null);
  assert.ok(f.requests.some((r) => r.url.includes("pageToken=page-2")));
  const one = await f.reviews("[id]/route.ts").GET(f.request("/"), { params: Promise.resolve({ id: "r1" }) });
  assert.equal((await one.json()).review.comment, "Heerlijk gegeten");
});

test("reply create/update returns Google's reply; delete calls Google; nothing local is faked", async (t) => {
  const f = setup(t);
  await f.connect();
  const api = f.reviews("[id]/reply/route.ts");
  const res = await api.PUT(f.request("/", "PUT", { comment: "Dank je wel, Sanne!" }), { params: Promise.resolve({ id: "r1" }) });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).reply, { comment: "Dank je wel, Sanne!", updateTime: "2026-10-07T12:00:00Z" });
  const put = f.requests.find((r) => r.url.endsWith("/reviews/r1/reply") && r.init.method === "PUT");
  assert.equal(new URL(put.url).pathname, "/v4/accounts/1/locations/11/reviews/r1/reply");
  assert.equal((await api.DELETE(f.request("/", "DELETE"), { params: Promise.resolve({ id: "r1" }) })).status, 200);
  assert.ok(f.requests.some((r) => r.url.endsWith("/reviews/r1/reply") && r.init.method === "DELETE"));
  assert.equal((await api.PUT(f.request("/", "PUT", { comment: "" }), { params: Promise.resolve({ id: "r1" }) })).status, 400);
  assert.equal((await api.PUT(f.request("/", "PUT", { comment: "x" }), { params: Promise.resolve({ id: "../evil" }) })).status, 400);
  f.network.handle = async () => reply({ error: { status: "INVALID_ARGUMENT" } }, 400);
  const rejected = await api.PUT(f.request("/", "PUT", { comment: "Hoi" }), { params: Promise.resolve({ id: "r1" }) });
  assert.equal(rejected.status, 400);
  assert.doesNotMatch((await rejected.json()).error, /INVALID_ARGUMENT/);
});

test("token refresh preserves the refresh token; revoked access requires reconnect; temporary errors keep the connection", async (t) => {
  const f = setup(t);
  const { c } = await f.connect();
  c.expires_at = new Date(0).toISOString();
  f.network.handle = async (url) => (url.includes("/token") ? reply(f.token({ access_token: "new", refresh_token: undefined })) : reply({}));
  assert.equal((await f.gbp.businessToken("w1")).token.refresh_token, "refresh-fixture");
  assert.equal(f.crypto.decrypt(c.encrypted_credentials, "w1:google_business").access_token, "new");
  for (const kind of ["network", "server", "revoked"]) {
    c.expires_at = new Date(0).toISOString();
    f.network.handle = async () => {
      if (kind === "network") throw Error("private-details");
      return reply({ error: kind === "revoked" ? "invalid_grant" : "x" }, kind === "revoked" ? 400 : 500);
    };
    await assert.rejects(f.gbp.businessToken("w1"));
    assert.equal(c.status, kind === "revoked" ? "reconnect_required" : "connected");
  }
});

test("workspace isolation: foreign workspace, logged-out user and members cannot connect or read", async (t) => {
  const f = setup(t);
  await f.connect();
  f.jar.set("mavix-workspace", { value: "w2" });
  assert.equal((await f.reviews("route.ts").GET(f.request("/api/reviews"))).status, 403);
  assert.equal((await f.action("status")).status, 403);
  f.jar.clear();
  f.state.user = null;
  assert.equal((await f.reviews("route.ts").GET(f.request("/api/reviews"))).status, 401);
  f.state.user = { id: "u1" };
  f.tables.workspace_members[0].role = "MEMBER";
  const before = f.requests.length;
  assert.equal((await f.action("connect", "POST")).status, 403);
  assert.equal((await f.action("select", "POST", "", { account: "accounts/1", location: "locations/11" })).status, 403);
  assert.equal(f.requests.length, before, "no Google call before authorization");
});

test("disconnect clears credentials and location, deletes nothing at Google and leaves Gmail/Calendar alone", async (t) => {
  const f = setup(t);
  const { c } = await f.connect();
  f.tables.integration_connections.push({ id: "gm", workspace_id: "w1", provider: "gmail", status: "connected", encrypted_credentials: "gmail-fixture" });
  const before = f.requests.length;
  assert.equal((await f.action("disconnect", "POST")).status, 200);
  assert.deepEqual([c.status, c.encrypted_credentials, c.account_email], ["disconnected", null, null]);
  assert.deepEqual(c.metadata, {});
  assert.equal(f.requests.length, before, "no Google calls (nothing revoked or deleted)");
  assert.equal(f.tables.integration_connections[1].encrypted_credentials, "gmail-fixture");
  assert.equal((await f.reviews("route.ts").GET(f.request("/api/reviews"))).status, 409);
});

test("pure helpers: safe photos, anonymous reviewers, filters and loaded-only stats", () => {
  const r = normalizeReview({ reviewId: "x1", starRating: "FIVE", reviewer: { displayName: "A", profilePhotoUrl: "https://evil.example/p.png" }, createTime: "2026-10-05T00:00:00Z" }, "locations/1");
  assert.equal(r.reviewer.photoUrl, null);
  const anon = normalizeReview({ reviewId: "x2", reviewer: { isAnonymous: true, displayName: "Hidden" } }, "locations/1");
  assert.equal(anon.reviewer.name, "Anonieme Google-gebruiker");
  assert.equal(anon.rating, null);
  assert.equal(normalizeReview({ reviewId: "../bad" }, "l"), null);
  const page = normalizeReviewsPage({ reviews: [{ reviewId: "a", starRating: "ONE" }, { reviewId: "b", starRating: "THREE", reviewReply: { comment: "ok" } }] }, "l", true);
  assert.deepEqual(["low", "mid", "unanswered", "answered"].map((f) => page.reviews.filter((x) => matchesFilter(x, f)).length), [1, 1, 1, 1]);
  assert.deepEqual(loadedStats([r], Date.parse("2026-10-07T00:00:00Z")), { loaded: 1, unanswered: 1, lastThirtyDays: 1 });
});
