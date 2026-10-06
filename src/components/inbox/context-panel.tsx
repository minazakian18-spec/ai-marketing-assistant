"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Mavi } from "@/components/mavi";
import { IconButton } from "@/components/ui";
import { capabilities } from "@/lib/inbox/shared";
import { ChannelIcon } from "./channel-icon";
import { messageTime, windowLabel } from "./format";
import { ContactAvatar } from "./conversation-list";
import type { ConversationPatch, Detail } from "./thread";

function Section({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="ib-section" open={open}>
      <summary>
        {title}
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="ib-section-body">{children}</div>
    </details>
  );
}

const STATUS_TEXT = { open: "Open", pending: "In afwachting", resolved: "Afgehandeld" };

export function ContextPanel({
  detail,
  onClose,
  onUpdate,
  onSummary,
}: {
  detail: Detail | null;
  onClose: () => void;
  onUpdate: (patch: ConversationPatch) => void;
  onSummary: () => Promise<string | null>;
}) {
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");
  const id = detail?.conversation.id;
  useEffect(() => {
    setSummary("");
    setError("");
    setLabel("");
  }, [id]);

  if (!detail) return <aside className="ib-context ib-context-empty" aria-label="Klantgegevens" />;

  const { conversation: c, capabilities: caps, window: win, contact } = detail;
  const notes = detail.messages.filter((m) => m.direction === "note").slice(-3).reverse();
  const lastIn = [...detail.messages].reverse().find((m) => m.direction === "inbound");
  const lastOut = [...detail.messages].reverse().find((m) => m.direction === "outbound" && m.status !== "failed");
  const first = detail.hasMore ? null : detail.messages[0];
  const email = contact?.email || c.contact.email;
  const phone = contact?.phone || c.contact.phone;

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
  function addLabel(e: FormEvent) {
    e.preventDefault();
    const next = label.trim().slice(0, 30);
    if (!next || c.labels.includes(next) || c.labels.length >= 10) return;
    onUpdate({ labels: [...c.labels, next] });
    setLabel("");
  }

  return (
    <aside className="ib-context" aria-label="Klantgegevens">
      <header className="ib-person">
        <IconButton label="Details sluiten" className="ib-context-close" onClick={onClose}>
          <X size={16} />
        </IconButton>
        <ContactAvatar name={c.contact.name} channel={c.channel} size={56} />
        <strong>{c.contact.name}</strong>
        <span>
          {capabilities[c.channel].label}
          {c.contact.handle && c.contact.handle !== c.contact.name ? " · " + c.contact.handle : ""}
        </span>
        <span className={"ib-state is-" + c.status}>{STATUS_TEXT[c.status]}</span>
      </header>

      <Section title="Klant">
        <dl className="ib-dl">
          <dt>E-mail</dt>
          <dd>{email || "—"}</dd>
          <dt>Telefoon</dt>
          <dd>{phone || "—"}</dd>
          {contact?.company && (
            <>
              <dt>Bedrijf</dt>
              <dd>{contact.company}</dd>
            </>
          )}
        </dl>
        <p className="ib-muted">
          {contact ? (
            <>
              Gekoppeld aan Mavix-contact <Link href="/contacten">{contact.name}</Link>
            </>
          ) : (
            "Geen overeenkomend Mavix-contact."
          )}
        </p>
      </Section>

      <Section title="Kanalen">
        <p className="ib-channel-line">
          <ChannelIcon channel={c.channel} size={14} label />
          {c.contact.handle && <span>{c.contact.handle}</span>}
        </p>
        {win.applies && (
          <p className="ib-muted">
            {win.open ? "Antwoordvenster open, " + windowLabel(win.closesAt) + "." : "Antwoordvenster gesloten."}
            {caps.templates && !win.open ? " Alleen goedgekeurde templates mogelijk." : ""}
          </p>
        )}
        {caps.live === "polling" && <p className="ib-muted">E-mail wordt ongeveer elke minuut opgehaald.</p>}
      </Section>

      <Section title="Labels">
        {c.labels.length > 0 && (
          <ul className="ib-labels">
            {c.labels.map((l) => (
              <li key={l}>
                {l}
                <button type="button" aria-label={"Label " + l + " verwijderen"} onClick={() => onUpdate({ labels: c.labels.filter((x) => x !== l) })}>
                  <X size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form className="ib-label-form" onSubmit={addLabel}>
          <label className="sr-only" htmlFor="ib-label">
            Label toevoegen
          </label>
          <input id="ib-label" value={label} maxLength={30} placeholder="Label toevoegen" onChange={(e) => setLabel(e.target.value)} />
          <IconButton label="Label toevoegen" type="submit" disabled={!label.trim()}>
            <Plus size={15} />
          </IconButton>
        </form>
      </Section>

      <Section title="Notities" open={notes.length > 0}>
        {notes.length ? (
          <ul className="ib-notes">
            {notes.map((n) => (
              <li key={n.id}>
                <p>{n.body}</p>
                <small>
                  {n.author} · {messageTime(n.createdAt)}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ib-muted">Nog geen interne notities. Gebruik &ldquo;Interne notitie&rdquo; onder het gesprek.</p>
        )}
      </Section>

      <Section title="Recente activiteit" open={false}>
        <ul className="ib-activity">
          {lastIn && <li>Laatste bericht van klant · {messageTime(lastIn.createdAt)}</li>}
          {lastOut && <li>Laatste antwoord · {messageTime(lastOut.createdAt)}</li>}
          {first && <li>Gesprek gestart via {capabilities[c.channel].label} · {messageTime(first.createdAt)}</li>}
        </ul>
        {summary ? (
          <p className="ib-summary">{summary}</p>
        ) : (
          <button type="button" className="button secondary ib-small" disabled={busy} onClick={() => void summarize()}>
            <Mavi size={14} state={busy ? "thinking" : "idle"} />
            {busy ? "Mavi vat samen…" : "Samenvatten met Mavi"}
          </button>
        )}
        {error && (
          <p className="ib-error" role="alert">
            {error}
          </p>
        )}
      </Section>
    </aside>
  );
}
