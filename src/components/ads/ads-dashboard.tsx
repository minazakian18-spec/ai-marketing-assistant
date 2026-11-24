"use client";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Copy, Loader2, MousePointerClick, Percent, RefreshCw, Sparkles, Target, Wallet, Check, TrendingUp } from "lucide-react";

// Google Ads overview with real numbers (GET /api/integrations/google_ads/report)
// and AI proposals (POST .../advice). Read-only: Mavix never changes campaigns.
type T = { cost: number; clicks: number; impressions: number; conversions: number; value: number };
type Report = {
  account: { id: string; name: string; currency: string };
  period: { from: string; to: string };
  current: T;
  previous: T;
  weeks: ({ week: string } & T)[];
  campaigns: ({ id: string; name: string; status: string; type: string; dailyBudget: number } & T)[];
  searchTerms: ({ term: string } & T)[];
};
type Advice = {
  summary: string;
  insights: { title: string; detail: string }[];
  actions: { title: string; why: string; impact: "hoog" | "middel" | "laag"; campaign: string }[];
  ad_copy: { headlines: string[]; descriptions: string[] };
  keywords: { add: string[]; negative: string[] };
  missing_data: string[];
};
const BASE = "/api/integrations/google_ads/";
const STATUS: Record<string, string> = { ENABLED: "Actief", PAUSED: "Gepauzeerd", REMOVED: "Verwijderd" };
const TYPE: Record<string, string> = { SEARCH: "Zoeken", PERFORMANCE_MAX: "Performance Max", DISPLAY: "Display", VIDEO: "Video", SHOPPING: "Shopping", LOCAL: "Lokaal", SMART: "Slim", DEMAND_GEN: "Demand Gen" };

const date = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "short" });

export function AdsDashboard() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [thinking, setThinking] = useState(false);
  const [adviceError, setAdviceError] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const r = await fetch(BASE + "report", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) return setError(d.error || "De cijfers uit Google Ads konden niet worden geladen.");
    setReport(d);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function ask() {
    setThinking(true);
    setAdviceError("");
    const r = await fetch(BASE + "advice", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: "{}" });
    const d = await r.json().catch(() => ({}));
    setThinking(false);
    if (!r.ok) return setAdviceError(d.error || "Mavix kon nu geen voorstellen maken. Probeer het later opnieuw.");
    setAdvice(d.advice);
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(""), 1500);
    });
  }

  if (error)
    return (
      <section className="ads-card">
        <p role="alert" className="ads-connect-error">
          {error}
        </p>
        <button type="button" className="button secondary" onClick={() => void load()}>
          <RefreshCw size={14} aria-hidden="true" /> Opnieuw proberen
        </button>
      </section>
    );
  if (!report)
    return (
      <section className="ads-card" aria-busy="true">
        <p className="ads-connect-note">
          <Loader2 size={14} className="int-spin" aria-hidden="true" /> Cijfers ophalen uit Google Ads…
        </p>
      </section>
    );

  const money = new Intl.NumberFormat("nl-NL", { style: "currency", currency: report.account.currency || "EUR" });
  const n = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 });
  const c = report.current, p = report.previous;
  const ratio = (a: number, b: number) => (b ? a / b : 0);
  const kpis: { icon: typeof Wallet; label: string; now: number; before: number; fmt: (v: number) => string; lowerIsBetter?: boolean }[] = [
    { icon: Wallet, label: "Uitgaven", now: c.cost, before: p.cost, fmt: money.format },
    { icon: MousePointerClick, label: "Klikken", now: c.clicks, before: p.clicks, fmt: n.format },
    { icon: Percent, label: "CTR", now: ratio(c.clicks, c.impressions) * 100, before: ratio(p.clicks, p.impressions) * 100, fmt: (v) => n.format(v) + "%" },
    { icon: Target, label: "Gem. CPC", now: ratio(c.cost, c.clicks), before: ratio(p.cost, p.clicks), fmt: money.format, lowerIsBetter: true },
    { icon: Check, label: "Conversies", now: c.conversions, before: p.conversions, fmt: n.format },
    { icon: TrendingUp, label: "Kosten per conversie", now: ratio(c.cost, c.conversions), before: ratio(p.cost, p.conversions), fmt: money.format, lowerIsBetter: true },
  ];
  const maxWeek = Math.max(1, ...report.weeks.map((w) => w.cost));
  const noSpend = c.cost === 0 && c.impressions === 0;

  return (
    <>
      <section className="ads-card" aria-labelledby="ads-results">
        <div className="ads-section-head">
          <div>
            <h2 id="ads-results">Resultaten</h2>
            <p>
              {report.account.name || "Google Ads"} · {date(report.period.from)} t/m {date(report.period.to)}, vergeleken met de 30 dagen ervoor. Bron: Google Ads.
            </p>
          </div>
          <button type="button" className="button secondary" disabled={loading} onClick={() => void load()}>
            <RefreshCw size={14} aria-hidden="true" className={loading ? "int-spin" : ""} /> Vernieuwen
          </button>
        </div>
        {noSpend && <p className="ads-connect-note">Er liep de afgelopen 30 dagen geen advertentie in dit account. Vraag Mavix hieronder om een startplan.</p>}
        <div className="ads-kpis ads-kpis-live">
          {kpis.map((k) => {
            const pct = k.before ? Math.round(((k.now - k.before) / k.before) * 100) : null;
            const good = pct === null || pct === 0 ? null : k.lowerIsBetter ? pct < 0 : pct > 0;
            return (
              <div key={k.label}>
                <span>
                  <k.icon size={13} aria-hidden="true" /> {k.label}
                </span>
                <strong>{k.fmt(k.now)}</strong>
                <em className={good === null ? "" : good ? "is-good" : "is-bad"}>{pct === null ? "geen vorige periode" : (pct > 0 ? "+" : "") + pct + "% t.o.v. ervoor"}</em>
              </div>
            );
          })}
        </div>
        {report.weeks.length > 0 && (
          <div className="ads-chart">
            <span className="ads-chart-label">Uitgaven per week (laatste 12 weken)</span>
            <div className="ads-chart-bars">
              {report.weeks.map((w) => (
                <i key={w.week} style={{ height: Math.max(2, (w.cost / maxWeek) * 100) + "%" }} title={`Week van ${date(w.week)}: ${money.format(w.cost)}, ${w.clicks} klikken, ${n.format(w.conversions)} conversies`} />
              ))}
            </div>
          </div>
        )}
      </section>

      {report.campaigns.length > 0 && (
        <section className="ads-card" aria-labelledby="ads-campaigns">
          <div className="ads-section-head">
            <div>
              <h2 id="ads-campaigns">Campagnes</h2>
              <p>Laatste 30 dagen, gesorteerd op uitgaven.</p>
            </div>
          </div>
          <div className="ads-table-scroll">
            <table className="ads-live-table">
              <thead>
                <tr>
                  <th scope="col">Campagne</th>
                  <th scope="col">Status</th>
                  <th scope="col">Uitgaven</th>
                  <th scope="col">Klikken</th>
                  <th scope="col">CTR</th>
                  <th scope="col">CPC</th>
                  <th scope="col">Conversies</th>
                  <th scope="col">Kosten/conv.</th>
                </tr>
              </thead>
              <tbody>
                {report.campaigns.map((x) => (
                  <tr key={x.id}>
                    <th scope="row">
                      {x.name}
                      <small>{TYPE[x.type] || x.type}{x.dailyBudget ? ` · budget ${money.format(x.dailyBudget)}/dag` : ""}</small>
                    </th>
                    <td>{STATUS[x.status] || x.status}</td>
                    <td>{money.format(x.cost)}</td>
                    <td>{n.format(x.clicks)}</td>
                    <td>{x.impressions ? n.format((x.clicks / x.impressions) * 100) + "%" : "—"}</td>
                    <td>{x.clicks ? money.format(x.cost / x.clicks) : "—"}</td>
                    <td>{n.format(x.conversions)}</td>
                    <td>{x.conversions ? money.format(x.cost / x.conversions) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {report.searchTerms.length > 0 && (
        <section className="ads-card" aria-labelledby="ads-terms">
          <div className="ads-section-head">
            <div>
              <h2 id="ads-terms">Waar mensen op zochten</h2>
              <p>De zoekopdrachten die tot klikken leidden, laatste 30 dagen.</p>
            </div>
          </div>
          <div className="ads-table-scroll">
            <table className="ads-live-table">
              <thead>
                <tr>
                  <th scope="col">Zoekterm</th>
                  <th scope="col">Klikken</th>
                  <th scope="col">Uitgaven</th>
                  <th scope="col">Conversies</th>
                </tr>
              </thead>
              <tbody>
                {report.searchTerms.map((t) => (
                  <tr key={t.term}>
                    <th scope="row">{t.term}</th>
                    <td>{n.format(t.clicks)}</td>
                    <td>{money.format(t.cost)}</td>
                    <td>{n.format(t.conversions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="ads-card ads-advice" aria-labelledby="ads-advice">
        <div className="ads-section-head">
          <div>
            <h2 id="ads-advice">
              <Sparkles size={17} aria-hidden="true" /> Voorstellen van Mavix
            </h2>
            <p>Op basis van deze cijfers en je Brand Hub. Het zijn voorstellen: Mavix wijzigt niets in Google Ads.</p>
          </div>
          <button type="button" className="button primary" disabled={thinking} onClick={() => void ask()}>
            {thinking ? <Loader2 size={15} className="int-spin" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
            {thinking ? "Mavix analyseert…" : advice ? "Opnieuw analyseren" : "Maak voorstellen"}
          </button>
        </div>
        {adviceError && (
          <p role="alert" className="ads-connect-error">
            {adviceError}
          </p>
        )}
        {advice && (
          <div className="ads-advice-body">
            {advice.summary && <p className="ads-advice-summary">{advice.summary}</p>}
            {advice.actions.length > 0 && (
              <>
                <h3>Wat je nu kunt doen</h3>
                <ol className="ads-actions">
                  {advice.actions.map((a) => (
                    <li key={a.title}>
                      <span className={"ads-impact is-" + a.impact}>{a.impact === "hoog" ? "Grote impact" : a.impact === "middel" ? "Middel" : "Klein"}</span>
                      <strong>{a.title}</strong>
                      {a.campaign && <small>Campagne: {a.campaign}</small>}
                      <span>{a.why}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
            {advice.insights.length > 0 && (
              <>
                <h3>Wat opvalt</h3>
                <ul className="ads-insights">
                  {advice.insights.map((i) => (
                    <li key={i.title}>
                      <strong>{i.title}</strong> {i.detail}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {(advice.ad_copy.headlines.length > 0 || advice.ad_copy.descriptions.length > 0) && (
              <>
                <h3>Advertentieteksten om te testen</h3>
                <ul className="ads-copy">
                  {[...advice.ad_copy.headlines.map((h) => ["Kop", h]), ...advice.ad_copy.descriptions.map((d) => ["Beschrijving", d])].map(([kind, text]) => (
                    <li key={kind + text}>
                      <small>
                        {kind} · {text.length} tekens
                      </small>
                      <span>{text}</span>
                      <button type="button" className="ads-copy-btn" aria-label={"Kopieer: " + text} onClick={() => copy(text)}>
                        {copied === text ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {(advice.keywords.add.length > 0 || advice.keywords.negative.length > 0) && (
              <div className="ads-keywords">
                {advice.keywords.add.length > 0 && (
                  <div>
                    <h3>Zoekwoorden om toe te voegen</h3>
                    <p className="ads-chips">{advice.keywords.add.map((k) => <span key={k}>{k}</span>)}</p>
                  </div>
                )}
                {advice.keywords.negative.length > 0 && (
                  <div>
                    <h3>Uitsluiten (negatieve zoekwoorden)</h3>
                    <p className="ads-chips is-negative">{advice.keywords.negative.map((k) => <span key={k}>{k}</span>)}</p>
                  </div>
                )}
              </div>
            )}
            {advice.missing_data.length > 0 && (
              <div className="ads-missing">
                <AlertTriangle size={15} aria-hidden="true" />
                <div>
                  <strong>Voor beter advies</strong>
                  <ul>
                    {advice.missing_data.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
