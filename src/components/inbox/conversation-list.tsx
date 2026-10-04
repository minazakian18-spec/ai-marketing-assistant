"use client";
import { Search } from "lucide-react";
import type { Channel, ConversationView } from "@/lib/inbox/shared";
import { ChannelIcon } from "./channel-icon";
import { initials, listTime } from "./format";

export type StatusFilter = "open" | "unread" | "mine" | "resolved";
const CHANNEL_FILTERS: [Channel | "", string][] = [
  ["", "Alles"],
  ["whatsapp", "WhatsApp"],
  ["instagram", "Instagram"],
  ["messenger", "Messenger"],
  ["gmail", "E-mail"],
];
const STATUS_FILTERS: [StatusFilter, string][] = [
  ["open", "Open"],
  ["unread", "Ongelezen"],
  ["mine", "Toegewezen aan mij"],
  ["resolved", "Afgehandeld"],
];

export function ConversationList({
  conversations,
  selectedId,
  channel,
  status,
  query,
  loading,
  hasMore,
  onChannel,
  onStatus,
  onQuery,
  onSelect,
  onMore,
}: {
  conversations: ConversationView[];
  selectedId: string | null;
  channel: Channel | "";
  status: StatusFilter;
  query: string;
  loading: boolean;
  hasMore: boolean;
  onChannel: (c: Channel | "") => void;
  onStatus: (s: StatusFilter) => void;
  onQuery: (q: string) => void;
  onSelect: (id: string) => void;
  onMore: () => void;
}) {
  return (
    <aside className="ib-list" aria-label="Gesprekken">
      <div className="ib-list-tools">
        <label className="ib-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Zoek in gesprekken</span>
          <input type="search" placeholder="Zoek op naam of bericht" value={query} maxLength={100} onChange={(e) => onQuery(e.target.value)} />
        </label>
        <div className="ib-chips" role="group" aria-label="Kanaal">
          {CHANNEL_FILTERS.map(([value, label]) => (
            <button key={label} type="button" aria-pressed={channel === value} onClick={() => onChannel(value)}>
              {label}
            </button>
          ))}
        </div>
        <div className="ib-chips ib-chips-status" role="group" aria-label="Status">
          {STATUS_FILTERS.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={status === value} onClick={() => onStatus(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="ib-items">
        {conversations.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={"ib-item" + (c.unread > 0 ? " is-unread" : "")}
              aria-current={selectedId === c.id ? "true" : undefined}
              onClick={() => onSelect(c.id)}
            >
              <span className="ib-avatar" aria-hidden="true">
                {initials(c.contact.name)}
                <ChannelIcon channel={c.channel} size={10} />
              </span>
              <span className="ib-item-main">
                <span className="ib-item-top">
                  <strong>{c.contact.name}</strong>
                  <time dateTime={c.lastMessageAt}>{listTime(c.lastMessageAt)}</time>
                </span>
                {c.subject && <span className="ib-item-subject">{c.subject}</span>}
                <span className="ib-item-preview">
                  {c.lastDirection === "outbound" && <span className="ib-you">Jij: </span>}
                  {c.preview || "—"}
                </span>
              </span>
              {c.unread > 0 && (
                <span className="ib-unread" aria-label={c.unread + " ongelezen"}>
                  {c.unread > 9 ? "9+" : c.unread}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {!loading && !conversations.length && (
        <p className="ib-list-empty">{query ? "Geen gesprekken gevonden." : "Geen gesprekken in deze weergave."}</p>
      )}
      {loading && !conversations.length && <p className="ib-list-empty">Gesprekken laden…</p>}
      {hasMore && (
        <button type="button" className="button secondary ib-more" onClick={onMore} disabled={loading}>
          {loading ? "Laden…" : "Meer gesprekken"}
        </button>
      )}
    </aside>
  );
}
