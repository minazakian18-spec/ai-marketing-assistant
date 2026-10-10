"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Plus, Trash2, X } from "lucide-react";

// Newsletter signup forms: create, configure, embed. Signups land in Contacts
// automatically (merged when the workspace loads).

type Form = {
  id: string;
  public_key: string;
  name: string;
  consent_text: string;
  privacy_policy_url: string | null;
  privacy_policy_version: string;
  allowed_origins: string[];
  redirect_url: string | null;
  double_opt_in: boolean;
  active: boolean;
};
type Meta = { forms: Form[]; emailConfigured: boolean; endpoint: string; hostedBase: string };
type Draft = { name: string; consentText: string; privacyPolicyUrl: string; privacyPolicyVersion: string; allowedOrigins: string; redirectUrl: string; doubleOptIn: boolean; active: boolean };

const blank = (business: string): Draft => ({
  name: "Nieuwsbrief",
  consentText: `Ja, ik wil de nieuwsbrief van ${business || "dit bedrijf"} per e-mail ontvangen. Afmelden kan altijd via de link in elke e-mail.`,
  privacyPolicyUrl: "",
  privacyPolicyVersion: "1",
  allowedOrigins: "",
  redirectUrl: "",
  doubleOptIn: false,
  active: true,
});
const toDraft = (f: Form): Draft => ({
  name: f.name,
  consentText: f.consent_text,
  privacyPolicyUrl: f.privacy_policy_url || "",
  privacyPolicyVersion: f.privacy_policy_version,
  allowedOrigins: f.allowed_origins.join("\n"),
  redirectUrl: f.redirect_url || "",
  doubleOptIn: f.double_opt_in,
  active: f.active,
});

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Plain HTML: works on any website without scripts.
function embedCode(meta: Meta, f: Form) {
  return `<form action="${meta.endpoint}" method="post">
  <input type="hidden" name="form" value="${f.public_key}">
  <label>E-mailadres <input type="email" name="email" required maxlength="254"></label>
  <label>Naam (optioneel) <input type="text" name="name" maxlength="120"></label>
  <label><input type="checkbox" name="consent" value="yes" required> ${esc(f.consent_text)}${f.privacy_policy_url ? ` <a href="${esc(f.privacy_policy_url)}" target="_blank" rel="noopener">Privacyverklaring</a>` : ""}</label>
  <div style="position:absolute;left:-10000px" aria-hidden="true"><input type="text" name="website" tabindex="-1" autocomplete="off"></div>
  <button type="submit">Aanmelden</button>
</form>`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="button secondary"
      onClick={() =>
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1800);
        })
      }
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
      {done ? "Gekopieerd" : label}
    </button>
  );
}

export function NewsletterForms({ business, canEdit, onClose }: { business: string; canEdit: boolean; onClose: () => void }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/newsletter/forms");
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "De formulieren konden niet worden geladen.");
    setMeta(d);
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  async function submit() {
    if (!editing) return;
    setBusy(true);
    setError("");
    const d = editing.draft;
    try {
      const r = await fetch(editing.id ? "/api/newsletter/forms/" + editing.id : "/api/newsletter/forms", {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: d.name,
          consentText: d.consentText,
          privacyPolicyUrl: d.privacyPolicyUrl.trim() || null,
          privacyPolicyVersion: d.privacyPolicyVersion,
          allowedOrigins: d.allowedOrigins
            .split(/[\s,]+/)
            .map((s) => s.trim().replace(/\/$/, ""))
            .filter(Boolean),
          redirectUrl: d.redirectUrl.trim() || null,
          doubleOptIn: d.doubleOptIn,
          active: d.active,
        }),
      });
      const res = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(res.error || "Opslaan is niet gelukt.");
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(f: Form) {
    if (!window.confirm(`Formulier "${f.name}" verwijderen? Nieuwe aanmeldingen via dit formulier stoppen. Bestaande abonnees blijven.`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/newsletter/forms/" + f.id, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Verwijderen is niet gelukt.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verwijderen is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  const set = (patch: Partial<Draft>) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));

  return (
    <>
      <div className="nlf-scrim" onClick={onClose} aria-hidden="true" />
      <section className="nlf" role="dialog" aria-modal="true" aria-labelledby="nlf-title">
        <header>
          <div>
            <h2 id="nlf-title">Aanmeldformulieren</h2>
            <p>Bezoekers die zich aanmelden komen automatisch in Contacten, met hun toestemming vastgelegd.</p>
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
          {!meta && !error && <p className="field-note">Laden…</p>}
          {meta && !editing && (
            <>
              {meta.forms.length === 0 && <p className="field-note">Nog geen formulier. Maak er een en zet het op je website, of deel de link.</p>}
              <ul className="nlf-list">
                {meta.forms.map((f) => (
                  <li key={f.id} className="nlf-item">
                    <div className="nlf-item-head">
                      <strong>{f.name}</strong>
                      <span className={"nlf-state" + (f.active ? " is-on" : "")}>{f.active ? "Actief" : "Gepauzeerd"}</span>
                      {f.double_opt_in && <span className="nlf-state">Dubbele bevestiging</span>}
                    </div>
                    <div className="nlf-actions">
                      <a className="button secondary" href={meta.hostedBase + f.public_key} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={14} /> Aanmeldpagina
                      </a>
                      <CopyButton text={meta.hostedBase + f.public_key} label="Link kopiëren" />
                      <CopyButton text={embedCode(meta, f)} label="Code voor je website" />
                      {canEdit && (
                        <>
                          <button type="button" className="button secondary" onClick={() => setEditing({ id: f.id, draft: toDraft(f) })}>
                            Bewerken
                          </button>
                          <button type="button" className="button danger-outline" onClick={() => void remove(f)} disabled={busy} aria-label={"Verwijder " + f.name}>
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {canEdit && (
                <button type="button" className="button primary" onClick={() => setEditing({ id: null, draft: blank(business) })}>
                  <Plus size={15} /> Nieuw formulier
                </button>
              )}
              <p className="field-note">
                Andere nieuwsbriefdiensten (zoals Mailchimp of Brevo) synchroniseren niet vanzelf. Gebruik dit formulier op je website, dan komen aanmeldingen
                direct in Mavix.
              </p>
            </>
          )}
          {meta && editing && (
            <form
              className="nlf-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label>
                Naam (alleen voor jou)
                <input value={editing.draft.name} maxLength={120} required onChange={(e) => set({ name: e.target.value })} />
              </label>
              <label>
                Toestemmingstekst bij het vinkje
                <textarea value={editing.draft.consentText} minLength={10} maxLength={1000} rows={3} required onChange={(e) => set({ consentText: e.target.value })} />
              </label>
              <div className="ig-two-fields">
                <label>
                  Link naar je privacyverklaring
                  <input type="url" placeholder="https://" value={editing.draft.privacyPolicyUrl} onChange={(e) => set({ privacyPolicyUrl: e.target.value })} />
                </label>
                <label>
                  Versie privacyverklaring
                  <input value={editing.draft.privacyPolicyVersion} maxLength={40} required onChange={(e) => set({ privacyPolicyVersion: e.target.value })} />
                </label>
              </div>
              <label>
                Websites die dit formulier mogen gebruiken (optioneel)
                <textarea
                  rows={2}
                  placeholder="https://www.jouwrestaurant.nl"
                  value={editing.draft.allowedOrigins}
                  onChange={(e) => set({ allowedOrigins: e.target.value })}
                />
              </label>
              <label>
                Bedankpagina op je eigen website (optioneel)
                <input type="url" placeholder="https://" value={editing.draft.redirectUrl} onChange={(e) => set({ redirectUrl: e.target.value })} />
              </label>
              <label className="contacts-consent-check">
                <input type="checkbox" checked={editing.draft.doubleOptIn} disabled={!meta.emailConfigured && !editing.draft.doubleOptIn} onChange={(e) => set({ doubleOptIn: e.target.checked })} />
                <span>
                  Dubbele bevestiging: aanmelders bevestigen via een e-mail.
                  {!meta.emailConfigured && " Nog niet beschikbaar: Mavix kan nog geen e-mail versturen (de beheerder moet dit instellen)."}
                </span>
              </label>
              <label className="contacts-consent-check">
                <input type="checkbox" checked={editing.draft.active} onChange={(e) => set({ active: e.target.checked })} />
                <span>Formulier is actief</span>
              </label>
              <div className="nlf-actions">
                <button type="button" className="button secondary" onClick={() => setEditing(null)}>
                  Annuleren
                </button>
                <button type="submit" className="button primary" disabled={busy}>
                  {busy ? "Opslaan…" : "Opslaan"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
