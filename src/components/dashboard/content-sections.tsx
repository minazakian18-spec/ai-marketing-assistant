"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Instagram,
  Mail,
  Film,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";
import { Artwork } from "@/components/ui";
import { shortDate, type DashboardItem } from "@/lib/dashboard-data";
export function ChannelIcon({ item }: { item: DashboardItem }) {
  const Icon =
    item.kind.includes("Reel") || item.kind === "Reel"
      ? Film
      : item.channel === "E-mail"
        ? Mail
        : Instagram;
  return (
    <span
      className={
        "dash-channel-icon " + (item.channel === "E-mail" ? "email" : "")
      }
    >
      <Icon size={18} />
    </span>
  );
}
export function ItemStatus({ status }: { status: DashboardItem["status"] }) {
  const labels = {
    review: "Wacht op goedkeuring",
    scheduled: "Gepland",
    published: "Gepubliceerd",
    sent: "Verzonden",
    approved: "Goedgekeurd",
    blocked: "Geblokkeerd",
    failed: "Mislukt",
    rejected: "Afgewezen",
    brand: "Brand Hub aanvullen",
  };
  return (
    <span
      key={status}
      data-status={status}
      className={
        "badge " +
        (["review", "blocked", "failed", "brand", "rejected"].includes(status)
          ? "draft"
          : status === "scheduled"
            ? "scheduled"
            : "approved")
      }
    >
      {labels[status]}
    </span>
  );
}
export function Attention({
  items,
  onView,
}: {
  items: DashboardItem[];
  onView: (item: DashboardItem) => void;
}) {
  const [all, setAll] = useState(false);
  return (
    <section className="panel attention-panel">
      <div className="dash-section-head">
        <div>
          <h2>
            Jouw aandacht nodig{" "}
            <span className="attention-count">{items.length}</span>
          </h2>
          <p>Dit zijn je belangrijkste vervolgstappen.</p>
        </div>
        {items.length > 3 && (
          <button className="text-link" onClick={() => setAll(!all)}>
            {all ? "Toon minder" : "Bekijk alles"}
            <ArrowUpRight size={14} />
          </button>
        )}
      </div>
      {items.length ? (
        (all ? items : items.slice(0, 3)).map((item) => (
          <div className="attention-item" key={item.id}>
            <ChannelIcon item={item} />
            <div className="attention-copy">
              <span>{item.kind}</span>
              <strong>{item.title}</strong>
              <small>
                {item.status === "review"
                  ? "Wacht op goedkeuring"
                  : item.status === "blocked"
                    ? "Geblokkeerd: controleer de inhoud"
                    : item.status === "failed"
                      ? "Mislukt: actie nodig"
                      : item.status === "brand"
                        ? "Ontbrekende broninformatie"
                        : "Gepland op " + shortDate(item.date)}
              </small>
            </div>
            <button className="button secondary" onClick={() => onView(item)}>
              Bekijken
            </button>
          </div>
        ))
      ) : (
        <div className="dash-empty">
          <CheckCircle2 size={23} />
          <p>Alles is bijgewerkt. Je hoeft momenteel niets te beoordelen.</p>
        </div>
      )}
    </section>
  );
}
export function Upcoming({
  items,
  onView,
}: {
  items: DashboardItem[];
  onView: (item: DashboardItem) => void;
}) {
  return (
    <section className="panel upcoming-panel">
      <div className="dash-section-head">
        <div>
          <h2>Komende 7 dagen</h2>
          <p>Je marketing, mooi op tijd.</p>
        </div>
        <CalendarDays size={18} />
      </div>
      {items.length ? (
        <>
          {items.slice(0, 4).map((item) => (
            <button
              className="upcoming-row"
              key={item.id}
              onClick={() => onView(item)}
            >
              <span className="upcoming-date">
                <strong>
                  {new Date(item.date).toLocaleDateString("nl-NL", {
                    weekday: "short",
                  })}
                </strong>
                <span>{shortDate(item.date)}</span>
              </span>
              <div>
                <strong>{item.kind}</strong>
                <span>{item.title}</span>
              </div>
              <time dateTime={item.date}>
                {new Date(item.date).toLocaleTimeString("nl-NL", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </button>
          ))}
          <Link href="/contentkalender" className="dash-card-link">
            Open contentkalender
            <ArrowUpRight size={15} />
          </Link>
        </>
      ) : (
        <div className="dash-empty">
          <p>Je hebt deze week nog niets gepland.</p>
          <Link href="/contentkalender" className="button secondary">
            Plan content
          </Link>
        </div>
      )}
    </section>
  );
}
export function RecentContent({
  items,
  onView,
}: {
  items: DashboardItem[];
  onView: (item: DashboardItem) => void;
}) {
  return (
    <section className="panel recent-dashboard">
      <div className="dash-section-head">
        <div>
          <h2>Recente content</h2>
          <p>Van eerste idee tot resultaat.</p>
        </div>
      </div>
      {items.length ? (
        items.slice(0, 4).map((item) => (
          <button
            className="dash-recent-row"
            key={item.id}
            onClick={() => onView(item)}
          >
            {item.channel === "Instagram" ? (
              <Artwork small variant={item.variant} />
            ) : (
              <span className="email-thumbnail">
                <Mail size={22} />
              </span>
            )}
            <div className="recent-copy">
              <strong>{item.title}</strong>
              <span>
                {item.channel} · {shortDate(item.date)}
              </span>
              {item.metric && <small>{item.metric}</small>}
            </div>
            <ItemStatus status={item.status} />
          </button>
        ))
      ) : (
        <div className="dash-empty">
          <p>Je hebt nog geen content gemaakt.</p>
          <Link className="text-link" href="/instagram-ai">
            Maak je eerste Instagram-concept
          </Link>
        </div>
      )}
    </section>
  );
}
