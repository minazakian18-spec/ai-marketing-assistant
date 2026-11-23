"use client";
import { useState } from "react";
import { Loader2, ScanSearch } from "lucide-react";
import { isBrowserDemo } from "@/lib/demo";
import type { Profile } from "@/lib/types";
import { strategyOf } from "@/lib/brand-strategy";

// "Website opnieuw analyseren": reads the website (homepage plus menu,
// product and service pages) and suggests the current offer. Products change,
// so this can be run again at any time. Nothing is saved without a tick.
type Analysis = { description: string; products: string[]; usps: string[]; audience: string };
type Key = "products" | "description" | "usps" | "audience";

export function WebsiteAnalyze({ profile, onApply, compact = false }: { profile: Profile; onApply: (patch: Partial<Profile>, usps?: string) => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ analysis: Analysis; pages: string[] } | null>(null);
  const [picked, setPicked] = useState<Key[]>([]);
  const website = profile.website?.trim() || "";

  async function run() {
    setError("");
    setResult(null);
    if (isBrowserDemo()) return setError("In de testmodus analyseert Mavix geen websites.");
    setBusy(true);
    const r = await fetch("/api/brand/analyze", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ url: website }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(d.error || "Je website kon niet worden geanalyseerd.");
    setResult(d);
    const a = d.analysis as Analysis;
    setPicked((["products", "usps", "description", "audience"] as Key[]).filter((k) => (Array.isArray(a[k]) ? (a[k] as string[]).length : (a[k] as string))));
  }

  function apply() {
    if (!result) return;
    const a = result.analysis;
    const patch: Partial<Profile> = {};
    if (picked.includes("products")) patch.products = a.products.join("\n");
    if (picked.includes("description") && a.description) patch.description = a.description;
    if (picked.includes("audience") && a.audience) patch.audience = a.audience;
    onApply(patch, picked.includes("usps") && a.usps.length ? a.usps.join("\n") : undefined);
    setResult(null);
  }

  const rows: [Key, string, string, string][] = result
    ? ([
        ["products", "Producten en diensten", result.analysis.products.join(", "), profile.products || ""],
        ["usps", "Wat je uniek maakt", result.analysis.usps.join(" · "), strategyOf(profile).usps],
        ["description", "Omschrijving", result.analysis.description, profile.description],
        ["audience", "Doelgroep", result.analysis.audience, profile.audience],
      ] as [Key, string, string, string][]).filter(([, , v]) => v)
    : [];

  return (
    <div className={"bh-analyze" + (compact ? " is-compact" : "")}>
      <div className="bh-analyze-head">
        <div>
          <strong>Website analyseren</strong>
          <small>Nieuwe producten of diensten? Mavix leest je website opnieuw en stelt je actuele aanbod voor.</small>
        </div>
        <button type="button" className="button secondary" disabled={busy || !website} onClick={() => void run()}>
          {busy ? <Loader2 size={15} className="int-spin" aria-hidden="true" /> : <ScanSearch size={15} aria-hidden="true" />}
          {busy ? "Website lezen…" : "Website opnieuw analyseren"}
        </button>
      </div>
      {!website && <small className="bh-hint">Vul eerst je website in bij stap 1.</small>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {result && !rows.length && <p className="bh-hint">Mavix vond op je website geen nieuwe gegevens.</p>}
      {result && rows.length > 0 && (
        <fieldset className="bh-import-list">
          <legend>
            Gevonden op {result.pages.length} {result.pages.length === 1 ? "pagina" : "pagina's"}. Kies wat je wilt overnemen:
          </legend>
          {rows.map(([key, label, value, current]) => (
            <label key={key} className="bh-import-item">
              <input type="checkbox" checked={picked.includes(key)} onChange={(e) => setPicked(e.target.checked ? [...picked, key] : picked.filter((k) => k !== key))} />
              <span>
                <strong>{label}</strong>
                <span>{value}</span>
                {current && <small>Nu: “{current.replace(/\n/g, ", ").slice(0, 100)}{current.length > 100 ? "…" : ""}”</small>}
              </span>
            </label>
          ))}
          <div className="bh-import-actions">
            <button type="button" className="button primary" disabled={!picked.length} onClick={apply}>
              {picked.length ? `${picked.length} overnemen` : "Niets gekozen"}
            </button>
            <button type="button" className="button secondary" onClick={() => setResult(null)}>
              Annuleren
            </button>
          </div>
        </fieldset>
      )}
    </div>
  );
}
