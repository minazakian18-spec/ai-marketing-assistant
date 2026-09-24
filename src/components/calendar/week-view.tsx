"use client";
import { Sparkles } from "lucide-react";
import { statusMeta, type CalendarItem } from "@/lib/calendar-data";
import { AddContentMenu } from "./add-content-menu";
import { localKey } from "./month-view";
const WEEKDAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
function weekDays(anchor: Date): Date[] {
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
export function WeekView({
  anchor,
  items,
  today,
  onSelect,
  onDrop,
}: {
  anchor: Date;
  items: CalendarItem[];
  today: Date;
  onSelect: (item: CalendarItem) => void;
  onDrop: (item: CalendarItem, dateKey: string) => void;
}) {
  const days = weekDays(anchor);
  const byDate = new Map<string, CalendarItem[]>();
  for (const item of items) {
    if (!item.date) continue;
    const list = byDate.get(item.date) || [];
    list.push(item);
    byDate.set(item.date, list);
  }
  const todayKey = localKey(today);
  return (
    <div className="cal-week-grid">
      {days.map((d, i) => {
        const key = localKey(d);
        const dayItems = (byDate.get(key) || []).sort((a, b) =>
          (a.time || "99:99").localeCompare(b.time || "99:99"),
        );
        return (
          <div
            key={key}
            className={
              "cal-week-col" + (key === todayKey ? " is-today" : "")
            }
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              const item = items.find((it) => it.id === id);
              if (item) onDrop(item, key);
            }}
          >
            <div className="cal-week-col-head">
              <span>
                {WEEKDAYS[i]} {d.getDate()}
              </span>
              <AddContentMenu compact date={key} />
            </div>
            <div className="cal-week-items">
              {dayItems.map((item) => (
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
              {!dayItems.length && <p className="cal-week-empty">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
