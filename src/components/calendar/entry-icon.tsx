import { CalendarDays, Instagram, Mail, Repeat } from "lucide-react";
import type { Entry } from "./model";

// Subtle source marker: Instagram/Mail for Mavix content, a calendar glyph for
// Google events (a generic icon, not Google's own artwork).
export function EntryIcon({ entry }: { entry: Entry }) {
  if (entry.kind === "mavix")
    return entry.channel === "E-mail" ? (
      <Mail size={11} aria-label="E-mail" />
    ) : (
      <Instagram size={11} aria-label="Instagram" />
    );
  return entry.google?.recurringEventId ? (
    <Repeat size={11} aria-label="Terugkerend Google-evenement" />
  ) : (
    <CalendarDays size={11} aria-label="Google Calendar" />
  );
}
