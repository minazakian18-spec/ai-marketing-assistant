"use client";
import { Archive, ArrowDownWideNarrow, ArrowUpWideNarrow, CircleDot, Inbox, MessagesSquare, UserRound } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";
import type { Channel } from "@/lib/inbox/shared";
import type { StatusFilter } from "./conversation-list";

// Left column of the Inbox: channels (with connection state and unread
// counts), folders and sort order. On phones it becomes a scrollable strip of
// channels above the conversation list.

export type ChannelState = { channel: Channel; state: "not_connected" | "connected" | "reconsent" | "reconnect" | "selection" | "error"; account: string };
export type SortOrder = "newest" | "oldest";

export const CHANNEL_ORDER: Channel[] = ["instagram", "whatsapp", "gmail", "messenger"];
export const CHANNEL_NAME: Record<Channel, string> = {
  instagram: "Instagram Direct",
  whatsapp: "WhatsApp Business",
  gmail: "Gmail",
  messenger: "Facebook Messenger",
};
const FOLDERS: [StatusFilter, string, typeof Inbox][] = [
  ["open", "Open", Inbox],
  ["unread", "Ongelezen", CircleDot],
  ["mine", "Toegewezen aan mij", UserRound],
  ["resolved", "Afgehandeld", Archive],
];

export function stateLabel(s?: ChannelState["state"]) {
  if (!s || s === "not_connected") return "Niet gekoppeld";
  if (s === "connected") return "Verbonden";
  if (s === "selection") return "Keuze nodig";
  if (s === "reconnect") return "Opnieuw koppelen";
  if (s === "reconsent") return "Toestemming nodig";
  return "Fout";
}
const tone = (s?: ChannelState["state"]) => (!s || s === "not_connected" ? "off" : s === "connected" ? "on" : "warn");

function Count({ n, label }: { n: number; label: string }) {
  if (!n) return null;
  return (
    <span className="ib-rail-count" aria-label={n + " " + label}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function ChannelRail({
  channels,
  unreadByChannel,
  unreadTotal,
  channel,
  status,
  sort,
  onChannel,
  onStatus,
  onSort,
}: {
  channels: ChannelState[] | null;
  unreadByChannel: Partial<Record<Channel, number>>;
  unreadTotal: number;
  channel: Channel | "";
  status: StatusFilter;
  sort: SortOrder;
  onChannel: (c: Channel | "") => void;
  onStatus: (s: StatusFilter) => void;
  onSort: (s: SortOrder) => void;
}) {
  const state = (c: Channel) => channels?.find((x) => x.channel === c)?.state;
  return (
    <nav className="ib-rail" aria-label="Kanalen en mappen">
      <div className="ib-rail-group">
        <h3 className="ib-rail-heading">Kanalen</h3>
        <ul className="ib-rail-list">
          <li>
            <button type="button" className="ib-rail-item" aria-current={channel === "" ? "true" : undefined} onClick={() => onChannel("")} title="Alle berichten">
              <span className="ib-rail-icon">
                <MessagesSquare size={17} aria-hidden="true" />
              </span>
              <span className="ib-rail-label">Alle berichten</span>
              <Count n={unreadTotal} label="ongelezen" />
            </button>
          </li>
          {CHANNEL_ORDER.map((c) => {
            const s = state(c);
            return (
              <li key={c}>
                <button
                  type="button"
                  className={"ib-rail-item is-" + tone(s)}
                  aria-current={channel === c ? "true" : undefined}
                  onClick={() => onChannel(c)}
                  title={CHANNEL_NAME[c] + " · " + stateLabel(s)}
                >
                  <span className="ib-rail-icon">
                    <BrandIcon brand={c} size={18} />
                    <span className={"ib-rail-dot is-" + tone(s)} aria-hidden="true" />
                  </span>
                  <span className="ib-rail-label">
                    {CHANNEL_NAME[c]}
                    <small>{stateLabel(s)}</small>
                  </span>
                  <Count n={unreadByChannel[c] || 0} label="ongelezen" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="ib-rail-group ib-rail-folders">
        <h3 className="ib-rail-heading">Mappen</h3>
        <ul className="ib-rail-list">
          {FOLDERS.map(([f, label, Icon]) => (
            <li key={f}>
              <button type="button" className="ib-rail-item" aria-current={status === f ? "true" : undefined} onClick={() => onStatus(f)} title={label}>
                <span className="ib-rail-icon">
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span className="ib-rail-label">{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="ib-rail-group ib-rail-sort">
        <h3 className="ib-rail-heading">Sorteren</h3>
        <div className="ib-rail-seg" role="group" aria-label="Sorteren">
          <button type="button" aria-pressed={sort === "newest"} onClick={() => onSort("newest")} title="Nieuwste eerst">
            <ArrowDownWideNarrow size={14} aria-hidden="true" />
            <span>Nieuwste</span>
          </button>
          <button type="button" aria-pressed={sort === "oldest"} onClick={() => onSort("oldest")} title="Oudste eerst">
            <ArrowUpWideNarrow size={14} aria-hidden="true" />
            <span>Oudste</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
