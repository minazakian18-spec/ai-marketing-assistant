import test from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/lib/research/rules.ts";
import { answerFromReport, buildReport, nextEligibleAt, researchPeriod } from "../src/lib/research/report.ts";
import { businessKindOf, reviewFacts, websiteFacts } from "../src/lib/research/extract.ts";
import { isPublicAddress } from "../src/lib/server/safe-fetch.ts";

const baseInput = (over = {}) => ({
  businessKind: "restaurant",
  collectedAt: "2026-10-07T10:00:00Z",
  sources: [{ id: "profile", label: "Bedrijfsprofiel", status: "used", note: "" }],
  profile: { name: "Trattoria Test", industry: "Restaurant", audience: "Gezinnen", description: "Italiaans", website: "", city: "Utrecht", hasAddress: true, phone: "", products: [{ name: "Pizza", price: 12 }], offers: "", hasBrandVoice: true, segments: 1 },
  content: { last30: 0, scheduledAhead: 0, drafts: 0, formats: {}, withPhotos: 0 },
  email: { campaigns90: 0, contacts: 50, subscribed: 40 },
  ...over,
});

test("monthly period and next eligible date follow Amsterdam time", () => {
  assert.equal(researchPeriod(new Date("2026-10-31T22:30:00Z")), "2026-10"); // 23:30 local, still October
  assert.equal(researchPeriod(new Date("2026-10-31T23:30:00Z")), "2026-11"); // 00:30 local, November (CET)
  assert.equal(nextEligibleAt("2026-10"), "2026-10-31T23:00:00.000Z"); // 1 Nov 00:00 CET
  assert.equal(nextEligibleAt("2026-03"), "2026-03-31T22:00:00.000Z"); // 1 Apr 00:00 CEST
  assert.equal(nextEligibleAt("2026-12"), "2026-12-31T23:00:00.000Z"); // 1 Jan next year
});

test("missing sources become uncertain findings, never invented facts", () => {
  const findings = analyze(baseInput());
  const byId = Object.fromEntries(findings.map((f) => [f.id, f]));
  assert.equal(byId["reviews-unknown"].status, "uncertain");
  assert.equal(byId["google-unknown"].status, "uncertain");
  assert.equal(byId["instagram-stats-unknown"].status, "uncertain");
  assert.equal(byId["website-none"].status, "uncertain");
  assert.ok(!findings.some((f) => /concurrent/i.test(f.found)), "no competitor claims without data");
});

test("restaurant rules flag missing menu, reservations and unanswered negative reviews", () => {
  const html = '<html><head><title>Trattoria</title></head><body><h1>Welkom</h1><p>Lekker Italiaans eten in Utrecht.</p></body></html>';
  const reviews = reviewFacts(
    [
      { starRating: "TWO", comment: "Lang moeten wachten, service traag", createTime: "2026-10-01T10:00:00Z" },
      { starRating: "ONE", comment: "Wachttijd veel te lang", createTime: "2026-09-20T10:00:00Z" },
      { starRating: "FIVE", comment: "Heerlijk eten!", createTime: "2026-09-10T10:00:00Z", reviewReply: { comment: "Dank!" } },
    ],
    new Date("2026-10-07T10:00:00Z"),
  );
  const input = baseInput({ profile: { ...baseInput().profile, website: "http://trattoria.test" }, website: websiteFacts("http://trattoria.test/", 200, html, 900), reviews });
  const ids = analyze(input).map((f) => f.id);
  for (const id of ["website-menu", "website-reservations", "website-https", "website-hours", "website-mobile", "reviews-replies", "reviews-complaint-de wachttijd"]) assert.ok(ids.includes(id), id);
  const report = buildReport(input, analyze(input), "2026-10", new Date("2026-10-07T10:00:00Z"));
  assert.equal(report.topPriorities.length, 3);
  assert.ok(report.findings[0].priority === "high");
  assert.ok(report.plan.length >= 2);
  assert.ok(report.notResearched.some((n) => /Concurrenten/.test(n.label)));
});

test("website facts detect menu, reservation, phone, hours and schema", () => {
  const html = `<html><head><title>Bistro</title><meta name="description" content="Bistro in Gouda"><meta name="viewport" content="width=device-width">
    <script type="application/ld+json">{"@type":"Restaurant"}</script></head>
    <body><a href="/menu">Bekijk het menu</a><a href="https://zenchef.com/x">Reserveren</a><a href="tel:+31182000000">Bel ons</a>
    <p>Openingstijden: di 17:00 - 22:00</p></body></html>`;
  const w = websiteFacts("https://bistro.test/", 200, html, 500);
  assert.equal(w.https, true);
  assert.equal(w.metaDescription, "Bistro in Gouda");
  assert.equal(w.menuLink && w.reservationLink && w.phoneLink && w.mentionsOpeningHours && w.restaurantSchema && w.mobileViewport, true);
  const ids = analyze(baseInput({ profile: { ...baseInput().profile, website: "https://bistro.test" }, website: w })).map((f) => f.id);
  assert.ok(ids.includes("website-menu-good") && ids.includes("website-reservations-good"));
  assert.ok(!ids.includes("website-https") && !ids.includes("website-schema"));
});

test("review facts: average, reply rate, recent trend and themes", () => {
  const r = reviewFacts(
    [
      { starRating: "FIVE", comment: "Super vriendelijke bediening", createTime: "2026-10-01T00:00:00Z", reviewReply: { comment: "x" } },
      { starRating: "FOUR", comment: "Vriendelijk personeel", createTime: "2026-01-01T00:00:00Z" },
      { starRating: "FIVE", comment: "Fijne service", createTime: "2026-01-02T00:00:00Z" },
    ],
    new Date("2026-10-07T00:00:00Z"),
  );
  assert.equal(r.total, 3);
  assert.equal(r.average, 4.7);
  assert.equal(r.recent90, 1);
  assert.equal(r.replied, 1);
  assert.equal(r.themes.find((t) => t.theme === "de service").positive, 3);
});

test("business kind and offline follow-up answers", () => {
  assert.equal(businessKindOf("Restaurant"), "restaurant");
  assert.equal(businessKindOf("Kapsalon"), "business");
  const input = baseInput();
  const report = buildReport(input, analyze(input), "2026-10");
  assert.match(answerFromReport("Wat moet ik als eerste verbeteren?", report), /^Begin met:/);
  assert.match(answerFromReport("Hoe zit het met mijn reviews?", report), /Reviews/);
});

test("SSRF guard rejects private, loopback, link-local and metadata addresses", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])
    assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ["93.184.216.34", "8.8.8.8", "2606:4700::6810:84e5"]) assert.equal(isPublicAddress(ip), true, ip);
  assert.equal(isPublicAddress("not-an-ip"), false);
});
