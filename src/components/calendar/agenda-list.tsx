"use client";
import { addDaysLocal, dayKey, formatTime, onDay, sortEntries, type Entry } from "./model";
import { EntryIcon } from "./entry-icon";

function dayTitle(day: Date, now: Date) {
  const key = dayKey(day);
  if (key === dayKey(now)) return "Vandaag";
  if (key === dayKey(addDaysLocal(now, 1))) return "Morgen";
  return day.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}

export function AgendaList({
  start,
  days,
  entries,
  now,
  onSelect,
}: {
  start: Date;
  days: number;
  entries: Entry[];
  now: Date;
  onSelect: (e: Entry) => void;
}) {
  const groups = Array.from({ length: days }, (_, i) => addDaysLocal(start, i))
    .map((day) => ({ day, list: onDay(entries, day).sort(sortEntries) }))
    .filter((g) => g.list.length);
  if (!groups.length)
    return <p className="ag-empty">Geen afspraken of content in deze periode.</p>;
  return (
    <div className="ag">
      {groups.map(({ day, list }) => (
        <section key={dayKey(day)} className="ag-day" aria-label={dayTitle(day, now)}>
          <h3>{dayTitle(day, now)}</h3>
          <ul>
            {list.map((x) => (
              <li key={x.key}>
                <button type="button" onClick={() => onSelect(x)} style={{ ["--chip" as string]: x.color }}>
                  <time>{x.allDay ? "Hele dag" : formatTime(x.start)}</time>
                  <span className="ag-dot" aria-hidden="true" />
                  <span className="ag-title">
                    <EntryIcon entry={x} />
                    {x.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
