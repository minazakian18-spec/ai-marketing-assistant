import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { calendarReturnHref } from "@/lib/calendar/planning";

const when = (v: string) => {
  const [d, t] = v.split("T");
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + (t ? " · " + t.slice(0, 5) : "");
};

// Shown in Social and E-mail when the user came from the calendar: the moment
// being planned (live, follows the editor's date field) and a way back.
export function PlanningNotice({
  action,
  dateTime,
  returnDate,
  existing = false,
}: {
  action: "Publiceren" | "Versturen";
  dateTime: string;
  returnDate?: string;
  existing?: boolean;
}) {
  return (
    <div className="plan-notice" role="status">
      <CalendarClock size={18} aria-hidden="true" />
      <div>
        <strong>{existing ? "Geopend vanuit de kalender" : dateTime ? "Wordt ingepland vanuit de kalender" : "Vanuit de kalender"}</strong>
        <span>{dateTime ? action + ": " + when(dateTime) : "Nog geen moment gekozen. Kies hieronder een datum en tijd."}</span>
      </div>
      <Link className="button secondary" href={calendarReturnHref(dateTime || returnDate)}>
        Terug naar kalender
      </Link>
    </div>
  );
}
