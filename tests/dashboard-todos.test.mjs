import test from "node:test";
import assert from "node:assert/strict";
import { buildTodos, todoProgress } from "../src/lib/dashboard-todos.ts";

const base = (over = {}) => ({
  brandScore: 40,
  review: { count: 0, href: "/social?tab=assist" },
  failed: { count: 0, href: "/calendar" },
  campaigns: 0,
  plannedThisWeek: 0,
  ...over,
});
const statuses = (map) => (p) => map[p] || "disconnected";

test("to-do's come only from real state: urgent first, then open, then done", () => {
  const todos = buildTodos(base({ failed: { count: 2, href: "/x" }, review: { count: 1, href: "/r" }, campaigns: 3, status: statuses({ gmail: "reconnect_required" }) }));
  const ids = todos.map((t) => t.id);
  assert.deepEqual(ids.slice(0, 2), ["failed", "reconnect-gmail"]);
  assert.ok(todos.find((t) => t.id === "failed").title.startsWith("2 geplande items"));
  assert.equal(todos.find((t) => t.id === "review").href, "/r");
  assert.equal(todos.find((t) => t.id === "email").done, true);
  const firstDone = todos.findIndex((t) => t.done);
  assert.ok(todos.slice(firstDone).every((t) => t.done), "done items are last");
});

test("connection steps wait until statuses are loaded and count selection as connected", () => {
  assert.ok(!buildTodos(base()).some((t) => t.id === "instagram" || t.id === "gbp"));
  const todos = buildTodos(base({ status: statuses({ instagram: "connected", google_business: "selection_required" }) }));
  assert.equal(todos.find((t) => t.id === "instagram").done, true);
  assert.equal(todos.find((t) => t.id === "gbp").done, true);
  assert.ok(todos.some((t) => t.id === "gbp-location" && t.urgent));
});

test("progress covers regular steps only, brand progress is clamped", () => {
  const todos = buildTodos(base({ brandScore: 140, plannedThisWeek: 2, failed: { count: 1, href: "/x" } }));
  assert.equal(todos.find((t) => t.id === "brand").progress, 100);
  assert.equal(todos.find((t) => t.id === "week").detail, "2 items staan ingepland voor de komende 7 dagen.");
  assert.deepEqual(todoProgress(todos), { done: 3, total: 4 });
});
