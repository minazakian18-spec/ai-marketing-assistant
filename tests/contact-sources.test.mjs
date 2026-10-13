import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOrigin, originOf, sourceFolders, sourceLabel, OTHER_SOURCE } from "../src/lib/contact-sources.ts";
import { contactValid } from "../src/lib/contact-data.ts";

const contact = (over = {}) => ({
  id: "c-" + Math.random().toString(16).slice(2),
  firstName: "Sanne",
  lastName: "de Vries",
  email: "sanne@example.test",
  status: "Niet bevestigd",
  source: "import",
  createdAt: "2026-10-13T09:00:00.000Z",
  ...over,
});

test("originOf: explicit origin wins, older contacts get a sensible default folder", () => {
  assert.equal(originOf(contact({ origin: "thuisbezorgd" })), "thuisbezorgd");
  assert.equal(originOf(contact({ source: "newsletter" })), "website");
  assert.equal(originOf(contact({ source: "manual" })), "manual");
  assert.equal(originOf(contact({ source: "import" })), OTHER_SOURCE);
});

test("normalizeOrigin maps typed labels to preset ids and keeps custom names", () => {
  assert.equal(normalizeOrigin("thuisbezorgd"), "thuisbezorgd");
  assert.equal(normalizeOrigin(" Uber Eats "), "ubereats");
  assert.equal(normalizeOrigin("Handmatig toegevoegd"), "manual");
  assert.equal(normalizeOrigin("Deliveroo"), "Deliveroo");
  assert.equal(normalizeOrigin("   "), undefined);
  assert.equal(normalizeOrigin("x".repeat(80)).length, 60);
});

test("sourceFolders lists every preset, then custom sources, then other; counts per folder", () => {
  const folders = sourceFolders([
    contact({ origin: "thuisbezorgd" }),
    contact({ origin: "thuisbezorgd" }),
    contact({ origin: "Deliveroo" }),
    contact({ source: "import" }),
  ]);
  const ids = folders.map((f) => f.id);
  assert.deepEqual(ids, ["thuisbezorgd", "sitedish", "ubereats", "website", "manual", "Deliveroo", OTHER_SOURCE]);
  assert.equal(folders.find((f) => f.id === "thuisbezorgd").count, 2);
  assert.equal(folders.find((f) => f.id === "sitedish").count, 0);
  assert.equal(sourceLabel("Deliveroo"), "Deliveroo");
  // No "other" folder when nothing falls into it.
  assert.ok(!sourceFolders([contact({ origin: "website" })]).some((f) => f.id === OTHER_SOURCE));
});

test("contactValid accepts a valid origin and rejects malformed ones", () => {
  assert.ok(contactValid(contact()));
  assert.ok(contactValid(contact({ origin: "ubereats" })));
  assert.ok(!contactValid(contact({ origin: "" })));
  assert.ok(!contactValid(contact({ origin: 5 })));
  assert.ok(!contactValid(contact({ origin: "x".repeat(61) })));
});
