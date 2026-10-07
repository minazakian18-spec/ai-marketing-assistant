import type { CalendarItem } from "@/lib/calendar-data";
import { MAVIX_TZ, zonedToUtc, type ClientEvent } from "@/lib/calendar/core";

export type View = "day" | "week" | "month" | "agenda";

export type GoogleCalendar = {
  id: string;
  summary: string;
  color: string;
  accessRole: string;
  primary: boolean;
};

// One thing on the calendar: a Google event or a piece of Mavix content.
export type Entry = {
  key: string;
  kind: "google" | "mavix";
  title: string;
  start: number; // ms instant
  end: number;
  allDay: boolean;
  startDate?: string; // all-day only, YYYY-MM-DD
  endDate?: string; // all-day only, exclusive
  color: string;
  editable: boolean;
  calendarId?: string;
  channel?: "Instagram" | "E-mail";
  google?: ClientEvent;
  item?: CalendarItem;
};

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const timeKey = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const fromKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDaysLocal = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfWeek = (d: Date) => addDaysLocal(startOfDay(d), -((d.getDay() + 6) % 7));
export const browserTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || MAVIX_TZ;

export function visibleRange(view: View, anchor: Date) {
  if (view === "day") return { start: startOfDay(anchor), end: addDaysLocal(anchor, 1) };
  if (view === "week") {
    const s = startOfWeek(anchor);
    return { start: s, end: addDaysLocal(s, 7) };
  }
  if (view === "month") {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const s = startOfWeek(first);
    return { start: s, end: addDaysLocal(s, 42) };
  }
  return { start: startOfDay(anchor), end: addDaysLocal(anchor, 30) };
}

export function shiftAnchor(view: View, anchor: Date, dir: 1 | -1) {
  if (view === "day") return addDaysLocal(anchor, dir);
  if (view === "week") return addDaysLocal(anchor, 7 * dir);
  if (view === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  return addDaysLocal(anchor, 30 * dir);
}

export function periodLabel(view: View, anchor: Date) {
  if (view === "day")
    return anchor.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (view === "week") {
    const s = startOfWeek(anchor);
    const e = addDaysLocal(s, 6);
    const same = s.getMonth() === e.getMonth();
    return (
      s.toLocaleDateString("nl-NL", { day: "numeric", month: same ? undefined : "short" }) +
      " – " +
      e.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })
    );
  }
  if (view === "month") return anchor.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
  return "Vanaf " + anchor.toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
}

export function googleEntries(events: ClientEvent[], calendars: GoogleCalendar[]): Entry[] {
  return events.map((e) => {
    const cal = calendars.find((c) => c.id === e.calendarId);
    const start = e.allDay ? fromKey(e.start).getTime() : Date.parse(e.start);
    const end = e.allDay ? fromKey(e.end).getTime() : Date.parse(e.end);
    return {
      key: "g:" + e.calendarId + ":" + e.id,
      kind: "google",
      title: e.title,
      start,
      end,
      allDay: e.allDay,
      startDate: e.allDay ? e.start : undefined,
      endDate: e.allDay ? e.end : undefined,
      color: cal?.color || "#7c6bd6",
      editable: e.editable,
      calendarId: e.calendarId,
      google: e,
    };
  });
}

// Scan-friendly status colours: planned content in Mavix purple, waiting for
// approval lighter, failed/blocked red, published history muted.
const STATUS_COLOR: Record<CalendarItem["status"], string> = {
  scheduled: "#6d28d9",
  approved: "#6d28d9",
  review: "#a78bfa",
  published: "#8b8b96",
  failed: "#d92d20",
  blocked: "#d92d20",
  rejected: "#8b8b96",
};

// Mavix content is scheduled in Amsterdam wall-clock time; convert to instants.
// Only content with a planned date appears; rejected content is not planned.
export function mavixEntries(items: CalendarItem[]): Entry[] {
  return items
    .filter((i) => i.date && i.status !== "rejected")
    .map((i) => {
      const start = zonedToUtc(i.date, i.time || "09:00", MAVIX_TZ);
      return {
        key: "m:" + i.id,
        kind: "mavix",
        title: i.title || i.contentType,
        start,
        end: start + 30 * 60000,
        allDay: false,
        color: STATUS_COLOR[i.status],
        editable: true,
        channel: i.channel,
        item: i,
      };
    });
}

export function onDay(entries: Entry[], day: Date) {
  const s = startOfDay(day).getTime();
  const e = addDaysLocal(day, 1).getTime();
  const key = dayKey(day);
  return entries.filter((x) =>
    x.allDay ? x.startDate! <= key && key < x.endDate! : x.start < e && x.end > s,
  );
}

export const sortEntries = (a: Entry, b: Entry) =>
  Number(b.allDay) - Number(a.allDay) || a.start - b.start || a.title.localeCompare(b.title);

// Side-by-side columns for overlapping timed events (per day).
export function layoutDay(entries: Entry[]) {
  const sorted = [...entries].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: { entry: Entry; col: number; cols: number }[] = [];
  let group: { entry: Entry; col: number }[] = [];
  let groupEnd = -Infinity;
  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.col + 1));
    for (const g of group) out.push({ ...g, cols });
    group = [];
  };
  for (const entry of sorted) {
    if (entry.start >= groupEnd && group.length) {
      flush();
      groupEnd = -Infinity;
    }
    const used = new Set(group.filter((g) => g.entry.end > entry.start).map((g) => g.col));
    let col = 0;
    while (used.has(col)) col++;
    group.push({ entry, col });
    groupEnd = Math.max(groupEnd, entry.end);
  }
  if (group.length) flush();
  return out;
}

export const formatTime = (ms: number) =>
  new Date(ms).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
