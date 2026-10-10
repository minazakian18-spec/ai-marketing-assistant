"use client";
import type { ReactNode } from "react";
import { ListFilter, Search, X } from "lucide-react";
import { Menu, type MenuItem } from "@/components/menu";
import { BrandIcon } from "@/components/brand-icon";
import { capabilities, type Channel, type ConversationView } from "@/lib/inbox/shared";
import { CHANNEL_NAME, type SortOrder } from "./channel-rail";
import { initials, listTime } from "./format";

export type StatusFilter = "open" | "unread" | "mine" | "resolved";
export const STATUS_LABEL: Record<StatusFilter, string> = {
  open: "Open",
  unread: "Ongelezen",
  mine: "Toegewezen aan mij",
  resolved: "Afgehandeld",
};

// Contact avatar with the channel's logo as a small badge.
export function ContactAvatar({ name, channel, size = 38 }: { name: string; channel: Channel; size?: number }) {
  return (
    <span className="ib-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }} aria-hidden="true">
      {initials(name)}
      <span className="ib-avatar-badge">
        <BrandIcon brand={channel} size={Math.max(11, Math.round(size * 0.32))} />
      </span>
    </span>
  );
}

export function ConversationList({
  conversations,
  selectedId,
  channel,
  status,
  query,
  loading,
  hasMore,
  unread,
  sort,
  onChannel,
  onStatus,
  onSort,
  onQuery,
  onSelect,
  onMore,
  empty,
  extraMore,
}: {
  conversations: ConversationView[];
  selectedId: string | null;
  channel: Channel | "";
  status: StatusFilter;
  query: string;
  loading: boolean;
  hasMore: boolean;
  unread: number;
  sort: SortOrder;
  onChannel: (c: Channel | "") => void;
  onStatus: (s: StatusFilter) => void;
  onSort: (s: SortOrder) => void;
  onQuery: (q: string) => void;
  onSelect: (id: string) => void;
  onMore: () => void;
  /** Replaces the default empty text (e.g. a Gmail connect prompt). */
  empty?: ReactNode;
  /** Second-stage paging after the stored list ends (older Gmail). */
  extraMore?: { label: string; busy: boolean; onClick: () => void } | null;
}) {
  const filtered = channel !== "" || status !== "open";
  // Channels and folders live in the channel rail; on phones this menu offers
  // the folders and the sort order.
  const items: MenuItem[] = [
    { type: "heading", label: "Map" },
    ...(Object.keys(STATUS_LABEL) as StatusFilter[]).map((s) => ({ label: STATUS_LABEL[s], checked: status === s, onSelect: () => onStatus(s) })),
    { type: "separator" },
    { type: "heading", label: "Sorteren" },
    { label: "Nieuwste eerst", checked: sort === "newest", onSelect: () => onSort("newest") },
    { label: "Oudste eerst", checked: sort === "oldest", onSelect: () => onSort("oldest") },
  ];
  return (
    <aside className="ib-list" aria-label="Gesprekken">
      <div className="ib-list-head">
        <div className="ib-list-title">
          <h2>{channel ? CHANNEL_NAME[channel] : "Alle berichten"}</h2>
          {unread > 0 && <span className="ib-count">{unread} ongelezen</span>}
        </div>
        <div className="ib-search-row">
          <label className="ib-search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Zoek in gesprekken</span>
            <input type="search" placeholder="Zoeken" value={query} maxLength={100} onChange={(e) => onQuery(e.target.value)} />
          </label>
          <Menu label="Map en sortering" className={"ib-filter-menu" + (status !== "open" || sort !== "newest" ? " is-active" : "")} trigger={<ListFilter size={16} />} items={items} />
        </div>
        {filtered && (
          <div className="ib-active-filters">
            {channel && (
              <button type="button" onClick={() => onChannel("")}>
                <BrandIcon brand={channel} size={12} />
                {capabilities[channel].label}
                <X size={12} aria-label="Kanaalfilter wissen" />
              </button>
            )}
            {status !== "open" && (
              <button type="button" onClick={() => onStatus("open")}>
                {STATUS_LABEL[status]}
                <X size={12} aria-label="Statusfilter wissen" />
              </button>
            )}
          </div>
        )}
      </div>
      <ul className="ib-items" key={channel + "|" + status + "|" + sort}>
        {conversations.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={"ib-item" + (c.unread > 0 ? " is-unread" : "")}
              aria-current={selectedId === c.id ? "true" : undefined}
              onClick={() => onSelect(c.id)}
            >
              <ContactAvatar name={c.contact.name} channel={c.channel} />
              <span className="ib-item-main">
                <span className="ib-item-top">
                  <strong>{c.contact.name}</strong>
                  <time dateTime={c.lastMessageAt}>{listTime(c.lastMessageAt)}</time>
                </span>
                <span className="ib-item-bottom">
                  <span className="ib-item-preview">
                    {c.lastDirection === "outbound" && <span className="ib-you">Jij: </span>}
                    {c.subject && c.channel === "gmail" ? c.subject + " — " : ""}
                    {c.preview || "—"}
                  </span>
                  {c.unread > 0 && (
                    <span className="ib-unread" aria-label={c.unread + " ongelezen"}>
                      {c.unread > 9 ? "9+" : c.unread}
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!loading && !conversations.length && (empty || <p className="ib-list-empty">{query ? "Geen gesprekken gevonden." : filtered ? "Geen gesprekken met dit filter." : "Nog geen gesprekken."}</p>)}
      {loading && !conversations.length && <p className="ib-list-empty">Gesprekken laden…</p>}
      {hasMore && (
        <button type="button" className="button secondary ib-more" onClick={onMore} disabled={loading}>
          {loading ? "Laden…" : "Meer laden"}
        </button>
      )}
      {!hasMore && extraMore && !loading && (
        <button type="button" className="button secondary ib-more" onClick={extraMore.onClick} disabled={extraMore.busy}>
          {extraMore.busy ? "Oudere e-mails ophalen…" : extraMore.label}
        </button>
      )}
    </aside>
  );
}
