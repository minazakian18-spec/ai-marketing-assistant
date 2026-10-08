"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Building2, Plug } from "lucide-react";
import type { ReviewAutoReplySettings } from "@/lib/review-model";

// Preferences used for "Voorstel van Mavi" on real Google reviews. Replies are
// never posted automatically; automation (autopilot) is a later step.
export function ReplyPreferences({ settings, onChange }: { settings: ReviewAutoReplySettings; onChange: (s: ReviewAutoReplySettings) => Promise<void> | void }) {
  const [tone, setTone] = useState(settings.tone);
  const [signature, setSignature] = useState(settings.signature);
  const [saved, setSaved] = useState(false);
  const dirty = tone !== settings.tone || signature !== settings.signature;
  return (
    <section className="rvl-settings">
      <form
        className="ui-card rvl-prefs"
        onSubmit={async (e) => {
          e.preventDefault();
          await onChange({ ...settings, tone: tone.trim().slice(0, 300), signature: signature.trim().slice(0, 80) });
          setSaved(true);
        }}
      >
        <h2>Antwoordstijl voor Mavi</h2>
        <p>Mavi gebruikt dit bij het voorstellen van een antwoord. Jij controleert en plaatst elk antwoord zelf.</p>
        <label>
          Toon
          <textarea rows={3} maxLength={300} value={tone} onChange={(e) => (setTone(e.target.value), setSaved(false))} />
        </label>
        <label>
          Ondertekening
          <input maxLength={80} value={signature} onChange={(e) => (setSignature(e.target.value), setSaved(false))} placeholder="Bijvoorbeeld: Team Trattoria" />
        </label>
        <div className="rvl-prefs-bar">
          {saved && !dirty && <span role="status">Opgeslagen.</span>}
          <button type="submit" className="button primary" disabled={!dirty}>
            Opslaan
          </button>
        </div>
      </form>
      <div className="rvl-links">
        <Link href="/brand-hub" className="ui-card">
          <Building2 size={18} aria-hidden="true" />
          <span>
            <strong>Brand Hub</strong>
            <small>Bedrijfsnaam en merkstem die Mavi in antwoorden gebruikt.</small>
          </span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <Link href="/account/integraties" className="ui-card">
          <Plug size={18} aria-hidden="true" />
          <span>
            <strong>Google Bedrijfsprofiel</strong>
            <small>Koppeling, gekozen locatie en ontkoppelen.</small>
          </span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
