"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { UserRound, X } from "lucide-react";
import { Mavi } from "@/components/mavi";
import type { ConversationStatus } from "@/lib/inbox/shared";
import { ChannelIcon } from "./channel-icon";
import { initials, windowLabel } from "./format";
import type { Detail } from "./thread";

const STATUSES: [ConversationStatus, string][] = [
  ["open", "Open"],
  ["pending", "In afwachting"],
  ["resolved", "Afgehandeld"],
];

export function ContextPanel({
  detail,
  demo,
  userId,
  onClose,
  onUpdate,
  onSummary,
}: {
  detail: Detail | null;
  demo: boolean;
  userId: string;
  onClose: () => void;
  onUpdate: (patch: { status?: ConversationStatus; assignedUserId?: string | null; unread?: boolean }) => void;
  onSummary: () => Promise<string | null>;
}) {
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = detail?.conversation.id;
  useEffect(() => {
    setSummary("");
    setError("");
  }, [id]);

  if (!detail)
    return (
      <aside className="ib-context ib-context-empty" aria-label="Klantgegevens">
        <UserRound size={18} aria-hidden="true" />
        <p>Selecteer een gesprek om klantgegevens te zien.</p>
      </aside>
    );

  const { conversation: c, capabilities: caps, window: win, contact } = detail;

  async function summarize() {
    setBusy(true);
    setError("");
    try {
      setSummary((await onSummary()) || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mavi kon geen samenvatting maken.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="ib-context" aria-label="Klantgegevens">
      <header className="ib-context-head">
        <h2>Details</h2>
        <button type="button" className="ib-icon ib-context-close" onClick={onClose} aria-label="Details sluiten">
          <X size={18} />
        </button>
      </header>
      <div className="ib-person">
        <span className="ib-avatar ib-avatar-lg" aria-hidden="true">
          {initials(c.contact.name)}
        </span>
        <div>
          <strong>{c.contact.name}</strong>
          {c.contact.handle && c.contact.handle !== c.contact.name && <span>{c.contact.handle}</span>}
          <ChannelIcon channel={c.channel} label />
        </div>
      </div>

      <section className="ib-section">
        <h3>Mavix-contact</h3>
        {contact ? (
          <dl className="ib-dl">
            <dt>Naam</dt>
            <dd>{contact.name}</dd>
            {contact.email && (<><dt>E-mail</dt><dd>{contact.email}</dd></>)}
            {contact.phone && (<><dt>Telefoon</dt><dd>{contact.phone}</dd></>)}
            {contact.company && (<><dt>Bedrijf</dt><dd>{contact.company}</dd></>)}
            {contact.status && (<><dt>Status</dt><dd>{contact.status}</dd></>)}
          </dl>
        ) : (
          <p className="ib-muted">
            Geen exact overeenkomend contact gevonden.{" "}
            <Link href="/contacten">Naar Contacten</Link>
          </p>
        )}
      </section>

      <section className="ib-section">
        <h3>Gesprek</h3>
        <label className="ib-field">
          <span>Status</span>
          <select value={c.status} disabled={demo} onChange={(e) => onUpdate({ status: e.target.value as ConversationStatus })}>
            {STATUSES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="ib-field">
          <span>Toegewezen aan</span>
          <select
            value={c.assignedUserId || ""}
            disabled={demo}
            onChange={(e) => onUpdate({ assignedUserId: e.target.value || null })}
          >
            <option value="">Niemand</option>
            {detail.members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.userId === userId ? m.name + " (ik)" : m.name}
              </option>
            ))}
          </select>
        </label>
        {!demo && c.assignedUserId !== userId && userId && (
          <button type="button" className="button secondary ib-small" onClick={() => onUpdate({ assignedUserId: userId })}>
            Aan mij toewijzen
          </button>
        )}
        <button type="button" className="button secondary ib-small" disabled={demo} onClick={() => onUpdate({ unread: true })}>
          Markeer als ongelezen
        </button>
      </section>

      <section className="ib-section">
        <h3>Kanaal</h3>
        <p className="ib-muted">
          {caps.live === "polling"
            ? "E-mail wordt ongeveer elke minuut opgehaald via de Gmail API (geen realtime)."
            : "Nieuwe berichten komen binnen via webhooks van Meta."}
        </p>
        {win.applies && (
          <p className="ib-muted">
            {win.open ? "Antwoordvenster open (" + windowLabel(win.closesAt) + ")." : "Antwoordvenster gesloten."}{" "}
            {caps.templates ? "Buiten 24 uur kun je alleen goedgekeurde templates sturen." : "Na 24 uur zonder bericht van de klant kun je niet meer antwoorden."}
          </p>
        )}
        {caps.delivery === "sent-only" && <p className="ib-muted">Gmail meldt alleen of een e-mail is verzonden, niet of hij is gelezen.</p>}
      </section>

      <section className="ib-section">
        <h3>Samenvatting</h3>
        {summary ? (
          <p className="ib-summary">{summary}</p>
        ) : (
          <button type="button" className="button secondary ib-small ib-mavi-btn" disabled={demo || busy} onClick={() => void summarize()}>
            <Mavi size={15} state={busy ? "thinking" : "idle"} />
            {busy ? "Mavi vat samen…" : "Laat Mavi samenvatten"}
          </button>
        )}
        {error && <p className="ib-error" role="alert">{error}</p>}
      </section>
    </aside>
  );
}
