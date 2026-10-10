"use client";
import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";

// This month's AI usage for the workspace, straight from the ai_usage ledger
// (tokens per request; no prompts or outputs are stored).
type Usage = {
  since: string;
  requests: number;
  failed: number;
  tokens: number;
  costMicroUsd: number;
  pricesConfigured: boolean;
  limit: number;
  configured: boolean;
  byFeature: Record<string, { requests: number; tokens: number }>;
};
const FEATURE: Record<string, string> = {
  inbox_reply: "Inbox-antwoorden",
  inbox_rewrite: "Inbox-tekst aanpassen",
  inbox_summary: "Gesprekssamenvattingen",
  content_instagram: "Instagram-content",
  content_email: "E-mailcontent",
  content_edit: "Tekst bewerken in Content Studio",
  brand_preview: "Brand Hub-toonvoorbeeld",
  brand_improve: "Brand Hub-tekstverbetering",
  seo_suggest: "SEO-tekstvoorstellen",
  review_reply: "Reviewantwoorden",
  research: "Onderzoek",
};
const nf = new Intl.NumberFormat("nl-NL");

export function AiUsage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/ai-usage", { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(r.status === 403 && !body.access ? "AI-gebruik is zichtbaar voor eigenaren en beheerders met een echt account." : body.error || "AI-gebruik kon niet worden geladen.");
        if (active) setUsage(body);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, []);
  const pct = usage && usage.limit > 0 ? Math.min(100, Math.round((usage.tokens / usage.limit) * 100)) : 0;
  return (
    <section className="panel account-panel">
      <div className="section-heading">
        <div>
          <h2>
            <Gauge size={18} aria-hidden="true" /> AI-gebruik deze maand
          </h2>
          <p>Elk AI-verzoek wordt geteld. Mavix bewaart alleen aantallen, nooit je teksten of klantberichten.</p>
        </div>
      </div>
      <div className="account-panel-body ai-usage">
        {error ? (
          <p className="field-note">{error}</p>
        ) : !usage ? (
          <p className="field-note" role="status">
            Laden…
          </p>
        ) : (
          <>
            {!usage.configured && <p className="field-note">AI is nog niet geconfigureerd op de server. Er worden geen AI-verzoeken uitgevoerd.</p>}
            <div>
              <div className={"ai-usage-meter" + (pct >= 85 ? " is-high" : "")} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Gebruik van het maandtegoed">
                <span style={{ width: pct + "%" }} />
              </div>
              <p className="field-note">
                {nf.format(usage.tokens)} van {nf.format(usage.limit)} tokens gebruikt ({pct}%). Het tegoed begint elke maand opnieuw.
              </p>
            </div>
            <dl className="ai-usage-stats">
              <div>
                <dt>Verzoeken</dt>
                <dd>{nf.format(usage.requests)}</dd>
              </div>
              <div>
                <dt>Mislukt</dt>
                <dd>{nf.format(usage.failed)}</dd>
              </div>
              <div>
                <dt>Geschatte kosten</dt>
                <dd>{usage.pricesConfigured ? "$" + (usage.costMicroUsd / 1_000_000).toFixed(2) : "—"}</dd>
              </div>
            </dl>
            {!usage.pricesConfigured && <p className="field-note">Kosten worden pas berekend als de tokenprijzen op de server zijn ingesteld.</p>}
            {Object.keys(usage.byFeature).length > 0 && (
              <ul className="ai-usage-features">
                {Object.entries(usage.byFeature)
                  .sort((a, b) => b[1].tokens - a[1].tokens)
                  .map(([f, v]) => (
                    <li key={f}>
                      <span>{FEATURE[f] || f}</span>
                      <span>
                        {nf.format(v.requests)} × · {nf.format(v.tokens)} tokens
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
