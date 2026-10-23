import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { serverLoader } from "./helpers/server-loader.mjs";
import { publishedLabel, sentLabel } from "../src/lib/status-labels.ts";

// Phase 1 information architecture: every navigation target exists, old
// addresses keep working, page names resolve for nested routes, and the
// terms stay unambiguous.
const icon = () => null;
const load = serverLoader({
  "lucide-react": new Proxy({}, { get: () => icon }),
  [path.resolve("src/components/mavi.ts")]: { Mavi: icon },
});
const nav = load("src/lib/navigation.ts");
const pageExists = (href) => fs.existsSync(path.join("src/app/(app)", href, "page.tsx"));

test("every sidebar and system item points to an existing page", () => {
  const items = [...nav.navigationGroups.flatMap((g) => g.items), ...nav.systemNavigation];
  for (const i of items) assert.ok(pageExists(i.href), i.href);
  assert.equal(new Set(items.map((i) => i.href)).size, items.length, "no item listed twice");
  assert.equal(new Set(items.map((i) => i.label)).size, items.length, "one name per page");
});

test("'Werkruimte' is reserved for the business account, not a sidebar group", () => {
  assert.ok(!nav.navigationGroups.some((g) => g.label === "Werkruimte"));
});

test("old addresses keep working: aliases and redirects lead to existing pages", () => {
  const config = fs.readFileSync("next.config.ts", "utf8");
  for (const [from, to] of [["/instagram-ai", "/social"], ["/ai-content", "/social"], ["/email-ai", "/email"], ["/review-ai", "/reviews"], ["/contentkalender", "/calendar"]]) {
    assert.ok(config.includes(`["${from}", "${to}"]`), from);
    assert.equal(nav.navigationPath(from), to);
    assert.ok(pageExists(to), to);
  }
  // /bedrijfsprofiel is now a redirect to the Brand Hub instead of a second copy.
  assert.ok(config.includes(`["/bedrijfsprofiel", "/brand-hub"]`));
  const old = fs.readFileSync("src/app/(app)/bedrijfsprofiel/page.tsx", "utf8");
  assert.match(old, /redirect\("\/brand-hub"\)/);
  assert.equal(nav.navigationPath("/bedrijfsprofiel"), "/brand-hub");
});

test("page names resolve for nested routes and settings pages", () => {
  const settings = [["/account", "Account en profiel"], ["/account/team", "Team"]];
  assert.equal(nav.pageLabel("/studio/nieuw"), "Content Studio");
  assert.equal(nav.pageLabel("/seo/rapport/abc"), "SEO Intelligence");
  assert.equal(nav.pageLabel("/account/integraties"), "Integraties");
  assert.equal(nav.pageLabel("/account/team", settings), "Team");
  assert.equal(nav.pageLabel("/account", settings), "Account en profiel");
  assert.equal(nav.pageLabel("/account"), "Instellingen");
  assert.equal(nav.pageLabel("/bedrijfsprofiel"), "Brand Hub");
  assert.equal(nav.pageLabel("/beheer"), "Beheer");
  assert.equal(nav.pageLabel("/onbekend"), "");
});

test("published and sent only claim a real action when the provider confirmed it", () => {
  assert.equal(publishedLabel(true), "Gepubliceerd");
  assert.equal(publishedLabel(false), "Demo gepubliceerd");
  assert.equal(sentLabel(true), "Verzonden");
  assert.equal(sentLabel(false), "Demo verzonden");
});

test("'Bedrijfsprofiel' only names Google's Business Profile; Mavix's own profile is the Brand Hub", () => {
  const files = ["src/lib/research/types.ts", "src/lib/research/rules.ts", "src/lib/server/research.ts", "src/components/research/research-section.tsx"];
  for (const f of files) {
    const bare = fs
      .readFileSync(f, "utf8")
      .split(/\r?\n/)
      .filter((l) => /Bedrijfsprofiel/.test(l) && !/Google Bedrijfsprofiel/.test(l) && !/^\s*(\/\/|\*)/.test(l));
    assert.deepEqual(bare, [], f);
  }
});
