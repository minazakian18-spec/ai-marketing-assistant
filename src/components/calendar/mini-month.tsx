"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysLocal, dayKey, startOfWeek } from "./model";

const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

// Compact month picker for the calendar side panel. Highlights today and
// the visible range; picking a day moves the main calendar there.
export function MiniMonth({
  anchor,
  rangeStart,
  rangeEnd,
  onPick,
}: {
  anchor: Date;
  rangeStart: Date;
  rangeEnd: Date;
  onPick: (d: Date) => void;
}) {
  const [month, setMonth] = useState(() => new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  useEffect(() => {
    setMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  }, [anchor]);

  const first = startOfWeek(month);
  const days = Array.from({ length: 42 }, (_, i) => addDaysLocal(first, i));
  const today = dayKey(new Date());
  const label = month.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });

  return (
    <div className="mini-month">
      <div className="mini-month-head">
        <strong>{label}</strong>
        <div>
          <button type="button" aria-label="Vorige maand" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <ChevronLeft size={15} />
          </button>
          <button type="button" aria-label="Volgende maand" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div className="mini-month-grid" role="grid" aria-label={label}>
        {WEEKDAYS.map((d) => (
          <span key={d} className="mini-month-wd" aria-hidden="true">
            {d}
          </span>
        ))}
        {days.map((d) => {
          const key = dayKey(d);
          const inRange = d >= rangeStart && d < rangeEnd;
          return (
            <button
              key={key}
              type="button"
              className={
                "mini-month-day" +
                (d.getMonth() !== month.getMonth() ? " is-outside" : "") +
                (key === today ? " is-today" : "") +
                (inRange ? " is-range" : "")
              }
              aria-label={d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
              aria-current={key === today ? "date" : undefined}
              onClick={() => onPick(d)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
