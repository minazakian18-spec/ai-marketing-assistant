"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Contact } from "@/lib/types";

// Consent record of a newsletter contact: what the person agreed to, when and
// where, plus the GDPR erasure action.
type Event = { event: string; consent_text: string | null; privacy_policy_version: string | null; privacy_policy_url: string | null; page_url: string | null; method: string; created_at: string };
const EVENT: Record<string, string> = { subscribe: "Aangemeld", confirm: "Bevestigd via e-mail", unsubscribe: "Afgemeld" };
const METHOD: Record<string, string> = { form: "via aanmeldformulier", link: "via link", one_click: "via afmeldknop in e-mailprogramma", mavix_user: "door een teamlid in Mavix" };
const when = (iso: string) => new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function ConsentDialog({ contact, canEdit, onClose, onErased }: { contact: Contact; canEdit: boolean; onClose: () => void; onErased: () => void }) {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const id = contact.newsletter?.subscriberId;

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  useEffect(() => {
    if (!id) return;
    fetch("/api/newsletter/subscribers/" + id)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(r.status === 404 ? "Er is geen toestemmingsregistratie (meer) voor dit contact." : d.error || "Laden is niet gelukt.");
        setEvents(d.events);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function erase() {
    if (!id) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/newsletter/subscribers/" + id, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Wissen is niet gelukt.");
      onErased();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wissen is niet gelukt.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="nlf-scrim" onClick={onClose} aria-hidden="true" />
      <section className="nlf nlf-narrow" role="dialog" aria-modal="true" aria-labelledby="consent-title">
        <header>
          <div>
            <h2 id="consent-title">Toestemming nieuwsbrief</h2>
            <p>{contact.email}</p>
          </div>
          <button type="button" className="nlf-close" onClick={onClose} aria-label="Sluiten">
            <X size={16} />
          </button>
        </header>
        <div className="nlf-body">
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {!events && !error && <p className="field-note">Laden…</p>}
          {events && (
            <ol className="consent-log">
              {events.map((e, i) => (
                <li key={i}>
                  <strong>
                    {EVENT[e.event] || e.event} {METHOD[e.method] || ""}
                  </strong>
                  <time dateTime={e.created_at}>{when(e.created_at)}</time>
                  {e.consent_text && <blockquote>{e.consent_text}</blockquote>}
                  {(e.privacy_policy_version || e.page_url) && (
                    <small>
                      {e.privacy_policy_version && "Privacyverklaring versie " + e.privacy_policy_version}
                      {e.privacy_policy_version && e.page_url && " · "}
                      {e.page_url && "Pagina: " + e.page_url}
                    </small>
                  )}
                </li>
              ))}
            </ol>
          )}
          {canEdit && id && (
            <div className="consent-erase">
              {!confirming ? (
                <button type="button" className="button danger-outline" onClick={() => setConfirming(true)}>
                  Gegevens wissen (AVG)
                </button>
              ) : (
                <>
                  <p className="field-note">
                    Dit verwijdert de aanmelding, de toestemmingsregistratie en het contact. Het e-mailadres blijft alleen als onleesbare code op de
                    afmeldlijst staan, zodat deze persoon nooit meer per ongeluk wordt gemaild.
                  </p>
                  <div className="nlf-actions">
                    <button type="button" className="button secondary" onClick={() => setConfirming(false)}>
                      Annuleren
                    </button>
                    <button type="button" className="button danger-outline" onClick={() => void erase()} disabled={busy}>
                      {busy ? "Wissen…" : "Definitief wissen"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
