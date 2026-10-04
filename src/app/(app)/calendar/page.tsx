"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading } from "@/components/ui";
import {
  toCalendarItems,
  type CalendarItem,
  type CalendarStatus,
} from "@/lib/calendar-data";
import type { Post } from "@/lib/types";
import { campaignError, type EmailCampaign } from "@/lib/email-model";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { ListView } from "@/components/calendar/list-view";
import { CalendarDetailPanel } from "@/components/calendar/detail-panel";
import { AddContentMenu } from "@/components/calendar/add-content-menu";
import "../../calendar.css";
// "Campagnes" is not a separate content model in Mavix: an EmailCampaign with
// kind "Create Campaign" already carries this meaning (see email-model.ts).
// Rather than inventing a parallel campaign entity, this pill filters the
// existing e-mail data on that content type.
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
function periodLabel(view: "month" | "week" | "list", anchor: Date) {
  if (view === "week") {
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const startStr = start.toLocaleDateString("nl-NL", {
      day: "numeric",
      month: sameMonth ? undefined : "short",
    });
    const endStr = end.toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return startStr + " – " + endStr;
  }
  return anchor.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
}
export default function CalendarPage() {
  const { data, ready, save } = useWorkspace();
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [status, setStatus] = useState<"all" | CalendarStatus>("all");
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [feedback, setFeedback] = useState("");
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const today = new Date();
  useEffect(() => {
    if (window.matchMedia("(max-width: 650px)").matches) setView("list");
  }, []);
  useEffect(() => setFeedback(""), [selected?.id]);
  const items = toCalendarItems(data);
  const byChannel = items.filter((i) => {
    if (channel === "all") return true;
    if (channel === "Campagnes")
      return i.channel === "E-mail" && i.contentType === "Campaign";
    return i.channel === channel;
  });
  const filtered =
    status === "all" ? byChannel : byChannel.filter((i) => i.status === status);
  const scheduledCount = filtered.filter((i) => i.status === "scheduled").length;
  const reviewCount = filtered.filter((i) => i.status === "review").length;
  function switchView(next: "month" | "week" | "list") {
    setView(next);
    if (next !== "list") setFocusDate(null);
  }
  function shiftPeriod(dir: 1 | -1) {
    const next = new Date(anchor);
    if (view === "week") next.setDate(next.getDate() + dir * 7);
    else next.setMonth(next.getMonth() + dir);
    setAnchor(next);
  }
  async function syncGoogleCalendar() {
    const toSync = items
      .filter((i) => i.date)
      .map((i) => ({
        id: i.id,
        title: i.title || i.contentType || "Content",
        date: i.date,
        time: i.time,
        channel: i.channel,
        caption: i.caption,
      }));
    if (!toSync.length) {
      setSyncMessage("Geen ingeplande content om te synchroniseren.");
      return;
    }
    setSyncing(true);
    setSyncMessage("");
    try {
      const r = await fetch("/api/integrations/google_calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: toSync }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Synchroniseren is niet gelukt.");
      const ok = d.results.filter((x: { ok: boolean }) => x.ok).length;
      const failed = d.results.length - ok;
      setSyncMessage(
        failed
          ? `${ok} van ${d.results.length} items gesynchroniseerd, ${failed} mislukt.`
          : `${ok} ${ok === 1 ? "item" : "items"} gesynchroniseerd met Google Calendar.`,
      );
    } catch (e) {
      setSyncMessage(
        e instanceof Error ? e.message : "Synchroniseren is niet gelukt.",
      );
    } finally {
      setSyncing(false);
    }
  }
  function handleMore(dateKey: string) {
    setFocusDate(dateKey);
    setView("list");
  }
  async function moveItem(item: CalendarItem, dateKey: string, timeStr: string) {
    const dateValue = dateKey + "T" + (timeStr || "18:00");
    const message =
      "Content verplaatst naar " +
      new Date(dateKey + "T00:00").toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "long",
      });
    if (item.source.kind === "post") {
      await save(
        {
          ...data,
          posts: data.posts.map((p) =>
            p.id === item.source.id ? { ...p, date: dateValue } : p,
          ),
        },
        message,
      );
    } else {
      const campaigns = data.email?.campaigns || [];
      await save(
        {
          ...data,
          email: {
            settings: data.email!.settings,
            campaigns: campaigns.map((c) =>
              c.id === item.source.id ? { ...c, date: dateValue } : c,
            ),
          },
        },
        message,
      );
    }
    setSelected(null);
  }
  function handleDrop(item: CalendarItem, dateKey: string) {
    if (item.date === dateKey) return;
    moveItem(item, dateKey, item.time || "18:00");
  }
  async function approveItem(item: CalendarItem) {
    const future =
      !!item.date &&
      new Date(item.date + "T" + (item.time || "00:00")) > new Date();
    if (item.source.kind === "post") {
      const post = data.posts.find((p) => p.id === item.source.id);
      if (!post) return;
      const next: Post = {
        ...post,
        status: future ? "scheduled" : "approved",
        date: future ? post.date : "",
      };
      await save(
        { ...data, posts: data.posts.map((p) => (p.id === post.id ? next : p)) },
        "Content goedgekeurd",
      );
    } else {
      const campaigns = data.email?.campaigns || [];
      const c = campaigns.find((c) => c.id === item.source.id);
      if (!c) return;
      const error = campaignError(c, future);
      if (error) {
        setFeedback(error);
        return;
      }
      const next: EmailCampaign = {
        ...c,
        status: future ? "scheduled" : "approved",
        date: future ? c.date : "",
        reason: "",
      };
      await save(
        {
          ...data,
          email: {
            settings: data.email!.settings,
            campaigns: campaigns.map((x) => (x.id === c.id ? next : x)),
          },
        },
        "Content goedgekeurd",
      );
    }
    setSelected(null);
  }
  async function rejectItem(item: CalendarItem) {
    if (item.source.kind === "post") {
      await save(
        {
          ...data,
          posts: data.posts.map((p) =>
            p.id === item.source.id ? { ...p, status: "rejected", date: "" } : p,
          ),
        },
        "Concept afgewezen",
      );
    } else {
      const campaigns = data.email?.campaigns || [];
      await save(
        {
          ...data,
          email: {
            settings: data.email!.settings,
            campaigns: campaigns.map((c) =>
              c.id === item.source.id
                ? { ...c, status: "rejected", date: "", reason: "" }
                : c,
            ),
          },
        },
        "Concept afgewezen",
      );
    }
    setSelected(null);
  }
  async function duplicateItem(item: CalendarItem) {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    if (item.source.kind === "post") {
      const post = data.posts.find((p) => p.id === item.source.id);
      if (!post) return;
      const next: Post = { ...post, id, createdAt, status: "draft", date: "" };
      await save({ ...data, posts: [next, ...data.posts] }, "Concept gedupliceerd");
    } else {
      const campaigns = data.email?.campaigns || [];
      const c = campaigns.find((c) => c.id === item.source.id);
      if (!c) return;
      const next: EmailCampaign = {
        ...c,
        id,
        createdAt,
        status: "draft",
        date: "",
        reason: "",
      };
      await save(
        {
          ...data,
          email: { settings: data.email!.settings, campaigns: [next, ...campaigns] },
        },
        "Concept gedupliceerd",
      );
    }
    setSelected(null);
  }
  async function deleteItem(item: CalendarItem) {
    if (item.source.kind === "post") {
      await save(
        { ...data, posts: data.posts.filter((p) => p.id !== item.source.id) },
        "Content verwijderd",
      );
    } else {
      const campaigns = (data.email?.campaigns || []).filter(
        (c) => c.id !== item.source.id,
      );
      await save(
        { ...data, email: { settings: data.email!.settings, campaigns } },
        "Content verwijderd",
      );
    }
    setSelected(null);
  }
  return (
    <>
      <PageHeading
        eyebrow="Werkruimte"
        title="Kalender"
        description="Geef je ideeën een plek in de planning."
      />
      <div className="cal-toolbar">
        <div className="cal-toolbar-left">
          {view === "list" ? (
            <span className="cal-period-label">Alle content</span>
          ) : (
            <>
              <button
                type="button"
                className="button secondary"
                onClick={() => setAnchor(new Date())}
              >
                Vandaag
              </button>
              <button
                type="button"
                className="cal-nav-btn"
                aria-label="Vorige periode"
                onClick={() => shiftPeriod(-1)}
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                className="cal-nav-btn"
                aria-label="Volgende periode"
                onClick={() => shiftPeriod(1)}
              >
                <ChevronRight size={17} />
              </button>
              <span className="cal-period-label">
                {periodLabel(view, anchor)}
              </span>
            </>
          )}
        </div>
        <div className="cal-toolbar-right">
          <div className="tabs" role="group" aria-label="Weergave">
            <button
              aria-pressed={view === "month"}
              className={view === "month" ? "selected" : ""}
              onClick={() => switchView("month")}
            >
              Maand
            </button>
            <button
              aria-pressed={view === "week"}
              className={view === "week" ? "selected" : ""}
              onClick={() => switchView("week")}
            >
              Week
            </button>
            <button
              aria-pressed={view === "list"}
              className={view === "list" ? "selected" : ""}
              onClick={() => switchView("list")}
            >
              Lijst
            </button>
          </div>
          <button
            type="button"
            className="button secondary"
            disabled={syncing}
            onClick={() => void syncGoogleCalendar()}
          >
            <CalendarCheck size={16} />
            {syncing ? "Bezig met synchroniseren…" : "Synchroniseer met Google Calendar"}
          </button>
          <AddContentMenu />
        </div>
      </div>
      {syncMessage && (
        <p role="status" className="cal-sync-message">
          {syncMessage}{" "}
          <Link href="/account/integraties">Koppeling beheren</Link>
        </p>
      )}
      <div className="cal-filters" role="group" aria-label="Filter op kanaal">
        {CHANNELS.map((c) => (
          <button
            key={c}
            type="button"
            className="cal-pill"
            aria-pressed={channel === c}
            onClick={() => setChannel(c)}
          >
            {c === "all" ? "Alles" : c}
          </button>
        ))}
      </div>
      <div
        className="cal-filters cal-filters-compact"
        role="group"
        aria-label="Filter op status"
      >
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="cal-pill cal-pill-compact"
            aria-pressed={status === s.id}
            onClick={() => setStatus(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="cal-summary">
        <span>
          <strong>{scheduledCount}</strong> gepland
        </span>
        <span>
          <strong>{reviewCount}</strong> wacht op goedkeuring
        </span>
        <span>
          <strong>{filtered.length}</strong> totaal
        </span>
      </div>
      {!ready ? (
        <p role="status">Kalender laden…</p>
      ) : view === "month" ? (
        <MonthView
          anchor={anchor}
          items={filtered}
          today={today}
          onSelect={setSelected}
          onMore={handleMore}
          onDrop={handleDrop}
        />
      ) : view === "week" ? (
        <WeekView
          anchor={anchor}
          items={filtered}
          today={today}
          onSelect={setSelected}
          onDrop={handleDrop}
        />
      ) : (
        <ListView
          items={filtered}
          today={today}
          focusDate={focusDate}
          onClearFocus={() => setFocusDate(null)}
          onSelect={setSelected}
        />
      )}
      <p className="calendar-disclaimer">
        Posts en e-mails worden niet automatisch gepubliceerd of verstuurd.
      </p>
      <CalendarDetailPanel
        item={selected}
        onClose={() => setSelected(null)}
        onApprove={approveItem}
        onReject={rejectItem}
        onDuplicate={duplicateItem}
        onDelete={deleteItem}
        onMove={(item, date, time) => moveItem(item, date, time)}
      />
      {feedback && (
        <p role="alert" className="storage-error">
          {feedback}
        </p>
      )}
    </>
  );
}
