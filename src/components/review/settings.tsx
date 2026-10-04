"use client";
import Link from "next/link";
import { ArrowUpRight, Building2, Link2, ShieldCheck } from "lucide-react";
import type { ReviewAutoReplySettings } from "@/lib/review-model";

export function ReviewSettings({
  settings,
  onChange,
}: {
  settings: ReviewAutoReplySettings;
  onChange: (s: ReviewAutoReplySettings) => void;
}) {
  return (
    <section>
      <div className="panel rv-connect-card">
        <div>
          <span className="rv-connect-icon">
            <Link2 size={22} />
          </span>
          <div>
            <h2>Google Business Profile</h2>
            <p>
              Koppel je profiel via Integraties. Het automatisch ophalen van
              je echte reviews in deze werkruimte volgt in een volgende fase.
            </p>
          </div>
        </div>
        <Link className="button secondary" href="/account/integraties">
          <ShieldCheck size={16} />
          Koppelen
        </Link>
      </div>

      <section className="panel channel-summary">
        <div>
          <span className="channel-summary-icon">
            <Building2 size={22} />
          </span>
          <div>
            <small>Bedrijfsgegevens voor reacties</small>
            <h2>Brand Hub</h2>
            <p>Bedrijfsnaam, merkstem en logo worden gebruikt in je reacties.</p>
          </div>
        </div>
        <Link className="button secondary" href="/brand-hub">
          Openen <ArrowUpRight size={14} />
        </Link>
      </section>

      <div className="panel account-panel">
        <div className="section-heading">
          <div>
            <h2>Meldingen</h2>
            <p>Bepaal waarover Mavix je op de hoogte houdt.</p>
          </div>
        </div>
        <div className="notification-row">
          <div>
            <h3>Nieuwe review binnengekomen</h3>
            <p>Ontvang een melding zodra er een nieuwe review binnenkomt.</p>
          </div>
          <button
            type="button"
            className="notification-toggle"
            role="switch"
            aria-checked={settings.notifyOnLowRating}
            onClick={() =>
              onChange({
                ...settings,
                notifyOnLowRating: !settings.notifyOnLowRating,
              })
            }
          >
            <span />
          </button>
        </div>
        <div className="notification-row">
          <div>
            <h3>Auto Reply status</h3>
            <p>
              {settings.enabled
                ? "Mavix mag automatisch reageren volgens je regels."
                : "Auto Reply staat uit — reacties blijven concepten."}
            </p>
          </div>
          <button
            type="button"
            className="notification-toggle"
            role="switch"
            aria-checked={settings.enabled}
            onClick={() => onChange({ ...settings, enabled: !settings.enabled })}
          >
            <span />
          </button>
        </div>
      </div>
      <p className="field-note">
        Automatisch reageren op Google vereist een gekoppeld Google Business
        Profile.
      </p>
    </section>
  );
}
