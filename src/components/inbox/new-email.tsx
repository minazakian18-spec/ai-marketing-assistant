"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Send, X } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";
import { IconButton } from "@/components/ui";

const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

// "Nieuwe e-mail": sent through the workspace's Gmail via the Mavix backend
// (POST /api/inbox/gmail/send). The server validates again and blocks header
// injection; the thread is added to the Inbox after Gmail accepts it.
export function NewEmailDialog({
  from,
  onClose,
  onSent,
}: {
  from: string;
  onClose: () => void;
  onSent: (conversationId: string | null) => void;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [busy, onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const address = to.trim();
    if (!EMAIL.test(address)) return setError("Vul een geldig e-mailadres in.");
    if (!subject.trim()) return setError("Geef je e-mail een onderwerp.");
    if (/[\r\n]/.test(subject)) return setError("Het onderwerp mag geen regeleinden bevatten.");
    if (!body.trim()) return setError("Schrijf eerst een bericht.");
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/inbox/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: address, subject: subject.trim(), body }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Versturen is niet gelukt. Probeer het opnieuw.");
      onSent(typeof d.conversationId === "string" ? d.conversationId : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Versturen is niet gelukt.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="ib-compose-scrim" onClick={() => !busy && onClose()} aria-hidden="true" />
      <form noValidate className="ib-compose" role="dialog" aria-modal="true" aria-labelledby="ib-compose-title" onSubmit={(e) => void submit(e)}>
        <header>
          <BrandIcon brand="gmail" size={18} />
          <div>
            <h2 id="ib-compose-title">Nieuwe e-mail</h2>
            {from && <span>Van {from}</span>}
          </div>
          <IconButton label="Sluiten" onClick={onClose} disabled={busy}>
            <X size={16} />
          </IconButton>
        </header>
        <div className="ib-compose-body">
          <label>
            <span>Aan</span>
            <input ref={first} type="email" inputMode="email" autoComplete="email" maxLength={254} required value={to} onChange={(e) => setTo(e.target.value)} placeholder="naam@voorbeeld.nl" />
          </label>
          <label>
            <span>Onderwerp</span>
            <input maxLength={200} required value={subject} onChange={(e) => setSubject(e.target.value.replace(/[\r\n]+/g, " "))} />
          </label>
          <label className="ib-compose-message">
            <span className="sr-only">Bericht</span>
            <textarea rows={10} maxLength={20000} required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Schrijf je bericht…" />
          </label>
          {error && (
            <p role="alert" className="ib-error">
              {error}
            </p>
          )}
        </div>
        <footer>
          <span>Wordt verstuurd via Gmail en verschijnt in je Verzonden-map.</span>
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            Annuleren
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? <Loader2 size={15} className="ib-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
            {busy ? "Versturen…" : "Versturen"}
          </button>
        </footer>
      </form>
    </>
  );
}
