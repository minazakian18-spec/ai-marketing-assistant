"use client";
import { useState } from "react";
import { addDaysLocal, dayKey, formatTime, fromKey, onDay, sortEntries, startOfWeek, type Entry } from "./model";
import { EntryIcon } from "./entry-icon";

const MAX = 3;
const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

export function MonthGrid({
  anchor,
  entries,
  now,
  onSelect,
  onCreate,
  onMoveDay,
  onShowDay,
}: {
  anchor: Date;
  entries: Entry[];
  now: Date;
  onSelect: (e: Entry) => void;
  onCreate: (day: Date) => void;
  onMoveDay: (e: Entry, day: Date) => void;
  onShowDay: (day: Date) => void;
}) {
  const [over, setOver] = useState<string | null>(null);
  const start = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const days = Array.from({ length: 42 }, (_, i) => addDaysLocal(start, i));
  const byKey = new Map(entries.map((e) => [e.key, e]));
  const today = dayKey(now);

  return (
    <div className="mg" role="grid" aria-label="Maandoverzicht">
      <div className="mg-weekdays" role="row">
        {WEEKDAYS.map((d) => (
          <div key={d} role="columnheader">
            {d}
          </div>
        ))}
      </div>
      <div className="mg-cells">
        {days.map((day) => {
          const key = dayKey(day);
          const list = onDay(entries, day).sort(sortEntries);
          const outside = day.getMonth() !== anchor.getMonth();
          return (
            <div
              key={key}
              role="gridcell"
              className={
                "mg-cell" +
                (outside ? " is-outside" : "") +
                (key === today ? " is-today" : "") +
                (over === key ? " is-over" : "")
              }
              onClick={(e) => {
                if (e.target === e.currentTarget) onCreate(day);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(key);
              }}
              onDragLeave={() => setOver((o) => (o === key ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const entry = byKey.get(e.dataTransfer.getData("text/mavix-entry"));
                if (entry) onMoveDay(entry, fromKey(key));
              }}
            >
              <button
                type="button"
                className="mg-date"
                onClick={() => onShowDay(day)}
                aria-label={day.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" }) + ", dagweergave openen"}
              >
                {day.getDate()}
              </button>
              {list.slice(0, MAX).map((x) => (
                <button
                  key={x.key}
                  type="button"
                  draggable={x.editable}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/mavix-entry", x.key);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className={"cal-chip" + (x.allDay ? " is-allday" : "") + (x.kind === "mavix" ? " is-mavix" : "")}
                  style={{ ["--chip" as string]: x.color }}
                  onClick={() => onSelect(x)}
                >
                  <EntryIcon entry={x} />
                  {!x.allDay && <time>{formatTime(x.start)}</time>}
                  <span>{x.title}</span>
                </button>
              ))}
              {list.length > MAX && (
                <button type="button" className="mg-more" onClick={() => onShowDay(day)}>
                  +{list.length - MAX} meer
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
