// Planning from the calendar: one configuration for the "Maken" menu and the
// menu that opens when you click an empty slot, plus the URL contract that
// hands a chosen date/time to the existing Social and E-mail editors.
//
// Contract: /social?tab=assist&type=Post&date=YYYY-MM-DD[&time=HH:mm]&source=calendar
//           /email?tab=assist&date=YYYY-MM-DD[&time=HH:mm]&source=calendar
// Times are Mavix wall-clock time (Europe/Amsterdam), the same as stored on
// posts and campaigns. Without a time the editor uses its own default.

export type PlanKind = "event" | "instagram-post" | "email" | "instagram-story" | "instagram-reel";
export type PlanOption = {
  kind: PlanKind;
  label: string;
  detail?: string;
  group: "appointment" | "marketing";
  soon?: boolean;
};

export const PLAN_OPTIONS: PlanOption[] = [
  { kind: "event", label: "Afspraak", detail: "Normale afspraak", group: "appointment" },
  { kind: "instagram-post", label: "Instagram-post", group: "marketing" },
  { kind: "email", label: "E-mail / nieuwsbrief", group: "marketing" },
  { kind: "instagram-story", label: "Instagram-story", group: "marketing", soon: true },
  { kind: "instagram-reel", label: "Instagram-reel", group: "marketing", soon: true },
];

export type PlanSlot = { date: string; time?: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Where a marketing option leads; null for the appointment (handled in place). */
export function planningHref(kind: PlanKind, slot?: PlanSlot): string | null {
  const q = new URLSearchParams({ tab: "assist" });
  if (kind === "instagram-post") q.set("type", "Post");
  else if (kind !== "email") return null;
  if (slot && DATE.test(slot.date)) {
    q.set("date", slot.date);
    if (slot.time && TIME.test(slot.time)) q.set("time", slot.time);
  }
  q.set("source", "calendar");
  return (kind === "email" ? "/email?" : "/social?") + q.toString();
}

export type PlanningContext = {
  fromCalendar: boolean;
  /** datetime-local value (YYYY-MM-DDTHH:mm) or "" when no date was chosen. */
  dateTime: string;
  /** Day to show when returning to the calendar. */
  returnDate: string;
};

/**
 * Reads the planning context from the URL. `defaultTime` is the channel's own
 * default publishing time for that day, used when only a date was passed
 * (e.g. an all-day click). Also accepts the older `date=YYYY-MM-DDTHH:mm`.
 */
export function readPlanningContext(params: URLSearchParams, defaultTime: (date: string) => string): PlanningContext {
  const fromCalendar = params.get("source") === "calendar";
  const back = params.get("back") || "";
  const raw = params.get("date") || "";
  const [d, legacyTime] = raw.split("T");
  if (!DATE.test(d)) return { fromCalendar, dateTime: "", returnDate: DATE.test(back) ? back : "" };
  const t = params.get("time") || legacyTime?.slice(0, 5) || "";
  const time = TIME.test(t) ? t : defaultTime(d);
  return { fromCalendar, dateTime: d + "T" + (TIME.test(time) ? time : "18:00"), returnDate: d };
}

/**
 * Opening existing content from the calendar. `back` only remembers which day
 * to return to; it never changes the content's own schedule.
 */
export function contentHref(base: string, mode: "view" | "edit", back?: string) {
  const q = new URLSearchParams({ source: "calendar" });
  if (mode === "view") q.set("view", "preview");
  if (back && DATE.test(back)) q.set("back", back);
  return base + (base.includes("?") ? "&" : "?") + q.toString();
}

/** Back to the calendar, on the week of the planned day when known. */
export function calendarReturnHref(date?: string) {
  return date && DATE.test(date.slice(0, 10)) ? "/calendar?date=" + date.slice(0, 10) : "/calendar";
}

/** Weekday key (0 = Sunday) of a YYYY-MM-DD date, as used by Instagram settings. */
export function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return String(new Date(Date.UTC(y, m - 1, d)).getUTCDay());
}
