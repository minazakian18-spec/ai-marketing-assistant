// Pure Google Calendar sync logic: no I/O, no server-only imports, so it can be
// unit-tested with mocked Google responses (tests/calendar.test.mjs).

// Mavix content is scheduled as wall-clock time ("2026-10-15T10:00") for a
// business in the Netherlands.
export const MAVIX_TZ = "Europe/Amsterdam";

/* ---------- wall-clock arithmetic (never depends on the host timezone) ---------- */

const pad = (n: number) => String(n).padStart(2, "0");

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function addMinutesLocal(date: string, time: string, minutes: number) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm + minutes));
  return {
    date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`,
  };
}

// Wall-clock parts of an instant in a timezone.
export function zonedParts(utcMs: number, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    second: Number(parts.second),
  };
}

function offsetMs(utcMs: number, tz: string) {
  const p = zonedParts(utcMs, tz);
  const [y, m, d] = p.date.split("-").map(Number);
  const [hh, mm] = p.time.split(":").map(Number);
  return Date.UTC(y, m - 1, d, hh, mm, p.second) - Math.floor(utcMs / 1000) * 1000;
}

// The instant at which a wall-clock time occurs in a timezone (DST-aware).
export function zonedToUtc(date: string, time: string, tz: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = offsetMs(guess, tz);
  const t = guess - first;
  const second = offsetMs(t, tz);
  return second === first ? t : guess - second;
}

/* ---------- Mavix content → Google event ---------- */

export type ContentItem = {
  type: "post" | "email";
  id: string;
  title: string;
  channel: "Instagram" | "E-mail";
  kind: string;
  date: string;
  time: string;
  caption: string;
};

export function contentEventBody(item: ContentItem, tz = MAVIX_TZ) {
  const time = item.time || "09:00";
  const end = addMinutesLocal(item.date, time, 30);
  const title = item.title.trim() || item.kind || "Content";
  return {
    summary: `Mavix · ${item.channel} — ${title}`.slice(0, 250),
    description: [
      item.caption?.slice(0, 1500),
      `${item.kind} · gepland in Mavix`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    start: { dateTime: `${item.date}T${time}:00`, timeZone: tz },
    end: { dateTime: `${end.date}T${end.time}:00`, timeZone: tz },
    transparency: "transparent",
    reminders: { useDefault: false, overrides: [] as unknown[] },
    extendedProperties: { private: { mavixItemId: `${item.type}-${item.id}` } },
  };
}

// Stable fingerprint of what we sent, so unchanged content isn't re-sent.
export function contentHash(body: { summary: string; description: string; start: unknown; end: unknown }) {
  const text = JSON.stringify([body.summary, body.description, body.start, body.end]);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export type EventLink = {
  workspace_id: string;
  mavix_entity_type: "post" | "email";
  mavix_entity_id: string;
  calendar_id: string;
  provider_event_id: string;
  content_hash: string;
  state: "active" | "deleted_remotely";
};

export type MirrorPlan = {
  create: ContentItem[];
  update: { item: ContentItem; link: EventLink }[];
  remove: EventLink[];
};

// Idempotent: running it again with the links it produced yields an empty plan.
export function planMirror(
  items: ContentItem[],
  allLinks: EventLink[],
  workspaceId: string,
  calendarId: string,
  tz = MAVIX_TZ,
): MirrorPlan {
  const links = allLinks.filter((l) => l.workspace_id === workspaceId);
  const plan: MirrorPlan = { create: [], update: [], remove: [] };
  const wanted = new Set<string>();
  for (const item of items) {
    const key = item.type + ":" + item.id;
    wanted.add(key);
    const link = links.find(
      (l) => l.mavix_entity_type === item.type && l.mavix_entity_id === item.id,
    );
    if (!link) {
      plan.create.push(item);
      continue;
    }
    // The user deleted the mirrored event in Google: respect that, don't recreate it.
    if (link.state === "deleted_remotely") continue;
    if (link.calendar_id !== calendarId) {
      plan.remove.push(link);
      plan.create.push(item);
      continue;
    }
    if (link.content_hash !== contentHash(contentEventBody(item, tz)))
      plan.update.push({ item, link });
  }
  for (const link of links)
    if (
      link.state === "active" &&
      !wanted.has(link.mavix_entity_type + ":" + link.mavix_entity_id)
    )
      plan.remove.push(link);
  return plan;
}

/* ---------- incremental sync ---------- */

export type GoogleEvent = {
  id: string;
  status?: string;
  etag?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: { date?: string; dateTime?: string; timeZone?: string };
  reminders?: { useDefault?: boolean; overrides?: { method: string; minutes: number }[] };
  attendees?: { email: string; self?: boolean }[];
  extendedProperties?: { private?: Record<string, string> };
};
export type EventsPage = {
  items?: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
};
export type PageRequest = { syncToken?: string; pageToken?: string };
export class SyncTokenExpired extends Error {}

// Runs an incremental sync from a stored token. If Google invalidated the token
// (HTTP 410 → SyncTokenExpired), falls back to a full sync and reports reset.
export async function runSync(
  fetchPage: (req: PageRequest) => Promise<EventsPage>,
  syncToken: string | null,
  maxPages = 40,
) {
  async function loop(token: string | undefined) {
    const changes: GoogleEvent[] = [];
    let pageToken: string | undefined;
    for (let i = 0; i < maxPages; i++) {
      const page = await fetchPage(token ? { syncToken: token, pageToken } : { pageToken });
      changes.push(...(page.items || []));
      if (page.nextPageToken) {
        pageToken = page.nextPageToken;
        continue;
      }
      if (!page.nextSyncToken) throw new Error("Google gaf geen synchronisatietoken terug.");
      return { changes, nextSyncToken: page.nextSyncToken };
    }
    throw new Error("Te veel pagina's tijdens synchronisatie.");
  }
  if (syncToken) {
    try {
      return { ...(await loop(syncToken)), reset: false };
    } catch (e) {
      if (!(e instanceof SyncTokenExpired)) throw e;
    }
  }
  return { ...(await loop(undefined)), reset: true };
}

// Mirrored Mavix events that were deleted in Google during a sync.
export function remotelyDeleted(changes: GoogleEvent[]) {
  return changes
    .filter((e) => e.status === "cancelled" && !e.recurringEventId)
    .map((e) => e.id);
}

/* ---------- errors ---------- */

export type MappedError = {
  status: number;
  message: string;
  connection?: "reconnect_required" | "permission_missing";
};

export function mapGoogleError(status: number, reason = ""): MappedError {
  if (status === 401)
    return {
      status: 409,
      message: "De koppeling met Google Calendar is verlopen. Verbind opnieuw.",
      connection: "reconnect_required",
    };
  if (/insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(reason))
    return {
      status: 403,
      message:
        "Mavix mist toestemming voor Google Calendar. Verbind opnieuw en sta alle gevraagde toegang toe.",
      connection: "permission_missing",
    };
  if (status === 429 || /rateLimitExceeded|userRateLimitExceeded|quotaExceeded/i.test(reason))
    return {
      status: 429,
      message: "Google Calendar krijgt even te veel verzoeken. Probeer het over een minuut opnieuw.",
    };
  if (status === 403)
    return {
      status: 403,
      message: "Je hebt geen toestemming om dit evenement of deze agenda te wijzigen.",
    };
  if (status === 404 || status === 410)
    return {
      status: 404,
      message: "Dit evenement of deze agenda bestaat niet meer in Google Calendar.",
    };
  if (status === 412)
    return {
      status: 409,
      message:
        "Dit evenement is intussen in Google Calendar gewijzigd. Vernieuw de kalender en probeer het opnieuw.",
    };
  if (status === 400)
    return {
      status: 400,
      message: "Google Calendar accepteerde deze gegevens niet. Controleer datum en tijd.",
    };
  return {
    status: 503,
    message: "Google Calendar is tijdelijk niet bereikbaar. Probeer het later opnieuw.",
  };
}

/* ---------- recurrence (Google RRULE model) ---------- */

export type Repeat = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
} | null;

export function recurrenceFor(repeat: Repeat): string[] | undefined {
  if (!repeat) return undefined;
  const interval = Math.max(1, Math.min(99, Math.round(repeat.interval || 1)));
  return [`RRULE:FREQ=${repeat.freq}` + (interval > 1 ? `;INTERVAL=${interval}` : "")];
}

export function parseRepeat(recurrence?: string[]): Repeat {
  const rule = recurrence?.find((r) => r.startsWith("RRULE:"));
  if (!rule) return null;
  const freq = /FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/.exec(rule)?.[1] as NonNullable<Repeat>["freq"] | undefined;
  if (!freq) return null;
  return { freq, interval: Number(/INTERVAL=(\d+)/.exec(rule)?.[1] || 1) };
}

const withoutEnd = (rule: string) =>
  rule.replace(/;(UNTIL|COUNT)=[^;]*/g, "");

// "This and following": end the original series just before this occurrence.
export function truncateRecurrence(
  recurrence: string[],
  occurrence: { date?: string; dateTime?: string },
): string[] {
  let until: string;
  if (occurrence.date) {
    until = addDays(occurrence.date, -1).replace(/-/g, "");
  } else {
    const t = new Date(new Date(occurrence.dateTime!).getTime() - 1000);
    until = t.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }
  return recurrence.map((r) =>
    r.startsWith("RRULE:") ? withoutEnd(r) + ";UNTIL=" + until : r,
  );
}

// The new series created by "this and following" continues open-ended.
export function continueRecurrence(recurrence: string[]): string[] {
  return recurrence
    .filter((r) => !r.startsWith("EXDATE") && !r.startsWith("RDATE"))
    .map((r) => (r.startsWith("RRULE:") ? withoutEnd(r) : r));
}

/* ---------- event input from the Mavix composer → Google event body ---------- */

export type EventInput = {
  title: string;
  description?: string;
  location?: string;
  allDay: boolean;
  startDate: string;
  startTime?: string;
  endDate: string; // inclusive for all-day events
  endTime?: string;
  timeZone: string;
  reminder: "default" | "none" | number;
  repeat: Repeat;
  attendees?: string[];
};

export function validateInput(input: EventInput): string | null {
  if (!input.title.trim()) return "Geef het evenement een titel.";
  if (input.allDay) {
    if (input.endDate < input.startDate) return "De einddatum ligt vóór de begindatum.";
    return null;
  }
  if (!input.startTime || !input.endTime) return "Vul een begin- en eindtijd in.";
  const start = zonedToUtc(input.startDate, input.startTime, input.timeZone);
  const end = zonedToUtc(input.endDate, input.endTime, input.timeZone);
  if (end <= start) return "De eindtijd ligt vóór of op de begintijd.";
  return null;
}

export function eventBody(input: EventInput) {
  const body: Record<string, unknown> = {
    summary: input.title.trim().slice(0, 500),
    description: input.description?.slice(0, 8000) || "",
    location: input.location?.slice(0, 500) || "",
    start: input.allDay
      ? { date: input.startDate, dateTime: null }
      : { dateTime: `${input.startDate}T${input.startTime}:00`, timeZone: input.timeZone, date: null },
    end: input.allDay
      ? { date: addDays(input.endDate, 1), dateTime: null }
      : { dateTime: `${input.endDate}T${input.endTime}:00`, timeZone: input.timeZone, date: null },
    reminders:
      input.reminder === "default"
        ? { useDefault: true }
        : {
            useDefault: false,
            overrides:
              input.reminder === "none" ? [] : [{ method: "popup", minutes: input.reminder }],
          },
  };
  const recurrence = recurrenceFor(input.repeat);
  if (recurrence) body.recurrence = recurrence;
  if (input.attendees?.length)
    body.attendees = input.attendees.map((email) => ({ email }));
  return body;
}

/* ---------- Google event → client shape ---------- */

export type CalendarMeta = { id: string; accessRole: string };
export type ClientEvent = {
  id: string;
  calendarId: string;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  start: string; // RFC3339 instant, or YYYY-MM-DD for all-day
  end: string; // exclusive for all-day
  timeZone?: string;
  recurringEventId?: string;
  originalStart?: { date?: string; dateTime?: string };
  recurrence?: string[];
  etag?: string;
  htmlLink?: string;
  editable: boolean;
  reminder: "default" | "none" | number;
  attendees: string[];
};

export function normalizeEvent(e: GoogleEvent, calendar: CalendarMeta): ClientEvent | null {
  if (e.status === "cancelled" || !e.start || !e.end) return null;
  const allDay = !!e.start.date;
  const overrides = e.reminders?.overrides || [];
  return {
    id: e.id,
    calendarId: calendar.id,
    title: e.summary || "(Geen titel)",
    description: e.description || "",
    location: e.location || "",
    allDay,
    start: allDay ? e.start.date! : e.start.dateTime!,
    end: allDay ? e.end.date! : e.end.dateTime!,
    timeZone: e.start.timeZone,
    recurringEventId: e.recurringEventId,
    originalStart: e.originalStartTime,
    recurrence: e.recurrence,
    etag: e.etag,
    htmlLink: e.htmlLink,
    editable: calendar.accessRole === "owner" || calendar.accessRole === "writer",
    reminder:
      e.reminders?.useDefault !== false
        ? "default"
        : overrides.length
          ? overrides[0].minutes
          : "none",
    attendees: (e.attendees || []).filter((a) => !a.self).map((a) => a.email),
  };
}

export function isMirroredContent(e: GoogleEvent) {
  return !!e.extendedProperties?.private?.mavixItemId;
}
