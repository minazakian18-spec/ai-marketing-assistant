"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X, ExternalLink, Trash2 } from "lucide-react";
import { addDays, parseRepeat, type ClientEvent, type EventInput, type Repeat } from "@/lib/calendar/core";
import { browserTimeZone, dayKey, timeKey, type GoogleCalendar } from "./model";

export type Scope = "this" | "following" | "all";
export type EditorState =
  | { mode: "create"; start: Date; end: Date; allDay: boolean }
  | { mode: "edit"; event: ClientEvent };

const REMINDERS: [string, string][] = [
  ["default", "Standaard van agenda"],
  ["none", "Geen herinnering"],
  ["10", "10 minuten van tevoren"],
  ["30", "30 minuten van tevoren"],
  ["60", "1 uur van tevoren"],
  ["1440", "1 dag van tevoren"],
];
const REPEATS: [string, string][] = [
  ["", "Herhaalt niet"],
  ["DAILY", "Dagelijks"],
  ["WEEKLY", "Wekelijks"],
  ["MONTHLY", "Maandelijks"],
  ["YEARLY", "Jaarlijks"],
];

function initial(state: EditorState, calendars: GoogleCalendar[]) {
  const writable = calendars.filter((c) => c.accessRole === "owner" || c.accessRole === "writer");
  const fallback = (writable.find((c) => c.primary) || writable[0])?.id || "";
  if (state.mode === "create")
    return {
      title: "",
      allDay: state.allDay,
      startDate: dayKey(state.start),
      startTime: timeKey(state.start),
      endDate: state.allDay ? dayKey(state.start) : dayKey(state.end),
      endTime: timeKey(state.end),
      calendarId: fallback,
      description: "",
      location: "",
      reminder: "default",
      repeat: "",
      interval: 1,
      guests: "",
    };
  const e = state.event;
  const repeat = parseRepeat(e.recurrence);
  const s = e.allDay ? null : new Date(e.start);
  const en = e.allDay ? null : new Date(e.end);
  return {
    title: e.title,
    allDay: e.allDay,
    startDate: e.allDay ? e.start : dayKey(s!),
    startTime: s ? timeKey(s) : "09:00",
    endDate: e.allDay ? addDays(e.end, -1) : dayKey(en!),
    endTime: en ? timeKey(en) : "10:00",
    calendarId: e.calendarId,
    description: e.description,
    location: e.location,
    reminder: String(e.reminder),
    repeat: repeat?.freq || "",
    interval: repeat?.interval || 1,
    guests: e.attendees.join(", "),
  };
}

export function EventEditor({
  state,
  calendars,
  googleLabel = "Google Agenda",
  onClose,
  onSave,
  onDelete,
}: {
  state: EditorState | null;
  calendars: GoogleCalendar[];
  googleLabel?: string;
  onClose: () => void;
  onSave: (input: EventInput, calendarId: string, scope: Scope) => Promise<boolean>;
  onDelete: (scope: Scope) => Promise<boolean>;
}) {
  const [form, setForm] = useState(() => (state ? initial(state, calendars) : null));
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ask, setAsk] = useState<null | "save" | "delete">(null);
  const [scope, setScope] = useState<Scope>("this");
  const titleRef = useRef<HTMLInputElement>(null);

  const editing = state?.mode === "edit" ? state.event : null;
  const recurring = !!editing?.recurringEventId;
  const readOnly = !!editing && !editing.editable;
  const writable = calendars.filter((c) => c.accessRole === "owner" || c.accessRole === "writer");

  useEffect(() => {
    if (!state) return;
    setForm(initial(state, calendars));
    setMore(!!(state.mode === "edit" && (state.event.description || state.event.location || state.event.recurrence)));
    setError("");
    setAsk(null);
    setScope("this");
    const t = window.setTimeout(() => titleRef.current?.focus(), 50);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!state || !form) return null;
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });
  // Mavix' own calendars store simple events: no repeat rules or guests.
  const local = form.calendarId.startsWith("mavix:");

  function toInput(): EventInput {
    const f = form!;
    const repeat: Repeat = f.repeat
      ? { freq: f.repeat as NonNullable<Repeat>["freq"], interval: Number(f.interval) || 1 }
      : null;
    return {
      title: f.title,
      description: f.description,
      location: f.location,
      allDay: f.allDay,
      startDate: f.startDate,
      startTime: f.allDay ? undefined : f.startTime,
      endDate: f.endDate,
      endTime: f.allDay ? undefined : f.endTime,
      timeZone: browserTimeZone(),
      reminder: f.reminder === "default" || f.reminder === "none" ? f.reminder : Number(f.reminder),
      repeat: local ? null : repeat,
      attendees: local ? [] : f.guests
        .split(/[,;\s]+/)
        .map((g) => g.trim())
        .filter(Boolean),
    };
  }

  async function save(chosen: Scope) {
    setBusy(true);
    setError("");
    const ok = await onSave(toInput(), form!.calendarId, chosen);
    setBusy(false);
    if (!ok) setAsk(null);
  }
  async function remove(chosen: Scope) {
    setBusy(true);
    const ok = await onDelete(chosen);
    setBusy(false);
    if (!ok) setAsk(null);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form!.title.trim()) return setError("Geef het evenement een titel.");
    if (recurring) return setAsk("save");
    void save("this");
  }

  return (
    <>
      <div className="ce-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="ce" role="dialog" aria-modal="true" aria-label={editing ? "Evenement bewerken" : "Nieuw evenement"}>
        <header className="ce-head">
          <h2>{editing ? (readOnly ? "Evenement" : "Evenement bewerken") : "Nieuw evenement"}</h2>
          <button type="button" className="ce-icon" onClick={onClose} aria-label="Sluiten">
            <X size={18} />
          </button>
        </header>
        <form className="ce-body" onSubmit={submit}>
          {readOnly && (
            <p className="ce-note">Deze agenda is alleen-lezen. Je kunt dit evenement niet wijzigen.</p>
          )}
          <fieldset disabled={readOnly || busy}>
            <label className="ce-field">
              <span className="sr-only">Titel</span>
              <input
                ref={titleRef}
                className="ce-title"
                placeholder="Titel toevoegen"
                value={form.title}
                maxLength={500}
                onChange={(e) => set({ title: e.target.value })}
                required
              />
            </label>
            <label className="ce-check">
              <input type="checkbox" checked={form.allDay} onChange={(e) => set({ allDay: e.target.checked })} />
              Hele dag
            </label>
            <div className="ce-row">
              <label className="ce-field">
                <span>Begin</span>
                <input type="date" value={form.startDate} required onChange={(e) => {
                  const startDate = e.target.value;
                  set({ startDate, endDate: form.endDate < startDate ? startDate : form.endDate });
                }} />
              </label>
              {!form.allDay && (
                <label className="ce-field">
                  <span>Tijd</span>
                  <input type="time" step={900} value={form.startTime} required onChange={(e) => set({ startTime: e.target.value })} />
                </label>
              )}
            </div>
            <div className="ce-row">
              <label className="ce-field">
                <span>Einde</span>
                <input type="date" value={form.endDate} min={form.startDate} required onChange={(e) => set({ endDate: e.target.value })} />
              </label>
              {!form.allDay && (
                <label className="ce-field">
                  <span>Tijd</span>
                  <input type="time" step={900} value={form.endTime} required onChange={(e) => set({ endTime: e.target.value })} />
                </label>
              )}
            </div>
            <label className="ce-field">
              <span>Agenda</span>
              <select
                value={form.calendarId}
                onChange={(e) => set({ calendarId: e.target.value })}
                disabled={recurring}
              >
                {(
                  [
                    ["Mavix", (readOnly ? calendars : writable).filter((c) => c.id.startsWith("mavix:"))],
                    [googleLabel, (readOnly ? calendars : writable).filter((c) => !c.id.startsWith("mavix:"))],
                  ] as const
                ).map(
                  ([label, list]) =>
                    list.length > 0 && (
                      <optgroup key={label} label={label}>
                        {list.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.summary}
                          </option>
                        ))}
                      </optgroup>
                    ),
                )}
              </select>
              {!local && !editing && <small>Wordt opgeslagen in Google Agenda.</small>}
            </label>
            <button type="button" className="ce-more" onClick={() => setMore(!more)} aria-expanded={more}>
              {more ? "Minder opties" : "Meer opties"}
            </button>
            {more && (
              <div className="ce-more-fields">
                <label className="ce-field">
                  <span>Locatie</span>
                  <input value={form.location} maxLength={500} onChange={(e) => set({ location: e.target.value })} />
                </label>
                <label className="ce-field">
                  <span>Beschrijving</span>
                  <textarea rows={3} value={form.description} maxLength={8000} onChange={(e) => set({ description: e.target.value })} />
                </label>
                <label className="ce-field">
                  <span>Herinnering</span>
                  <select value={form.reminder} onChange={(e) => set({ reminder: e.target.value })}>
                    {REMINDERS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                {!local && (<div className="ce-row">
                  <label className="ce-field">
                    <span>Herhalen</span>
                    <select value={form.repeat} onChange={(e) => set({ repeat: e.target.value })}>
                      {REPEATS.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  {form.repeat && (
                    <label className="ce-field ce-interval">
                      <span>Elke</span>
                      <input type="number" min={1} max={99} value={form.interval} onChange={(e) => set({ interval: Number(e.target.value) })} />
                    </label>
                  )}
                </div>)}
                {!local && (<label className="ce-field">
                  <span>Gasten (e-mailadressen)</span>
                  <input
                    value={form.guests}
                    placeholder="naam@voorbeeld.nl, …"
                    onChange={(e) => set({ guests: e.target.value })}
                  />
                  {form.guests.trim() && <small>Gasten ontvangen een uitnodiging van Google Calendar.</small>}
                </label>)}
              </div>
            )}
          </fieldset>
          {error && <p role="alert" className="ce-error">{error}</p>}

          {ask && (
            <div className="ce-scope" role="group" aria-label="Welke gebeurtenissen?">
              <strong>{ask === "save" ? "Wijziging opslaan voor" : recurring ? "Verwijderen" : "Evenement verwijderen?"}</strong>
              {recurring && ([
                ["this", "Dit evenement"],
                ["following", "Dit en volgende evenementen"],
                ["all", "Alle evenementen"],
              ] as [Scope, string][]).map(([v, l]) => (
                <label key={v}>
                  <input type="radio" name="scope" checked={scope === v} onChange={() => setScope(v)} />
                  {l}
                </label>
              ))}
              {ask === "delete" && !recurring && <p>Dit evenement wordt ook uit Google Calendar verwijderd.</p>}
              <div className="ce-actions">
                <button type="button" className="button secondary" onClick={() => setAsk(null)} disabled={busy}>
                  Annuleren
                </button>
                <button
                  type="button"
                  className={"button " + (ask === "delete" ? "danger" : "primary")}
                  disabled={busy}
                  onClick={() => void (ask === "save" ? save(scope) : remove(recurring ? scope : "this"))}
                >
                  {busy ? "Bezig…" : ask === "save" ? "Opslaan" : "Verwijderen"}
                </button>
              </div>
            </div>
          )}

          {!ask && (
            <div className="ce-actions">
              {editing && !readOnly && (
                <button type="button" className="button secondary ce-delete" onClick={() => setAsk("delete")} disabled={busy}>
                  <Trash2 size={15} />
                  Verwijderen
                </button>
              )}
              {editing?.htmlLink && (
                <a className="ce-link" href={editing.htmlLink} target="_blank" rel="noreferrer">
                  Openen in Google Agenda <ExternalLink size={13} />
                </a>
              )}
              {!readOnly && (
                <button type="submit" className="button primary" disabled={busy}>
                  {busy ? "Opslaan…" : "Opslaan"}
                </button>
              )}
            </div>
          )}
        </form>
      </aside>
    </>
  );
}
