import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serverLoader } from "./helpers/server-loader.mjs";

// A database without the library migration answers with PGRST205 (table not
// in schema cache). The library must report "being set up" with a plain
// Dutch message, log what is missing, and never return fake data.
function stubDb(error) {
  const chain = {
    upsert: async () => ({ error }),
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: async () => ({ data: null, error }),
  };
  return { from: () => chain, rpc: async () => ({ data: null, error }), storage: { from: () => ({}) } };
}

function loadLibrary(error) {
  const load = serverLoader({ [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => stubDb(error), appUrl: () => "http://localhost:3000" } });
  return load("src/lib/server/library.ts");
}

test("library: missing table becomes LibrarySetupError with a user-friendly message", async (t) => {
  const logs = [];
  t.mock.method(console, "error", (m) => logs.push(m));
  const lib = loadLibrary({ code: "PGRST205", message: "Could not find the table 'public.library_albums' in the schema cache" });
  await assert.rejects(lib.listLibrary("11111111-1111-1111-1111-111111111111", true), (e) => {
    assert.ok(e instanceof lib.LibrarySetupError);
    assert.equal(e.status, 503);
    assert.doesNotMatch(e.message, /migrat|sql|PGRST/i);
    return true;
  });
  assert.match(logs.join("\n"), /library_not_provisioned/);
});

test("library: other database errors are not disguised as setup", async (t) => {
  t.mock.method(console, "error", () => {});
  const lib = loadLibrary({ code: "57014", message: "canceling statement due to statement timeout" });
  await assert.rejects(lib.listLibrary("11111111-1111-1111-1111-111111111111", true), (e) => {
    assert.ok(!(e instanceof lib.LibrarySetupError));
    assert.equal(e.status, 503);
    return true;
  });
});
