"use client";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  addDaysLocal,
  dayKey,
  formatTime,
  layoutDay,
  onDay,
  startOfDay,
  type Entry,
} from "./model";
import { EntryIcon } from "./entry-icon";
import { statusMeta } from "@/lib/calendar-data";

const HOUR = 48;
const SNAP = 15;

type Drag = {
  key: string;
  mode: "move" | "resize";
  x: number;
  y: number;
  minutes: number;
  days: number;
  moved: boolean;
};

export function TimeGrid({
  days,
  entries,
  now,
  onSelect,
  onCreate,
  onMove,
}: {
  days: Date[];
  entries: Entry[];
  now: Date;
  onSelect: (e: Entry) => void;
  onCreate: (start: Date, end: Date, allDay: boolean) => void;
  onMove: (e: Entry, start: number, end: number) => void;
}) {
  const body = useRef<HTMLDivElement>(null);
  const cols = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    if (body.current) body.current.scrollTop = 7 * HOUR - 8;
  }, []);

  function down(e: ReactPointerEvent, entry: Entry, mode: Drag["mode"]) {
    if (!entry.editable || e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ key: entry.key, mode, x: e.clientX, y: e.clientY, minutes: 0, days: 0, moved: false });
  }
  function move(e: ReactPointerEvent) {
    if (!drag || !cols.current) return;
    const dy = e.clientY - drag.y;
    const dx = e.clientX - drag.x;
    const minutes = Math.round(((dy / HOUR) * 60) / SNAP) * SNAP;
    const width = cols.current.getBoundingClientRect().width / days.length;
    const dayShift = drag.mode === "move" ? Math.round(dx / width) : 0;
    const moved = drag.moved || Math.abs(dy) > 4 || Math.abs(dx) > 4;
    if (moved !== drag.moved || minutes !== drag.minutes || dayShift !== drag.days)
      setDrag({ ...drag, minutes, days: dayShift, moved });
  }
  function up(entry: Entry) {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) return;
    suppressClick.current = true;
    const shift = d.minutes * 60000;
    if (d.mode === "resize") {
      const end = Math.max(entry.start + SNAP * 60000, entry.end + shift);
      if (end !== entry.end) onMove(entry, entry.start, end);
      return;
    }
    // Move in wall-clock terms so a DST change doesn't skew the time.
    const s = new Date(entry.start);
    const start = new Date(s.getFullYear(), s.getMonth(), s.getDate() + d.days, s.getHours(), s.getMinutes() + d.minutes).getTime();
    if (start !== entry.start) onMove(entry, start, start + (entry.end - entry.start));
  }

  function createAt(day: Date, e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = Math.floor(((e.clientY - rect.top) / HOUR) * 2) * 30;
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
    onCreate(start, new Date(start.getTime() + 3600000), false);
  }

  const todayKey = dayKey(now);
  const allDayByDay = days.map((d) => onDay(entries, d).filter((x) => x.allDay));

  return (
    <div className="tg" style={{ ["--tg-days" as string]: days.length }}>
      <div className="tg-head">
        <div className="tg-gutter" />
        {days.map((d) => (
          <div key={dayKey(d)} className={"tg-day-head" + (dayKey(d) === todayKey ? " is-today" : "")}>
            <span>{d.toLocaleDateString("nl-NL", { weekday: "short" })}</span>
            <strong>{d.getDate()}</strong>
          </div>
        ))}
      </div>
      <div className="tg-allday">
        <div className="tg-gutter">Hele dag</div>
        {days.map((d, i) => (
          <div
            key={dayKey(d)}
            className="tg-allday-cell"
            onDoubleClick={(e) => {
              if (e.target === e.currentTarget) onCreate(d, addDaysLocal(d, 1), true);
            }}
          >
            {allDayByDay[i].map((x) => (
              <button
                key={x.key}
                type="button"
                className="cal-chip"
                style={{ ["--chip" as string]: x.color }}
                onClick={() => onSelect(x)}
              >
                <EntryIcon entry={x} />
                <span>{x.title}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="tg-body" ref={body}>
        <div className="tg-hours" aria-hidden="true">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="tg-hour">
              {h ? `${String(h).padStart(2, "0")}:00` : ""}
            </div>
          ))}
        </div>
        <div className="tg-cols" ref={cols}>
          {days.map((day) => {
            const dayStart = startOfDay(day).getTime();
            const timed = onDay(entries, day).filter((x) => !x.allDay);
            const isToday = dayKey(day) === todayKey;
            return (
              <div
                key={dayKey(day)}
                className={"tg-col" + (isToday ? " is-today" : "")}
                onClick={(e) => createAt(day, e)}
                aria-label={day.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
              >
                {layoutDay(timed).map(({ entry, col, cols: n }) => {
                  const active = drag?.key === entry.key && drag.moved;
                  const startMin = Math.max(0, (entry.start - dayStart) / 60000);
                  const endMin = Math.min(1440, (entry.end - dayStart) / 60000);
                  let top = (startMin / 60) * HOUR;
                  let height = Math.max(18, ((endMin - startMin) / 60) * HOUR);
                  let shiftX = 0;
                  if (active && drag) {
                    if (drag.mode === "move") {
                      top += (drag.minutes / 60) * HOUR;
                      shiftX = drag.days;
                    } else height = Math.max(12, height + (drag.minutes / 60) * HOUR);
                  }
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      className={"tg-event" + (entry.kind === "mavix" ? " is-mavix" : "") + (active ? " is-dragging" : "") + (entry.editable ? "" : " is-readonly")}
                      style={{
                        top,
                        height,
                        left: `calc(${(col / n) * 100}% + 2px)`,
                        width: `calc(${100 / n}% - 4px)`,
                        transform: shiftX ? `translateX(${shiftX * n * 100}%)` : undefined,
                        ["--chip" as string]: entry.color,
                      }}
                      onPointerDown={(e) => down(e, entry, "move")}
                      onPointerMove={move}
                      onPointerUp={() => up(entry)}
                      onPointerCancel={() => setDrag(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (suppressClick.current) {
                          suppressClick.current = false;
                          return;
                        }
                        onSelect(entry);
                      }}
                      aria-label={`${entry.title}, ${formatTime(entry.start)} tot ${formatTime(entry.end)}${entry.item ? ", " + statusMeta(entry.item.status).label : ""}`}
                    >
                      <span className="tg-event-title">
                        <EntryIcon entry={entry} />
                        {entry.title}
                      </span>
                      <span className="tg-event-time">
                        {formatTime(entry.start)} – {formatTime(entry.end)}
                      </span>
                      {entry.editable && entry.kind === "google" && (
                        <span
                          className="tg-resize"
                          aria-hidden="true"
                          onPointerDown={(e) => down(e, entry, "resize")}
                        />
                      )}
                    </button>
                  );
                })}
                {isToday && (
                  <div
                    className="tg-now"
                    style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR }}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
