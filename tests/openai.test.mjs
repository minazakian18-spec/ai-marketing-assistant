import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";

const OpenAI = createRequire(import.meta.url)("openai").default;
const origin = "https://mavix.webbo-solutions.nl";
const FAKE_KEY = "sk-test-fixture-000000000000";

function setup(tables, { role = "OWNER", access = "approved" } = {}) {
  tables.workspace_members ??= [{ user_id: "u1", workspace_id: "w1", role, created_at: "1" }];
  tables.workspaces ??= [{ id: "w1", deleted_at: null, access_status: access }];
  tables.ai_usage ??= [];
  const db = memoryDb(tables, { uuid: true });
  db.auth = { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) };
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
  });
  const calls = [];
  let reply = async () => ({ status: "completed", output_text: "Hallo!", usage: { input_tokens: 1000, output_tokens: 200 } });
  load("src/lib/server/openai.ts").__setOpenAIClient({ responses: { create: async (p) => (calls.push(p), reply(p)) } });
  return { db, load, calls, setReply: (fn) => (reply = fn) };
}
function withEnv(vars, fn) {
  const old = {};
  for (const [k, v] of Object.entries(vars)) {
    old[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [k, v] of Object.entries(old)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  });
}
const quiet = (t) => {
  t.mock.method(console, "info", () => {});
  t.mock.method(console, "error", () => {});
};
const apiError = (Cls, status, code) => new Cls(status, { code, message: "provider detail " + FAKE_KEY }, "provider detail", new Headers());

test("OpenAI: Responses API with the cost-efficient default model, feature output limit, no storage, tokens and cost recorded", (t) =>
  withEnv({ OPENAI_API_KEY: FAKE_KEY, OPENAI_MODEL: undefined, OPENAI_ADVANCED_MODEL: undefined }, async () => {
    quiet(t);
    const tables = {};
    const { load, calls } = setup(tables);
    const usage = load("src/lib/server/ai-usage.ts");
    const ai = load("src/lib/server/ai.ts");
    const text = await usage.metered({ workspaceId: "w1", user: { id: "u1" } }, "review_reply", () => ai.generateReviewReply({ reviewer: "Sanne de Vries", rating: 5, comment: "Heerlijk" }, { name: "Telepizza" }, {}));
    assert.equal(text, "Hallo!");
    const [call] = calls;
    assert.equal(call.model, "gpt-5.6-luna");
    assert.equal(call.max_output_tokens, usage.OUTPUT_LIMIT.review_reply);
    assert.equal(call.store, false);
    assert.deepEqual(call.reasoning, { effort: "none" });
    assert.match(call.instructions, /never publish anything yourself/);
    assert.ok(!JSON.stringify(call).includes("de Vries"), "only the reviewer's first name reaches the model");
    const row = tables.ai_usage[0];
    assert.deepEqual([row.status, row.model, row.input_tokens, row.output_tokens, row.cost_micro_usd], ["succeeded", "gpt-5.6-luna", 1000, 200, 1000 * 0.2 + 200 * 1.2]);
  }));

test("OpenAI: e-mails, inbox replies and the agent use the advanced model; env overrides both", (t) =>
  withEnv({ OPENAI_API_KEY: FAKE_KEY, OPENAI_MODEL: "gpt-5-nano", OPENAI_ADVANCED_MODEL: "gpt-5-mini" }, async () => {
    quiet(t);
    const { load, calls, setReply } = setup({});
    setReply(async () => ({ status: "completed", output_text: "SUBJECT: Hoi\nPREVIEW: p\nCTA: Bekijk\nBODY:\nHallo daar", usage: { input_tokens: 1, output_tokens: 1 } }));
    const ai = load("src/lib/server/ai.ts");
    const mail = await ai.generateEmailText({ kind: "Create Newsletter", instruction: "Nieuws", useDescription: false, variant: 0 }, {});
    assert.equal(mail.subject, "Hoi");
    assert.equal(mail.body, "Hallo daar");
    assert.equal(calls[0].model, "gpt-5-mini");
    assert.deepEqual(calls[0].reasoning, { effort: "low" });
    setReply(async () => ({ status: "completed", output_text: "Kort.", usage: { input_tokens: 1, output_tokens: 1 } }));
    await ai.editContent("shorter", "Een lange tekst om in te korten.", "instagram", {});
    assert.equal(calls[1].model, "gpt-5-nano");
  }));

test("OpenAI errors: exhausted credit, rate limit, bad key and unknown model give clear Dutch messages without provider details", (t) =>
  withEnv({ OPENAI_API_KEY: FAKE_KEY }, async () => {
    quiet(t);
    const tables = {};
    const { load, setReply } = setup(tables);
    const usage = load("src/lib/server/ai-usage.ts");
    const ai = load("src/lib/server/ai.ts");
    const cases = [
      [apiError(OpenAI.RateLimitError, 429, "insufficient_quota"), 503, /AI-tegoed van Mavix is op/],
      [apiError(OpenAI.RateLimitError, 429, "rate_limit_exceeded"), 429, /even druk/],
      [apiError(OpenAI.AuthenticationError, 401, "invalid_api_key"), 503, /niet goed geconfigureerd/],
      [apiError(OpenAI.NotFoundError, 404, "model_not_found"), 503, /model is niet beschikbaar/],
      [new OpenAI.APIConnectionError({ message: "socket hang up" }), 503, /niet bereikbaar/],
    ];
    for (const [err, status, message] of cases) {
      setReply(async () => {
        throw err;
      });
      await assert.rejects(
        usage.metered({ workspaceId: "w1", user: { id: "u1" } }, "seo_suggest", () => ai.generateSeoSuggestions("title", { url: "https://x.nl", title: "", metaDescription: "", h1: [], textSample: "", keyword: "" }, {})),
        (e) => {
          assert.equal(e.status, status);
          assert.match(e.message, message);
          assert.ok(!e.message.includes(FAKE_KEY) && !e.message.includes("provider detail"));
          return true;
        },
      );
    }
    assert.ok(tables.ai_usage.every((r) => r.status === "failed" && r.cost_micro_usd === 0), "failed requests are logged, not charged");
  }));

test("OpenAI: an incomplete response without text is an error, never an empty draft", (t) =>
  withEnv({ OPENAI_API_KEY: FAKE_KEY }, async () => {
    quiet(t);
    const { load, setReply } = setup({});
    setReply(async () => ({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output_text: "", usage: { input_tokens: 10, output_tokens: 900 } }));
    await assert.rejects(load("src/lib/server/ai.ts").improveBrandText("description", "Wij bakken pizza's in Utrecht.", {}), (e) => e.status === 502);
  }));

test("OpenAI: without a key nothing is called", (t) =>
  withEnv({ OPENAI_API_KEY: undefined }, async () => {
    quiet(t);
    const { load, calls } = setup({});
    const openai = load("src/lib/server/openai.ts");
    assert.equal(openai.aiConfigured(), false);
    await assert.rejects(openai.aiText("x", [{ role: "user", content: [{ type: "text", text: "hoi" }] }]), (e) => e.status === 503);
    assert.equal(calls.length, 0);
  }));

test("cost safeguard: the global monthly budget stops every workspace before the provider credit runs out", (t) =>
  withEnv({ OPENAI_API_KEY: FAKE_KEY, AI_GLOBAL_MONTHLY_BUDGET_USD: "8" }, async () => {
    quiet(t);
    const now = new Date().toISOString();
    const tables = { ai_usage: [{ workspace_id: "other", user_id: "u9", input_tokens: 0, output_tokens: 0, cost_micro_usd: 8_000_000, status: "succeeded", created_at: now }] };
    const { load, calls } = setup(tables);
    const usage = load("src/lib/server/ai-usage.ts");
    await assert.rejects(usage.metered({ workspaceId: "w1", user: { id: "u1" } }, "agent", async () => "x"), (e) => e.status === 503 && /budget/.test(e.message));
    assert.equal(calls.length, 0);
    const refused = tables.ai_usage.find((r) => r.workspace_id === "w1");
    assert.deepEqual([refused.status, refused.model, refused.cost_micro_usd], ["failed", "refused", 0], "refused request is logged at zero cost");
  }));

test("conservative defaults: short output limits and modest quotas", () => {
  const { load } = setup({});
  const usage = load("src/lib/server/ai-usage.ts");
  const l = usage.limits();
  assert.equal(l.monthlyTokens, 300_000);
  assert.equal(l.dailyRequestsPerUser, 40);
  assert.equal(l.globalMonthlyMicroUsd, 8_000_000);
  // One campaign call replaces three separate generations (post, e-mail, copy).
  // Images are priced per image size/quality (fixed output tokens), not per answer length.
  assert.ok(Object.entries(usage.OUTPUT_LIMIT).every(([f, n]) => n <= (f === "content_campaign" ? 2600 : f.startsWith("image_") ? 8000 : 1800)));
});

const agentRequest = (body, headers = {}) =>
  new Request(origin + "/api/agent", { method: "POST", headers: { origin, "Content-Type": "application/json", "Idempotency-Key": "agent-key-123456", ...headers }, body: JSON.stringify(body) });

test("Mavix Agent: answers from the caller's own workspace, metered, only allow-listed links", (t) =>
  withEnv({ OPENAI_API_KEY: FAKE_KEY }, async () => {
    quiet(t);
    const tables = {
      business_profiles: [
        { workspace_id: "w1", data: { profile: { name: "Telepizza" }, posts: [{ id: "p", status: "draft" }] } },
        { workspace_id: "w2", data: { profile: { name: "Andere zaak" } } },
      ],
      integration_connections: [
        { workspace_id: "w1", provider: "gmail", status: "connected" },
        { workspace_id: "w2", provider: "whatsapp", status: "connected" },
      ],
    };
    const { load, calls, setReply } = setup(tables);
    setReply(async () => ({ status: "completed", output_text: "Je hebt 1 concept klaarstaan.\nACTIE: /dashboard", usage: { input_tokens: 500, output_tokens: 60 } }));
    const route = load("src/app/api/agent/route.ts");
    const res = await route.POST(agentRequest({ text: "Wat moet ik vandaag doen?" }));
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.reply.content, "Je hebt 1 concept klaarstaan.");
    assert.deepEqual(body.reply.action, { href: "/dashboard", label: "Open Dashboard" });
    const sent = JSON.stringify(calls[0]);
    assert.match(sent, /Telepizza/);
    assert.ok(!sent.includes("Andere zaak") && !sent.includes("whatsapp"), "no data from another workspace");
    assert.equal(calls[0].model, "gpt-5.4-mini");
    assert.deepEqual([tables.ai_usage[0].feature, tables.ai_usage[0].status, tables.ai_usage[0].request_key], ["agent", "succeeded", "agent:agent-key-123456"]);

    setReply(async () => ({ status: "completed", output_text: "Kijk hier.\nACTIE: https://evil.example", usage: { input_tokens: 1, output_tokens: 1 } }));
    const second = await (await route.POST(agentRequest({ text: "Waar?" }, { "Idempotency-Key": "agent-key-999999" }))).json();
    assert.equal(second.reply.action, null, "links outside Mavix are dropped");
  }));

test("Mavix Agent: no key means no AI call (navigation fallback in the browser)", (t) =>
  withEnv({ OPENAI_API_KEY: undefined }, async () => {
    quiet(t);
    const tables = { business_profiles: [{ workspace_id: "w1", data: {} }] };
    const { load, calls } = setup(tables);
    const body = await (await load("src/app/api/agent/route.ts").POST(agentRequest({ text: "Hoi" }))).json();
    assert.deepEqual(body, { configured: false });
    assert.equal(calls.length, 0);
    assert.equal(tables.ai_usage.length, 0);
  }));

test("Mavix Agent: logged-out, pending-beta and cross-site requests are refused before any AI call", (t) =>
  withEnv({ OPENAI_API_KEY: FAKE_KEY }, async () => {
    quiet(t);
    const pending = setup({ business_profiles: [] }, { access: "pending" });
    assert.equal((await pending.load("src/app/api/agent/route.ts").POST(agentRequest({ text: "Hoi" }))).status, 403);
    const loggedOut = setup({});
    loggedOut.db.auth = { getUser: async () => ({ data: { user: null }, error: null }) };
    assert.equal((await loggedOut.load("src/app/api/agent/route.ts").POST(agentRequest({ text: "Hoi" }))).status, 401);
    const csrf = setup({});
    assert.equal((await csrf.load("src/app/api/agent/route.ts").POST(agentRequest({ text: "Hoi" }, { origin: "https://evil.example" }))).status, 403);
    assert.equal(pending.calls.length + loggedOut.calls.length + csrf.calls.length, 0);
  }));

test("cost safeguard: simultaneous requests cannot spend past the global budget together", (t) =>
  withEnv({ OPENAI_API_KEY: FAKE_KEY, AI_GLOBAL_MONTHLY_BUDGET_USD: "0.05", AI_DAILY_REQUESTS_PER_USER: "1000" }, async () => {
    quiet(t);
    const users = Array.from({ length: 12 }, (_, i) => "user" + i);
    const tables = {
      workspace_members: users.map((u) => ({ user_id: u, workspace_id: "w1", role: "OWNER", created_at: "1" })),
      workspaces: [{ id: "w1", deleted_at: null, access_status: "approved" }],
      ai_usage: [],
    };
    const { load } = setup(tables);
    const usage = load("src/lib/server/ai-usage.ts");
    const reservation = usage.reservationMicroUsd("agent");
    let calls = 0;
    const results = await Promise.allSettled(
      users.map((u) =>
        usage.metered({ workspaceId: "w1", user: { id: u } }, "agent", async () => {
          calls++;
          await new Promise((r) => setTimeout(r, 20));
          usage.recordTokens("gpt-5.4-mini", 8000, usage.OUTPUT_LIMIT.agent);
          return "ok";
        }),
      ),
    );
    const passed = results.filter((r) => r.status === "fulfilled").length;
    assert.equal(passed, calls, "only admitted requests reached the model");
    assert.ok(passed * reservation <= 50_000, `admitted ${passed} x ${reservation} must stay within 0.05 USD`);
    assert.ok(passed < users.length, "the budget refused some of the burst");
    const spent = tables.ai_usage.reduce((s, r) => s + r.cost_micro_usd, 0);
    assert.ok(spent <= 50_000, "recorded spend " + spent + " within budget");
    assert.ok(tables.ai_usage.every((r) => r.status !== "pending"), "no reservation left behind");
  }));

test("cost safeguard: the reservation covers the worst case of the configured models", () =>
  withEnv({ OPENAI_MODEL: undefined, OPENAI_ADVANCED_MODEL: undefined }, async () => {
    const usage = setup({}).load("src/lib/server/ai-usage.ts");
    // priciest configured model is gpt-5.4-mini: 0.75 in / 4.50 out per 1M
    assert.equal(usage.reservationMicroUsd("content_email"), Math.round(8000 * 0.75 + 1800 * 4.5));
    assert.ok(usage.costMicroUsd("gpt-5.4-mini", 8000, 1800) <= usage.reservationMicroUsd("content_email"));
  }));

test("cost safeguard: oversized input is refused before any API call; long conversations are trimmed to recent messages", (t) =>
  withEnv({ OPENAI_API_KEY: FAKE_KEY }, async () => {
    quiet(t);
    const { load, calls } = setup({});
    const openai = load("src/lib/server/openai.ts");
    await assert.rejects(openai.aiText("x", [{ role: "user", content: [{ type: "text", text: "a".repeat(30000) }] }]), (e) => e.status === 413);
    assert.equal(calls.length, 0);
    const ai = load("src/lib/server/ai.ts");
    const messages = Array.from({ length: 30 }, (_, i) => ({ from: i % 2 ? "business" : "customer", text: "bericht " + i + " " + "x".repeat(1900), attachments: [], at: "2026-10-10T10:00:00Z" }));
    await ai.generateInboxReply({ channel: "gmail", subject: "Vraag", customerName: "Sanne", messages, profile: {} });
    const sent = JSON.stringify(calls[0].input);
    assert.ok(sent.length < 8000 * 3, "request within the input cap");
    assert.match(sent, /bericht 29 /, "newest message kept");
    assert.ok(!sent.includes("bericht 0 "), "oldest messages dropped");
  }));

test("reasoning tokens are part of output_tokens and are charged as output", (t) =>
  withEnv({ OPENAI_API_KEY: FAKE_KEY }, async () => {
    quiet(t);
    const tables = {};
    const { load, setReply } = setup(tables);
    setReply(async () => ({ status: "completed", output_text: "Klaar.", usage: { input_tokens: 400, output_tokens: 300, output_tokens_details: { reasoning_tokens: 250 } } }));
    const usage = load("src/lib/server/ai-usage.ts");
    await usage.metered({ workspaceId: "w1", user: { id: "u1" } }, "brand_improve", () => load("src/lib/server/ai.ts").improveBrandText("description", "Wij bakken pizza's in Utrecht.", {}));
    const row = tables.ai_usage[0];
    assert.equal(row.output_tokens, 300);
    assert.equal(row.cost_micro_usd, Math.round(400 * 0.2 + 300 * 1.2));
  }));

test("incomplete responses (output limit hit while reasoning) are still recorded and charged", (t) =>
  withEnv({ OPENAI_API_KEY: FAKE_KEY }, async () => {
    quiet(t);
    const tables = {};
    const { load, setReply } = setup(tables);
    setReply(async () => ({ status: "incomplete", output_text: "", usage: { input_tokens: 500, output_tokens: 600, output_tokens_details: { reasoning_tokens: 600 } } }));
    const usage = load("src/lib/server/ai-usage.ts");
    await assert.rejects(usage.metered({ workspaceId: "w1", user: { id: "u1" } }, "brand_improve", () => load("src/lib/server/ai.ts").improveBrandText("description", "Wij bakken pizza's in Utrecht.", {})));
    const row = tables.ai_usage[0];
    assert.deepEqual([row.status, row.output_tokens, row.cost_micro_usd], ["failed", 600, Math.round(500 * 0.2 + 600 * 1.2)]);
  }));