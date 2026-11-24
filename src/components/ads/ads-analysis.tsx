"use client";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, Copy, Flag, Gauge, Lightbulb, ListChecks, Map, Target, Wallet } from "lucide-react";

// The Google Ads analysis as a guided route: 1 Overzicht, 2 Conclusies,
// 3 Voorstellen (several at once, each with idea, goal, steps, budget and
// measurement), 4 Teksten en zoekwoorden, 5 Stappenplan. Server:
// src/lib/server/ads-advice.ts. Proposals only; nothing changes in Google Ads.
export type AdsAdvice = {
  summary: string;
  health: { score: number; label: string; explanation: string };
  conclusions: { title: string; explanation: string; evidence: string; verdict: "goed" | "let op" | "probleem" }[];
  proposals: {
    title: string;
    kind: "nieuw" | "aanpassen" | "stoppen" | "testen" | "meten";
    campaign: string;
    idea: string;
    goal: string;
    kpi: string;
    steps: string[];
    budget: { daily_min: number; daily_recommended: number; monthly: number; reasoning: string };
    expected: string;
    timeframe: string;
    measure: string;
    risk: string;
    impact: "hoog" | "middel" | "laag";
    effort: "laag" | "middel" | "hoog";
  }[];
  roadmap: { when: string; what: string }[];
  ad_copy: { headlines: string[]; descriptions: string[] };
  keywords: { add: string[]; negative: string[] };
  missing_data: string[];
};

const KIND: Record<string, string> = { nieuw: "Nieuwe campagne", aanpassen: "Aanpassen", stoppen: "Stoppen", testen: "Testen", meten: "Meting" };
const STEPS = ["Overzicht", "Conclusies", "Voorstellen", "Teksten en zoekwoorden", "Stappenplan"] as const;

export function AdsAnalysis({ advice, currency }: { advice: AdsAdvice; currency: string }) {
  const [step, setStep] = useState(0);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const [copied, setCopied] = useState("");
  const money = new Intl.NumberFormat("nl-NL", { style: "currency", currency: currency || "EUR" });
  const totalDaily = advice.proposals.reduce((s, p) => s + p.budget.daily_recommended, 0);

  function copy(text: string) {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(""), 1500);
    });
  }

  const sections = [
    // 1. Overview
    <div key="0" className="aa-overview">
      <div className={"aa-health " + (advice.health.score >= 70 ? "is-good" : advice.health.score >= 45 ? "is-mid" : "is-bad")}>
        <Gauge size={18} aria-hidden="true" />
        <strong>{advice.health.score}/100</strong>
        <span>{advice.health.label}</span>
      </div>
      <div>
        <p className="ads-advice-summary">{advice.summary}</p>
        {advice.health.explanation && <p className="aa-muted">{advice.health.explanation}</p>}
        <ul className="aa-glance">
          <li>
            <strong>{advice.conclusions.filter((c) => c.verdict === "probleem").length}</strong> problemen
          </li>
          <li>
            <strong>{advice.conclusions.filter((c) => c.verdict === "let op").length}</strong> aandachtspunten
          </li>
          <li>
            <strong>{advice.conclusions.filter((c) => c.verdict === "goed").length}</strong> wat goed werkt
          </li>
          <li>
            <strong>{advice.proposals.length}</strong> voorstellen
          </li>
        </ul>
      </div>
    </div>,
    // 2. Conclusions
    <ul key="1" className="ads-conclusions">
      {advice.conclusions.map((c) => (
        <li key={c.title} className={"is-" + c.verdict.replace(" ", "-")}>
          <span className="ads-verdict">{c.verdict === "goed" ? "Werkt goed" : c.verdict === "probleem" ? "Probleem" : "Let op"}</span>
          <strong>{c.title}</strong>
          <span>{c.explanation}</span>
          {c.evidence && <small>Onderbouwing: {c.evidence}</small>}
        </li>
      ))}
    </ul>,
    // 3. Proposals: several side by side, each expandable into a full plan.
    <div key="2" className="aa-proposals">
      {totalDaily > 0 && (
        <p className="aa-muted">
          Alle voorstellen samen: ongeveer <strong>{money.format(totalDaily)}</strong> per dag, <strong>{money.format(totalDaily * 30.4)}</strong> per maand (schatting, aanbevolen budgetten opgeteld).
        </p>
      )}
      <div className="aa-cards">
        {advice.proposals.map((p, i) => {
          const expanded = all || open === i;
          return (
            <article key={p.title} className={"aa-card" + (expanded ? " is-open" : "")}>
              <header>
                <div className="aa-tags">
                  <span className={"ads-impact is-" + p.impact}>{p.impact === "hoog" ? "Grote impact" : p.impact === "middel" ? "Middel" : "Klein"}</span>
                  <span className="aa-tag">{KIND[p.kind]}</span>
                  <span className="aa-tag">Moeite: {p.effort}</span>
                </div>
                <h4>
                  {i + 1}. {p.title}
                </h4>
                {p.campaign && <small>Campagne: {p.campaign}</small>}
                <dl className="aa-key">
                  <div>
                    <dt>
                      <Target size={13} aria-hidden="true" /> Doel
                    </dt>
                    <dd>{p.goal}</dd>
                  </div>
                  <div>
                    <dt>
                      <Wallet size={13} aria-hidden="true" /> Budget
                    </dt>
                    <dd>
                      {p.budget.daily_recommended > 0 ? (
                        <>
                          {money.format(p.budget.daily_recommended)}/dag <span className="aa-muted">(min. {money.format(p.budget.daily_min)}, ≈ {money.format(p.budget.monthly)}/maand)</span>
                        </>
                      ) : (
                        "Geen extra budget"
                      )}
                    </dd>
                  </div>
                </dl>
              </header>
              {expanded && (
                <div className="aa-detail">
                  <section>
                    <h5>
                      <Lightbulb size={14} aria-hidden="true" /> Het idee erachter
                    </h5>
                    <p>{p.idea}</p>
                  </section>
                  {p.kpi && (
                    <section>
                      <h5>
                        <Flag size={14} aria-hidden="true" /> Meetbaar doel
                      </h5>
                      <p>{p.kpi}</p>
                    </section>
                  )}
                  {p.steps.length > 0 && (
                    <section>
                      <h5>
                        <ListChecks size={14} aria-hidden="true" /> Zo doe je het
                      </h5>
                      <ol className="aa-steps">
                        {p.steps.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ol>
                    </section>
                  )}
                  {p.budget.reasoning && (
                    <section>
                      <h5>
                        <Wallet size={14} aria-hidden="true" /> Waarom dit budget
                      </h5>
                      <p>{p.budget.reasoning}</p>
                    </section>
                  )}
                  <div className="aa-grid">
                    {p.expected && (
                      <section>
                        <h5>Verwacht effect (schatting)</h5>
                        <p>{p.expected}</p>
                      </section>
                    )}
                    {p.timeframe && (
                      <section>
                        <h5>Wanneer beoordelen</h5>
                        <p>{p.timeframe}</p>
                      </section>
                    )}
                    {p.measure && (
                      <section>
                        <h5>Hoe je het meet</h5>
                        <p>{p.measure}</p>
                      </section>
                    )}
                    {p.risk && (
                      <section>
                        <h5>Risico</h5>
                        <p>{p.risk}</p>
                      </section>
                    )}
                  </div>
                </div>
              )}
              {!all && (
                <button type="button" className="aa-toggle" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : i)}>
                  {expanded ? "Minder tonen" : "Bekijk het plan"} <ChevronDown size={14} aria-hidden="true" className={expanded ? "is-flipped" : ""} />
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>,
    // 4. Copy and keywords
    <div key="3" className="aa-copy">
      {(advice.ad_copy.headlines.length > 0 || advice.ad_copy.descriptions.length > 0) && (
        <>
          <h4>Advertentieteksten om te testen</h4>
          <ul className="ads-copy">
            {[...advice.ad_copy.headlines.map((h) => ["Kop", h, 30] as const), ...advice.ad_copy.descriptions.map((d) => ["Beschrijving", d, 90] as const)].map(([kind, text, max]) => (
              <li key={kind + text}>
                <small>
                  {kind} · {text.length}/{max} tekens
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
      <div className="ads-keywords">
        {advice.keywords.add.length > 0 && (
          <div>
            <h4>Zoekwoorden om te testen</h4>
            <p className="ads-chips">{advice.keywords.add.map((k) => <span key={k}>{k}</span>)}</p>
          </div>
        )}
        {advice.keywords.negative.length > 0 && (
          <div>
            <h4>Uitsluiten (negatieve zoekwoorden)</h4>
            <p className="ads-chips is-negative">{advice.keywords.negative.map((k) => <span key={k}>{k}</span>)}</p>
            <button type="button" className="button secondary aa-copy-all" onClick={() => copy(advice.keywords.negative.join("\n"))}>
              {copied === advice.keywords.negative.join("\n") ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} Kopieer lijst voor Google Ads
            </button>
          </div>
        )}
      </div>
    </div>,
    // 5. Roadmap
    <div key="4" className="aa-roadmap">
      <ol>
        {advice.roadmap.map((r) => (
          <li key={r.when + r.what}>
            <strong>{r.when}</strong>
            <span>{r.what}</span>
          </li>
        ))}
      </ol>
      {advice.missing_data.length > 0 && (
        <div className="ads-missing">
          <AlertTriangle size={15} aria-hidden="true" />
          <div>
            <strong>Voor nog beter advies</strong>
            <ul>
              {advice.missing_data.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>,
  ];

  return (
    <div className="aa">
      <div className="aa-bar">
        <ol className="aa-stepper" aria-label="Stappen van de analyse">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" aria-current={!all && step === i ? "step" : undefined} className={i < step && !all ? "is-done" : ""} onClick={() => (setAll(false), setStep(i))}>
                <span>{i < step && !all ? <Check size={12} aria-hidden="true" /> : i + 1}</span>
                {s}
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="button secondary" onClick={() => setAll((v) => !v)}>
          <Map size={14} aria-hidden="true" /> {all ? "Stap voor stap" : "Alles tonen"}
        </button>
      </div>

      {all ? (
        STEPS.map((s, i) => (
          <section key={s} className="aa-section">
            <h3>
              {i + 1}. {s}
            </h3>
            {sections[i]}
          </section>
        ))
      ) : (
        <section className="aa-section" aria-live="polite">
          <h3>
            Stap {step + 1} van {STEPS.length}: {STEPS[step]}
          </h3>
          {sections[step]}
          <div className="aa-nav">
            <button type="button" className="button secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft size={14} aria-hidden="true" /> Vorige
            </button>
            {step < STEPS.length - 1 && (
              <button type="button" className="button primary" onClick={() => setStep((s) => s + 1)}>
                Volgende: {STEPS[step + 1]} <ArrowRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
