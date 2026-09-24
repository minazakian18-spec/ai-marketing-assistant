"use client";
import { Sparkles, Instagram, Mail } from "lucide-react";
import { statusMeta, type CalendarItem } from "@/lib/calendar-data";
import { localKey } from "./month-view";
const channelIcon = { Instagram, "E-mail": Mail } as const;
function dayLabel(dateKey: string, today: Date) {
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateKey === localKey(today)) return "Vandaag";
  if (dateKey === localKey(tomorrow)) return "Morgen";
  return new Date(dateKey + "T00:00").toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
export function ListView({
  items,
  today,
  focusDate,
  onClearFocus,
  onSelect,
}: {
  items: CalendarItem[];
  today: Date;
  focusDate?: string | null;
  onClearFocus?: () => void;
  onSelect: (item: CalendarItem) => void;
}) {
  const planned = items.filter(
    (i) => i.date && (!focusDate || i.date === focusDate),
  );
  const unplanned = !focusDate ? items.filter((i) => !i.date) : [];
  const groups = new Map<string, CalendarItem[]>();
  for (const item of planned) {
    const list = groups.get(item.date) || [];
    list.push(item);
    groups.set(item.date, list);
  }
  const dateKeys = [...groups.keys()].sort();
  return (
    <div className="cal-list">
      {focusDate && onClearFocus && (
        <button
          type="button"
          className="text-link cal-list-back"
          onClick={onClearFocus}
        >
          ← Alle dagen tonen
        </button>
      )}
      {dateKeys.map((key) => (
        <section key={key}>
          <p className="cal-list-group-label">{dayLabel(key, today)}</p>
          {groups
            .get(key)!
            .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"))
            .map((item) => (
              <ListRow key={item.id} item={item} onSelect={onSelect} />
            ))}
        </section>
      ))}
      {!dateKeys.length && (
        <p className="muted">
          Geen geplande content{focusDate ? " op deze dag" : ""}.
        </p>
      )}
      {unplanned.length > 0 && (
        <section>
          <p className="cal-list-group-label">Nog niet ingepland</p>
          {unplanned.map((item) => (
            <ListRow key={item.id} item={item} onSelect={onSelect} />
          ))}
        </section>
      )}
    </div>
  );
}
function ListRow({
  item,
  onSelect,
}: {
  item: CalendarItem;
  onSelect: (item: CalendarItem) => void;
}) {
  const Icon = channelIcon[item.channel];
  const meta = statusMeta(item.status);
  return (
    <button
      type="button"
      className="cal-list-row"
      onClick={() => onSelect(item)}
    >
      <span className="cal-list-thumb">
        {item.mediaUrl ? <img src={item.mediaUrl} alt="" /> : <Icon size={18} />}
      </span>
      <span className="cal-list-main">
        <span className="cal-list-title">
          {item.automated && <Sparkles size={12} />} {item.title}
        </span>
        <span className="cal-list-meta">
          {item.channel} · {item.contentType}
        </span>
      </span>
      <span className={"badge " + meta.className}>{meta.label}</span>
      {item.time && <span className="cal-list-time">{item.time}</span>}
    </button>
  );
}
