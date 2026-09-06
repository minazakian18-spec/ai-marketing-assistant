import test from "node:test";
import assert from "node:assert/strict";
import { generateMock } from "../src/lib/content-generator.ts";
import {
  emptyWorkspace,
  readWorkspace,
  writeWorkspace,
  STORAGE_KEY,
} from "../src/lib/storage.ts";

test("mockgeneratie gebruikt het idee en de bedrijfsnaam, met een nieuwe conceptidentiteit", () => {
  const profile = { ...emptyWorkspace.profile, name: "Studio Bloom" };
  const first = generateMock("Onze weekendactie", profile);
  const second = generateMock("Onze weekendactie", profile, 1);
  assert.match(first.caption, /Studio Bloom/);
  assert.match(first.caption, /Onze weekendactie/);
  assert.equal(first.status, "draft");
  assert.equal(first.date, "");
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.caption, second.caption);
  assert.match(first.hashtags, /#StudioBloom/);
});

test("lokale opslag begint leeg en bewaart profiel, status en planning", () => {
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  assert.deepEqual(readWorkspace(), emptyWorkspace);
  const profile = { ...emptyWorkspace.profile, name: "Mijn bedrijf" };
  const post = {
    ...generateMock("Een nieuw product", profile),
    status: "scheduled",
    date: "2027-01-15T12:00",
  };
  const workspace = { profile, posts: [post] };
  writeWorkspace(workspace);
  assert.deepEqual(readWorkspace(), workspace);
  memory.set(STORAGE_KEY, "{broken");
  assert.throws(() => readWorkspace());
  memory.set(
    STORAGE_KEY,
    JSON.stringify({ profile, posts: [{ status: "published" }] }),
  );
  assert.throws(() => readWorkspace(), /Ongeldige/);
  globalThis.localStorage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  assert.throws(() => writeWorkspace(workspace), /QuotaExceededError/);
});
