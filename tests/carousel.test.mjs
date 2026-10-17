import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";

// Inspiration images and Instagram carousels: plan rights, per-image metering
// (no bypass of the image limit), references as real inputs, workspace
// isolation, slide helpers, download ZIP and the pricing comparison.
// OpenAI is mocked; no real request or cost.

const origin = "https://mavix.webbo-solutions.nl";
process.env.OPENAI_API_KEY = "sk-test-fixture-carousel";
process.env.AI_IMAGE_WORKSPACES = "w1";
process.env.AI_DAILY_REQUESTS_PER_USER = "1000";
delete process.env.OPENAI_IMAGE_MODEL;
const sharp = (await import("sharp")).default;
const jpeg = (w = 400, h = 400, c = "#d96") => sharp({ create: { width: w, height: h, channels: 3, background: c } }).jpeg().toBuffer();
const dataUrl = async (w, h) => "data:image/jpeg;base64," + (await jpeg(w, h)).toString("base64");

function env({ plan = null, user = "u1" } = {}) {
  const tables = {
    workspace_members: [{ user_id: "u1", workspace_id: "w1", role: "OWNER", created_at: "1" }, { user_id: "u3", workspace_id: "w2", role: "OWNER", created_at: "1" }],
    workspaces: [{ id: "w1", deleted_at: null, access_status: "approved" }, { id: "w2", deleted_at: null, access_status: "approved" }],
    business_profiles: [{ workspace_id: "w1", version: 1, data: { profile: { name: "Telepizza", industry: "pizzeria" }, posts: [] } }, { workspace_id: "w2", version: 1, data: { profile: {}, posts: [] } }],
    subscriptions: plan ? [{ workspace_id: "w1", plan, status: "active", billing_interval: "month", current_period_end: new Date(Date.now() + 10 * 86400000).toISOString() }] : [],
    ai_usage: [],
    library_files: [],
  };
  const db = memoryDb(tables, { uuid: true });
  db.auth = { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) };
  db.rpc = async () => ({ data: true, error: null });
  const objects = new Map();
  db.storage = { from: () => ({ upload: async (p, b) => (objects.set(p, Buffer.from(b)), { error: null }), download: async (p) => ({ data: objects.has(p) ? new Blob([objects.get(p)]) : null, error: objects.has(p) ? null : { message: "nf" } }), createSignedUrl: async (p) => ({ data: { signedUrl: "https://storage.test/" + p }, error: null }), remove: async () => ({ error: null }) }) };
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
  });
  const calls = [];
  let n = 0;
  load("src/lib/server/openai.ts").__setOpenAIClient({
    images: {
      generate: async (p) => (calls.push({ kind: "generate", ...p }), { data: [{ b64_json: (await jpeg(1024, 1280, "#" + (100 + ++n).toString(16).padStart(6, "a"))).toString("base64") }], usage: { input_tokens: 100, output_tokens: 7000 } }),
      edit: async (p) => (calls.push({ kind: "edit", ...p }), { data: [{ b64_json: (await jpeg(1024, 1280, "#" + (200 + ++n).toString(16).padStart(6, "b"))).toString("base64") }], usage: { input_tokens: 2500, output_tokens: 7000 } }),
    },
    responses: {
      create: async (p) => {
        calls.push({ kind: "plan", ...p });
        const count = JSON.parse(p.input[0].content[1].text.replace(/^<brief>\n|\n<\/brief>$/g, "")).slides;
        const slides = Array.from({ length: count }, (_, i) => ({ headline: i === 0 ? "Je kwam voor één pizza…" : `Slide ${i + 1}`, body: "", image_brief: `Beeld ${i + 1}: pizza en cocktails op een terras` }));
        return { status: "completed", output: [], output_text: JSON.stringify({ title: "Italiaanse avond", concept: "Van één pizza naar een hele avond", audience: "Gezinnen", goal: "Reserveringen", visual_style: "Warm avondlicht, houtoven, terracotta", slides, caption: "Een avondje uit begint met één pizza.", hashtags: "#pizza #amstelveen" }), usage: { input_tokens: 600, output_tokens: 900 } };
      },
    },
  });
  const image = load("src/app/api/generate/image/route.ts");
  const carousel = load("src/app/api/generate/carousel/route.ts");
  const post = (route, url, body) =>
    route.POST(new Request(origin + url, { method: "POST", headers: { origin, "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) })).then(async (r) => ({ status: r.status, body: await r.json() }));
  return { tables, calls, objects, load, img: (b) => post(image, "/api/generate/image", b), plan: (b) => post(carousel, "/api/generate/carousel", b) };
}
const quiet = (t) => {
  t.mock.method(console, "info", () => {});
  t.mock.method(console, "error", () => {});
};

test("inspiration images are sent as real image inputs and the prompt asks for a NEW image", async (t) => {
  quiet(t);
  const e = env({ plan: "growth" });
  const refs = [await dataUrl(800, 600), await dataUrl(600, 800)];
  const r = await e.img({ mode: "generate", brief: "een sfeervolle foto met pizza en cocktails", references: refs });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const c = e.calls[0];
  assert.equal(c.kind, "edit", "references go to the image endpoint that accepts input images");
  assert.equal(c.image.length, 2, "both references are real inputs");
  assert.match(c.prompt, /Create a NEW, original/);
  assert.match(c.prompt, /Do not reproduce them/);
  assert.match(c.prompt, /no copied .*logos.*watermarks/);
  assert.equal(e.tables.ai_usage[0].feature, "image_inspire");
  assert.equal(e.tables.ai_usage[0].status, "succeeded");
});

test("inspiration limits per plan and validation of real content, type and size", async (t) => {
  quiet(t);
  const s = env({ plan: "starter" });
  const two = [await dataUrl(400, 400), await dataUrl(400, 400)];
  const r = await s.img({ mode: "generate", brief: "een pizza", references: two });
  assert.equal(r.status, 402);
  assert.match(r.body.error, /1 inspiratiebeeld/);
  assert.equal(s.calls.length, 0);
  const g = env({ plan: "growth" });
  assert.equal((await g.img({ mode: "generate", brief: "een pizza", references: [await dataUrl(100, 100)] })).status, 400, "too small");
  const fake = "data:image/png;base64," + Buffer.from("not an image at all").toString("base64");
  assert.equal((await g.img({ mode: "generate", brief: "een pizza", references: [fake] })).status, 400, "content is checked, not the declared type");
  assert.equal(g.calls.length, 0);
});

test("references from the Bibliotheek: own workspace only", async (t) => {
  quiet(t);
  const e = env({ plan: "autopilot" });
  const { storeImage } = e.load("src/lib/server/library.ts");
  const own = await storeImage({ workspaceId: "w1", userId: "u1" }, await jpeg(600, 600), { kind: "image", mime: "image/jpeg" });
  assert.equal((await e.img({ mode: "generate", brief: "een pizza", references: ["/api/library/media/" + own] })).status, 200);
  const foreign = await storeImage({ workspaceId: "w2", userId: "u3" }, await jpeg(600, 600, "#123456"), { kind: "image", mime: "image/jpeg" });
  assert.equal((await e.img({ mode: "generate", brief: "een pizza", references: ["/api/library/media/" + foreign] })).status, 404);
});

test("carousels: Starter refused server-side; Growth max 5 slides; Premium max 10; plan has exactly N slides", async (t) => {
  quiet(t);
  const s = env({ plan: "starter" });
  const r = await s.plan({ brief: "Een Italiaanse avond", slides: 3 });
  assert.equal(r.status, 402);
  assert.match(r.body.error, /Mavix Growth/);
  assert.equal(s.calls.length, 0);
  // A Starter cannot bypass via the image route with slide context either.
  assert.equal((await s.img({ mode: "generate", brief: "pizza", slide: { visualStyle: "warm", slideBrief: "pizza", index: 1, total: 3 } })).status, 402);
  const g = env({ plan: "growth" });
  assert.equal((await g.plan({ brief: "Een Italiaanse avond", slides: 6 })).status, 402);
  const ok = await g.plan({ brief: "Een Italiaanse avond", slides: 5 });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.plan.slides.length, 5);
  assert.ok(ok.body.plan.visual_style && ok.body.plan.caption);
  assert.equal(g.tables.ai_usage[0].feature, "carousel_plan");
  const p = env({ plan: "autopilot" });
  assert.equal((await p.plan({ brief: "Een Italiaanse avond", slides: 10 })).status, 200);
  assert.equal((await p.plan({ brief: "Een Italiaanse avond", slides: 11 })).status, 400);
});

test("each slide is one metered AI image: the monthly image limit cannot be bypassed with carousels", async (t) => {
  quiet(t);
  const g = env({ plan: "growth" });
  const now = new Date().toISOString();
  g.tables.ai_usage.push(...Array.from({ length: 15 }, () => ({ workspace_id: "w1", user_id: "u1", feature: "image_generate", status: "succeeded", cost_micro_usd: 0, created_at: now })));
  const slide = (i) => ({ mode: "generate", brief: "pizza", format: "portrait", slide: { visualStyle: "warm avondlicht", slideBrief: "pizza " + i, index: i, total: 5 } });
  assert.equal((await g.img(slide(1))).status, 200, "the 16th image is allowed");
  const r = await g.img(slide(2));
  assert.equal(r.status, 402, "the 17th is refused, carousel or not");
  assert.match(r.body.error, /16 nieuwe ai-afbeeldingen/);
});

test("slide 2+ uses slide 1 as style reference; consistency brief in every slide prompt", async (t) => {
  quiet(t);
  const e = env({ plan: "growth" });
  const first = await e.img({ mode: "generate", brief: "pizza", format: "portrait", slide: { visualStyle: "warm avondlicht, terracotta", slideBrief: "een pizza uit de oven", index: 1, total: 3 } });
  assert.match(e.calls[0].prompt, /Shared visual style for every slide: warm avondlicht, terracotta/);
  await e.img({ mode: "generate", brief: "pasta", format: "portrait", slide: { visualStyle: "warm avondlicht, terracotta", slideBrief: "pasta", index: 2, total: 3, styleReference: first.body.image } });
  assert.equal(e.calls[1].kind, "edit");
  assert.match(e.calls[1].prompt, /earlier slide of this carousel/);
  assert.equal(e.tables.ai_usage[1].feature, "image_inspire", "still one AI image (counts in the image limit)");
});

test("partial failure: earlier slides are stored and paid, the failed one costs nothing", async (t) => {
  quiet(t);
  const e = env({ plan: "growth" });
  await e.img({ mode: "generate", brief: "pizza", slide: { visualStyle: "warm", slideBrief: "pizza", index: 1, total: 3 } });
  const OpenAI = (await import("node:module")).createRequire(import.meta.url)("openai").default;
  e.load("src/lib/server/openai.ts").__setOpenAIClient({ images: { generate: async () => { throw new OpenAI.BadRequestError(400, { message: "rejected" }, "rejected", new Headers()); } } });
  const r = await e.img({ mode: "generate", brief: "pasta", slide: { visualStyle: "warm", slideBrief: "pasta", index: 2, total: 3 } });
  assert.ok(r.status >= 400);
  assert.equal(e.tables.library_files.length, 1, "slide 1 stays stored");
  const rows = e.tables.ai_usage;
  assert.equal(rows.filter((x) => x.status === "succeeded").length, 1);
  assert.equal(rows.find((x) => x.status === "failed").cost_micro_usd, 0);
  const sum = await e.load("src/lib/server/ai-usage.ts").creditSummary("w1");
  assert.equal(sum.credits.used, 10, "only the succeeded slide uses credits");
});

test("closed test: the carousel route cannot be used by other workspaces", async (t) => {
  quiet(t);
  const other = env({ user: "u3" });
  assert.equal((await other.plan({ brief: "Een Italiaanse avond", slides: 3 })).status, 403);
  assert.equal(other.calls.length, 0);
});

test("slide helpers: reorder, replace one slide only, media mirrors the slides; shape validation", () => {
  const c = serverLoader({})("src/lib/carousel.ts");
  const a = c.newSlide({ id: "a", image: "/i/a", source: "ai" }),
    b = c.newSlide({ id: "b", image: "/i/b", source: "ai" }),
    d = c.newSlide({ id: "d" });
  assert.deepEqual(c.moveSlide([a, b, d], 2, 0).map((s) => s.id), ["d", "a", "b"]);
  const replaced = c.replaceSlide([a, b, d], "b", { image: "/i/b2" });
  assert.equal(replaced[0], a, "other slides untouched (same object)");
  assert.equal(replaced[1].image, "/i/b2");
  const p = c.withCarousel({ id: "p", prompt: "", caption: "x", hashtags: "", status: "draft", date: "", createdAt: "1", variant: 0 }, { slides: [b, a, d], format: "portrait" });
  assert.equal(p.contentType, "Carousel");
  assert.deepEqual(p.media, ["/i/b", "/i/a"], "order kept, empty slides skipped");
  assert.equal(c.carouselValid(p.carousel), true);
  assert.equal(c.carouselValid({ slides: Array.from({ length: 11 }, () => d), format: "portrait" }), false);
  assert.equal(c.creditEstimate(5), 2 + 5 * 10);
  const pub = serverLoader({})("src/lib/instagram-publish.ts");
  assert.ok(pub.publishProblems({ caption: "x", hashtags: "", media: ["/api/library/media/11111111-1111-4111-8111-111111111111", "/api/library/media/22222222-2222-4222-8222-222222222222"], contentType: "Carousel", carousel: { slides: [{ ...a, headline: "Hoi", showText: true }, b], format: "portrait" } }).some((m) => /definitieve slides/.test(m)), "text slides are only published as the final composed image");
  const ok = { ...a, headline: "Hoi", showText: true, rendered: "/api/library/media/33333333-3333-4333-8333-333333333333" };
  assert.ok(!pub.publishProblems({ caption: "x", hashtags: "", media: ["/api/library/media/33333333-3333-4333-8333-333333333333", "/i/b"].slice(0, 1).concat(["/api/library/media/22222222-2222-4222-8222-222222222222"]), contentType: "Carousel", carousel: { slides: [ok, b], format: "portrait" } }).some((m) => /definitieve slides/.test(m)));
  // Media mirrors the final image of text slides; a text edit invalidates it.
  assert.equal(c.withCarousel({ id: "q", prompt: "", caption: "", hashtags: "", status: "draft", date: "", createdAt: "1", variant: 0 }, { slides: [ok, b], format: "portrait" }).media[0], ok.rendered);
  assert.equal(c.replaceSlide([ok], ok.id, { headline: "Nieuw" })[0].rendered, undefined);
  // Text style: only known values.
  assert.equal(c.carouselValid({ slides: [{ ...ok, style: { ...c.DEFAULT_STYLE, color: "#123abc" } }, b], format: "portrait" }), true);
  assert.equal(c.carouselValid({ slides: [{ ...ok, style: { ...c.DEFAULT_STYLE, font: "comic" } }, b], format: "portrait" }), false);
  assert.equal(c.carouselValid({ slides: [{ ...ok, style: { ...c.DEFAULT_STYLE, color: "red;x" } }, b], format: "portrait" }), false);
});

test("download ZIP: valid archive with slides in order and caption.txt", () => {
  const { zip, crc32 } = serverLoader({})("src/lib/zip.ts");
  const enc = new TextEncoder();
  const out = zip([{ name: "slide-01.jpg", data: enc.encode("A") }, { name: "slide-02.jpg", data: enc.encode("BB") }, { name: "caption.txt", data: enc.encode("Hallo") }]);
  const buf = Buffer.from(out);
  assert.equal(buf.readUInt32LE(0), 0x04034b50);
  assert.equal(buf.readUInt32LE(buf.length - 22), 0x06054b50);
  assert.equal(buf.readUInt16LE(buf.length - 22 + 10), 3, "three entries");
  const names = [...buf.toString("latin1").matchAll(/slide-0\d\.jpg|caption\.txt/g)].map((m) => m[0]);
  assert.deepEqual(names.slice(0, 3), ["slide-01.jpg", "slide-02.jpg", "caption.txt"]);
  assert.equal(crc32(enc.encode("123456789")), 0xcbf43926, "standard CRC-32 check value");
});

test("pricing comparison: at least 45 unique rows, 8 categories plus summary, honest rights from the plan configuration", () => {
  const c = serverLoader({})("src/lib/pricing-content.ts");
  const p = serverLoader({})("src/lib/plans.ts");
  assert.ok(c.uniqueRows().length >= 45, "unique rows: " + c.uniqueRows().length);
  assert.equal(c.CATEGORIES.length, 9);
  const key = c.CATEGORIES.find((x) => x.id === "key");
  assert.ok(key.open && key.rows.length >= 15, "at least 15 differences visible immediately");
  assert.ok(key.rows.every(c.differs), "the summary only lists real differences");
  const row = (label) => c.uniqueRows().find((r) => r.label === label);
  assert.deepEqual(row("AI-carrousels maken").values, { starter: "Nee", growth: true, autopilot: true });
  assert.deepEqual(row("Slides per carrousel").values, { starter: false, growth: "2–5", autopilot: "2–10" });
  assert.deepEqual(row("Max. carrousels per maand").values, { starter: 0, growth: 4, autopilot: 10 });
  assert.deepEqual(row("Max. inspiratiebeelden").values, { starter: 1, growth: 3, autopilot: 5 });
  assert.deepEqual(row("Mavix Agent").values, { starter: false, growth: false, autopilot: true });
  assert.deepEqual(row("Persoonlijk advies").values, { starter: false, growth: false, autopilot: "20 minuten per maand" });
  assert.deepEqual(row("Inbox AI-antwoorden per maand").values, { starter: false, growth: 40, autopilot: 100 });
  assert.equal(row("Gmail-integratie").values.growth, "soon", "not sold as working");
  const g = c.upgradeBenefits("starter", "growth");
  assert.equal(g.extraPerMonth, p.euro(40));
  assert.ok(g.items.some((i) => i === "600 in plaats van 150 AI-credits per maand"));
  assert.ok(g.items.some((i) => /carrousels met AI: 4 per maand, tot 5 slides/.test(i)));
  const pr = c.upgradeBenefits("growth", "autopilot");
  assert.equal(pr.extraPerMonth, p.euro(50));
  assert.ok(pr.items.some((i) => /Mavix Agent \(30 taken per maand\)/.test(i)));
  assert.ok(pr.items.some((i) => /20 minuten/.test(i)));
  assert.ok(p.PLANS.growth.highlights.includes("AI-carrousels tot 5 slides"));
  assert.ok(p.PLANS.autopilot.highlights.includes("AI-carrousels tot 10 slides"));
  for (const id of p.PLAN_IDS) assert.ok(p.maxActionCredits(p.PLANS[id]) <= p.PLANS[id].credits, id);
});
