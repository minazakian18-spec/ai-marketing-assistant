import test from "node:test";
import assert from "node:assert/strict";
import { PLAN_OPTIONS, calendarReturnHref, contentHref, planningHref, readPlanningContext, weekdayOf } from "../src/lib/calendar/planning.ts";

const read = (url, fallback = () => "18:00") => readPlanningContext(new URL(url, "http://x").searchParams, fallback);

test("calendar hands date and time to the existing Social and E-mail editors", () => {
  assert.equal(planningHref("instagram-post", { date: "2026-10-13", time: "17:00" }), "/social?tab=assist&type=Post&date=2026-10-13&time=17%3A00&source=calendar");
  assert.equal(planningHref("email", { date: "2026-10-14", time: "12:00" }), "/email?tab=assist&date=2026-10-14&time=12%3A00&source=calendar");
  assert.equal(planningHref("email", { date: "2026-10-14" }), "/email?tab=assist&date=2026-10-14&source=calendar");
  assert.equal(planningHref("instagram-post"), "/social?tab=assist&type=Post&source=calendar");
  assert.equal(planningHref("event", { date: "2026-10-14" }), null);
  assert.equal(planningHref("instagram-reel"), null, "upcoming formats lead nowhere");
  assert.equal(planningHref("email", { date: "nope", time: "25:00" }), "/email?tab=assist&source=calendar");
});

test("Social/E-mail read the context; date-only picks use the channel default time", () => {
  assert.deepEqual(read("/social?date=2026-10-13&time=17:00&source=calendar"), { fromCalendar: true, dateTime: "2026-10-13T17:00", returnDate: "2026-10-13" });
  assert.equal(read("/email?date=2026-10-14&source=calendar", () => "10:00").dateTime, "2026-10-14T10:00");
  assert.equal(read("/social?date=2026-10-13T09:30").dateTime, "2026-10-13T09:30", "legacy date param");
  assert.deepEqual(read("/social?tab=assist"), { fromCalendar: false, dateTime: "", returnDate: "" });
  assert.equal(read("/social?date=2026-10-13&time=99:99").dateTime, "2026-10-13T18:00");
  assert.equal(read("/social?post=1&source=calendar&back=2026-10-20").returnDate, "2026-10-20");
});

test("opening content from the calendar never changes its schedule", () => {
  const view = contentHref("/social?tab=assist&post=abc", "view", "2026-10-13");
  assert.equal(view, "/social?tab=assist&post=abc&source=calendar&view=preview&back=2026-10-13");
  assert.ok(!new URL(view, "http://x").searchParams.has("date"));
  assert.equal(contentHref("/email?tab=create&campaign=c1", "edit"), "/email?tab=create&campaign=c1&source=calendar");
  assert.equal(calendarReturnHref("2026-10-13T17:00"), "/calendar?date=2026-10-13");
  assert.equal(calendarReturnHref(""), "/calendar");
});

test("one menu configuration with working post/e-mail and subtle upcoming formats", () => {
  const working = PLAN_OPTIONS.filter((o) => !o.soon).map((o) => o.kind);
  assert.deepEqual(working, ["event", "instagram-post", "email"]);
  assert.ok(PLAN_OPTIONS.filter((o) => o.soon).every((o) => o.group === "marketing"));
  assert.equal(weekdayOf("2026-10-13"), "2"); // Tuesday
});
