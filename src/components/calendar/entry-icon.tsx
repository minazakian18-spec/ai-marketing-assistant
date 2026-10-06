import { CalendarDays, CheckSquare, Instagram, Mail, Repeat } from "lucide-react";
import type { Entry } from "./model";

// Subtle source marker: Instagram/Mail for Mavix content, a checkbox for
// Mavix tasks, a repeat glyph for recurring Google events and a plain
// calendar glyph for other appointments.
export function EntryIcon({ entry }: { entry: Entry }) {
  if (entry.kind === "mavix")
    return entry.channel === "E-mail" ? <Mail size={11} aria-label="E-mail" /> : <Instagram size={11} aria-label="Instagram" />;
  if (entry.calendarId === "mavix:tasks") return <CheckSquare size={11} aria-label="Taak" />;
  if (entry.google?.recurringEventId) return <Repeat size={11} aria-label="Terugkerende afspraak" />;
  return <CalendarDays size={11} aria-label={entry.calendarId?.startsWith("mavix:") ? "Mavix-agenda" : "Google Agenda"} />;
}
