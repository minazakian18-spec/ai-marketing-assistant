import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";

// AI images (OpenAI Images API): prompt built from the brief with Brand Hub
// as optional style context; generate works without any photo; edit needs a
// photo; owners/admins only; metered at the image model's price.

const origin = "https://mavix.webbo-solutions.nl";
process.env.OPENAI_API_KEY = "sk-test-fixture-images";
const sharp = (await import("sharp")).default;
const jpeg = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: "#d96" } }).jpeg().toBuffer();

test("image prompt: brief is the subject, Brand Hub optional, no text or logos", () => {
  const p = serverLoader({})("src/lib/image-prompt.ts");
  const bare = p.buildImagePrompt({ brief: "een pizza op een terras", mode: "generate", format: "square" });
  assert.match(bare, /een pizza op een terras/);
  assert.ok(!/Brand context/.test(bare), "no brand block without Brand Hub data");
  assert.match(bare, /No text/);
  const brand = p.brandStyleOf({ name: "Telepizza", industry: "pizzeria", brandVoice: { colors: ["#C0392B", "rood"], marketingStyle: "warm" }, strategy: { designStyles: ["Warm en huiselijk"] } });
  assert.deepEqual(brand.colors, ["#C0392B"], "only valid colour codes");
  const styled = p.buildImagePrompt({ brief: "een pizza", mode: "generate", format: "portrait", brand });
  assert.match(styled, /pizzeria called "Telepizza"/);
  assert.match(styled, /#C0392B/);
  assert.match(styled, /4:5/);
  assert.match(p.buildImagePrompt({ brief: "lichtere achtergrond", mode: "edit", format: "square" }), /^Edit this photo/);
  assert.deepEqual(p.brandStyleOf(null), {});
});

test("reservation for images uses the image model price", () => {
  const u = serverLoader({ [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => ({}) } })("src/lib/server/ai-usage.ts");
  // High quality, largest size (1024x1536 = 6,240 output tokens) is always covered.
  assert.equal(u.reservationMicroUsd("image_generate"), 1000 * 10 + 6300 * 40);
  assert.equal(u.reservationMicroUsd("image_edit"), 3000 * 10 + 6300 * 40);
  // Real cost of one high-quality square image: about 0.17 USD.
  assert.equal(u.costMicroUsd("gpt-image-1", 80, 4160), 80 * 10 + 4160 * 40);
});

function env({ user = "u1", profile = { name: "Telepizza", industry: "pizzeria" } } = {}) {
  const tables = {
    workspace_members: [{ user_id: "u1", workspace_id: "w1", role: "OWNER", created_at: "1" }, { user_id: "u2", workspace_id: "w1", role: "MEMBER", created_at: "1" }],
    workspaces: [{ id: "w1", deleted_at: null, access_status: "approved" }],
    business_profiles: [{ workspace_id: "w1", data: { profile } }],
    ai_usage: [],
  };
  const db = memoryDb(tables, { uuid: true });
  db.auth = { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) };
  db.rpc = async () => ({ data: true, error: null });
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
  });
  const calls = [];
  load("src/lib/server/openai.ts").__setOpenAIClient({
    images: {
      generate: async (p) => (calls.push({ kind: "generate", ...p }), { data: [{ b64_json: (await jpeg(1024, p.size === "1024x1536" ? 1536 : 1024)).toString("base64") }], usage: { input_tokens: 80, output_tokens: 4160 } }),
      edit: async (p) => (calls.push({ kind: "edit", ...p }), { data: [{ b64_json: (await jpeg(1024, 1024)).toString("base64") }], usage: { input_tokens: 400, output_tokens: 1056 } }),
    },
  });
  const route = load("src/app/api/generate/image/route.ts");
  const post = async (body) => {
    const r = await route.POST(new Request(origin + "/api/generate/image", { method: "POST", headers: { origin, "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) }));
    return { status: r.status, body: await r.json() };
  };
  return { tables, calls, post };
}
const quiet = (t) => {
  t.mock.method(console, "info", () => {});
  t.mock.method(console, "error", () => {});
};

test("generate without any photo: a real image comes back, metered as image_generate", async (t) => {
  quiet(t);
  const e = env({ profile: { name: "" } });
  const r = await e.post({ mode: "generate", brief: "een dampende pizza op een houten plank", format: "square" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.image, /^data:image\/jpeg;base64,/);
  assert.equal(e.calls[0].kind, "generate");
  assert.equal(e.calls[0].model, "gpt-image-1");
  assert.equal(e.calls[0].output_format, "jpeg");
  assert.equal(e.tables.ai_usage[0].feature, "image_generate");
  assert.equal(e.calls[0].quality, "high");
  assert.equal(e.tables.ai_usage[0].output_tokens, 4160);
  assert.equal(e.tables.ai_usage[0].cost_micro_usd, 80 * 10 + 4160 * 40, "ledger holds the real cost of this image");
});

test("portrait is cropped to Instagram's 4:5", async (t) => {
  quiet(t);
  const e = env();
  const r = await e.post({ mode: "generate", brief: "een pizza", format: "portrait" });
  const meta = await sharp(Buffer.from(r.body.image.split(",")[1], "base64")).metadata();
  assert.deepEqual([meta.width, meta.height], [1024, 1280]);
  assert.match(e.calls[0].prompt, /Telepizza/, "Brand Hub used as style context when present");
});

test("brand context can be switched off", async (t) => {
  quiet(t);
  const e = env();
  await e.post({ mode: "generate", brief: "een pizza", useBrand: false });
  assert.ok(!/Telepizza/.test(e.calls[0].prompt));
});

test("edit needs a photo and sends it to the edit endpoint", async (t) => {
  quiet(t);
  const e = env();
  assert.equal((await e.post({ mode: "edit", brief: "lichtere achtergrond" })).status, 400);
  assert.equal(e.calls.length, 0);
  const photo = "data:image/jpeg;base64," + (await jpeg(600, 600)).toString("base64");
  const r = await e.post({ mode: "edit", brief: "lichtere achtergrond", photo });
  assert.equal(r.status, 200);
  assert.equal(e.calls[0].kind, "edit");
  assert.equal(e.tables.ai_usage[0].feature, "image_edit");
});

test("members and signed-out users cannot generate images", async () => {
  assert.equal((await env({ user: "u2" }).post({ mode: "generate", brief: "een pizza" })).status, 403);
  assert.equal((await env({ user: null }).post({ mode: "generate", brief: "een pizza" })).status, 401);
});
