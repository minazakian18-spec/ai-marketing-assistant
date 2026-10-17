import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";

// AI images (OpenAI Images API, gpt-image-2.5-flare by default): prompt from
// the brief with Brand Hub as optional style context; generate works without
// any photo; results stored once in the Bibliotheek; edit accepts a library
// reference; owners/admins only; metered at the image model price, with the
// worst case counted when the outcome is unknown. No real request is made.

const origin = "https://mavix.webbo-solutions.nl";
process.env.OPENAI_API_KEY = "sk-test-fixture-images";
delete process.env.OPENAI_IMAGE_MODEL;
process.env.AI_IMAGE_WORKSPACES = "w1"; // closed test: only the test workspace
const sharp = (await import("sharp")).default;
const jpeg = (w, h, color = "#d96") => sharp({ create: { width: w, height: h, channels: 3, background: color } }).jpeg().toBuffer();

test("image prompt: brief is the subject, Brand Hub optional, no text or logos", () => {
  const p = serverLoader({})("src/lib/image-prompt.ts");
  const bare = p.buildImagePrompt({ brief: "een pizza op een terras", mode: "generate", format: "square" });
  assert.match(bare, /een pizza op een terras/);
  assert.match(bare, /Professional commercial photograph/);
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

test("model, sizes and prices: gpt-image-2.5-flare, direct 4:5, reservation covers every case", () => {
  const u = serverLoader({ [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => ({}) } })("src/lib/server/ai-usage.ts");
  assert.equal(u.imageModel(), "gpt-image-2.5-flare");
  assert.deepEqual(u.priceFor("gpt-image-2.5-flare"), { input: 8, output: 30 });
  assert.equal(u.reservationMicroUsd("image_generate"), 1000 * 8 + 8000 * 30);
  assert.equal(u.reservationMicroUsd("image_edit"), 8000 * 8 + 8000 * 30);
  // Most expensive published high-quality case (GPT Image 2 table: 1024x1024 = 0.211 USD ≈ 7,033 tokens) fits.
  assert.ok(u.costMicroUsd("gpt-image-2.5-flare", 1000, 7033) <= u.reservationMicroUsd("image_generate"));
  // gpt-image-1 fallback (high portrait 6,240 tokens) also fits its own reservation.
  process.env.OPENAI_IMAGE_MODEL = "gpt-image-1";
  try {
    assert.ok(u.costMicroUsd("gpt-image-1", 1000, 6240) <= u.reservationMicroUsd("image_generate"));
  } finally {
    delete process.env.OPENAI_IMAGE_MODEL;
process.env.AI_IMAGE_WORKSPACES = "w1"; // closed test: only the test workspace
  }
  const o = serverLoader({ [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => ({}) } })("src/lib/server/openai.ts");
  assert.deepEqual(o.imagePlan("portrait", "gpt-image-2.5-flare"), { size: "1024x1280", crop: false });
  assert.deepEqual(o.imagePlan("portrait", "gpt-image-1"), { size: "1024x1536", crop: true });
  assert.deepEqual(o.imagePlan("square", "gpt-image-2.5-flare"), { size: "1024x1024", crop: false });
});

function env({ user = "u1", profile = { name: "Telepizza", industry: "pizzeria" }, client } = {}) {
  const tables = {
    workspace_members: [{ user_id: "u1", workspace_id: "w1", role: "OWNER", created_at: "1" }, { user_id: "u2", workspace_id: "w1", role: "MEMBER", created_at: "1" }, { user_id: "u3", workspace_id: "w2", role: "OWNER", created_at: "1" }],
    workspaces: [{ id: "w1", deleted_at: null, access_status: "approved" }, { id: "w2", deleted_at: null, access_status: "approved" }],
    business_profiles: [{ workspace_id: "w1", version: 1, data: { profile, posts: [] } }],
    ai_usage: [],
    library_files: [],
  };
  const db = memoryDb(tables, { uuid: true });
  db.auth = { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) };
  db.rpc = async () => ({ data: true, error: null });
  const objects = new Map();
  db.storage = { from: () => ({ upload: async (p, b) => (objects.set(p, Buffer.from(b)), { error: null }), download: async (p) => ({ data: objects.has(p) ? new Blob([objects.get(p)]) : null, error: objects.has(p) ? null : { message: "not found" } }), createSignedUrl: async (p) => ({ data: { signedUrl: "https://storage.test/" + p + "?sig" }, error: null }), remove: async () => ({ error: null }) }) };
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
  });
  const calls = [];
  load("src/lib/server/openai.ts").__setOpenAIClient(
    client ? client(calls) : {
      images: {
        generate: async (p, opts) => (calls.push({ kind: "generate", ...p, opts }), { data: [{ b64_json: (await jpeg(1024, p.size === "1024x1280" ? 1280 : 1024)).toString("base64") }], usage: { input_tokens: 90, output_tokens: 7000 } }),
        edit: async (p, opts) => (calls.push({ kind: "edit", ...p, opts }), { data: [{ b64_json: (await jpeg(1024, 1024, "#69d")).toString("base64") }], usage: { input_tokens: 1200, output_tokens: 7000 } }),
      },
    },
  );
  const route = load("src/app/api/generate/image/route.ts");
  const post = async (body) => {
    const r = await route.POST(new Request(origin + "/api/generate/image", { method: "POST", headers: { origin, "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) }));
    return { status: r.status, body: await r.json() };
  };
  return { tables, calls, post, load, objects, db };
}
const quiet = (t) => {
  t.mock.method(console, "info", () => {});
  t.mock.method(console, "error", () => {});
};

test("generate without any photo: real image, stored once in the Bibliotheek, real cost on the ledger", async (t) => {
  quiet(t);
  const e = env({ profile: { name: "" } });
  const r = await e.post({ mode: "generate", brief: "een dampende pizza op een houten plank", format: "square" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.stored, true);
  assert.match(r.body.image, /^\/api\/library\/media\/[0-9a-f-]{36}$/, "a short reference, not image data");
  const f = e.tables.library_files[0];
  assert.equal(f.kind, "ai");
  assert.equal(f.workspace_id, "w1");
  assert.match(f.storage_path, /^w1\//, "stored under the workspace");
  const c = e.calls[0];
  assert.equal(c.model, "gpt-image-2.5-flare");
  assert.equal(c.quality, "high");
  assert.equal(c.output_format, "jpeg");
  assert.equal(c.opts.maxRetries, 0, "no automatic paid retry");
  const row = e.tables.ai_usage[0];
  assert.equal(row.feature, "image_generate");
  assert.equal(row.status, "succeeded");
  assert.equal(row.cost_micro_usd, 90 * 8 + 7000 * 30, "ledger holds the real cost (~0.21 USD)");
});

test("the same image is never stored twice", async (t) => {
  quiet(t);
  const e = env();
  const a = await e.post({ mode: "generate", brief: "een pizza" });
  const b = await e.post({ mode: "generate", brief: "een pizza" });
  assert.equal(a.body.image, b.body.image);
  assert.equal(e.tables.library_files.length, 1);
  assert.equal(e.objects.size, 1);
});

test("portrait is generated directly at 1024x1280 (Instagram 4:5)", async (t) => {
  quiet(t);
  const e = env();
  await e.post({ mode: "generate", brief: "een pizza", format: "portrait" });
  assert.equal(e.calls[0].size, "1024x1280");
  const stored = [...e.objects.values()][0];
  const meta = await sharp(stored).metadata();
  assert.deepEqual([meta.width, meta.height], [1024, 1280]);
  assert.match(e.calls[0].prompt, /Telepizza/, "Brand Hub used as style context when present");
});

test("brand context can be switched off", async (t) => {
  quiet(t);
  const e = env();
  await e.post({ mode: "generate", brief: "een pizza", useBrand: false });
  assert.ok(!/Telepizza/.test(e.calls[0].prompt));
});

test("edit: needs a photo, accepts a Bibliotheek reference of the own workspace, bounds the input size", async (t) => {
  quiet(t);
  const e = env();
  assert.equal((await e.post({ mode: "edit", brief: "lichtere achtergrond" })).status, 400);
  // Store a large own photo first.
  const { storeImage } = e.load("src/lib/server/library.ts");
  const id = await storeImage({ workspaceId: "w1", userId: "u1" }, await jpeg(3000, 2000), { kind: "image", mime: "image/jpeg" });
  const r = await e.post({ mode: "edit", brief: "lichtere achtergrond", photo: "/api/library/media/" + id });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(e.calls[0].kind, "edit");
  const sent = await sharp(Buffer.from(await e.calls[0].image.arrayBuffer())).metadata();
  assert.ok(sent.width <= 1024 && sent.height <= 1024, "input downscaled to bound input tokens");
  assert.equal(e.tables.ai_usage[0].feature, "image_edit");
  // Another workspace's file is not reachable.
  e.tables.library_files.push({ id: "11111111-1111-4111-8111-111111111111", workspace_id: "w2", storage_path: "w2/x.jpg", mime_type: "image/jpeg", name: "x", size_bytes: 1 });
  assert.equal((await e.post({ mode: "edit", brief: "lichter", photo: "/api/library/media/11111111-1111-4111-8111-111111111111" })).status, 404);
});

test("timeout: the worst case is counted (OpenAI may have billed), the user gets an honest message", async (t) => {
  quiet(t);
  const OpenAI = createRequire(import.meta.url)("openai").default;
  const e = env({ client: () => ({ images: { generate: async () => { throw new OpenAI.APIConnectionTimeoutError(); } } }) });
  const r = await e.post({ mode: "generate", brief: "een pizza" });
  assert.equal(r.status, 504);
  assert.match(r.body.error, /meegeteld/);
  const row = e.tables.ai_usage[0];
  assert.equal(row.status, "failed");
  assert.equal(row.cost_micro_usd, 1000 * 8 + 8000 * 30, "reservation kept as cost");
  assert.equal(e.tables.library_files.length, 0);
});

test("refused request before generation costs nothing", async (t) => {
  quiet(t);
  const OpenAI = createRequire(import.meta.url)("openai").default;
  const e = env({ client: () => ({ images: { generate: async () => { throw new OpenAI.BadRequestError(400, { message: "Your request was rejected by the safety system", code: "moderation_blocked" }, "rejected", new Headers()); } } }) });
  const r = await e.post({ mode: "generate", brief: "iets" });
  assert.equal(r.status, 400);
  assert.equal(e.tables.ai_usage[0].cost_micro_usd, 0);
});

test("members and signed-out users cannot generate images", async () => {
  assert.equal((await env({ user: "u2" }).post({ mode: "generate", brief: "een pizza" })).status, 403);
  assert.equal((await env({ user: null }).post({ mode: "generate", brief: "een pizza" })).status, 401);
});

test("media route: own workspace only; publishing rules accept references", async (t) => {
  quiet(t);
  const e = env();
  const { storeImage } = e.load("src/lib/server/library.ts");
  const id = await storeImage({ workspaceId: "w1", userId: "u1" }, await jpeg(400, 400), { kind: "ai", mime: "image/jpeg" });
  const media = e.load("src/app/api/library/media/[id]/route.ts");
  const ok = await media.GET(new Request(origin + "/api/library/media/" + id), { params: Promise.resolve({ id }) });
  assert.equal(ok.status, 307);
  assert.match(ok.headers.get("location"), /^https:\/\/storage\.test\/w1\//);
  const other = env({ user: "u3" });
  other.tables.library_files.push(...e.tables.library_files);
  const denied = await other.load("src/app/api/library/media/[id]/route.ts").GET(new Request(origin + "/api/library/media/" + id), { params: Promise.resolve({ id }) });
  assert.equal(denied.status, 404);
  const { publishProblems } = serverLoader({})("src/lib/instagram-publish.ts");
  assert.deepEqual(publishProblems({ caption: "x", hashtags: "", media: ["/api/library/media/" + id], contentType: "Image" }), []);
});

test("moving old post images into the Bibliotheek replaces data with references, once", async (t) => {
  quiet(t);
  const e = env();
  const data = "data:image/jpeg;base64," + (await jpeg(300, 300)).toString("base64");
  e.tables.business_profiles[0].data.posts = [{ id: "p1", media: [data] }, { id: "p2", media: [data, "/api/library/media/22222222-2222-4222-8222-222222222222"] }];
  const route = e.load("src/app/api/library/migrate-media/route.ts");
  const r = await route.POST(new Request(origin + "/api/library/migrate-media", { method: "POST", headers: { origin } }));
  const d = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d));
  assert.equal(d.stored, 1, "identical image stored once");
  assert.equal(d.moved, 2);
  const posts = e.tables.business_profiles[0].data.posts;
  assert.ok(posts.every((p) => p.media.every((m) => m.startsWith("/api/library/media/"))));
  assert.ok(!JSON.stringify(posts).includes("base64"), "no image data left in the workspace document");
});

test("closed live test: other approved workspaces cannot generate images; default allows only Telepizza", async (t) => {
  quiet(t);
  const e = env({ user: "u3" }); // owner of w2 (approved)
  e.tables.business_profiles.push({ workspace_id: "w2", version: 1, data: { profile: {}, posts: [] } });
  const r = await e.post({ mode: "generate", brief: "een pizza" });
  assert.equal(r.status, 403);
  assert.match(r.body.error, /besloten test/);
  assert.equal(e.calls.length, 0, "no OpenAI request");
  assert.equal(e.tables.ai_usage.length, 0, "nothing reserved");
  delete process.env.AI_IMAGE_WORKSPACES;
  try {
    const d = env();
    assert.equal((await d.post({ mode: "generate", brief: "een pizza" })).status, 403, "without config only the Telepizza workspace is allowed");
  } finally {
    process.env.AI_IMAGE_WORKSPACES = "w1";
  }
});