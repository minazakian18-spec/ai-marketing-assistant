"use client";
import { Sparkles } from "lucide-react";
import { statusMeta, type CalendarItem } from "@/lib/calendar-data";
import { AddContentMenu } from "./add-content-menu";
function localKey(d: Date) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
function monthMatrix(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
const WEEKDAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
export function MonthView({
  anchor,
  items,
  today,
  onSelect,
  onMore,
  onDrop,
}: {
  anchor: Date;
  items: CalendarItem[];
  today: Date;
  onSelect: (item: CalendarItem) => void;
  onMore: (dateKey: string) => void;
  onDrop: (item: CalendarItem, dateKey: string) => void;
}) {
  const days = monthMatrix(anchor);
  const byDate = new Map<string, CalendarItem[]>();
  for (const item of items) {
    if (!item.date) continue;
    const list = byDate.get(item.date) || [];
    list.push(item);
    byDate.set(item.date, list);
  }
  const todayKey = localKey(today);
  return (
    <div className="cal-month-grid">
      {WEEKDAYS.map((d) => (
        <div className="cal-month-headcell" key={d}>
          {d}
        </div>
      ))}
      {days.map((d) => {
        const key = localKey(d);
        const inMonth = d.getMonth() === anchor.getMonth();
        const dayItems = (byDate.get(key) || []).sort((a, b) =>
          (a.time || "99:99").localeCompare(b.time || "99:99"),
        );
        const shown = dayItems.slice(0, 3);
        const overflow = dayItems.length - shown.length;
        return (
          <div
            key={key}
            className={
              "cal-month-cell" +
              (inMonth ? "" : " is-outside") +
              (key === todayKey ? " is-today" : "")
            }
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              const item = items.find((i) => i.id === id);
              if (item) onDrop(item, key);
            }}
          >
            <div className="cal-month-cell-head">
              <span className="cal-month-daynum">{d.getDate()}</span>
              <AddContentMenu compact date={key} />
            </div>
            <div className="cal-month-items">
              {shown.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={"cal-item " + statusMeta(item.status).className}
                  data-channel={item.channel}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", item.id)
                  }
                  onClick={() => onSelect(item)}
                >
                  {item.automated && <Sparkles size={11} />}
                  {item.time && (
                    <span className="cal-item-time">{item.time}</span>
                  )}
                  <span className="cal-item-title">{item.title}</span>
                </button>
              ))}
              {overflow > 0 && (
                <button
                  type="button"
                  className="cal-more"
                  onClick={() => onMore(key)}
                >
                  +{overflow} meer
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
export { localKey };
