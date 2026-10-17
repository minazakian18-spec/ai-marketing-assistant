"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";

// AI credits of the current period: shared credits for the workspace plus a
// monthly maximum per action. Counted on the server from the ai_usage
// ledger; failed requests use no credits. No prompts or outputs are stored.
type Action = { action: string; label: string; credits: number; used: number; limit: number | null; included: boolean };
type Usage = {
  configured: boolean;
  plan: { id: string | null; name: string; state: "beta" | "paid" | "past_due" | "inactive" };
  credits: { total: number; used: number; remaining: number };
  period: { start: string; end: string };
  actions: Action[];
  requests: number;
  failed: number;
};
const nf = new Intl.NumberFormat("nl-NL");
const date = (iso: string) => new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long" });

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={"ai-usage-meter" + (pct >= 85 ? " is-high" : "")} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <span style={{ width: pct + "%" }} />
    </div>
  );
}

export function AiUsage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/ai-usage", { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(r.status === 403 && !body.access ? "AI-tegoed is zichtbaar voor eigenaren en beheerders met een echt account." : body.error || "AI-tegoed kon niet worden geladen.");
        if (active) setUsage(body);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, []);
  const c = usage?.credits;
  return (
    <section className="panel account-panel">
      <div className="section-heading">
        <div>
          <h2>
            <Gauge size={18} aria-hidden="true" /> AI-tegoed
          </h2>
          <p>Iedere AI-actie gebruikt credits uit het gedeelde tegoed van je werkruimte. Daarnaast heeft elke functie een maandmaximum.</p>
        </div>
      </div>
      <div className="account-panel-body ai-usage">
        {error ? (
          <p className="field-note">{error}</p>
        ) : !usage || !c ? (
          <p className="field-note" role="status">
            Laden…
          </p>
        ) : (
          <>
            {!usage.configured && <p className="field-note">AI is nog niet geconfigureerd op de server. Er worden geen AI-verzoeken uitgevoerd.</p>}
            {usage.plan.state === "inactive" && <p className="field-error">Je abonnement is niet actief. AI-functies staan uit; je gegevens blijven bewaard.</p>}
            <div className="ai-credits-head">
              <div>
                <strong className="ai-credits-big">{nf.format(c.remaining)}</strong>
                <span> van {nf.format(c.total)} credits over</span>
              </div>
              <span className="ai-credits-plan">{usage.plan.name}</span>
            </div>
            <Meter value={c.used} max={c.total} label="Gebruikte credits" />
            <p className="field-note">
              {nf.format(c.used)} credits gebruikt sinds {date(usage.period.start)}. Je tegoed vernieuwt op {date(usage.period.end)}; ongebruikte credits gaan niet mee.
              {c.remaining === 0 && " Nieuwe AI-acties zijn tot dan geblokkeerd; je bestaande content blijft gewoon beschikbaar."}
            </p>
            <ul className="ai-actions">
              {usage.actions
                .filter((a) => a.included || a.used > 0)
                .map((a) => (
                  <li key={a.action}>
                    <div className="ai-actions-row">
                      <span>{a.label}</span>
                      <span>
                        {a.limit !== null ? `${nf.format(a.used)} van ${nf.format(a.limit)}` : `${nf.format(a.used)} gebruikt`}
                        <small> · {a.credits} {a.credits === 1 ? "credit" : "credits"} per keer</small>
                      </span>
                    </div>
                    {a.limit !== null && <Meter value={a.used} max={a.limit} label={a.label} />}
                  </li>
                ))}
            </ul>
            {usage.actions.some((a) => !a.included) && (
              <p className="field-note">
                Niet in je pakket: {usage.actions.filter((a) => !a.included).map((a) => a.label.toLowerCase()).join(", ")}. <Link href="/pricing#vergelijk">Vergelijk pakketten</Link>
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
