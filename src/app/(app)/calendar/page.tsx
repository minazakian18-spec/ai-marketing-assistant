"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, PanelLeft, Plug, Plus, RefreshCw, X } from "lucide-react";
import { PLAN_OPTIONS, planningHref } from "@/lib/calendar/planning";
import { PlanMenu, PLAN_ICONS } from "@/components/calendar/plan-menu";
import { useWorkspace } from "@/components/workspace-provider";
import { Menu } from "@/components/menu";
import { BrandIcon } from "@/components/brand-icon";
import { MiniMonth } from "@/components/calendar/mini-month";
import { EventPopover } from "@/components/calendar/event-popover";
import { LOCAL_CALENDARS, fromInput, inRange, isLocalCalendar, reschedule, toClientEvent, type LocalCalendarEvent } from "@/lib/calendar/local";
import { toCalendarItems, type CalendarItem, type CalendarStatus } from "@/lib/calendar-data";
import type { Post } from "@/lib/types";
import { campaignError, type EmailCampaign } from "@/lib/email-model";
import { isBrowserDemo } from "@/lib/demo";
import { MAVIX_TZ, addDays, zonedParts, type ClientEvent, type EventInput } from "@/lib/calendar/core";
import { CalendarDetailPanel } from "@/components/calendar/detail-panel";
import { TimeGrid } from "@/components/calendar/time-grid";
import { MonthGrid } from "@/components/calendar/month-grid";
import { AgendaList } from "@/components/calendar/agenda-list";
import { EventEditor, type EditorState, type Scope } from "@/components/calendar/event-editor";
import {
  addDaysLocal,
  browserTimeZone,
  dayKey,
  fromKey,
  googleEntries,
  mavixEntries,
  periodLabel,
  shiftAnchor,
  startOfDay,
  startOfWeek,
  timeKey,
  visibleRange,
  type Entry,
  type GoogleCalendar,
  type View,
} from "@/components/calendar/model";
import "../../calendar.css";

const CHANNELS = ["all", "Instagram", "E-mail", "Campagnes"] as const;
type ChannelFilter = (typeof CHANNELS)[number];
const STATUS_FILTERS: { id: "all" | CalendarStatus; label: string }[] = [
  { id: "all", label: "Alle statussen" },
  { id: "review", label: "Wacht op goedkeuring" },
  { id: "approved", label: "Goedgekeurd" },
  { id: "scheduled", label: "Ingepland" },
  { id: "published", label: "Gepubliceerd" },
  { id: "rejected", label: "Afgewezen" },
  { id: "blocked", label: "Geblokkeerd" },
  { id: "failed", label: "Mislukt" },
];
const VIEWS: [View, string][] = [
  ["day", "Dag"],
  ["week", "Week"],
  ["month", "Maand"],
  ["agenda", "Agenda"],
];
const HIDDEN_KEY = "mavix.calendar.hidden.v1";

type Settings = { mirror: boolean; mirrorCalendarId: string };
type Conn =
  | { state: "loading" }
  | { state: "demo" }
  | { state: "error"; message: string }
  | {
      state: "ready";
      status: string;
      connected?: boolean;
      email?: string;
      mine?: boolean;
      settings: Settings;
      calendars: GoogleCalendar[];
    };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || "Er ging iets mis. Probeer het opnieuw."), { status: r.status });
  return d as T;
}

// Local input → the optimistic client shape (replaced by Google's answer).
function optimistic(base: Partial<ClientEvent>, input: EventInput, calendarId: string): ClientEvent {
  const local = (date: string, time?: string) => {
    const d = fromKey(date);
    const [h, m] = (time || "00:00").split(":").map(Number);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  return {
    id: base.id || "tmp-" + Math.random().toString(36).slice(2),
    calendarId,
    title: input.title,
    description: input.description || "",
    location: input.location || "",
    allDay: input.allDay,
    start: input.allDay ? input.startDate : local(input.startDate, input.startTime),
    end: input.allDay ? addDays(input.endDate, 1) : local(input.endDate, input.endTime),
    editable: true,
    reminder: input.reminder,
    attendees: input.attendees || [],
    recurringEventId: base.recurringEventId,
    recurrence: base.recurrence,
    etag: base.etag,
    htmlLink: base.htmlLink,
  };
}

function inputFrom(e: ClientEvent, start: number, end: number): EventInput {
  const s = new Date(start);
  const en = new Date(end);
  return {
    title: e.title,
    description: e.description,
    location: e.location,
    allDay: e.allDay,
    startDate: dayKey(s),
    startTime: e.allDay ? undefined : timeKey(s),
    endDate: e.allDay ? addDays(dayKey(en), -1) : dayKey(en),
    endTime: e.allDay ? undefined : timeKey(en),
    timeZone: browserTimeZone(),
    reminder: e.reminder,
    repeat: null,
    attendees: e.attendees,
  };
}

export default function CalendarPage() {
  const { data, ready, save } = useWorkspace();
  const router = useRouter();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [conn, setConn] = useState<Conn>({ state: "loading" });
  const [hidden, setHidden] = useState<string[]>([]);
  const [showMavix, setShowMavix] = useState(true);
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | CalendarStatus>("all");
  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [popover, setPopover] = useState<ClientEvent | null>(null);
  const [plan, setPlan] = useState<{ start: Date; end: Date; allDay: boolean; dateOnly: boolean; at: { x: number; y: number } } | null>(null);
  const lastPointer = useRef({ x: 0, y: 0 });
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [syncInfo, setSyncInfo] = useState<{ at: Date; mode: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const cache = useRef(new Map<string, ClientEvent[]>());

  const connected = conn.state === "ready" && (conn.connected ?? (conn.status === "connected" && !!conn.mine));
  const calendars = useMemo(() => (conn.state === "ready" && connected ? conn.calendars : []), [conn, connected]);
  const visibleIds = useMemo(() => calendars.filter((c) => !hidden.includes(c.id)).map((c) => c.id), [calendars, hidden]);
  const range = useMemo(() => visibleRange(view, anchor), [view, anchor]);
  const rangeKey = range.start.toISOString() + "|" + range.end.toISOString() + "|" + visibleIds.join(",");
  const localEvents = useMemo(() => data.calendar?.events || [], [data.calendar]);
  // Mavix' own calendars behave like extra (always writable) calendars.
  const localCalendars: GoogleCalendar[] = useMemo(
    () => LOCAL_CALENDARS.map((c) => ({ id: c.id, summary: c.summary, color: c.color, accessRole: "owner", primary: false })),
    [],
  );
  const allCalendars = useMemo(() => [...calendars, ...localCalendars], [calendars, localCalendars]);

  /* ---------- setup ---------- */
  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) setView("agenda");
    try {
      setHidden(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]"));
      setShowMavix(localStorage.getItem(HIDDEN_KEY + ".mavix") !== "0");
    } catch {
      /* Preferences are optional. */
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) setToast("Google Agenda is gekoppeld.");
    const calendarError = params.get("calendar_error");
    if (calendarError === "permission")
      setToast("Niet alle toestemmingen zijn gegeven. Koppel opnieuw en sta toegang tot je agenda's en afspraken toe.");
    if (calendarError === "denied") setToast("Je hebt geen toestemming gegeven. Google Agenda is niet gekoppeld.");
    if (calendarError === "offline_access")
      setToast("Google gaf geen blijvende toegang. Koppel opnieuw; trek eventueel eerst de toegang van Mavix in je Google-account in.");
    // Coming back from Social/E-mail: open the week of the planned day.
    const back = params.get("date");
    if (back && /^\d{4}-\d{2}-\d{2}$/.test(back)) setAnchor(fromKey(back));
    if (params.toString()) window.history.replaceState(null, "", "/calendar");
    const t = window.setInterval(() => setNow(new Date()), 60000);
    // Where the last click happened, so the planning menu opens next to it.
    const pointer = (e: PointerEvent) => (lastPointer.current = { x: e.clientX, y: e.clientY });
    document.addEventListener("pointerdown", pointer, true);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("pointerdown", pointer, true);
    };
  }, []);

  const loadStatus = useCallback(async () => {
    if (isBrowserDemo()) return setConn({ state: "demo" });
    try {
      const d = await api<Omit<Extract<Conn, { state: "ready" }>, "state">>("/api/calendar");
      setConn({ state: "ready", ...d });
    } catch (e) {
      setConn({ state: "error", message: (e as Error).message });
    }
  }, []);
  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  function persistHidden(next: string[]) {
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    } catch {
      /* Optional. */
    }
  }
  const toggle = (id: string, on: boolean) => persistHidden(on ? hidden.filter((h) => h !== id) : [...hidden, id]);

  /* ---------- Google events for the visible range ---------- */
  const loadEvents = useCallback(
    async (force = false) => {
      if (!connected) return;
      if (!visibleIds.length) {
        setEventsError("");
        return setEvents([]);
      }
      const cached = cache.current.get(rangeKey);
      if (cached && !force) {
        setEventsError("");
        return setEvents(cached);
      }
      setLoadingEvents(true);
      try {
        const q = new URLSearchParams({ start: range.start.toISOString(), end: range.end.toISOString(), calendars: visibleIds.join(",") });
        const d = await api<{ events: ClientEvent[] }>("/api/calendar/events?" + q);
        cache.current.set(rangeKey, d.events);
        setEvents(d.events);
        setEventsError("");
      } catch (e) {
        setEventsError((e as Error).message);
        if ((e as { status?: number }).status === 409) void loadStatus();
      } finally {
        setLoadingEvents(false);
      }
    },
    [connected, visibleIds, rangeKey, range, loadStatus],
  );
  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  /* ---------- two-way sync loop ---------- */
  const sync = useCallback(
    async (manual = false) => {
      if (!connected) return;
      setSyncing(true);
      try {
        const r = await api<{ changed: boolean; mode: string }>("/api/calendar/sync", {
          method: "POST",
          body: JSON.stringify({ calendars: visibleIds }),
        });
        setSyncInfo({ at: new Date(), mode: r.mode });
        if (r.changed || manual) {
          cache.current.clear();
          await loadEvents(true);
        }
        if (manual) setToast("Kalender gesynchroniseerd.");
      } catch (e) {
        if (manual) setToast((e as Error).message);
        if ((e as { status?: number }).status === 409) void loadStatus();
      } finally {
        setSyncing(false);
      }
    },
    [connected, visibleIds, loadEvents, loadStatus],
  );
  useEffect(() => {
    if (!connected) return;
    void sync();
    const tick = () => {
      if (document.visibilityState === "visible") void sync();
    };
    const t = window.setInterval(tick, 60000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", tick);
    };
    // Only restart the loop when the connection or calendar selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, visibleIds.join(",")]);

  /* ---------- Google mutations (optimistic, rolled back on failure) ---------- */
  async function mutate(apply: (list: ClientEvent[]) => ClientEvent[], request: () => Promise<ClientEvent | null | void>, refetch = false) {
    const before = events;
    setEvents(apply(before));
    try {
      const result = await request();
      cache.current.clear();
      if (refetch) await loadEvents(true);
      else if (result) setEvents(apply(before).map((e) => (e.id === "__pending__" ? result : e)));
      return true;
    } catch (e) {
      setEvents(before);
      setToast((e as Error).message);
      if ((e as { status?: number }).status === 409) void loadStatus();
      return false;
    }
  }

  async function googleCreate(input: EventInput, calendarId: string) {
    const temp = optimistic({ id: "__pending__" }, input, calendarId);
    const ok = await mutate(
      (list) => [...list, temp],
      async () => (await api<{ event: ClientEvent }>("/api/calendar/events", { method: "POST", body: JSON.stringify({ calendarId, input }) })).event,
      !!input.repeat,
    );
    if (ok) setToast("Afspraak opgeslagen in Google Agenda.");
    return ok;
  }
  async function googleUpdate(event: ClientEvent, input: EventInput, targetCalendarId: string, scope: Scope) {
    const wide = !!event.recurringEventId && scope !== "this";
    const next = optimistic({ ...event, id: "__pending__" }, input, targetCalendarId);
    const ok = await mutate(
      (list) => list.map((e) => (e.id === event.id && e.calendarId === event.calendarId ? next : e)),
      async () =>
        (
          await api<{ event: ClientEvent }>("/api/calendar/events", {
            method: "PATCH",
            body: JSON.stringify({ calendarId: event.calendarId, eventId: event.id, targetCalendarId, scope, etag: event.etag, input }),
          })
        ).event,
      wide || !!input.repeat !== !!event.recurrence,
    );
    if (ok) setToast("Wijziging opgeslagen in Google Agenda.");
    return ok;
  }
  async function googleDelete(event: ClientEvent, scope: Scope, quiet = false) {
    const wide = !!event.recurringEventId && scope !== "this";
    const ok = await mutate(
      (list) => list.filter((e) => !(e.id === event.id && e.calendarId === event.calendarId)),
      async () => {
        await api("/api/calendar/events", { method: "DELETE", body: JSON.stringify({ calendarId: event.calendarId, eventId: event.id, scope }) });
      },
      wide,
    );
    if (ok && !quiet) setToast("Afspraak verwijderd uit Google Agenda.");
    return ok;
  }

  /* ---------- Mavix calendars (workspace data) ---------- */
  const saveLocal = (next: LocalCalendarEvent[], message: string) => save({ ...data, calendar: { events: next } }, message);

  async function createEvent(input: EventInput, calendarId: string) {
    if (isLocalCalendar(calendarId)) return saveLocal([...localEvents, fromInput(input, calendarId)], "Afspraak opgeslagen");
    return googleCreate(input, calendarId);
  }
  async function updateEvent(event: ClientEvent, input: EventInput, target: string, scope: Scope) {
    const fromLocal = isLocalCalendar(event.calendarId);
    const toLocal = isLocalCalendar(target);
    if (fromLocal && toLocal) {
      const base = localEvents.find((e) => e.id === event.id);
      if (!base) return false;
      return saveLocal(localEvents.map((e) => (e.id === event.id ? fromInput(input, target, base) : e)), "Afspraak bijgewerkt");
    }
    if (fromLocal && !toLocal) {
      // Moved to Google: create there first, then remove the Mavix copy.
      if (!(await googleCreate(input, target))) return false;
      return saveLocal(localEvents.filter((e) => e.id !== event.id), "Afspraak verplaatst naar Google Agenda");
    }
    if (!fromLocal && toLocal) {
      if (!(await saveLocal([...localEvents, fromInput(input, target)], "Afspraak verplaatst naar Mavix"))) return false;
      return googleDelete(event, "this", true);
    }
    return googleUpdate(event, input, target, scope);
  }
  async function deleteEvent(event: ClientEvent, scope: Scope) {
    if (isLocalCalendar(event.calendarId)) return saveLocal(localEvents.filter((e) => e.id !== event.id), "Afspraak verwijderd");
    return googleDelete(event, scope);
  }

  /* ---------- Mavix content (posts and campaigns) ---------- */
  const mirrorAfterChange = () => {
    if (connected && conn.state === "ready" && conn.settings.mirror) void sync();
  };
  async function moveItem(item: CalendarItem, dateKey: string, timeStr: string) {
    const dateValue = dateKey + "T" + (timeStr || "18:00");
    const message = "Content verplaatst naar " + fromKey(dateKey).toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
    if (item.source.kind === "post") {
      await save({ ...data, posts: data.posts.map((p) => (p.id === item.source.id ? { ...p, date: dateValue } : p)) }, message);
    } else {
      const campaigns = data.email?.campaigns || [];
      await save(
        { ...data, email: { settings: data.email!.settings, campaigns: campaigns.map((c) => (c.id === item.source.id ? { ...c, date: dateValue } : c)) } },
        message,
      );
    }
    setSelected(null);
    mirrorAfterChange();
  }
  async function approveItem(item: CalendarItem) {
    const future = !!item.date && new Date(item.date + "T" + (item.time || "00:00")) > new Date();
    if (item.source.kind === "post") {
      const post = data.posts.find((p) => p.id === item.source.id);
      if (!post) return;
      const next: Post = { ...post, status: future ? "scheduled" : "approved", date: future ? post.date : "" };
      await save({ ...data, posts: data.posts.map((p) => (p.id === post.id ? next : p)) }, "Content goedgekeurd");
    } else {
      const campaigns = data.email?.campaigns || [];
      const c = campaigns.find((c) => c.id === item.source.id);
      if (!c) return;
      const error = campaignError(c, future);
      if (error) return setToast(error);
      const next: EmailCampaign = { ...c, status: future ? "scheduled" : "approved", date: future ? c.date : "", reason: "" };
      await save({ ...data, email: { settings: data.email!.settings, campaigns: campaigns.map((x) => (x.id === c.id ? next : x)) } }, "Content goedgekeurd");
    }
    setSelected(null);
    mirrorAfterChange();
  }
  async function rejectItem(item: CalendarItem) {
    if (item.source.kind === "post") {
      await save({ ...data, posts: data.posts.map((p) => (p.id === item.source.id ? { ...p, status: "rejected", date: "" } : p)) }, "Concept afgewezen");
    } else {
      const campaigns = data.email?.campaigns || [];
      await save(
        {
          ...data,
          email: {
            settings: data.email!.settings,
            campaigns: campaigns.map((c) => (c.id === item.source.id ? { ...c, status: "rejected", date: "", reason: "" } : c)),
          },
        },
        "Concept afgewezen",
      );
    }
    setSelected(null);
    mirrorAfterChange();
  }
  async function duplicateItem(item: CalendarItem) {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    if (item.source.kind === "post") {
      const post = data.posts.find((p) => p.id === item.source.id);
      if (!post) return;
      await save({ ...data, posts: [{ ...post, id, createdAt, status: "draft", date: "" }, ...data.posts] }, "Concept gedupliceerd");
    } else {
      const campaigns = data.email?.campaigns || [];
      const c = campaigns.find((c) => c.id === item.source.id);
      if (!c) return;
      await save(
        { ...data, email: { settings: data.email!.settings, campaigns: [{ ...c, id, createdAt, status: "draft", date: "", reason: "" }, ...campaigns] } },
        "Concept gedupliceerd",
      );
    }
    setSelected(null);
  }
  async function deleteItem(item: CalendarItem) {
    if (item.source.kind === "post") {
      await save({ ...data, posts: data.posts.filter((p) => p.id !== item.source.id) }, "Content verwijderd");
    } else {
      const campaigns = (data.email?.campaigns || []).filter((c) => c.id !== item.source.id);
      await save({ ...data, email: { settings: data.email!.settings, campaigns } }, "Content verwijderd");
    }
    setSelected(null);
    mirrorAfterChange();
  }

  /* ---------- entries & interactions ---------- */
  const items = ready ? toCalendarItems(data) : [];
  const filteredItems = items
    .filter((i) => (channel === "all" ? true : channel === "Campagnes" ? i.channel === "E-mail" && i.contentType === "Campaign" : i.channel === channel))
    .filter((i) => statusFilter === "all" || i.status === statusFilter);
  const shownLocal = localEvents.filter((e) => !hidden.includes(e.calendarId) && inRange(e, range.start, range.end)).map(toClientEvent);
  const entries: Entry[] = [
    ...googleEntries([...(connected ? events.filter((e) => visibleIds.includes(e.calendarId)) : []), ...shownLocal], allCalendars),
    ...(showMavix ? mavixEntries(filteredItems) : []),
  ];

  function select(entry: Entry) {
    if (entry.kind === "mavix" && entry.item) return setSelected(entry.item);
    if (entry.google) setPopover(entry.google);
  }
  // Clicking an empty slot first asks what to plan (appointment or content).
  function create(start: Date, end: Date, allDay: boolean, dateOnly = allDay) {
    setPlan({ start, end, allDay, dateOnly, at: lastPointer.current });
  }
  const planSlot = (p: NonNullable<typeof plan>) => (p.dateOnly ? { date: dayKey(p.start) } : zonedParts(p.start.getTime(), MAVIX_TZ));
  const planLabel = (p: NonNullable<typeof plan>) =>
    p.start.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" }) + (p.dateOnly ? "" : " · " + timeKey(p.start));
  function createNow() {
    const s = new Date();
    s.setMinutes(0, 0, 0);
    s.setHours(s.getHours() + 1);
    create(s, new Date(s.getTime() + 3600000), false);
  }
  function move(entry: Entry, start: number, end: number) {
    if (entry.kind === "mavix" && entry.item) {
      const p = zonedParts(start, MAVIX_TZ);
      return void moveItem(entry.item, p.date, p.time);
    }
    const e = entry.google!;
    if (isLocalCalendar(e.calendarId)) {
      const base = localEvents.find((x) => x.id === e.id);
      if (base) void saveLocal(localEvents.map((x) => (x.id === e.id ? reschedule(base, start, end, dayKey) : x)), "Afspraak verplaatst");
      return;
    }
    if (e.recurringEventId) setToast("Alleen deze gebeurtenis wordt verplaatst. Gebruik bewerken voor de hele reeks.");
    void googleUpdate(e, inputFrom(e, start, end), e.calendarId, "this");
  }
  function moveDay(entry: Entry, day: Date) {
    if (entry.allDay && entry.google) {
      if (isLocalCalendar(entry.google.calendarId)) return move(entry, day.getTime(), day.getTime() + 86400000);
      const days = Math.round((fromKey(entry.endDate!).getTime() - fromKey(entry.startDate!).getTime()) / 86400000);
      const start = dayKey(day);
      const input: EventInput = { ...inputFrom(entry.google, entry.start, entry.end), startDate: start, endDate: addDays(start, days - 1) };
      return void googleUpdate(entry.google, input, entry.google.calendarId, "this");
    }
    const s = new Date(entry.start);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), s.getHours(), s.getMinutes()).getTime();
    move(entry, start, start + (entry.end - entry.start));
  }

  async function connect() {
    setConnecting(true);
    try {
      const d = await api<{ url: string }>("/api/integrations/google_calendar/connect", { method: "POST", body: "{}" });
      window.location.assign(d.url);
    } catch (e) {
      setToast((e as Error).message);
      setConnecting(false);
    }
  }
  async function saveSettings(next: Settings) {
    if (conn.state !== "ready") return;
    const before = conn.settings;
    setConn({ ...conn, settings: next });
    try {
      await api("/api/calendar/settings", { method: "PATCH", body: JSON.stringify(next) });
      setToast(next.mirror ? "Geplande Mavix-content wordt met Google Agenda gesynchroniseerd." : "Mavix-content wordt niet meer naar Google Agenda gesynchroniseerd.");
      void sync();
    } catch (e) {
      setConn({ ...conn, settings: before });
      setToast((e as Error).message);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const weekDays = view === "day" ? [startOfDay(anchor)] : Array.from({ length: 7 }, (_, i) => addDaysLocal(startOfWeek(anchor), i));
  const writable = calendars.filter((c) => c.accessRole === "owner" || c.accessRole === "writer");
  const status = conn.state === "ready" ? conn.status : "";
  const teamOwned = conn.state === "ready" && conn.mine === false && status !== "disconnected";
  const needsReconnect = conn.state === "ready" && !connected && !teamOwned && !!status && status !== "disconnected";
  const googleLabel = conn.state === "ready" && conn.email ? "Google Agenda · " + conn.email : "Google Agenda";
  const popoverCalendar = popover ? allCalendars.find((c) => c.id === popover.calendarId) : null;

  return (
    <div className="cal-page">
      <h1 className="sr-only">Kalender</h1>
      <div className="cal-shell ui-card" data-panel={panelOpen ? "open" : "closed"}>
        <aside className="cal-sidebar" aria-label="Kalenders">
          <div className="cal-sidebar-top">
            <Menu
              label="Maken"
              align="start"
              className="cal-create"
              trigger={
                <>
                  <Plus size={18} />
                  Maken
                  <ChevronDown size={14} />
                </>
              }
              items={PLAN_OPTIONS.flatMap((o, i) => {
                const Icon = PLAN_ICONS[o.kind];
                const item = {
                  label: o.label + (o.soon ? " · binnenkort" : ""),
                  icon: <Icon size={15} />,
                  disabled: o.soon,
                  onSelect: () => (o.kind === "event" ? createNow() : router.push(planningHref(o.kind)!)),
                };
                return o.group === "marketing" && PLAN_OPTIONS[i - 1]?.group !== "marketing"
                  ? [{ type: "separator" as const }, { type: "heading" as const, label: "Marketing" }, item]
                  : [item];
              })}
            />
            <button type="button" className="ui-icon-button cal-sidebar-close" aria-label="Paneel sluiten" onClick={() => setPanelOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <MiniMonth
            anchor={anchor}
            rangeStart={range.start}
            rangeEnd={range.end}
            onPick={(d) => {
              setAnchor(d);
              setPanelOpen(false);
            }}
          />

          <section className="cal-group">
            <h2>Mijn kalenders</h2>
            <ul className="cal-checks">
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={showMavix}
                    style={{ accentColor: "#6d28d9" }}
                    onChange={(e) => {
                      setShowMavix(e.target.checked);
                      try {
                        localStorage.setItem(HIDDEN_KEY + ".mavix", e.target.checked ? "1" : "0");
                      } catch {
                        /* Optional. */
                      }
                    }}
                  />
                  <span>Mavix-content</span>
                </label>
              </li>
              {LOCAL_CALENDARS.map((c) => (
                <li key={c.id}>
                  <label>
                    <input type="checkbox" checked={!hidden.includes(c.id)} style={{ accentColor: c.color }} onChange={(e) => toggle(c.id, e.target.checked)} />
                    <span>{c.summary}</span>
                  </label>
                </li>
              ))}
            </ul>
            {showMavix && (
              <details className="cal-disclosure">
                <summary>Contentfilters</summary>
                <div className="cal-filters" role="group" aria-label="Filter op kanaal">
                  {CHANNELS.map((c) => (
                    <button key={c} type="button" className="cal-pill" aria-pressed={channel === c} onClick={() => setChannel(c)}>
                      {c === "all" ? "Alles" : c}
                    </button>
                  ))}
                </div>
                <label className="cal-select">
                  <span className="sr-only">Filter op status</span>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | CalendarStatus)}>
                    {STATUS_FILTERS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </details>
            )}
          </section>

          <section className="cal-group">
            <h2>Gekoppelde kalenders</h2>
            <div className="cal-account">
              <BrandIcon brand="google_calendar" size={20} />
              <div>
                <strong>Google Agenda</strong>
                {conn.state === "ready" && conn.email && status !== "disconnected" && <span>{conn.email}</span>}
              </div>
              <span className={"cal-state is-" + (connected ? "ok" : status === "reconnect_required" || status === "permission_missing" ? "warn" : "off")}>
                {connected
                  ? "Verbonden"
                  : status === "reconnect_required"
                    ? "Verlopen"
                    : status === "permission_missing"
                      ? "Toestemming nodig"
                      : teamOwned
                        ? "Teamlid"
                        : "Niet verbonden"}
              </span>
            </div>
            {conn.state === "loading" && (
              <div className="cal-skeleton" role="status" aria-label="Agenda's laden">
                <span />
                <span />
              </div>
            )}
            {conn.state === "demo" && <p className="cal-note">In de testmodus kun je Google Agenda niet koppelen.</p>}
            {conn.state === "error" && (
              <>
                <p className="cal-note">{conn.message}</p>
                <button type="button" className="button secondary cal-connect-btn" onClick={() => void loadStatus()}>
                  <RefreshCw size={14} />
                  Opnieuw proberen
                </button>
              </>
            )}
            {conn.state === "ready" && !connected && (
              <>
                <p className="cal-note">
                  {teamOwned
                    ? `De agenda van ${conn.email || "dit teamlid"} is privé en alleen voor diegene zichtbaar.`
                    : status === "reconnect_required"
                      ? "De koppeling is verlopen. Verbind opnieuw om je afspraken te zien."
                      : status === "permission_missing"
                        ? "Mavix mist toegang tot je agenda's. Geef opnieuw toestemming."
                        : "Koppel Google Agenda om je afspraken naast je Mavix-planning te zien."}
                </p>
                {!teamOwned && (
                  <button type="button" className="button secondary cal-connect-btn" onClick={() => void connect()} disabled={connecting}>
                    {connecting ? <Loader2 size={14} className="cal-spin" /> : <Plug size={14} />}
                    {connecting ? "Doorsturen…" : status === "disconnected" || !status ? "Koppel Google Agenda" : "Opnieuw koppelen"}
                  </button>
                )}
              </>
            )}
            {connected &&
              (calendars.length ? (
                <ul className="cal-checks">
                  {calendars.map((c) => (
                    <li key={c.id}>
                      <label>
                        <input type="checkbox" checked={!hidden.includes(c.id)} style={{ accentColor: c.color }} onChange={(e) => toggle(c.id, e.target.checked)} />
                        <span>{c.summary}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="cal-note">Er zijn geen agenda&apos;s gevonden in dit Google-account.</p>
              ))}
            {connected && calendars.length > 0 && !visibleIds.length && <p className="cal-note">Alle Google-agenda&apos;s zijn verborgen. Vink er een aan om afspraken te zien.</p>}
            {connected && conn.state === "ready" && (
              <details className="cal-disclosure">
                <summary>Synchronisatie</summary>
                <label className="cal-toggle">
                  <input type="checkbox" checked={conn.settings.mirror} onChange={(e) => void saveSettings({ ...conn.settings, mirror: e.target.checked })} />
                  Geplande Mavix-content ook in Google Agenda zetten
                </label>
                {conn.settings.mirror && (
                  <label className="cal-select">
                    <span>Naar agenda</span>
                    <select
                      value={conn.settings.mirrorCalendarId === "primary" ? writable.find((c) => c.primary)?.id || "primary" : conn.settings.mirrorCalendarId}
                      onChange={(e) => void saveSettings({ ...conn.settings, mirrorCalendarId: e.target.value })}
                    >
                      {writable.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.summary}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="cal-note">
                  {syncInfo
                    ? `Laatst gesynchroniseerd om ${syncInfo.at.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}${syncInfo.mode === "push" ? " · wijzigingen worden direct gemeld" : ""}.`
                    : "Wordt automatisch gesynchroniseerd."}
                </p>
                <button type="button" className="button secondary cal-connect-btn" onClick={() => void sync(true)} disabled={syncing}>
                  <RefreshCw size={14} />
                  {syncing ? "Synchroniseren…" : "Nu synchroniseren"}
                </button>
              </details>
            )}
            {conn.state === "ready" && status && status !== "disconnected" && (
              <Link className="text-link cal-manage" href="/account/integraties">
                Koppeling beheren
              </Link>
            )}
          </section>
        </aside>
        {panelOpen && <div className="cal-sidebar-scrim" onClick={() => setPanelOpen(false)} aria-hidden="true" />}

        <section className="cal-main" aria-busy={loadingEvents}>
          <div className="cal-bar">
            <button type="button" className="ui-icon-button cal-sidebar-open" aria-label="Kalenders tonen" onClick={() => setPanelOpen(true)}>
              <PanelLeft size={17} />
            </button>
            <button type="button" className="button secondary cal-today" onClick={() => setAnchor(new Date())}>
              Vandaag
            </button>
            <div className="cal-arrows">
              <button type="button" className="ui-icon-button" aria-label="Vorige periode" onClick={() => setAnchor(shiftAnchor(view, anchor, -1))}>
                <ChevronLeft size={18} />
              </button>
              <button type="button" className="ui-icon-button" aria-label="Volgende periode" onClick={() => setAnchor(shiftAnchor(view, anchor, 1))}>
                <ChevronRight size={18} />
              </button>
            </div>
            <h2 className="cal-title">{periodLabel(view, anchor)}</h2>
            {loadingEvents && (
              <span className="cal-loading" role="status">
                <Loader2 size={13} className="cal-spin" aria-hidden="true" />
                Afspraken laden…
              </span>
            )}
            <div className="cal-seg" role="group" aria-label="Weergave">
              {VIEWS.map(([v, label]) => (
                <button key={v} type="button" aria-pressed={view === v} className={"cal-seg-" + v} onClick={() => setView(v)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {needsReconnect ? (
            <div className="cal-banner is-warn" role="alert">
              <BrandIcon brand="google_calendar" size={16} />
              <p>
                {status === "permission_missing"
                  ? "Mavix mist toegang tot je Google-agenda's. Je ziet nu alleen je Mavix-planning."
                  : "Je Google Agenda-koppeling is verlopen of ingetrokken. Je ziet nu alleen je Mavix-planning."}
              </p>
              <button type="button" className="button secondary" onClick={() => void connect()} disabled={connecting}>
                {connecting ? "Doorsturen…" : "Opnieuw koppelen"}
              </button>
            </div>
          ) : connected && eventsError ? (
            <div className="cal-banner is-error" role="alert">
              <p>Google-afspraken konden niet worden geladen. {eventsError}</p>
              <button type="button" className="button secondary" onClick={() => void loadEvents(true)} disabled={loadingEvents}>
                {loadingEvents ? "Laden…" : "Opnieuw proberen"}
              </button>
            </div>
          ) : null}

          <div className="cal-view">
            {!ready ? (
              <p role="status" className="cal-note">
                Kalender laden…
              </p>
            ) : view === "month" ? (
              <MonthGrid
                anchor={anchor}
                entries={entries}
                now={now}
                onSelect={select}
                onCreate={(day) => create(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9), new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10), false, true)}
                onMoveDay={moveDay}
                onShowDay={(day) => {
                  setAnchor(day);
                  setView("day");
                }}
              />
            ) : view === "agenda" ? (
              <AgendaList start={range.start} days={30} entries={entries} now={now} onSelect={select} />
            ) : (
              <TimeGrid days={weekDays} entries={entries} now={now} onSelect={select} onCreate={create} onMove={move} />
            )}
          </div>
          <p className="cal-foot">
            Tijden in {browserTimeZone().replace("_", " ")}. Mavix-content wordt niet automatisch gepubliceerd of verstuurd.
          </p>
        </section>
      </div>

      {plan && (
        <PlanMenu
          slot={planSlot(plan)}
          label={planLabel(plan)}
          at={plan.at}
          onClose={() => setPlan(null)}
          onAppointment={() => {
            setEditor({ mode: "create", start: plan.start, end: plan.end, allDay: plan.allDay });
            setPlan(null);
          }}
        />
      )}
      {popover && popoverCalendar && (
        <EventPopover
          event={popover}
          calendar={popoverCalendar}
          source={isLocalCalendar(popover.calendarId) ? "mavix" : "google"}
          onClose={() => setPopover(null)}
          onEdit={() => {
            setEditor({ mode: "edit", event: popover });
            setPopover(null);
          }}
          onDelete={async () => {
            const ok = await deleteEvent(popover, "this");
            if (ok) setPopover(null);
            return ok;
          }}
        />
      )}
      <EventEditor
        state={editor}
        calendars={allCalendars}
        googleLabel={googleLabel}
        onClose={() => setEditor(null)}
        onSave={async (input, calendarId, scope) => {
          const ok = editor?.mode === "edit" ? await updateEvent(editor.event, input, calendarId, scope) : await createEvent(input, calendarId);
          if (ok) setEditor(null);
          return ok;
        }}
        onDelete={async (scope) => {
          if (editor?.mode !== "edit") return false;
          const ok = await deleteEvent(editor.event, scope);
          if (ok) setEditor(null);
          return ok;
        }}
      />
      <CalendarDetailPanel
        item={selected}
        onClose={() => setSelected(null)}
        onApprove={approveItem}
        onReject={rejectItem}
        onDuplicate={duplicateItem}
        onDelete={deleteItem}
        onMove={(item, date, time) => moveItem(item, date, time)}
      />
      {toast && (
        <p role="status" className="cal-toast">
          {toast}
        </p>
      )}
    </div>
  );
}
