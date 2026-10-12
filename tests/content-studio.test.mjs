import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";
import { studioItems, studioCounts, brandGaps, copyValid, CHANNELS, COPY_KINDS } from "../src/lib/studio.ts";

const origin = "https://mavix.webbo-solutions.nl";
const KEY = "sk-test-fixture-studio";
const now = "2026-10-12T10:00:00.000Z";

// ---------------------------------------------------------------- overview model

test("overview uses the same records as the calendar: posts, campaigns and copies, newest edit first", () => {
  const items = studioItems({
    posts: [
      { id: "p1", prompt: "Pizza van de maand", caption: "Nieuw!", hashtags: "", status: "scheduled", date: "2026-10-20T18:00", createdAt: "2026-10-01T09:00:00Z", variant: 0, media: ["data:image/png;base64,AA=="] },
      { id: "p2", prompt: "", caption: "**Vet** concept", hashtags: "", status: "draft", date: "", createdAt: "2026-10-02T09:00:00Z", updatedAt: "2026-10-11T09:00:00Z", variant: 0 },
    ],
    email: { settings: {}, campaigns: [{ id: "e1", title: "Nieuwsbrief", subject: "Zomerkaart", preview: "Proef de zomer", body: "", status: "sent", date: "", createdAt: "2026-10-05T09:00:00Z" }] },
    copies: [{ id: "c1", title: "Over ons", kind: "website", prompt: "", body: "## Over ons\nWij bakken pizza", status: "ready", createdAt: now, updatedAt: now }],
  });
  assert.deepEqual(items.map((i) => i.id), ["c1", "p2", "e1", "p1"]);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(byId.p1.href, "/social?tab=assist&post=p1", "opens the existing Instagram editor");
  assert.equal(byId.e1.href, "/email?tab=assist&campaign=e1");
  assert.equal(byId.c1.href, "/studio/tekst?id=c1");
  assert.deepEqual([byId.p1.status, byId.p1.statusLabel, byId.p1.image?.slice(0, 10)], ["scheduled", "Ingepland", "data:image"]);
  assert.deepEqual([byId.e1.status, byId.e1.statusLabel], ["published", "Verzonden"]);
  assert.deepEqual([byId.c1.status, byId.c1.statusLabel], ["approved", "Klaar"]);
  assert.equal(byId.p2.preview, "Vet concept", "markdown markers are not shown in previews");
  assert.equal(byId.c1.preview, "Over ons Wij bakken pizza");
  assert.deepEqual(studioCounts(items), { draft: 1, approved: 1, scheduled: 1, published: 1, failed: 0 });
});

test("only implemented channels are selectable; Reel is clearly marked as coming", () => {
  assert.deepEqual(CHANNELS.filter((c) => c.available).map((c) => c.id), ["instagram", "email", "copy"]);
  const reel = CHANNELS.find((c) => c.id === "reel");
  assert.equal(reel.available, false);
  assert.match(reel.note, /Binnenkort/);
});

test("Brand Hub gaps are suggestions, not a blocker", () => {
  assert.equal(brandGaps({ name: "", description: "", audience: "", voice: "" }).length, 5);
  assert.deepEqual(brandGaps({ name: "Telepizza", description: "Pizza", audience: "Gezinnen", voice: "Vrolijk", products: "Pizza" }), []);
});

test("marketing copy records are validated", () => {
  const ok = { id: "c1", title: "Over ons", kind: "website", prompt: "", body: "Tekst", status: "draft", createdAt: now, updatedAt: now };
  assert.equal(copyValid(ok), true);
  assert.equal(copyValid({ ...ok, kind: "virus" }), false);
  assert.equal(copyValid({ ...ok, status: "published" }), false, "copy can never claim to be published");
  assert.equal(copyValid({ ...ok, body: "x".repeat(20001) }), false);
  assert.equal(COPY_KINDS.length, 5);
});

// ---------------------------------------------------------------- server

function setup({ role = "OWNER", tables = {} } = {}) {
  tables.workspace_members ??= [
    { user_id: "u1", workspace_id: "w1", role, created_at: "1" },
    { user_id: "u9", workspace_id: "w2", role: "OWNER", created_at: "1" },
  ];
  tables.workspaces ??= [
    { id: "w1", deleted_at: null, access_status: "approved" },
    { id: "w2", deleted_at: null, access_status: "approved" },
  ];
  tables.business_profiles ??= [
    { workspace_id: "w1", version: 3, data: { profile: { name: "Telepizza" }, posts: [], copies: [] } },
    { workspace_id: "w2", version: 1, data: { profile: { name: "Andere zaak" } } },
  ];
  tables.profiles ??= [{ id: "u1", full_name: "", first_name: "", last_name: "", phone: "", photo: "" }];
  tables.ai_usage ??= [];
  const db = memoryDb(tables, { uuid: true });
  db.auth = { getUser: async () => ({ data: { user: { id: "u1", email: "o@x.nl" } }, error: null }) };
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
  });
  const calls = [];
  let reply = async () => ({ status: "completed", output_text: "## Over ons\nWij bakken al jaren pizza.", usage: { input_tokens: 300, output_tokens: 80 } });
  load("src/lib/server/openai.ts").__setOpenAIClient({ responses: { create: async (p) => (calls.push(p), reply(p)) } });
  const post = (url, body, headers = {}) => new Request(origin + url, { method: "POST", headers: { origin, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { tables, load, calls, post, setReply: (fn) => (reply = fn) };
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

test("marketing copy generation: own Brand Hub as context, metered, text only", (t) =>
  withKey(async () => {
    quiet(t);
    const { load, post, calls, tables } = setup();
    const res = await load("src/app/api/generate/copy/route.ts").POST(post("/api/generate/copy", { kind: "website", prompt: "Over-ons-tekst" }, { "Idempotency-Key": "copy-key-123456" }));
    assert.equal(res.status, 200);
    assert.match((await res.json()).text, /Over ons/);
    const sent = JSON.stringify(calls[0]);
    assert.match(sent, /Telepizza/);
    assert.ok(!sent.includes("Andere zaak"), "never another workspace's profile");
    assert.match(sent, /website copy/);
    assert.deepEqual([tables.ai_usage[0].feature, tables.ai_usage[0].status], ["content_copy", "succeeded"]);
  }));

test("marketing copy generation: no key = nothing generated; members cannot generate; bad input rejected", (t) =>
  withKey(async () => {
    quiet(t);
    const a = setup();
    const res = await a.load("src/app/api/generate/copy/route.ts").POST(a.post("/api/generate/copy", { kind: "website", prompt: "Over ons" }));
    assert.equal(res.status, 503);
    assert.equal(a.calls.length, 0);
  }, null).then(() =>
    withKey(async () => {
      const m = setup({ role: "MEMBER" });
      assert.equal((await m.load("src/app/api/generate/copy/route.ts").POST(m.post("/api/generate/copy", { kind: "website", prompt: "Over ons" }))).status, 403);
      const o = setup();
      assert.equal((await o.load("src/app/api/generate/copy/route.ts").POST(o.post("/api/generate/copy", { kind: "hack", prompt: "Over ons" }))).status, 400);
      assert.equal(m.calls.length + o.calls.length, 0);
    }),
  ));

test("AI rewrite failure leaves no partial result and reports a clear error", (t) =>
  withKey(async () => {
    quiet(t);
    const { load, post, setReply, tables } = setup();
    setReply(async () => {
      throw new Error("socket closed");
    });
    const res = await load("src/app/api/generate/edit/route.ts").POST(post("/api/generate/edit", { action: "hashtags", text: "Onze pizza van de maand is er!", channel: "instagram" }));
    assert.ok(res.status >= 500);
    assert.equal((await res.json()).results, undefined);
    assert.equal(tables.ai_usage[0].status, "failed");
  }));

test("new AI actions: hashtags, spelling, translate and headline reach the model with the right task", (t) =>
  withKey(async () => {
    quiet(t);
    const { load, calls, setReply } = setup();
    const ai = load("src/lib/server/ai.ts");
    setReply(async () => ({ status: "completed", output_text: "#pizza #utrecht #weekend", usage: { input_tokens: 1, output_tokens: 1 } }));
    assert.deepEqual(await ai.editContent("hashtags", "Pizza van de maand", "instagram", {}), ["#pizza #utrecht #weekend"]);
    assert.match(calls[0].input[0].content.at(-1).text, /hashtags/);
    setReply(async () => ({ status: "completed", output_text: "Kop A\n---\nKop B\n---\nKop C", usage: { input_tokens: 1, output_tokens: 1 } }));
    assert.deepEqual(await ai.editContent("headline", "Pizza van de maand", "copy", {}), ["Kop A", "Kop B", "Kop C"]);
    setReply(async () => ({ status: "completed", output_text: "Pizza of the month", usage: { input_tokens: 1, output_tokens: 1 } }));
    await ai.editContent("translate_en", "Pizza van de maand", "email", {});
    const task = calls[2].input[0].content.at(-1).text;
    assert.match(task, /English/);
    assert.ok(!task.includes("Keep the language of current_text"), "translation is not told to keep the language");
  }));

test("saving the workspace accepts valid copies and refuses invalid ones (no published copy)", (t) =>
  withKey(async () => {
    quiet(t);
    const { load, tables } = setup();
    const route = load("src/app/api/workspace/route.ts");
    const put = (data, version) => route.PUT(new Request(origin + "/api/workspace", { method: "PUT", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ data, version }) }));
    const base = { profile: { name: "Telepizza" }, posts: [] };
    const copy = { id: "c1", title: "Over ons", kind: "website", prompt: "", body: "Tekst", status: "draft", createdAt: now, updatedAt: now };
    assert.equal((await put({ ...base, copies: [copy] }, 3)).status, 200);
    assert.equal(tables.business_profiles[0].data.copies.length, 1);
    assert.equal((await put({ ...base, copies: [{ ...copy, status: "published" }] }, 4)).status, 400);
    assert.equal((await put({ ...base, copies: [copy] }, 3)).status, 409, "stale version: no silent overwrite");
  }));

test("a post can only become published through a real provider action", (t) =>
  withKey(async () => {
    quiet(t);
    const { load } = setup();
    const route = load("src/app/api/workspace/route.ts");
    const res = await route.PUT(
      new Request(origin + "/api/workspace", {
        method: "PUT",
        headers: { origin, "Content-Type": "application/json" },
        body: JSON.stringify({ version: 3, data: { profile: { name: "Telepizza" }, posts: [{ id: "p1", prompt: "", caption: "x", hashtags: "", status: "published", date: "", createdAt: now, variant: 0 }] } }),
      }),
    );
    assert.equal(res.status, 409);
    assert.match((await res.json()).error, /niets gepubliceerd/);
  }));
