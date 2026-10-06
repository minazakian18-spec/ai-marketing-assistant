"use client";
import { useEffect, useRef, useState } from "react";
import { AlignLeft, CalendarDays, Clock, ExternalLink, MapPin, Pencil, Trash2, X } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";
import { Mavi } from "@/components/mavi";
import { IconButton } from "@/components/ui";
import { addDays, type ClientEvent } from "@/lib/calendar/core";
import { fromKey } from "./model";

const dateLong = (d: Date) => d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const time = (d: Date) => d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });

function when(e: ClientEvent) {
  if (e.allDay) {
    const last = addDays(e.end, -1);
    return last === e.start ? dateLong(fromKey(e.start)) + " · hele dag" : dateLong(fromKey(e.start)) + " – " + dateLong(fromKey(last));
  }
  const s = new Date(e.start), en = new Date(e.end);
  return s.toDateString() === en.toDateString()
    ? dateLong(s) + " · " + time(s) + " – " + time(en)
    : dateLong(s) + " " + time(s) + " – " + dateLong(en) + " " + time(en);
}

// Small detail window for a calendar event (Google or Mavix calendar).
export function EventPopover({
  event,
  calendar,
  source,
  onClose,
  onEdit,
  onDelete,
}: {
  event: ClientEvent;
  calendar: { summary: string; color: string };
  source: "google" | "mavix";
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<boolean>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  return (
    <>
      <div className="evp-scrim" onClick={onClose} aria-hidden="true" />
      <div className="evp" role="dialog" aria-modal="true" aria-labelledby="evp-title" tabIndex={-1} ref={box}>
        <div className="evp-actions">
          {event.editable && (
            <IconButton label="Bewerken" onClick={onEdit}>
              <Pencil size={15} />
            </IconButton>
          )}
          {event.editable && (
            <IconButton label="Verwijderen" onClick={() => setConfirm(true)}>
              <Trash2 size={15} />
            </IconButton>
          )}
          {event.htmlLink && (
            <a className="ui-icon-button" href={event.htmlLink} target="_blank" rel="noreferrer" aria-label="Openen in Google Agenda" title="Openen in Google Agenda">
              <ExternalLink size={15} />
            </a>
          )}
          <IconButton label="Sluiten" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="evp-title">
          <span className="evp-swatch" style={{ background: calendar.color }} aria-hidden="true" />
          <div>
            <h2 id="evp-title">{event.title || "(Geen titel)"}</h2>
            <p>{when(event)}</p>
          </div>
        </div>
        <dl className="evp-rows">
          <div>
            <dt>
              <CalendarDays size={15} aria-label="Agenda" />
            </dt>
            <dd>{calendar.summary}</dd>
          </div>
          <div>
            <dt>{source === "google" ? <BrandIcon brand="google_calendar" size={15} title="Bron" /> : <Mavi size={15} label="Bron" />}</dt>
            <dd>{source === "google" ? "Google Agenda" : "Mavix"}</dd>
          </div>
          {event.recurringEventId && (
            <div>
              <dt>
                <Clock size={15} aria-label="Herhaling" />
              </dt>
              <dd>Terugkerende afspraak</dd>
            </div>
          )}
          {event.location && (
            <div>
              <dt>
                <MapPin size={15} aria-label="Locatie" />
              </dt>
              <dd>{event.location}</dd>
            </div>
          )}
          {event.description && (
            <div>
              <dt>
                <AlignLeft size={15} aria-label="Omschrijving" />
              </dt>
              <dd className="evp-desc">{event.description}</dd>
            </div>
          )}
        </dl>
        {!event.editable && <p className="evp-note">Deze agenda is alleen-lezen.</p>}
        {confirm && (
          <div className="evp-confirm" role="alert">
            <p>
              {event.recurringEventId
                ? "Alleen deze gebeurtenis wordt verwijderd. Gebruik Bewerken voor de hele reeks."
                : source === "google"
                  ? "De afspraak wordt ook uit Google Agenda verwijderd."
                  : "De afspraak wordt verwijderd."}
            </p>
            <div>
              <button type="button" className="button secondary" onClick={() => setConfirm(false)} disabled={busy}>
                Annuleren
              </button>
              <button
                type="button"
                className="button danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const ok = await onDelete();
                  setBusy(false);
                  if (!ok) setConfirm(false);
                }}
              >
                {busy ? "Bezig…" : "Verwijderen"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
