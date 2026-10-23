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