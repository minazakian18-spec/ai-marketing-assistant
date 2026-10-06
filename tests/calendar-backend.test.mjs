import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";

const origin = "https://mavix.webbo-solutions.nl";
const callback = origin + "/api/integrations/google_calendar/callback";
const cookieName = "mavix_oauth_google_calendar";
const eventInput = {
  title: "Meeting",
  allDay: true,
  startDate: "2026-10-10",
  endDate: "2026-10-10",
  timeZone: "Europe/Amsterdam",
  reminder: "default",
  repeat: null,
};
const googleEvent = {
  id: "event1",
  summary: "Meeting",
  start: { date: "2026-10-10" },
  end: { date: "2026-10-11" },
};

function setup(t) {
  process.env.APP_URL = origin;
  process.env.GOOGLE_CLIENT_ID = "client-fixture";
  process.env.GOOGLE_CLIENT_SECRET = "secret-fixture";
  process.env.OAUTH_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  const tables = {
    workspace_members: [{ user_id: "u1", workspace_id: "w1", role: "OWNER" }],
    workspaces: [{ id: "w1", deleted_at: null }],
    integration_connections: [],
    oauth_states: [],
  };
  const db = memoryDb(tables),
    jar = new Map(),
    state = { user: { id: "u1" } },
    requests = [];
  db.auth = {
    getUser: async () => ({ data: { user: state.user }, error: null }),
  };
  const cookies = {
    get: (name) => jar.get(name),
    set: (name, value, options) => jar.set(name, { value, options }),
    delete: (name) => jar.delete(name),
  };
  const supabase = {
    adminClient: () => db,
    authClient: async () => db,
    appUrl: () => origin,
  };
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: supabase,
    "next/headers": { cookies: async () => cookies },
    "@/lib/server/auth-limit": { authLimit: async () => {} },
    "@/lib/server/meta": {},
    "@/lib/server/inbox": {
      GMAIL_READ_SCOPE: "https://www.googleapis.com/auth/gmail.readonly",
    },
  });
  const credentials = load("src/lib/server/calendar-credentials.ts");
  const crypto = load("src/lib/server/crypto.ts");
  const oauth = load("src/lib/server/calendar-oauth.ts");
  const events = load("src/app/api/calendar/events/route.ts");
  const calendar = load("src/lib/server/calendar.ts");
  const tokenResponse = (over = {}) => ({
    access_token: "access-fixture",
    refresh_token: "refresh-fixture",
    expires_in: 3600,
    token_type: "Bearer",
    scope: credentials.CALENDAR_SCOPES.join(" "),
    ...over,
  });
  const reply = (data, status = 200) =>
    new Response(status === 204 ? null : JSON.stringify(data), { status });
  const network = {
    handle: async (url, init) => {
      if (url.includes("oauth2.googleapis.com/token"))
        return reply(tokenResponse());
      if (url.includes("/userinfo"))
        return reply({
          sub: "google1",
          email: "test@example.com",
          email_verified: true,
        });
      if (url.includes("/calendarList"))
        return reply({
          items: [
            {
              id: "test@example.com",
              summary: "Test",
              primary: true,
              accessRole: "owner",
            },
          ],
        });
      if (url.includes("/events"))
        return init.method === "DELETE"
          ? reply(null, 204)
          : reply(
              init.method || /\/events\/event1/.test(url)
                ? googleEvent
                : { items: [googleEvent] },
            );
      throw new Error("Unexpected fixture request: " + url);
    },
  };
  t.mock.method(globalThis, "fetch", async (url, init = {}) => {
    requests.push({ url: String(url), init });
    return network.handle(String(url), init);
  });
  const request = (
    method = "GET",
    body,
    url = origin + "/api/calendar/events",
  ) =>
    new Request(url, {
      method,
      headers: { origin, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const action = (name, method = "GET", url, body) =>
    oauth.handleCalendarIntegration(
      request(
        method,
        body,
        url || origin + "/api/integrations/google_calendar/" + name,
      ),
      name,
    );
  async function start() {
    const response = await action("connect", "POST");
    assert.equal(response.status, 200);
    return new URL((await response.json()).url);
  }
  async function complete(url) {
    return action(
      "callback",
      "GET",
      callback + "?code=code-fixture&state=" + url.searchParams.get("state"),
    );
  }
  async function connect() {
    const response = await complete(await start());
    assert.equal(response.status, 303);
    assert.equal(
      new URL(response.headers.get("location")).search,
      "?connected=1",
    );
    return tables.integration_connections[0];
  }
  return {
    tables,
    db,
    jar,
    state,
    requests,
    load,
    credentials,
    crypto,
    oauth,
    calendar,
    events,
    tokenResponse,
    reply,
    network,
    request,
    action,
    start,
    complete,
    connect,
  };
}

test("OAuth start uses offline Calendar-only scopes, secure state, PKCE and dedicated callback; GET and POST work", async (t) => {
  const f = setup(t),
    url = await f.start();
  assert.equal(url.searchParams.get("redirect_uri"), callback);
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.doesNotMatch(url.searchParams.get("scope"), /gmail|business/);
  const cookie = f.jar.get(cookieName);
  assert.equal(cookie.options.httpOnly, true);
  assert.equal(cookie.options.secure, true);
  assert.equal(
    f.tables.oauth_states[0].token_hash,
    f.crypto.hash(cookie.value),
  );
  assert.equal(
    url.searchParams.get("code_challenge"),
    Buffer.from(
      f.crypto.hash(f.tables.oauth_states[0].verifier),
      "hex",
    ).toString("base64url"),
  );
  assert.equal((await f.action("connect")).status, 303);
  const crossSite = new Request(
    origin + "/api/integrations/google_calendar/connect",
    { headers: { origin: "https://attacker.example" } },
  );
  assert.equal(
    (await f.oauth.handleCalendarIntegration(crossSite, "connect")).status,
    403,
  );
});

test("callback exchanges code server-side, encrypts tokens, returns safe status and rejects replay", async (t) => {
  const f = setup(t),
    url = await f.start(),
    response = await f.complete(url);
  assert.equal(response.status, 303);
  const c = f.tables.integration_connections[0];
  assert.equal(c.account_email, "test@example.com");
  assert.doesNotMatch(
    c.encrypted_credentials,
    /access-fixture|refresh-fixture/,
  );
  assert.equal(
    f.crypto.decrypt(c.encrypted_credentials, "w1:google_calendar")
      .refresh_token,
    "refresh-fixture",
  );
  assert.throws(() =>
    f.crypto.decrypt(c.encrypted_credentials, "w2:google_calendar"),
  );
  assert.equal(f.requests[0].init.body.get("code_verifier").length, 64);
  const status = await f.action("status"),
    text = await status.text();
  assert.equal(JSON.parse(text).connected, true);
  assert.doesNotMatch(
    text,
    /access-fixture|refresh-fixture|encrypted_credentials/,
  );
  f.jar.set(cookieName, { value: url.searchParams.get("state") });
  assert.equal((await f.complete(url)).status, 400);
});

test("callback rejects wrong browser, expired state, switched workspace and denied consent", async (t) => {
  const f = setup(t);
  let url = await f.start();
  f.jar.delete(cookieName);
  assert.equal((await f.complete(url)).status, 400);
  url = await f.start();
  f.tables.oauth_states.at(-1).expires_at = "2000-01-01";
  assert.equal((await f.complete(url)).status, 400);
  url = await f.start();
  f.jar.set("mavix-workspace", { value: "w2" });
  assert.equal((await f.complete(url)).status, 403);
  f.jar.delete("mavix-workspace");
  url = await f.start();
  const denied = await f.action(
    "callback",
    "GET",
    callback + "?error=access_denied&state=" + url.searchParams.get("state"),
  );
  assert.match(denied.headers.get("location"), /calendar_error=denied/);
  assert.equal(f.requests.length, 0);
});

test("no refresh token or missing Calendar permissions never yields a connected integration", async (t) => {
  const f = setup(t),
    normal = f.network.handle;
  f.network.handle = (url, init) =>
    url.includes("/token")
      ? f.reply(f.tokenResponse({ refresh_token: undefined }))
      : normal(url, init);
  assert.match(
    (await f.complete(await f.start())).headers.get("location"),
    /offline_access/,
  );
  assert.equal(f.tables.integration_connections[0].status, "disconnected");
  f.network.handle = (url, init) =>
    url.includes("/token")
      ? f.reply(f.tokenResponse({ scope: "openid email" }))
      : normal(url, init);
  assert.match(
    (await f.complete(await f.start())).headers.get("location"),
    /permission/,
  );
  assert.equal(f.tables.integration_connections[0].status, "disconnected");
});

test("repeat consent retains refresh token only for the same Google account", async (t) => {
  const f = setup(t);
  await f.connect();
  const normal = f.network.handle;
  f.network.handle = (url, init) =>
    url.includes("/token")
      ? f.reply(f.tokenResponse({ refresh_token: undefined }))
      : normal(url, init);
  await f.connect();
  f.network.handle = (url, init) =>
    url.includes("/userinfo")
      ? f.reply({
          sub: "different-google",
          email: "other@example.com",
          email_verified: true,
        })
      : url.includes("/token")
        ? f.reply(f.tokenResponse({ refresh_token: undefined }))
        : normal(url, init);
  assert.match(
    (await f.complete(await f.start())).headers.get("location"),
    /offline_access/,
  );
  assert.equal(
    f.tables.integration_connections[0].provider_account_id,
    "google1",
  );
});

test("automatic refresh preserves refresh token; a 401 triggers one refresh and retry", async (t) => {
  const f = setup(t),
    c = await f.connect(),
    normal = f.network.handle;
  c.expires_at = new Date(0).toISOString();
  f.network.handle = (url, init) =>
    url.includes("/token")
      ? f.reply(
          f.tokenResponse({
            access_token: "fresh-access",
            refresh_token: undefined,
          }),
        )
      : normal(url, init);
  const result = await f.credentials.calendarToken("w1", "u1");
  assert.equal(result.token.access_token, "fresh-access");
  assert.equal(result.token.refresh_token, "refresh-fixture");
  assert.ok(Date.parse(c.expires_at) > Date.now());
  let attempts = 0;
  f.network.handle = (url, init) =>
    url.includes("/calendarList") && attempts++ === 0
      ? f.reply({ error: {} }, 401)
      : url.includes("/token")
        ? f.reply(f.tokenResponse({ access_token: "retry-access" }))
        : normal(url, init);
  assert.equal((await f.action("calendars")).status, 200);
  assert.equal(attempts, 2);
});

test("revoked refresh requires reconnect; transient failures retain a usable connection", async (t) => {
  const f = setup(t),
    c = await f.connect();
  c.expires_at = new Date(0).toISOString();
  f.network.handle = async () =>
    f.reply({ error: "server_error", error_description: "SECRET" }, 503);
  await assert.rejects(
    f.credentials.calendarToken("w1", "u1"),
    (e) => e.status === 503 && !e.message.includes("SECRET"),
  );
  assert.equal(c.status, "connected");
  f.network.handle = async () =>
    f.reply({ error: "invalid_grant", error_description: "SECRET" }, 400);
  await assert.rejects(
    f.credentials.calendarToken("w1", "u1"),
    (e) => e.status === 409,
  );
  assert.equal(c.status, "reconnect_required");
  assert.equal((await (await f.action("status")).json()).connected, false);
});

test("disconnect erases credentials, identity, states and mappings without deleting Google events", async (t) => {
  const f = setup(t),
    c = await f.connect(),
    pending = await f.start();
  f.tables.calendar_event_links = [{ workspace_id: "w1" }];
  assert.equal((await f.action("disconnect", "POST")).status, 200);
  assert.equal(c.encrypted_credentials, null);
  assert.equal(c.account_email, null);
  assert.equal(c.status, "disconnected");
  assert.equal(f.tables.calendar_event_links.length, 0);
  assert.equal(f.tables.oauth_states.length, 0);
  f.jar.set(cookieName, { value: pending.searchParams.get("state") });
  assert.equal((await f.complete(pending)).status, 400);
  assert.ok(!f.requests.some((r) => r.init.method === "DELETE"));
});

test("disconnect during code exchange prevents callback from restoring credentials", async (t) => {
  const f = setup(t),
    pending = await f.start(),
    normal = f.network.handle;
  f.network.handle = async (url, init) => {
    if (url.includes("/token"))
      assert.equal((await f.action("disconnect", "POST")).status, 200);
    return normal(url, init);
  };
  assert.equal((await f.complete(pending)).status, 409);
  assert.equal(f.tables.integration_connections[0].encrypted_credentials, null);
});

test("disconnect during refresh prevents refresh from restoring credentials", async (t) => {
  const f = setup(t),
    c = await f.connect(),
    normal = f.network.handle;
  c.expires_at = new Date(0).toISOString();
  f.network.handle = async (url, init) => {
    if (url.includes("/token")) {
      c.status = "disconnected";
      c.encrypted_credentials = null;
      c.connection_generation = "new-generation";
    }
    return normal(url, init);
  };
  await assert.rejects(
    f.credentials.calendarToken("w1", "u1"),
    (e) => e.status === 409,
  );
  assert.equal(c.encrypted_credentials, null);
});

test("calendars paginate; list, create, update and delete events operate on Google", async (t) => {
  const f = setup(t);
  await f.connect();
  const normal = f.network.handle;
  f.network.handle = async (url, init) =>
    url.includes("/calendarList") && !url.includes("pageToken")
      ? f.reply({
          items: [{ id: "secondary", accessRole: "reader" }],
          nextPageToken: "page2",
        })
      : normal(url, init);
  const calendars = await (await f.action("calendars")).json();
  assert.equal(calendars.calendars.length, 2);
  const listUrl =
    origin +
    "/api/calendar/events?start=2026-10-01T00:00:00Z&end=2026-11-01T00:00:00Z&calendars=primary";
  const list = await f.events.GET(f.request("GET", undefined, listUrl));
  assert.equal(list.status, 200);
  assert.equal((await list.json()).events[0].id, "event1");
  const create = await f.events.POST(
    f.request("POST", { calendarId: "primary", input: eventInput }),
  );
  assert.equal(create.status, 200);
  assert.equal(
    (
      await f.events.PATCH(
        f.request("PATCH", {
          calendarId: "primary",
          eventId: "event1",
          scope: "this",
          input: eventInput,
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await f.events.DELETE(
        f.request("DELETE", {
          calendarId: "primary",
          eventId: "event1",
          scope: "this",
        }),
      )
    ).status,
    200,
  );
  for (const method of ["POST", "PATCH", "DELETE"])
    assert.ok(
      f.requests.some(
        (r) => r.init.method === method && r.url.includes("/events"),
      ),
    );
  assert.equal(f.tables.calendar_event_links?.length || 0, 0);
});

test("tenant membership, connector ownership, anonymous requests and mutation CSRF are enforced", async (t) => {
  const f = setup(t);
  await f.connect();
  f.requests.length = 0;
  f.jar.set("mavix-workspace", { value: "w2" });
  assert.equal((await f.action("calendars")).status, 403);
  f.jar.delete("mavix-workspace");
  f.state.user = { id: "u2" };
  f.tables.workspace_members.push({
    user_id: "u2",
    workspace_id: "w1",
    role: "MEMBER",
  });
  assert.equal((await f.action("calendars")).status, 403);
  assert.equal((await f.action("connect", "POST")).status, 403);
  assert.equal(f.requests.length, 0);
  f.state.user = null;
  assert.equal(
    (
      await f.events.GET(
        f.request(
          "GET",
          undefined,
          origin +
            "/api/calendar/events?start=2026-10-01T00:00:00Z&end=2026-10-02T00:00:00Z",
        ),
      )
    ).status,
    401,
  );
  f.state.user = { id: "u1" };
  const evil = new Request(origin + "/api/calendar/events", {
    method: "POST",
    headers: { origin: "https://evil.example" },
    body: "{}",
  });
  assert.equal((await f.events.POST(evil)).status, 403);
});

test("invalid IDs, reversed ranges, Google rate limits and missing permissions return safe errors", async (t) => {
  const f = setup(t);
  await f.connect();
  assert.equal(
    (
      await f.events.DELETE(
        f.request("DELETE", {
          calendarId: "primary",
          eventId: "../private",
          scope: "this",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.events.POST(
        f.request("POST", { calendarId: "unknown", input: eventInput }),
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await f.events.GET(
        f.request(
          "GET",
          undefined,
          origin +
            "/api/calendar/events?start=2026-11-01T00:00:00Z&end=2026-10-01T00:00:00Z",
        ),
      )
    ).status,
    400,
  );
  for (const [status, reason, expected] of [
    [403, "rateLimitExceeded", 429],
    [403, "forbidden", 403],
    [404, "notFound", 404],
    [403, "insufficientPermissions", 403],
  ]) {
    f.network.handle = async () =>
      f.reply({ error: { message: "SECRET", errors: [{ reason }] } }, status);
    const response = await f.action("calendars");
    assert.equal(response.status, expected);
    assert.doesNotMatch(await response.text(), /SECRET/);
  }
  assert.equal(
    f.tables.integration_connections[0].status,
    "permission_missing",
  );
});

test("database status failure is not reported as a disconnected account", async (t) => {
  const f = setup(t);
  f.tables.failTable = "integration_connections";
  assert.equal((await f.action("status")).status, 503);
});

test("public integration route dispatches both provider spellings to Calendar services", async (t) => {
  const f = setup(t),
    route = f.load("src/app/api/integrations/[provider]/[action]/route.ts");
  for (const provider of ["google_calendar", "google-calendar"]) {
    const response = await route.POST(f.request("POST"), {
      params: Promise.resolve({ provider, action: "connect" }),
    });
    assert.equal(response.status, 200);
    assert.equal(
      new URL((await response.json()).url).searchParams.get("redirect_uri"),
      callback,
    );
    const status = await route.GET(f.request(), {
      params: Promise.resolve({ provider, action: "status" }),
    });
    assert.equal(status.status, 200);
    assert.equal((await status.json()).connected, false);
  }
});

test("a second Google 401 requires reconnect and does not retry indefinitely", async (t) => {
  const f = setup(t);
  await f.connect();
  const normal = f.network.handle;
  let calls = 0;
  f.network.handle = (url, init) => {
    if (url.includes("/calendarList")) {
      calls++;
      return f.reply({ error: {} }, 401);
    }
    return normal(url, init);
  };
  assert.equal((await f.action("calendars")).status, 409);
  assert.equal(calls, 2);
  assert.equal(
    f.tables.integration_connections[0].status,
    "reconnect_required",
  );
});

test("concurrent refreshes preserve the winning credentials and an omitted refresh token", async (t) => {
  const f = setup(t),
    c = await f.connect();
  c.expires_at = new Date(0).toISOString();
  let calls = 0;
  f.network.handle = async () =>
    f.reply(
      f.tokenResponse({
        access_token: "access-" + ++calls,
        refresh_token: undefined,
      }),
    );
  const [one, two] = await Promise.all([
    f.credentials.calendarToken("w1", "u1"),
    f.credentials.calendarToken("w1", "u1"),
  ]);
  const saved = f.crypto.decrypt(c.encrypted_credentials, "w1:google_calendar");
  assert.equal(saved.refresh_token, "refresh-fixture");
  assert.equal(one.token.access_token, saved.access_token);
  assert.equal(two.token.access_token, saved.access_token);
});

test("dense event ranges return an explicit error rather than silently dropping later pages", async (t) => {
  const f = setup(t);
  await f.connect();
  const normal = f.network.handle;
  f.network.handle = (url, init) =>
    url.includes("/events?")
      ? f.reply({ items: [googleEvent], nextPageToken: "next" })
      : normal(url, init);
  await assert.rejects(
    f.calendar.listEvents(
      { workspaceId: "w1", userId: "u1" },
      ["primary"],
      "2026-10-01T00:00:00Z",
      "2026-11-01T00:00:00Z",
    ),
    (e) => e.status === 422,
  );
});

test("existing Google login and Supabase callback keep their original scopes and redirect", async (t) => {
  const f = setup(t);
  let params;
  f.db.auth.signInWithOAuth = async (value) => {
    params = value;
    return {
      data: { url: "https://accounts.google.com/login-fixture" },
      error: null,
    };
  };
  const login = f.load("src/app/api/auth/[action]/route.ts");
  const response = await login.POST(f.request("POST", {}), {
    params: Promise.resolve({ action: "google" }),
  });
  assert.equal(response.status, 200);
  assert.equal(params.options.scopes, "openid email profile");
  assert.equal(params.options.redirectTo, origin + "/auth/callback");
  f.db.auth.exchangeCodeForSession = async (code) => {
    assert.equal(code, "login-code");
    return { error: null };
  };
  const authCallback = f.load("src/app/auth/callback/route.ts");
  assert.equal(
    (
      await authCallback.GET(
        f.request("GET", undefined, origin + "/auth/callback?code=login-code"),
      )
    ).headers.get("location"),
    origin + "/dashboard",
  );
  assert.equal(f.tables.integration_connections.length, 0);
});
