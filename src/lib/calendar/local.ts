// Mavix' own calendars (Marketing, Content, Persoonlijk, Taken). Events are
// stored in the workspace data next to posts and campaigns, so planning
// works without Google. Pure: shared by the calendar page and tests.
import { addDays, zonedToUtc, type ClientEvent, type EventInput } from "./core.ts";

export const LOCAL_PREFIX = "mavix:";
export const LOCAL_CALENDARS = [
  { id: "mavix:marketing", summary: "Marketing", color: "#7c5cd6" },
  { id: "mavix:content", summary: "Content", color: "#2f8f8a" },
  { id: "mavix:personal", summary: "Persoonlijk", color: "#c0657f" },
  { id: "mavix:tasks", summary: "Taken", color: "#b7791f" },
] as const;
export type LocalCalendarId = (typeof LOCAL_CALENDARS)[number]["id"];

export type LocalCalendarEvent = {
  id: string;
  calendarId: LocalCalendarId;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  start: string; // ISO instant, or YYYY-MM-DD for all-day
  end: string; // exclusive date for all-day
  reminder: "default" | "none" | number;
  createdAt: string;
  updatedAt: string;
};

export const isLocalCalendar = (id: string): id is LocalCalendarId => LOCAL_CALENDARS.some((c) => c.id === id);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function localEventValid(e: unknown): e is LocalCalendarEvent {
  const v = e as Record<string, unknown>;
  if (!v || typeof v !== "object") return false;
  if (!["id", "title", "description", "location", "start", "end", "createdAt", "updatedAt"].every((k) => typeof v[k] === "string")) return false;
  if (!isLocalCalendar(String(v.calendarId)) || typeof v.allDay !== "boolean") return false;
  if (!(v.reminder === "default" || v.reminder === "none" || (typeof v.reminder === "number" && v.reminder >= 0))) return false;
  if ((v.title as string).length > 500 || (v.description as string).length > 8000) return false;
  const start = v.start as string, end = v.end as string;
  return v.allDay ? DATE.test(start) && DATE.test(end) && start < end : !isNaN(Date.parse(start)) && Date.parse(end) > Date.parse(start);
}

export function toClientEvent(e: LocalCalendarEvent): ClientEvent {
  return {
    id: e.id,
    calendarId: e.calendarId,
    title: e.title,
    description: e.description,
    location: e.location,
    allDay: e.allDay,
    start: e.start,
    end: e.end,
    editable: true,
    reminder: e.reminder,
    attendees: [],
  };
}

// Editor input -> stored event. Times are converted from the user's time
// zone to instants; all-day ends are exclusive like Google's.
export function fromInput(
  input: EventInput,
  calendarId: LocalCalendarId,
  base?: Pick<LocalCalendarEvent, "id" | "createdAt">,
  now = new Date().toISOString(),
): LocalCalendarEvent {
  const timed = (date: string, time?: string) => new Date(zonedToUtc(date, time || "00:00", input.timeZone)).toISOString();
  const start = input.allDay ? input.startDate : timed(input.startDate, input.startTime);
  let end = input.allDay ? addDays(input.endDate, 1) : timed(input.endDate, input.endTime);
  if (!input.allDay && Date.parse(end) <= Date.parse(start)) end = new Date(Date.parse(start) + 30 * 60000).toISOString();
  return {
    id: base?.id || "evt-" + Math.random().toString(36).slice(2) + Date.now().toString(36),
    calendarId,
    title: input.title.trim().slice(0, 500) || "(Geen titel)",
    description: (input.description || "").slice(0, 8000),
    location: (input.location || "").slice(0, 500),
    allDay: input.allDay,
    start,
    end,
    reminder: input.reminder,
    createdAt: base?.createdAt || now,
    updatedAt: now,
  };
}

// Move/resize a stored event to new instants (timed) or days (all-day).
export function reschedule(e: LocalCalendarEvent, start: number, end: number, dayKey: (d: Date) => string, now = new Date().toISOString()): LocalCalendarEvent {
  if (e.allDay) {
    const s = dayKey(new Date(start));
    const days = Math.max(1, Math.round((Date.parse(e.end) - Date.parse(e.start)) / 86400000));
    return { ...e, start: s, end: addDays(s, days), updatedAt: now };
  }
  return { ...e, start: new Date(start).toISOString(), end: new Date(Math.max(end, start + 15 * 60000)).toISOString(), updatedAt: now };
}

export function inRange(e: LocalCalendarEvent, start: Date, end: Date) {
  const s = e.allDay ? Date.parse(e.start + "T00:00:00") : Date.parse(e.start);
  const en = e.allDay ? Date.parse(e.end + "T00:00:00") : Date.parse(e.end);
  return s < end.getTime() && en > start.getTime();
}
