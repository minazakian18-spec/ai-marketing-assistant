import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { serverLoader } from "./helpers/server-loader.mjs";

const load = serverLoader({});

async function withAppUrl(url, fn) {
  const old = process.env.APP_URL;
  process.env.APP_URL = url;
  try {
    return await fn();
  } finally {
    if (old === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = old;
  }
}

test("www host redirects permanently to the canonical APP_URL origin, keeping path and query", () =>
  withAppUrl("https://mavix.webbo-solutions.nl", async () => {
    const { proxy } = load("src/proxy.ts");
    const r = await proxy(new NextRequest("https://www.mavix.webbo-solutions.nl/pricing?x=1", { headers: { host: "www.mavix.webbo-solutions.nl" } }));
    assert.equal(r.status, 308);
    assert.equal(r.headers.get("location"), "https://mavix.webbo-solutions.nl/pricing?x=1");
  }));

test("the canonical host and unrelated www hosts are not redirected", () =>
  withAppUrl("https://mavix.webbo-solutions.nl", async () => {
    const { proxy } = load("src/proxy.ts");
    const home = await proxy(new NextRequest("https://mavix.webbo-solutions.nl/", { headers: { host: "mavix.webbo-solutions.nl" } }));
    assert.notEqual(home.status, 308);
    const other = await proxy(new NextRequest("https://www.example.com/", { headers: { host: "www.example.com" } }));
    assert.notEqual(other.status, 308);
  }));

test("public marketing metadata: descriptive titles, canonical paths, private pages not in the sitemap", async () => {
  const { pageMetadata, PUBLIC_PAGES } = load("src/lib/site.ts");
  const m = pageMetadata({ title: "Prijzen en abonnementen voor AI-marketing", description: "x", path: "/pricing" });
  assert.equal(m.alternates.canonical, "/pricing");
  assert.equal(m.openGraph.title, "Prijzen en abonnementen voor AI-marketing | Mavix");
  const paths = PUBLIC_PAGES.map((p) => p.path);
  for (const p of ["/login", "/register", "/dashboard", "/agent", "/aanvraag/status"]) assert.ok(!paths.includes(p), p + " must not be in the sitemap");
});
