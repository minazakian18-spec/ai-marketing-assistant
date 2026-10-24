import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { serverLoader } from "./helpers/server-loader.mjs";

// Phase 2 security regression tests: SSRF address checks and the shape of
// every API route (authentication, origin check on writes).

const { isPublicAddress } = serverLoader({})("src/lib/server/safe-fetch.ts");

test("SSRF: private, loopback and metadata addresses are refused in every notation", () => {
  for (const ip of [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "::1", "0:0:0:0:0:0:0:1", "::", "fd00::1", "fe80::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "0:0:0:0:0:ffff:7f00:1",
    "64:ff9b::7f00:1", "::127.0.0.1",
  ])
    assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946", "::ffff:5db8:d822"]) assert.equal(isPublicAddress(ip), true, ip);
});

/* ---------------- Route shape ---------------- */

const routes = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? routes(p) : e.name === "route.ts" ? [p] : [];
  });
const name = (f) => "/" + path.relative("src/app/api", path.dirname(f)).split(path.sep).join("/");

// Public on purpose, each with its own protection.
const PUBLIC = {
  "/applications": "rate limit + origin (account request form)",
  "/auth/[action]": "Supabase Auth itself",
  "/newsletter/subscribe": "form key, consent, rate limit",
  "/newsletter/confirm": "single-use token",
  "/newsletter/unsubscribe": "signed token",
  "/webhooks/meta": "X-Hub-Signature-256",
  "/webhooks/resend": "Svix signature",
  "/billing/webhook": "Stripe-Signature",
  "/calendar/webhook": "channel token",
  "/automation/cron": "CRON_SECRET",
  "/seo/cron": "CRON_SECRET",
};

test("every API route either requires a signed-in member or is a documented public endpoint", () => {
  const files = routes("src/app/api");
  assert.ok(files.length > 50);
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    const gated = /\b(workspace|identity|platformAdmin)\(/.test(src) || /handle\w+Integration\(/.test(src);
    assert.ok(gated || PUBLIC[name(f)], name(f) + " has no authentication and is not documented as public");
  }
  for (const r of Object.keys(PUBLIC)) assert.ok(files.some((f) => name(f) === r), "documented public route exists: " + r);
});

test("every state-changing handler checks the request origin, unless it is a signed webhook or cron", () => {
  const signed = ["/webhooks/meta", "/webhooks/resend", "/billing/webhook", "/calendar/webhook", "/automation/cron", "/seo/cron", "/newsletter/subscribe", "/newsletter/confirm", "/newsletter/unsubscribe"];
  for (const f of routes("src/app/api")) {
    const src = fs.readFileSync(f, "utf8");
    const writes = /export (async )?function (POST|PUT|PATCH|DELETE)\b/.test(src);
    if (!writes || signed.includes(name(f))) continue;
    assert.ok(/sameOrigin\(/.test(src) || /handle\w+Integration\(/.test(src), name(f) + " changes state without an origin check");
  }
});

test("workspace data is only written by the server after its checks; the direct browser write policy is dropped", () => {
  const route = fs.readFileSync("src/app/api/workspace/route.ts", "utf8");
  assert.match(route, /adminClient\(\)\.from\('business_profiles'\)\.update\(/, "PUT writes with the service role after the checks");
  assert.doesNotMatch(route, /\bdb\.from\('business_profiles'\)\.update\(/, "no write with the browser's session");
  const sql = fs.readFileSync("supabase/migrations/202610230002_business_profiles_server_writes.sql", "utf8");
  assert.match(sql, /drop policy if exists business_write on public\.business_profiles;/);
  assert.match(sql, /ROLLBACK/);
  assert.doesNotMatch(sql, /drop policy if exists business_read/, "reading stays allowed for members");
});
/* ---------------- Image input: only JPEG/PNG/WebP bytes reach sharp ---------------- */
test("image signatures: JPEG, PNG and WebP pass; SVG, PDF, TIFF and disguised files never reach the image library", () => {
  const { sniffImage } = serverLoader({})("src/lib/server/image-sniff.ts");
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), "jpeg");
  assert.equal(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), "png");
  assert.equal(sniffImage(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")])), "webp");
  for (const bad of ['<svg xmlns="http://www.w3.org/2000/svg"></svg>', '<?xml version="1.0"?><svg/>', "%PDF-1.7", "II*\u0000", "GIF89a", ""]) assert.equal(sniffImage(Buffer.from(bad, "latin1")), null, JSON.stringify(bad));
  // The sharp call sites check the signature before calling sharp.
  for (const f of ["src/lib/server/image-input.ts", "src/lib/server/instagram-publish.ts"]) {
    const src = fs.readFileSync(f, "utf8");
    assert.ok(src.indexOf("sniffImage(") > 0 && src.indexOf("sniffImage(") < src.indexOf("sharp("), f + " checks the signature before sharp");
  }
});
test("an SVG disguised as a PNG data URL is refused before sharp is called", async () => {
  let sharpCalls = 0;
  const load = serverLoader({
    sharp: { default: () => (sharpCalls++, { metadata: async () => ({ format: "svg", width: 900, height: 900 }) }) },
    [path.resolve("src/lib/server/library.ts")]: { readImage: async () => { throw new Error("not used"); } },
  });
  const { loadImageInput } = load("src/lib/server/image-input.ts");
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"></svg>').toString("base64");
  await assert.rejects(loadImageInput("w1", "data:image/png;base64," + svg), (e) => e.status === 400 && /JPG-, PNG- of WebP/.test(e.message));
  assert.equal(sharpCalls, 0, "sharp never saw the SVG");
});