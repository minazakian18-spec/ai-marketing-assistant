import test from "node:test";
import assert from "node:assert/strict";
import { demoSession } from "../src/lib/demo.ts";
test("demo access requires an explicit cookie and development mode", () => {
  assert.equal(demoSession("1", "development"), true);
  for (const environment of ["production", "test", undefined])
    assert.equal(demoSession("1", environment), false);
  for (const cookie of [undefined, "", "0", "true"])
    assert.equal(demoSession(cookie, "development"), false);
});
