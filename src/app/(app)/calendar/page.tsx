"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Plug } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading } from "@/components/ui";
import { toCalendarItems, type CalendarItem, type CalendarStatus } from "@/lib/calendar-data";
import type { Post } from "@/lib/types";
import { campaignError, type EmailCampaign } from "@/lib/email-model";
import { isBrowserDemo } from "@/lib/demo";
import { MAVIX_TZ, addDays, zonedParts, type ClientEvent, type EventInput } from "@/lib/calendar/core";
import { CalendarDetailPanel } from "@/components/calendar/detail-panel";
import { AddContentMenu } from "@/components/calendar/add-content-menu";
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
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [toast, setToast] = useState("");
  const [syncInfo, setSyncInfo] = useState<{ at: Date; mode: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const cache = useRef(new Map<string, ClientEvent[]>());

  const connected = conn.state === "ready" && conn.status === "connected" && !!conn.mine;
  const calendars = useMemo(() => (conn.state === "ready" ? conn.calendars : []), [conn]);
  const visibleIds = useMemo(
    () => calendars.filter((c) => !hidden.includes(c.id)).map((c) => c.id),
    [calendars, hidden],
  );
  const range = useMemo(() => visibleRange(view, anchor), [view, anchor]);
  const rangeKey = range.start.toISOString() + "|" + range.end.toISOString() + "|" + visibleIds.join(",");

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
    if (params.get("connected")) setToast("Google Calendar is gekoppeld.");
    if (params.get("calendar_error") === "permission")
      setToast("Niet alle toestemmingen zijn gegeven. Koppel opnieuw en sta toegang tot je agenda's en afspraken toe.");
    if (params.toString()) window.history.replaceState(null, "", "/calendar");
    const t = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(t);
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

  /* ---------- events for the visible range ---------- */
  const loadEvents = useCallback(
    async (force = false) => {
      if (!connected) return;
      if (!visibleIds.length) return setEvents([]);
      const cached = cache.current.get(rangeKey);
      if (cached && !force) return setEvents(cached);
      setLoadingEvents(true);
      try {
        const q = new URLSearchParams({
          start: range.start.toISOString(),
          end: range.end.toISOString(),
          calendars: visibleIds.join(","),
        });
        const d = await api<{ events: ClientEvent[] }>("/api/calendar/events?" + q);
        cache.current.set(rangeKey, d.events);
        setEvents(d.events);
      } catch (e) {
        setToast((e as Error).message);
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
        const r = await api<{ changed: boolean; mode: string; mirrored: { created: number; updated: number; removed: number } }>(
          "/api/calendar/sync",
          { method: "POST", body: JSON.stringify({ calendars: visibleIds }) },
        );
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

  async function createEvent(input: EventInput, calendarId: string) {
    const temp = optimistic({ id: "__pending__" }, input, calendarId);
    const ok = await mutate(
      (list) => [...list, temp],
      async () => (await api<{ event: ClientEvent }>("/api/calendar/events", { method: "POST", body: JSON.stringify({ calendarId, input }) })).event,
      !!input.repeat,
    );
    if (ok) setToast("Evenement aangemaakt in Google Calendar.");
    return ok;
  }

  async function updateEvent(event: ClientEvent, input: EventInput, targetCalendarId: string, scope: Scope) {
    const wide = !!event.recurringEventId && scope !== "this";
    const next = optimistic({ ...event, id: "__pending__" }, input, targetCalendarId);
    const ok = await mutate(
      (list) => list.map((e) => (e.id === event.id && e.calendarId === event.calendarId ? next : e)),
      async () =>
        (
          await api<{ event: ClientEvent }>("/api/calendar/events", {
            method: "PATCH",
            body: JSON.stringify({
              calendarId: event.calendarId,
              eventId: event.id,
              targetCalendarId,
              scope,
              etag: event.etag,
              input,
            }),
          })
        ).event,
      wide || !!input.repeat !== !!event.recurrence,
    );
    if (ok) setToast("Wijziging opgeslagen in Google Calendar.");
    return ok;
  }

  async function deleteEvent(event: ClientEvent, scope: Scope) {
    const wide = !!event.recurringEventId && scope !== "this";
    const ok = await mutate(
      (list) => list.filter((e) => !(e.id === event.id && e.calendarId === event.calendarId)),
      async () => {
        await api("/api/calendar/events", {
          method: "DELETE",
          body: JSON.stringify({ calendarId: event.calendarId, eventId: event.id, scope }),
        });
      },
      wide,
    );
    if (ok) setToast("Evenement verwijderd uit Google Calendar.");
    return ok;
  }

  /* ---------- Mavix content (workspace data, separate from Google) ---------- */
  const mirrorAfterChange = () => {
    if (connected && conn.state === "ready" && conn.settings.mirror) void sync();
  };

  async function moveItem(item: CalendarItem, dateKey: string, timeStr: string) {
    const dateValue = dateKey + "T" + (timeStr || "18:00");
    const message =
      "Content verplaatst naar " +
      fromKey(dateKey).toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
    if (item.source.kind === "post") {
      await save(
        { ...data, posts: data.posts.map((p) => (p.id === item.source.id ? { ...p, date: dateValue } : p)) },
        message,
      );
    } else {
      const campaigns = data.email?.campaigns || [];
      await save(
        {
          ...data,
          email: {
            settings: data.email!.settings,
            campaigns: campaigns.map((c) => (c.id === item.source.id ? { ...c, date: dateValue } : c)),
          },
        },
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
      await save(
        { ...data, email: { settings: data.email!.settings, campaigns: campaigns.map((x) => (x.id === c.id ? next : x)) } },
        "Content goedgekeurd",
      );
    }
    setSelected(null);
    mirrorAfterChange();
  }
  async function rejectItem(item: CalendarItem) {
    if (item.source.kind === "post") {
      await save(
        { ...data, posts: data.posts.map((p) => (p.id === item.source.id ? { ...p, status: "rejected", date: "" } : p)) },
        "Concept afgewezen",
      );
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
    .filter((i) =>
      channel === "all" ? true : channel === "Campagnes" ? i.channel === "E-mail" && i.contentType === "Campaign" : i.channel === channel,
    )
    .filter((i) => statusFilter === "all" || i.status === statusFilter);
  const entries: Entry[] = [
    ...(connected ? googleEntries(events.filter((e) => visibleIds.includes(e.calendarId)), calendars) : []),
    ...(showMavix ? mavixEntries(filteredItems) : []),
  ];

  function select(entry: Entry) {
    if (entry.kind === "mavix" && entry.item) return setSelected(entry.item);
    if (entry.google) setEditor({ mode: "edit", event: entry.google });
  }
  function create(start: Date, end: Date, allDay: boolean) {
    if (!connected) return setToast("Koppel Google Calendar om afspraken te maken. Content plan je via ‘Content plannen’.");
    setEditor({ mode: "create", start, end, allDay });
  }
  function move(entry: Entry, start: number, end: number) {
    if (entry.kind === "mavix" && entry.item) {
      const p = zonedParts(start, MAVIX_TZ);
      return void moveItem(entry.item, p.date, p.time);
    }
    const e = entry.google!;
    if (e.recurringEventId) setToast("Alleen deze gebeurtenis wordt verplaatst. Gebruik bewerken voor de hele reeks.");
    void updateEvent(e, inputFrom(e, start, end), e.calendarId, "this");
  }
  function moveDay(entry: Entry, day: Date) {
    if (entry.allDay && entry.google) {
      const days = Math.round((fromKey(entry.endDate!).getTime() - fromKey(entry.startDate!).getTime()) / 86400000);
      const start = dayKey(day);
      const input: EventInput = {
        ...inputFrom(entry.google, entry.start, entry.end),
        startDate: start,
        endDate: addDays(start, days - 1),
      };
      return void updateEvent(entry.google, input, entry.google.calendarId, "this");
    }
    const s = new Date(entry.start);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), s.getHours(), s.getMinutes()).getTime();
    move(entry, start, start + (entry.end - entry.start));
  }

  async function connect() {
    try {
      const d = await api<{ url: string }>("/api/integrations/google_calendar/connect", { method: "POST", body: "{}" });
      window.location.assign(d.url);
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  async function saveSettings(next: Settings) {
    if (conn.state !== "ready") return;
    const before = conn.settings;
    setConn({ ...conn, settings: next });
    try {
      await api("/api/calendar/settings", { method: "PATCH", body: JSON.stringify(next) });
      setToast(next.mirror ? "Geplande Mavix-content wordt met Google Calendar gesynchroniseerd." : "Mavix-content wordt niet meer naar Google Calendar gesynchroniseerd.");
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

  const weekDays =
    view === "day" ? [startOfDay(anchor)] : Array.from({ length: 7 }, (_, i) => addDaysLocal(startOfWeek(anchor), i));
  const writable = calendars.filter((c) => c.accessRole === "owner" || c.accessRole === "writer");
  const status = conn.state === "ready" ? conn.status : "";

  return (
    <div className="cal-page">
      <PageHeading eyebrow="Werkruimte" title="Kalender" description="Je afspraken en je marketingplanning in één overzicht." />

      {conn.state === "ready" && !connected && (
        <section className="panel cal-connect">
          <div>
            <h2>
              {status === "reconnect_required"
                ? "Verbind Google Calendar opnieuw"
                : status === "permission_missing"
                  ? "Toestemming voor Google Calendar ontbreekt"
                  : conn.mine === false && status !== "disconnected"
                    ? "Google Calendar is gekoppeld door een teamlid"
                    : "Verbind Google Calendar"}
            </h2>
            <p>
              {conn.mine === false && status !== "disconnected"
                ? `De agenda van ${conn.email || "dit teamlid"} is privé en alleen voor hem of haar zichtbaar.`
                : "Bekijk je afspraken en marketingplanning samen in één kalender, en plan direct in je eigen Google Calendar."}
            </p>
          </div>
          {(conn.mine !== false || status === "disconnected") && (
            <button type="button" className="button primary" onClick={() => void connect()}>
              <Plug size={15} />
              {status === "disconnected" ? "Google Calendar koppelen" : "Opnieuw koppelen"}
            </button>
          )}
        </section>
      )}
      {conn.state === "demo" && (
        <p className="ws-notice">In de testmodus kun je Google Calendar niet koppelen. Je ziet hier alleen de Mavix-content uit de voorbeeldwerkruimte.</p>
      )}
      {conn.state === "error" && <p className="ws-notice">{conn.message}</p>}

      <div className="cal-layout">
        <aside className="cal-side" aria-label="Agenda's en filters">
          <div className="cal-side-actions">
            {connected && (
              <button type="button" className="button primary" onClick={() => create(new Date(new Date().setMinutes(0, 0, 0) + 3600000), new Date(new Date().setMinutes(0, 0, 0) + 7200000), false)}>
                <Plus size={15} />
                Nieuw evenement
              </button>
            )}
            <AddContentMenu />
          </div>

          <details className="cal-side-section" open>
            <summary>Mijn agenda&apos;s</summary>
            {connected ? (
              <ul className="cal-list">
                {calendars.map((c) => (
                  <li key={c.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={!hidden.includes(c.id)}
                        onChange={(e) => persistHidden(e.target.checked ? hidden.filter((h) => h !== c.id) : [...hidden, c.id])}
                        style={{ accentColor: c.color }}
                      />
                      <span className="cal-swatch" style={{ background: c.color }} aria-hidden="true" />
                      <span className="cal-list-name">{c.summary}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cal-side-note">Nog geen Google Calendar gekoppeld.</p>
            )}
            <ul className="cal-list">
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={showMavix}
                    onChange={(e) => {
                      setShowMavix(e.target.checked);
                      try {
                        localStorage.setItem(HIDDEN_KEY + ".mavix", e.target.checked ? "1" : "0");
                      } catch {
                        /* Optional. */
                      }
                    }}
                  />
                  <span className="cal-swatch is-mavix" aria-hidden="true" />
                  <span className="cal-list-name">Mavix-content</span>
                </label>
              </li>
            </ul>
          </details>

          {showMavix && (
            <details className="cal-side-section">
              <summary>Filters voor content</summary>
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

          {connected && conn.state === "ready" && (
            <details className="cal-side-section">
              <summary>Synchronisatie</summary>
              <label className="cal-toggle">
                <input
                  type="checkbox"
                  checked={conn.settings.mirror}
                  onChange={(e) => void saveSettings({ ...conn.settings, mirror: e.target.checked })}
                />
                Synchroniseer geplande Mavix-content met Google Calendar
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
              <p className="cal-side-note">
                Verbonden als {conn.email}.{" "}
                {syncInfo
                  ? `Laatst gesynchroniseerd om ${syncInfo.at.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}${syncInfo.mode === "push" ? " · wijzigingen worden direct gemeld" : ""}.`
                  : ""}
              </p>
              <button type="button" className="button secondary" onClick={() => void sync(true)} disabled={syncing}>
                <RefreshCw size={14} />
                {syncing ? "Synchroniseren…" : "Nu synchroniseren"}
              </button>
              <Link className="text-link" href="/account/integraties">
                Koppeling beheren
              </Link>
            </details>
          )}
        </aside>

        <section className="cal-main" aria-busy={loadingEvents}>
          <div className="cal-toolbar">
            <div className="cal-toolbar-left">
              <button type="button" className="button secondary" onClick={() => setAnchor(new Date())}>
                Vandaag
              </button>
              <button type="button" className="cal-nav-btn" aria-label="Vorige periode" onClick={() => setAnchor(shiftAnchor(view, anchor, -1))}>
                <ChevronLeft size={17} />
              </button>
              <button type="button" className="cal-nav-btn" aria-label="Volgende periode" onClick={() => setAnchor(shiftAnchor(view, anchor, 1))}>
                <ChevronRight size={17} />
              </button>
              <h2 className="cal-period-label">{periodLabel(view, anchor)}</h2>
            </div>
            <div className="tabs cal-views" role="group" aria-label="Weergave">
              {VIEWS.map(([v, label]) => (
                <button key={v} type="button" aria-pressed={view === v} className={(view === v ? "selected" : "") + (v === "week" ? " cal-view-week" : "")} onClick={() => setView(v)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="cal-tz">Tijden in {browserTimeZone().replace("_", " ")}{loadingEvents ? " · laden…" : ""}</p>

          {!ready ? (
            <p role="status">Kalender laden…</p>
          ) : view === "month" ? (
            <MonthGrid
              anchor={anchor}
              entries={entries}
              now={now}
              onSelect={select}
              onCreate={(day) => create(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9), new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10), false)}
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
          <p className="calendar-disclaimer">
            Mavix-content wordt niet automatisch gepubliceerd of verstuurd. Google-evenementen worden direct in Google Calendar opgeslagen.
          </p>
        </section>
      </div>

      <EventEditor
        state={editor}
        calendars={calendars}
        onClose={() => setEditor(null)}
        onSave={async (input, calendarId, scope) => {
          const ok =
            editor?.mode === "edit"
              ? await updateEvent(editor.event, input, calendarId, scope)
              : await createEvent(input, calendarId);
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
