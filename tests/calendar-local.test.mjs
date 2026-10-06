import test from "node:test";
import assert from "node:assert/strict";
import { fromInput, reschedule, localEventValid, inRange, isLocalCalendar, toClientEvent } from "../src/lib/calendar/local.ts";

const base = {
  title: "Overleg",
  description: "",
  location: "",
  allDay: false,
  startDate: "2026-10-06",
  startTime: "10:00",
  endDate: "2026-10-06",
  endTime: "11:00",
  timeZone: "Europe/Amsterdam",
  reminder: "default",
  repeat: null,
};
const key = (d) => d.toISOString().slice(0, 10);

test("timed input becomes UTC instants in the user's time zone", () => {
  const e = fromInput(base, "mavix:marketing", undefined, "2026-10-01T00:00:00.000Z");
  assert.equal(e.start, "2026-10-06T08:00:00.000Z"); // CEST = UTC+2
  assert.equal(e.end, "2026-10-06T09:00:00.000Z");
  assert.equal(localEventValid(e), true);
  assert.equal(toClientEvent(e).editable, true);
});

test("all-day input stores an exclusive end date", () => {
  const e = fromInput({ ...base, allDay: true, endDate: "2026-10-07" }, "mavix:tasks");
  assert.equal(e.start, "2026-10-06");
  assert.equal(e.end, "2026-10-08");
  assert.equal(localEventValid(e), true);
});

test("end before start is corrected to a 30 minute event", () => {
  const e = fromInput({ ...base, endTime: "09:00" }, "mavix:content");
  assert.equal(Date.parse(e.end) - Date.parse(e.start), 30 * 60000);
});

test("editing keeps id and createdAt", () => {
  const first = fromInput(base, "mavix:marketing", undefined, "2026-10-01T00:00:00.000Z");
  const edited = fromInput({ ...base, title: "Nieuw" }, "mavix:personal", first, "2026-10-02T00:00:00.000Z");
  assert.equal(edited.id, first.id);
  assert.equal(edited.createdAt, first.createdAt);
  assert.equal(edited.updatedAt, "2026-10-02T00:00:00.000Z");
  assert.equal(edited.calendarId, "mavix:personal");
});

test("reschedule moves timed events and keeps all-day length", () => {
  const e = fromInput(base, "mavix:marketing");
  const s = Date.parse("2026-10-08T12:00:00Z");
  const moved = reschedule(e, s, s + 3600000, key);
  assert.equal(moved.start, "2026-10-08T12:00:00.000Z");
  assert.equal(moved.end, "2026-10-08T13:00:00.000Z");
  const day = fromInput({ ...base, allDay: true, endDate: "2026-10-07" }, "mavix:tasks");
  const md = reschedule(day, Date.parse("2026-10-10T00:00:00Z"), 0, key);
  assert.equal(md.start, "2026-10-10");
  assert.equal(md.end, "2026-10-12");
});

test("validation and helpers", () => {
  assert.equal(isLocalCalendar("mavix:marketing"), true);
  assert.equal(isLocalCalendar("primary"), false);
  assert.equal(localEventValid({ id: "x" }), false);
  const e = fromInput(base, "mavix:marketing");
  assert.equal(localEventValid({ ...e, calendarId: "google" }), false);
  assert.equal(localEventValid({ ...e, end: e.start }), false);
  assert.equal(inRange(e, new Date("2026-10-05T00:00:00Z"), new Date("2026-10-12T00:00:00Z")), true);
  assert.equal(inRange(e, new Date("2026-10-07T00:00:00Z"), new Date("2026-10-08T00:00:00Z")), false);
});
