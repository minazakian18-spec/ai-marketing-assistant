import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";

const origin = "https://mavix.webbo-solutions.nl";

function setup(tables, userId = "u1") {
  const db = memoryDb(tables);
  db.auth = { getUser: async () => ({ data: { user: { id: userId, email: "x@example.com" } }, error: null }) };
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) },
  });
  return { db, load };
}

test("private beta: a pending workspace gets no access, an approved one does", async () => {
  const { load } = setup({
    workspace_members: [{ user_id: "u1", workspace_id: "w1", role: "OWNER", created_at: "1" }],
    workspaces: [{ id: "w1", deleted_at: null, access_status: "pending" }],
  });
  const access = load("src/lib/server/access.ts");
  await assert.rejects(access.workspace(), (e) => e instanceof access.AccessPendingError && e.status === 403 && e.access === "pending");
  const res = access.failure(new access.AccessPendingError("pending"));
  assert.equal((await res.json()).access, "pending");
});

test("private beta: suspended workspaces are refused with their own message", async () => {
  const { load } = setup({
    workspace_members: [{ user_id: "u1", workspace_id: "w1", role: "OWNER", created_at: "1" }],
    workspaces: [{ id: "w1", deleted_at: null, access_status: "suspended" }],
  });
  const access = load("src/lib/server/access.ts");
  await assert.rejects(access.workspace(), (e) => e.access === "suspended" && /gepauzeerd/.test(e.message));
});

test("private beta: an invited member skips their own pending workspace and lands in the approved one", async () => {
  const { load } = setup({
    workspace_members: [
      { user_id: "u1", workspace_id: "own", role: "OWNER", created_at: "1" },
      { user_id: "u1", workspace_id: "team", role: "MEMBER", created_at: "2" },
    ],
    workspaces: [
      { id: "own", deleted_at: null, access_status: "pending" },
      { id: "team", deleted_at: null, access_status: "approved" },
    ],
  });
  const access = load("src/lib/server/access.ts");
  const auth = await access.workspace();
  assert.equal(auth.workspaceId, "team");
  assert.equal(auth.role, "MEMBER");
  await assert.rejects(access.workspace(["OWNER", "ADMIN"]), (e) => e.status === 403 && !(e instanceof access.AccessPendingError));
});

test("private beta: missing access columns fail closed (no silent access)", async () => {
  const { db, load } = setup({ workspace_members: [{ user_id: "u1", workspace_id: "w1", role: "OWNER", created_at: "1" }], workspaces: [{ id: "w1", deleted_at: null }] });
  const from = db.from;
  db.from = (t) => {
    const q = from(t);
    if (t !== "workspaces") return q;
    const then = q.then;
    q.then = (res, rej) => Promise.resolve({ data: null, error: { code: "42703", message: "column workspaces.access_status does not exist" } }).then(res, rej);
    void then;
    return q;
  };
  const access = load("src/lib/server/access.ts");
  const errors = [];
  const original = console.error;
  console.error = (m) => errors.push(m);
  try {
    await assert.rejects(access.workspace(), (e) => e.status === 503);
  } finally {
    console.error = original;
  }
  assert.match(errors.join(""), /beta_access_not_provisioned/);
});

test("platform admin: only users listed in platform_admins pass", async () => {
  const { load } = setup({ platform_admins: [{ user_id: "staff" }] }, "u1");
  await assert.rejects(load("src/lib/server/access.ts").platformAdmin(), (e) => e.status === 403);
  const staff = setup({ platform_admins: [{ user_id: "staff" }] }, "staff");
  assert.equal((await staff.load("src/lib/server/access.ts").platformAdmin()).user.id, "staff");
});

test("AI metering: tokens are recorded per request, without prompt or output", async () => {
  const tables = { workspaces: [{ id: "w1", ai_monthly_token_limit: null }], ai_usage: [] };
  const { load } = setup(tables);
  const usage = load("src/lib/server/ai-usage.ts");
  const out = await usage.metered({ workspaceId: "w1", user: { id: "u1" } }, "inbox_reply", async () => {
    assert.equal(usage.currentOutputLimit(), usage.OUTPUT_LIMIT.inbox_reply);
    usage.recordTokens("claude-opus-5-5", 1200, 300);
    return "draft text";
  });
  assert.equal(out, "draft text");
  assert.equal(tables.ai_usage.length, 1);
  const row = tables.ai_usage[0];
  assert.deepEqual(
    { status: row.status, model: row.model, input: row.input_tokens, output: row.output_tokens, feature: row.feature, user: row.user_id },
    { status: "succeeded", model: "claude-opus-5-5", input: 1200, output: 300, feature: "inbox_reply", user: "u1" },
  );
  assert.ok(!JSON.stringify(row).includes("draft text"));
});

test("AI metering: failures are recorded and rethrown", async () => {
  const tables = { workspaces: [{ id: "w1" }], ai_usage: [] };
  const usage = setup(tables).load("src/lib/server/ai-usage.ts");
  await assert.rejects(usage.metered({ workspaceId: "w1", user: { id: "u1" } }, "content_email", async () => Promise.reject(new Error("provider down"))), /provider down/);
  assert.equal(tables.ai_usage[0].status, "failed");
});

test("AI metering: monthly quota, daily cap and concurrent requests are enforced before any AI call", async () => {
  const now = new Date().toISOString();
  const call = async (tables) => {
    let called = false;
    const usage = setup(tables).load("src/lib/server/ai-usage.ts");
    const result = await usage.metered({ workspaceId: "w1", user: { id: "u1" } }, "inbox_reply", async () => (called = true)).catch((e) => e);
    return { result, called };
  };
  const quota = await call({ workspaces: [{ id: "w1", ai_monthly_token_limit: 1000 }], ai_usage: [{ workspace_id: "w1", user_id: "u2", input_tokens: 900, output_tokens: 200, status: "succeeded", created_at: now }] });
  assert.equal(quota.result.status, 429);
  assert.equal(quota.called, false);
  const busy = await call({
    workspaces: [{ id: "w1" }],
    ai_usage: [1, 2].map((i) => ({ id: "p" + i, workspace_id: "w1", user_id: "u1", input_tokens: 0, output_tokens: 0, status: "pending", created_at: now })),
  });
  assert.equal(busy.result.status, 429);
  assert.match(busy.result.message, /vorige verzoek/);
  process.env.AI_DAILY_REQUESTS_PER_USER = "1";
  try {
    const daily = await call({ workspaces: [{ id: "w1" }], ai_usage: [{ workspace_id: "w1", user_id: "u1", input_tokens: 1, output_tokens: 1, status: "succeeded", created_at: now }] });
    assert.equal(daily.result.status, 429);
  } finally {
    delete process.env.AI_DAILY_REQUESTS_PER_USER;
  }
});

test("AI metering: cost uses only configured prices", async () => {
  const usage = setup({}).load("src/lib/server/ai-usage.ts");
  assert.equal(usage.costMicroUsd(1_000_000, 1_000_000), 0);
  process.env.AI_PRICE_INPUT_PER_MTOK = "3";
  process.env.AI_PRICE_OUTPUT_PER_MTOK = "15";
  try {
    assert.equal(usage.costMicroUsd(1_000_000, 100_000), 3_000_000 + 1_500_000);
  } finally {
    delete process.env.AI_PRICE_INPUT_PER_MTOK;
    delete process.env.AI_PRICE_OUTPUT_PER_MTOK;
  }
});

test("content generation: without an AI key nothing is generated in production", async () => {
  const tables = {
    workspace_members: [{ user_id: "u1", workspace_id: "w1", role: "OWNER", created_at: "1" }],
    workspaces: [{ id: "w1", deleted_at: null }],
    business_profiles: [{ workspace_id: "w1", data: { profile: { name: "Telepizza" } } }],
    ai_usage: [],
  };
  const { load } = setup(tables);
  const key = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    for (const kind of ["instagram", "email"]) {
      const route = load(`src/app/api/generate/${kind}/route.ts`);
      const res = await route.POST(new Request(origin + "/api/generate/" + kind, { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "Nieuwe pizza", type: "Post", kind: "Create Promotion" }) }));
      assert.equal(res.status, 503);
      assert.match((await res.json()).error, /niet geconfigureerd/);
    }
    assert.equal(tables.ai_usage.length, 0);
  } finally {
    if (key) process.env.ANTHROPIC_API_KEY = key;
  }
});

test("registration can be closed for the private beta", async () => {
  process.env.MAVIX_SIGNUP = "closed";
  try {
    const db = memoryDb({});
    db.auth = { signUp: async () => assert.fail("signUp must not be called") };
    const load = serverLoader({
      [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
      [path.resolve("src/lib/server/auth-limit.ts")]: { authLimit: async () => {} },
      "next/headers": { cookies: async () => ({ get: () => undefined }) },
    });
    const route = load("src/app/api/auth/[action]/route.ts");
    const res = await route.POST(
      new Request(origin + "/api/auth/register", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ email: "a@b.nl", password: "x".repeat(12), name: "A", businessName: "B" }) }),
      { params: Promise.resolve({ action: "register" }) },
    );
    assert.equal(res.status, 403);
  } finally {
    delete process.env.MAVIX_SIGNUP;
  }
});

test("content generation uses the stored Brand Hub profile, never the browser's, and is metered", async () => {
  const tables = {
    workspace_members: [{ user_id: "u1", workspace_id: "w1", role: "OWNER", created_at: "1" }],
    workspaces: [{ id: "w1", deleted_at: null }],
    business_profiles: [{ workspace_id: "w1", data: { profile: { name: "Telepizza", description: "Pizza", productList: [] } } }],
    ai_usage: [],
  };
  const db = memoryDb(tables);
  db.auth = { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) };
  let received;
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    "@/lib/server/ai": {
      generateInstagramText: async (brief, profile) => {
        received = { brief, profile };
        const usage = load("src/lib/server/ai-usage.ts");
        usage.recordTokens("claude-opus-5-5", 800, 200);
        return { caption: "Echte caption", hashtags: "#pizza" };
      },
    },
  });
  const key = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  try {
    const route = load("src/app/api/generate/instagram/route.ts");
    const res = await route.POST(
      new Request(origin + "/api/generate/instagram", {
        method: "POST",
        headers: { origin, "Content-Type": "application/json", "Idempotency-Key": "abcdef123456" },
        body: JSON.stringify({ prompt: "Pizza van de maand", type: "Post", profile: { name: "Vervalst bedrijf" }, photos: [], variant: 0 }),
      }),
    );
    assert.equal(res.status, 200);
    const post = await res.json();
    assert.equal(post.caption, "Echte caption");
    assert.equal(post.status, "draft");
    assert.equal(received.profile.name, "Telepizza");
    assert.equal(tables.ai_usage.length, 1);
    assert.deepEqual([tables.ai_usage[0].feature, tables.ai_usage[0].status, tables.ai_usage[0].input_tokens, tables.ai_usage[0].request_key], ["content_instagram", "succeeded", 800, "content_instagram:abcdef123456"]);
  } finally {
    if (key) process.env.ANTHROPIC_API_KEY = key;
    else delete process.env.ANTHROPIC_API_KEY;
  }
});

test("members cannot generate content (only owners and admins can save drafts)", async () => {
  const { load } = setup({ workspace_members: [{ user_id: "u1", workspace_id: "w1", role: "MEMBER", created_at: "1" }], workspaces: [{ id: "w1", deleted_at: null }] });
  const route = load("src/app/api/generate/edit/route.ts");
  const res = await route.POST(new Request(origin + "/api/generate/edit", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ action: "shorter", text: "Een tekst om in te korten.", channel: "instagram" }) }));
  assert.equal(res.status, 403);
});
