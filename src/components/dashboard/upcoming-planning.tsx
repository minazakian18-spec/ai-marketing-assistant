"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, CalendarClock, Instagram, Mail } from "lucide-react";
import { Card, EmptyState, SectionHeader } from "@/components/ui";

export type PlanItem = {
  id: string;
  title: string;
  at: string; // ISO instant, or YYYY-MM-DD for all-day events
  allDay?: boolean;
  source: "Instagram" | "E-mail" | "Google Calendar";
  href: string;
};

const HIDDEN_KEY = "mavix.calendar.hidden.v1";
const DAYS = 14;

function label(item: PlanItem) {
  const d = item.allDay ? new Date(item.at + "T00:00:00") : new Date(item.at);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const day =
    d.toDateString() === today.toDateString()
      ? "Vandaag"
      : d.toDateString() === tomorrow.toDateString()
        ? "Morgen"
        : d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
  return item.allDay ? day + " · hele dag" : day + " · " + d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

// Upcoming Mavix content plus, when Google Calendar is connected, the next
// two weeks of the user's visible calendars.
export function UpcomingPlanning({ content, calendarConnected }: { content: PlanItem[]; calendarConnected: boolean }) {
  const [events, setEvents] = useState<PlanItem[]>([]);
  const [calendarError, setCalendarError] = useState(false);

  useEffect(() => {
    if (!calendarConnected) return;
    let cancelled = false;
    (async () => {
      try {
        const status = await fetch("/api/calendar").then((r) => (r.ok ? r.json() : null));
        if (!status || status.status !== "connected" || !status.calendars?.length) return;
        let hidden: string[] = [];
        try {
          hidden = JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]");
        } catch {
          hidden = [];
        }
        const ids = (status.calendars as { id: string }[]).map((c) => c.id).filter((id) => !hidden.includes(id)).slice(0, 20);
        if (!ids.length) return;
        const start = new Date();
        const end = new Date(start.getTime() + DAYS * 86400000);
        const q = new URLSearchParams({ start: start.toISOString(), end: end.toISOString(), calendars: ids.join(",") });
        const r = await fetch("/api/calendar/events?" + q);
        if (!r.ok) throw new Error();
        const data = (await r.json()) as { events: { id: string; calendarId: string; title: string; start: string; allDay: boolean }[] };
        if (!cancelled)
          setEvents(
            data.events.map((e) => ({
              id: "g-" + e.calendarId + "-" + e.id,
              title: e.title || "(Geen titel)",
              at: e.start,
              allDay: e.allDay,
              source: "Google Calendar",
              href: "/calendar",
            })),
          );
      } catch {
        if (!cancelled) setCalendarError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [calendarConnected]);

  const sortKey = (i: PlanItem) => (i.allDay ? i.at + "T00:00:00" : new Date(i.at).toISOString());
  const items = [...content, ...events].sort((a, b) => sortKey(a).localeCompare(sortKey(b))).slice(0, 6);

  return (
    <Card className="dash-card">
      <SectionHeader
        title="Aankomende planning"
        icon={<CalendarClock size={16} />}
        action={
          <Link className="text-link dash-link" href="/calendar">
            Kalender <ArrowUpRight size={14} />
          </Link>
        }
      />
      {items.length ? (
        <ul className="dash-list">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="dash-row">
                <span className="dash-row-icon">
                  {item.source === "E-mail" ? (
                    <Mail size={16} aria-hidden="true" />
                  ) : item.source === "Instagram" ? (
                    <Instagram size={16} aria-hidden="true" />
                  ) : (
                    <CalendarDays size={16} aria-hidden="true" />
                  )}
                </span>
                <span className="dash-row-main">
                  <strong>{item.title}</strong>
                  <small>
                    {item.source} · {label(item)}
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<CalendarDays size={18} />}
          title="Niets gepland"
          action={
            <Link className="text-link dash-link" href="/calendar">
              Content plannen
            </Link>
          }
        >
          {calendarConnected
            ? "De komende " + DAYS + " dagen staat er niets in je kalender of contentplanning."
            : "Plan content in de kalender of koppel Google Calendar om je afspraken hier te zien."}
        </EmptyState>
      )}
      {calendarError && <p className="dash-note">Google Calendar kon niet worden geladen.</p>}
    </Card>
  );
}
