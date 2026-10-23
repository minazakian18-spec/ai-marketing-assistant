import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serverLoader, memoryDb } from "./helpers/server-loader.mjs";

// Workspace A's records, requested by a signed-in owner of workspace B with
// A's real ids: nothing is returned, changed or signed. Real route handlers;
// only Supabase, cookies and storage are in memory.

const origin = "https://mavix.webbo-solutions.nl";
const FILE = "11111111-1111-4111-8111-111111111111";
const REPORT = "22222222-2222-4222-8222-222222222222";
const CONV = "33333333-3333-4333-8333-333333333333";

function setup(t) {
  const tables = {
    workspace_members: [
      { user_id: "uA", workspace_id: "wA", role: "OWNER" },
      { user_id: "uB", workspace_id: "wB", role: "OWNER" },
    ],
    workspaces: [{ id: "wA", deleted_at: null }, { id: "wB", deleted_at: null }],
    library_files: [{ id: FILE, workspace_id: "wA", name: "contract", storage_path: "wA/contract.pdf" }],
    research_reports: [{ id: REPORT, workspace_id: "wA", period: "2026-10", status: "completed", completed_at: "2026-10-01T00:00:00Z", report: { secret: "A" } }],
    inbox_conversations: [{ id: CONV, workspace_id: "wA", provider: "instagram", status: "open", unread_count: 2, labels: [] }],
    inbox_messages: [],
    integration_connections: [],
  };
  const db = memoryDb(tables);
  const state = { user: "uB" };
  const signed = [];
  db.auth = { getUser: async () => ({ data: { user: { id: state.user, email: state.user + "@x.test" } }, error: null }) };
  db.storage = { from: () => ({ createSignedUrl: async (p) => (signed.push(p), { data: { signedUrl: "https://storage.test/" + p }, error: null }) }) };
  for (const level of ["error", "warn", "info"]) t.mock.method(console, level, () => {});
  const load = serverLoader({
    [path.resolve("src/lib/server/supabase.ts")]: { adminClient: () => db, authClient: async () => db, appUrl: () => origin },
    "next/headers": { cookies: async () => ({ get: () => undefined, set() {}, delete() {} }) },
  });
  const ctx = (id) => ({ params: Promise.resolve({ id }) });
  return { tables, state, signed, load, ctx };
}

test("workspace B cannot download, read or change workspace A's file, report or conversation", async (t) => {
  const f = setup(t);
  const download = f.load("src/app/api/library/files/[id]/download/route.ts");
  const research = f.load("src/app/api/research/[id]/route.ts");
  const inbox = f.load("src/app/api/inbox/[id]/route.ts");

  const d = await download.GET(new Request(origin + "/api/library/files/" + FILE + "/download"), f.ctx(FILE));
  assert.equal(d.status, 404);
  assert.deepEqual(f.signed, [], "no signed URL is issued for another workspace's file");

  const r = await research.GET(new Request(origin + "/api/research/" + REPORT), f.ctx(REPORT));
  assert.equal(r.status, 404);
  assert.ok(!(await r.text()).includes("secret"));

  const g = await inbox.GET(new Request(origin + "/api/inbox/" + CONV), f.ctx(CONV));
  assert.equal(g.status, 404);
  const p = await inbox.PATCH(new Request(origin + "/api/inbox/" + CONV, { method: "PATCH", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ status: "resolved", unread: false }) }), f.ctx(CONV));
  assert.equal(p.status, 404);
  assert.deepEqual([f.tables.inbox_conversations[0].status, f.tables.inbox_conversations[0].unread_count], ["open", 2], "A's conversation unchanged");

  // The owner of workspace A does get the file (the check is not simply "always 404").
  f.state.user = "uA";
  const own = await download.GET(new Request(origin + "/api/library/files/" + FILE + "/download"), f.ctx(FILE));
  assert.equal(own.status, 307);
  assert.deepEqual(f.signed, ["wA/contract.pdf"]);
});

test("a request from another site cannot change data, even with a valid session", async (t) => {
  const f = setup(t);
  f.state.user = "uA";
  const inbox = f.load("src/app/api/inbox/[id]/route.ts");
  const res = await inbox.PATCH(new Request(origin + "/api/inbox/" + CONV, { method: "PATCH", headers: { origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify({ status: "resolved" }) }), f.ctx(CONV));
  assert.equal(res.status, 403);
  assert.equal(f.tables.inbox_conversations[0].status, "open");
});
