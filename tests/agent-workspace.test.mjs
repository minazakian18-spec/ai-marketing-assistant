import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";

const OpenAI = createRequire(import.meta.url)("openai").default;
const origin = "https://mavix.webbo-solutions.nl";
const KEY = "sk-test-fixture-agent";

// Two users in workspace w1, one user in workspace w2.
function setup({ user = "u1", tables } = {}) {
  tables ??= {};
  tables.workspace_members ??= [
    { user_id: "u1", workspace_id: "w1", role: "OWNER", created_at: "1" },
    { user_id: "u2", workspace_id: "w1", role: "MEMBER", created_at: "1" },
    { user_id: "u3", workspace_id: "w2", role: "OWNER", created_at: "1" },
  ];
  tables.workspaces ??= [
    { id: "w1", deleted_at: null, access_status: "approved" },
    { id: "w2", deleted_at: null, access_status: "approved" },
  ];
  tables.business_profiles ??= [
    { workspace_id: "w1", data: { profile: { name: "Telepizza" } } },
    { workspace_id: "w2", data: { profile: { name: "Andere zaak" } } },
  ];
  tables.ai_usage ??= [];
  const db = memoryDb(tables, { uuid: true });
  const session = { user };
  db.auth = { getUser: async () => ({ data: { user: session.user ? { id: session.user } : null }, error: null }) };
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
  });
  const calls = [];
  let reply = async () => ({ status: "completed", output_text: "## Plan\n- Post op vrijdag\n- Nieuwsbrief op zondag", usage: { input_tokens: 600, output_tokens: 120 } });
  load("src/lib/server/openai.ts").__setOpenAIClient({ responses: { create: async (p) => (calls.push(p), reply(p)) } });
  const req = (url, method = "GET", body, headers = {}) =>
    new Request(origin + url, { method, headers: { origin, "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const routes = {
    send: load("src/app/api/agent/route.ts"),
    list: load("src/app/api/agent/conversations/route.ts"),
    one: load("src/app/api/agent/conversations/[id]/route.ts"),
    folders: load("src/app/api/agent/folders/route.ts"),
    folder: load("src/app/api/agent/folders/[id]/route.ts"),
  };
  const p = (id) => ({ params: Promise.resolve({ id }) });
  const api = {
    send: async (body, key = crypto.randomUUID()) => {
      const r = await routes.send.POST(req("/api/agent", "POST", body, { "Idempotency-Key": key }));
      return { status: r.status, body: await r.json() };
    },
    list: async (qs = "") => (await routes.list.GET(req("/api/agent/conversations" + qs))).json(),
    get: async (id, qs = "") => {
      const r = await routes.one.GET(req("/api/agent/conversations/" + id + qs), p(id));
      return { status: r.status, body: await r.json() };
    },
    patch: async (id, body) => (await routes.one.PATCH(req("/api/agent/conversations/" + id, "PATCH", body), p(id))).status,
    del: async (id) => (await routes.one.DELETE(req("/api/agent/conversations/" + id, "DELETE"), p(id))).status,
    newFolder: async (name) => (await routes.folders.POST(req("/api/agent/folders", "POST", { name }))).json(),
    renameFolder: async (id, name) => (await routes.folder.PATCH(req("/api/agent/folders/" + id, "PATCH", { name }), p(id))).status,
    deleteFolder: async (id) => (await routes.folder.DELETE(req("/api/agent/folders/" + id, "DELETE"), p(id))).status,
  };
  return { db, tables, calls, api, session, setReply: (fn) => (reply = fn) };
}
async function withKey(fn, key = KEY) {
  const old = process.env.OPENAI_API_KEY;
  if (key) process.env.OPENAI_API_KEY = key;
  else delete process.env.OPENAI_API_KEY;
  try {
    return await fn();
  } finally {
    if (old === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = old;
  }
}
const quiet = (t) => {
  t.mock.method(console, "info", () => {});
  t.mock.method(console, "error", () => {});
};

test("first message creates the conversation with a deterministic title, stores both messages, metered", (t) =>
  withKey(async () => {
    quiet(t);
    const { api, tables, calls } = setup();
    const r = await api.send({ text: "maak een marketingplanning voor oktober voor mijn pizzeria" });
    assert.equal(r.status, 200);
    assert.equal(r.body.conversation.title, "Maak een marketingplanning voor oktober voor mijn pizzeria");
    assert.equal(r.body.userMessage.role, "user");
    assert.equal(r.body.reply.role, "assistant");
    assert.equal(r.body.reply.status, "ok");
    assert.equal(r.body.reply.model, "gpt-5.4-mini");
    assert.equal(tables.agent_conversations.length, 1);
    assert.equal(tables.agent_messages.length, 2);
    assert.ok(tables.agent_messages.every((m) => m.workspace_id === "w1" && m.user_id === "u1"));
    assert.deepEqual([tables.ai_usage[0].feature, tables.ai_usage[0].status], ["agent", "succeeded"]);
    assert.match(JSON.stringify(calls[0]), /Telepizza/);
    assert.equal(calls.length, 1, "no extra AI call for the title");
  }));

test("follow-up uses stored history from the server, and reload returns messages in order", (t) =>
  withKey(async () => {
    quiet(t);
    const { api, calls } = setup();
    const first = await api.send({ text: "Ideeën voor meer reserveringen" });
    const id = first.body.conversation.id;
    await api.send({ text: "Maak er een weekplanning van", conversationId: id });
    const history = JSON.parse(calls[1].input[0].content.find((c) => c.text.startsWith("<history>")).text.replace(/^<history>\n|\n<\/history>$/g, ""));
    assert.deepEqual(history.map((h) => h.from), ["user", "agent"]);
    const reload = await api.get(id);
    assert.equal(reload.status, 200);
    assert.deepEqual(reload.body.messages.map((m) => m.role), ["user", "assistant", "user", "assistant"]);
    assert.equal(reload.body.conversation.message_count, 4);
  }));

test("conversations are private: another user in the same workspace and another workspace see nothing and cannot change it", (t) =>
  withKey(async () => {
    quiet(t);
    const env = setup();
    const { body } = await env.api.send({ text: "Mijn geheime campagne" });
    const id = body.conversation.id;
    for (const other of ["u2", "u3"]) {
      env.session.user = other;
      assert.equal((await env.api.list()).conversations.length, 0, other + " lists nothing");
      assert.equal((await env.api.get(id)).status, 404, other + " cannot open it");
      assert.equal(await env.api.patch(id, { title: "Gekaapt" }), 404);
      assert.equal(await env.api.del(id), 404);
      const sent = await env.api.send({ text: "Hoi", conversationId: id });
      assert.equal(sent.status, 404, other + " cannot post into it");
      assert.equal((await env.api.list("?q=geheime")).conversations.length, 0, other + " cannot find it by search");
    }
    env.session.user = "u1";
    assert.equal((await env.api.get(id)).body.conversation.title, "Mijn geheime campagne");
    assert.equal(env.tables.agent_messages.length, 2, "nothing was added by the other users");
  }));

test("rename, pin, archive and restore; archived conversations leave the main list", (t) =>
  withKey(async () => {
    quiet(t);
    const { api } = setup();
    const id = (await api.send({ text: "Nieuwsbrief november" })).body.conversation.id;
    assert.equal(await api.patch(id, { title: "Nieuwsbrief — november" }), 200);
    assert.equal(await api.patch(id, { pinned: true }), 200);
    let list = await api.list();
    assert.deepEqual([list.conversations[0].title, list.conversations[0].pinned], ["Nieuwsbrief — november", true]);
    assert.equal(await api.patch(id, { archived: true }), 200);
    assert.equal((await api.list()).conversations.length, 0);
    assert.equal((await api.list("?archived=1")).conversations.length, 1);
    assert.equal(await api.patch(id, { archived: false }), 200);
    list = await api.list();
    assert.equal(list.conversations.length, 1);
    assert.equal(await api.patch(id, {}), 400, "empty change rejected");
  }));

test("delete removes the conversation and its messages", (t) =>
  withKey(async () => {
    quiet(t);
    const { api, tables } = setup();
    const keep = (await api.send({ text: "Bewaren" })).body.conversation.id;
    const gone = (await api.send({ text: "Weggooien" })).body.conversation.id;
    assert.equal(await api.del(gone), 200);
    assert.deepEqual(tables.agent_conversations.map((c) => c.id), [keep]);
    assert.ok(tables.agent_messages.every((m) => m.conversation_id === keep));
    assert.equal((await api.get(gone)).status, 404);
  }));

test("folders: create, rename, move in and out, and deleting a folder keeps its conversations", (t) =>
  withKey(async () => {
    quiet(t);
    const env = setup();
    const id = (await env.api.send({ text: "Instagram-campagne kerst" })).body.conversation.id;
    const { folder } = await env.api.newFolder("Kerst 2026");
    assert.equal(folder.name, "Kerst 2026");
    assert.equal(await env.api.renameFolder(folder.id, "Feestdagen"), 200);
    assert.equal(await env.api.patch(id, { folderId: folder.id }), 200);
    assert.equal((await env.api.list()).conversations[0].folder_id, folder.id);
    assert.equal(await env.api.patch(id, { folderId: null }), 200);
    assert.equal((await env.api.list()).conversations[0].folder_id, null);
    await env.api.patch(id, { folderId: folder.id });
    assert.equal(await env.api.deleteFolder(folder.id), 200);
    const list = await env.api.list();
    assert.equal(list.folders.length, 0);
    assert.equal(list.conversations.length, 1, "conversation survives");
    assert.equal(list.conversations[0].folder_id, null);
    // Another user's folder cannot be used or seen.
    const { folder: own } = await env.api.newFolder("Van u1");
    env.session.user = "u2";
    const theirs = (await env.api.send({ text: "Van u2" })).body.conversation.id;
    assert.equal(await env.api.patch(theirs, { folderId: own.id }), 404);
    assert.equal(await env.api.renameFolder(own.id, "x"), 404);
    assert.equal((await env.api.list()).folders.length, 0);
  }));

test("search finds titles and message text, case-insensitive, within the caller's own conversations", (t) =>
  withKey(async () => {
    quiet(t);
    const { api, setReply } = setup();
    await api.send({ text: "Ideeën voor de lunchkaart" });
    setReply(async () => ({ status: "completed", output_text: "Probeer een Pizza Margherita-actie op dinsdag.", usage: { input_tokens: 1, output_tokens: 1 } }));
    await api.send({ text: "Iets anders" });
    assert.deepEqual((await api.list("?q=LUNCH")).conversations.map((c) => c.title), ["Ideeën voor de lunchkaart"]);
    assert.deepEqual((await api.list("?q=margherita")).conversations.map((c) => c.title), ["Iets anders"]);
    assert.equal((await api.list("?q=100%25")).conversations.length, 0, "wildcards are escaped");
  }));

test("a failed AI call is stored as a failed answer with a safe message, and retry answers it", (t) =>
  withKey(async () => {
    quiet(t);
    const { api, setReply, tables } = setup();
    setReply(async () => {
      throw new OpenAI.RateLimitError(429, { code: "insufficient_quota", message: "detail " + KEY }, "detail", new Headers());
    });
    const r = await api.send({ text: "Schrijf een nieuwsbrief" });
    assert.equal(r.status, 503);
    assert.match(r.body.error, /AI-tegoed van Mavix is op/);
    assert.equal(r.body.reply.status, "failed");
    assert.ok(!JSON.stringify(tables.agent_messages).includes(KEY), "no provider details stored");
    const id = r.body.conversation.id;
    setReply(async () => ({ status: "completed", output_text: "Hier is je nieuwsbrief.", usage: { input_tokens: 1, output_tokens: 1 } }));
    const retry = await api.send({ retry: true, conversationId: id });
    assert.equal(retry.status, 200);
    assert.equal(retry.body.userMessage, null, "retry does not duplicate the question");
    const msgs = (await api.get(id)).body.messages;
    assert.deepEqual(msgs.map((m) => [m.role, m.status]), [["user", "ok"], ["assistant", "failed"], ["assistant", "ok"]]);
    assert.equal((await api.send({ retry: true, conversationId: id })).status, 409, "nothing left to retry");
  }));

test("budget exhaustion: the question is kept, the answer explains, no model call", (t) =>
  withKey(async () => {
    quiet(t);
    process.env.AI_GLOBAL_MONTHLY_BUDGET_USD = "0.001";
    try {
      const { api, calls } = setup({ tables: { ai_usage: [{ workspace_id: "w2", user_id: "u3", input_tokens: 0, output_tokens: 0, cost_micro_usd: 5000, status: "succeeded", created_at: new Date().toISOString() }] } });
      const r = await api.send({ text: "Maak een planning" });
      assert.equal(r.status, 503);
      assert.match(r.body.error, /budget/);
      assert.equal(calls.length, 0);
      assert.equal(r.body.userMessage.content, "Maak een planning");
    } finally {
      delete process.env.AI_GLOBAL_MONTHLY_BUDGET_USD;
    }
  }));

test("concurrent sends from one user: at most two reach the model at once", (t) =>
  withKey(async () => {
    quiet(t);
    const { api, setReply } = setup();
    let inFlight = 0,
      peak = 0;
    setReply(async () => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((r) => setTimeout(r, 30));
      inFlight--;
      return { status: "completed", output_text: "ok", usage: { input_tokens: 1, output_tokens: 1 } };
    });
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => api.send({ text: "Vraag " + i })));
    assert.ok(peak <= 2, "peak concurrency " + peak);
    assert.ok(results.some((r) => r.status === 429), "extra requests are refused");
  }));

test("without an AI key nothing is stored and the client keeps the draft", (t) =>
  withKey(async () => {
    quiet(t);
    const { api, tables, calls } = setup();
    const r = await api.send({ text: "Hoi Mavi" });
    assert.deepEqual(r.body, { configured: false });
    assert.equal((tables.agent_conversations || []).length, 0);
    assert.equal((tables.agent_messages || []).length, 0);
    assert.equal(calls.length, 0);
  }, null));

test("logged-out and cross-site requests are refused; ids from the browser are validated", (t) =>
  withKey(async () => {
    quiet(t);
    const env = setup();
    env.session.user = null;
    assert.equal((await env.api.send({ text: "Hoi" })).status, 401);
    assert.equal((await env.api.list()).error !== undefined, true);
    env.session.user = "u1";
    const r = await env.api.send({ text: "Hoi" }, "k");
    assert.equal(r.status, 200);
    assert.equal((await env.api.get("not-a-uuid")).status, 404);
    assert.equal((await env.api.send({ text: "x", conversationId: "not-a-uuid" })).status, 400);
  }));

test("pagination: conversations come back newest first in pages", (t) =>
  withKey(async () => {
    quiet(t);
    const { api, db } = setup();
    const store = setup.loadStore ?? null;
    void store;
    for (let i = 0; i < 3; i++) await api.send({ text: "Gesprek " + i });
    const list = await api.list();
    assert.deepEqual(list.conversations.map((c) => c.title), ["Gesprek 2", "Gesprek 1", "Gesprek 0"]);
    assert.equal(list.more, false);
    void db;
  }));

test("a new conversation starts directly inside a project; never in another user's or workspace's project", (t) =>
  withKey(async () => {
    quiet(t);
    const { api, tables, session } = setup();
    const { folder } = await api.newFolder("Zomeractie");
    // Created inside the project with the first message (no separate move).
    const r = await api.send({ text: "Bedenk drie posts voor ons terras", folderId: folder.id });
    assert.equal(r.status, 200);
    assert.equal(r.body.conversation.folder_id, folder.id);
    assert.equal(tables.agent_conversations.length, 1);
    assert.equal(tables.agent_conversations[0].folder_id, folder.id);
    // Reload: the conversation still belongs to the project, history intact.
    const reload = await api.get(r.body.conversation.id);
    assert.equal(reload.body.conversation.folder_id, folder.id);
    assert.equal(reload.body.messages.length, 2);
    // Follow-up stays in the project.
    await api.send({ text: "Maak ze korter", conversationId: r.body.conversation.id });
    assert.equal(tables.agent_conversations[0].folder_id, folder.id);

    // Another user in the same workspace, and a user of another workspace,
    // cannot start a conversation in this project: nothing is stored.
    for (const other of ["u2", "u3"]) {
      session.user = other;
      const before = tables.agent_conversations.length;
      const bad = await api.send({ text: "Probeer het project", folderId: folder.id });
      assert.equal(bad.status, 404, other);
      assert.equal(tables.agent_conversations.length, before, "no conversation created for " + other);
    }
    session.user = "u1";
    // Without a project: as before.
    const loose = await api.send({ text: "Losse vraag" });
    assert.equal(loose.body.conversation.folder_id, null);
    // Deleting the project keeps its conversations (without project).
    assert.equal(await api.deleteFolder(folder.id), 200);
    assert.equal(tables.agent_conversations.find((c) => c.id === r.body.conversation.id).folder_id, null);
    assert.equal(tables.agent_messages.filter((m) => m.conversation_id === r.body.conversation.id).length, 4);
  }));