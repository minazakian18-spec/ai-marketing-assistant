"use client";
import { useState } from "react";
import { Globe } from "lucide-react";
import { isBrowserDemo } from "@/lib/demo";
import { suggestionsFor, type ImportField, type ImportSuggestion } from "@/lib/brand-import";
import type { Profile } from "@/lib/types";

// "Gegevens van je website halen": reads facts from the homepage and lets the
// owner pick which ones to use. Already filled fields are never overwritten
// unless the owner ticks them.
export function WebsiteImport({ profile, onApply }: { profile: Profile; onApply: (patch: Partial<Profile>) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState<ImportSuggestion[] | null>(null);
  const [picked, setPicked] = useState<ImportField[]>([]);

  async function read() {
    setError("");
    setFound(null);
    if (isBrowserDemo()) return setError("In de testmodus leest Mavix geen websites.");
    setBusy(true);
    const r = await fetch("/api/brand/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: profile.website }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(d.error || "Je website kon niet worden gelezen.");
    const list = suggestionsFor(profile, d.facts || {});
    setFound(list);
    setPicked(list.filter((s) => s.replace).map((s) => s.field));
  }

  function apply() {
    if (!found) return;
    const patch: Partial<Profile> = {};
    for (const s of found) if (picked.includes(s.field)) (patch as Record<string, string>)[s.field] = s.value;
    onApply(patch);
    setFound(null);
  }

  return (
    <div className="bh-import">
      <button type="button" className="button secondary" disabled={busy || !profile.website.trim()} onClick={() => void read()}>
        <Globe size={15} aria-hidden="true" />
        {busy ? "Website lezen…" : "Gegevens van mijn website halen"}
      </button>
      {!profile.website.trim() && <small className="bh-hint">Vul eerst je website in.</small>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {found && !found.length && <p className="bh-hint">Mavix vond op je homepage geen nieuwe gegevens. Je ingevulde gegevens blijven zoals ze zijn.</p>}
      {found && found.length > 0 && (
        <fieldset className="bh-import-list">
          <legend>Gevonden op je website. Kies wat je wilt overnemen:</legend>
          {found.map((s) => (
            <label key={s.field} className="bh-import-item">
              <input type="checkbox" checked={picked.includes(s.field)} onChange={(e) => setPicked(e.target.checked ? [...picked, s.field] : picked.filter((f) => f !== s.field))} />
              <span>
                <strong>{s.label}</strong>
                <span>{s.value}</span>
                <small>
                  Bron: {s.source}
                  {s.current ? ` · nu ingevuld: “${s.current.slice(0, 80)}${s.current.length > 80 ? "…" : ""}”` : ""}
                </small>
              </span>
            </label>
          ))}
          <div className="bh-import-actions">
            <button type="button" className="button primary" disabled={!picked.length} onClick={apply}>
              {picked.length ? `${picked.length} overnemen` : "Niets gekozen"}
            </button>
            <button type="button" className="button secondary" onClick={() => setFound(null)}>
              Annuleren
            </button>
          </div>
          <small className="bh-hint">Overgenomen gegevens kun je daarna gewoon aanpassen. Ze worden pas bewaard als je Brand Hub opslaat.</small>
        </fieldset>
      )}
    </div>
  );
}
