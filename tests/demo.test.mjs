import test from "node:test";
import assert from "node:assert/strict";
import { demoSession } from "../src/lib/demo.ts";
test("demo access requires an explicit cookie, available in any environment", () => {
  for (const environment of ["development", "production", "test", undefined])
    assert.equal(demoSession("1", environment), true);
  for (const cookie of [undefined, "", "0", "true"])
    assert.equal(demoSession(cookie, "production"), false);
});
