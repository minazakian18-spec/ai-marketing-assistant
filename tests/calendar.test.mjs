import test from "node:test";
import assert from "node:assert/strict";
import {
  addMinutesLocal,
  addDays,
  zonedToUtc,
  zonedParts,
  contentEventBody,
  contentHash,
  planMirror,
  runSync,
  SyncTokenExpired,
  remotelyDeleted,
  mapGoogleError,
  recurrenceFor,
  parseRepeat,
  truncateRecurrence,
  continueRecurrence,
  eventBody,
  validateInput,
  normalizeEvent,
} from "../src/lib/calendar/core.ts";

const item = (over = {}) => ({
  type: "post",
  id: "p1",
  title: "Nieuwe collectie",
  channel: "Instagram",
  kind: "Post",
  date: "2026-10-15",
  time: "10:00",
  caption: "Caption",
  ...over,
});
const linkFor = (it, over = {}) => ({
  workspace_id: "w1",
  mavix_entity_type: it.type,
  mavix_entity_id: it.id,
  calendar_id: "primary",
  provider_event_id: "g-" + it.id,
  content_hash: contentHash(contentEventBody(it)),
  state: "active",
  ...over,
});

test("Amsterdam wall-clock times convert to the right instant across DST", () => {
  // Summer time (UTC+2) and winter time (UTC+1).
  assert.equal(new Date(zonedToUtc("2026-07-01", "10:00", "Europe/Amsterdam")).toISOString(), "2026-07-01T08:00:00.000Z");
  assert.equal(new Date(zonedToUtc("2026-12-01", "10:00", "Europe/Amsterdam")).toISOString(), "2026-12-01T09:00:00.000Z");
  // The day the clocks go back (25 Oct 2026): 12:00 is UTC+1.
  assert.equal(new Date(zonedToUtc("2026-10-25", "12:00", "Europe/Amsterdam")).toISOString(), "2026-10-25T11:00:00.000Z");
  assert.deepEqual(zonedParts(Date.UTC(2026, 6, 1, 8, 0), "Europe/Amsterdam").time, "10:00");
});

test("wall-clock arithmetic rolls over midnight and month ends without the host timezone", () => {
  assert.deepEqual(addMinutesLocal("2026-10-31", "23:45", 30), { date: "2026-11-01", time: "00:15" });
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("Mavix content becomes a Google event with local time + timezone, never a shifted UTC string", () => {
  const body = contentEventBody(item());
  assert.equal(body.summary, "Mavix · Instagram — Nieuwe collectie");
  assert.deepEqual(body.start, { dateTime: "2026-10-15T10:00:00", timeZone: "Europe/Amsterdam" });
  assert.deepEqual(body.end, { dateTime: "2026-10-15T10:30:00", timeZone: "Europe/Amsterdam" });
  assert.equal(body.extendedProperties.private.mavixItemId, "post-p1");
  assert.equal(contentEventBody(item({ channel: "E-mail", title: "Nieuwsbrief oktober" })).summary, "Mavix · E-mail — Nieuwsbrief oktober");
});

test("mirror sync creates a mapping once and never duplicates on later runs", () => {
  const a = item();
  const first = planMirror([a], [], "w1", "primary");
  assert.equal(first.create.length, 1);
  const second = planMirror([a], [linkFor(a)], "w1", "primary");
  assert.deepEqual(second, { create: [], update: [], remove: [] });
});

test("changed content updates the existing Google event instead of creating a new one", () => {
  const a = item();
  const plan = planMirror([item({ time: "11:00" })], [linkFor(a)], "w1", "primary");
  assert.equal(plan.create.length, 0);
  assert.equal(plan.update.length, 1);
  assert.equal(plan.update[0].link.provider_event_id, "g-p1");
});

test("unscheduled or deleted content removes its mirrored event; remote deletions are respected", () => {
  const a = item();
  const removed = planMirror([], [linkFor(a)], "w1", "primary");
  assert.equal(removed.remove.length, 1);
  const respected = planMirror([a], [linkFor(a, { state: "deleted_remotely" })], "w1", "primary");
  assert.deepEqual(respected, { create: [], update: [], remove: [] });
  assert.deepEqual(remotelyDeleted([{ id: "x", status: "cancelled" }, { id: "y", status: "confirmed" }]), ["x"]);
});

test("mirror planning only considers links of the same workspace", () => {
  const a = item();
  const plan = planMirror([a], [linkFor(a, { workspace_id: "other" })], "w1", "primary");
  assert.equal(plan.create.length, 1);
  assert.equal(plan.remove.length, 0);
});

test("incremental sync uses the stored token and follows pagination", async () => {
  const calls = [];
  const result = await runSync(async (req) => {
    calls.push(req);
    return req.pageToken ? { items: [{ id: "b" }], nextSyncToken: "t2" } : { items: [{ id: "a" }], nextPageToken: "p2" };
  }, "t1");
  assert.equal(result.reset, false);
  assert.equal(result.nextSyncToken, "t2");
  assert.deepEqual(result.changes.map((c) => c.id), ["a", "b"]);
  assert.equal(calls[0].syncToken, "t1");
});

test("an expired sync token (410) falls back to a full sync", async () => {
  const result = await runSync(async (req) => {
    if (req.syncToken) throw new SyncTokenExpired();
    return { items: [], nextSyncToken: "fresh" };
  }, "old");
  assert.equal(result.reset, true);
  assert.equal(result.nextSyncToken, "fresh");
});

test("revoked access and provider errors map to safe Dutch messages and connection states", () => {
  assert.equal(mapGoogleError(401).connection, "reconnect_required");
  assert.equal(mapGoogleError(403, "insufficientPermissions").connection, "permission_missing");
  assert.equal(mapGoogleError(403, "rateLimitExceeded").status, 429);
  assert.equal(mapGoogleError(403, "forbidden").connection, undefined);
  assert.equal(mapGoogleError(412).status, 409);
  assert.equal(mapGoogleError(500).status, 503);
  assert.doesNotMatch(mapGoogleError(500).message, /googleapis|error/i);
});

test("recurrence follows Google's RRULE model", () => {
  assert.deepEqual(recurrenceFor({ freq: "WEEKLY", interval: 2 }), ["RRULE:FREQ=WEEKLY;INTERVAL=2"]);
  assert.deepEqual(parseRepeat(["RRULE:FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=5"]), { freq: "MONTHLY", interval: 3 });
  assert.deepEqual(
    truncateRecurrence(["RRULE:FREQ=DAILY;COUNT=10"], { dateTime: "2026-10-15T10:00:00+02:00" }),
    ["RRULE:FREQ=DAILY;UNTIL=20261015T075959Z"],
  );
  assert.deepEqual(truncateRecurrence(["RRULE:FREQ=WEEKLY"], { date: "2026-10-15" }), ["RRULE:FREQ=WEEKLY;UNTIL=20261014"]);
  assert.deepEqual(continueRecurrence(["RRULE:FREQ=DAILY;UNTIL=20261231", "EXDATE:20261020"]), ["RRULE:FREQ=DAILY"]);
});

test("all-day events use exclusive end dates and timed events keep their timezone", () => {
  const base = { title: "Beurs", reminder: "default", repeat: null, timeZone: "Europe/Amsterdam" };
  const allDay = eventBody({ ...base, allDay: true, startDate: "2026-10-15", endDate: "2026-10-16" });
  assert.deepEqual(allDay.start, { date: "2026-10-15", dateTime: null });
  assert.deepEqual(allDay.end, { date: "2026-10-17", dateTime: null });
  const timed = eventBody({ ...base, allDay: false, startDate: "2026-10-15", startTime: "09:00", endDate: "2026-10-15", endTime: "10:30", reminder: 10 });
  assert.equal(timed.start.dateTime, "2026-10-15T09:00:00");
  assert.equal(timed.start.timeZone, "Europe/Amsterdam");
  assert.deepEqual(timed.reminders, { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] });
  assert.match(validateInput({ ...base, allDay: false, startDate: "2026-10-15", startTime: "10:00", endDate: "2026-10-15", endTime: "09:00" }), /eindtijd/);
});

test("Google events normalize with edit rights from the calendar's access role", () => {
  const e = { id: "e1", etag: '"1"', summary: "Teamoverleg", start: { dateTime: "2026-10-15T09:00:00+02:00" }, end: { dateTime: "2026-10-15T10:00:00+02:00" }, reminders: { useDefault: true } };
  assert.equal(normalizeEvent(e, { id: "c", accessRole: "owner" }).editable, true);
  assert.equal(normalizeEvent(e, { id: "c", accessRole: "reader" }).editable, false);
  assert.equal(normalizeEvent({ ...e, status: "cancelled" }, { id: "c", accessRole: "owner" }), null);
  const allDay = normalizeEvent({ id: "a", start: { date: "2026-10-15" }, end: { date: "2026-10-16" } }, { id: "c", accessRole: "owner" });
  assert.equal(allDay.allDay, true);
  assert.equal(allDay.end, "2026-10-16");
});
