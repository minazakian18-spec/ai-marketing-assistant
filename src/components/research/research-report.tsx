"use client";
import { useState, type FormEvent } from "react";
import { ArrowUp, Check, CircleHelp, Database, X } from "lucide-react";
import { Mavi } from "@/components/mavi";
import { AREA_LABEL, type Area, type Finding, type FindingStatus, type ResearchReport } from "@/lib/research/types";
import { periodLabel } from "@/lib/research/report";

const STATUS: Record<FindingStatus, { label: string; Icon: typeof Check }> = {
  good: { label: "Gaat goed", Icon: Check },
  improve: { label: "Kan beter", Icon: X },
  uncertain: { label: "Onzeker", Icon: CircleHelp },
};
const PRIORITY = { high: "Hoge prioriteit", medium: "Gemiddelde prioriteit", low: "Lage prioriteit" } as const;
const AREA_ORDER: Area[] = ["reviews", "customers", "google", "website", "social", "marketing", "profile", "competitors"];
const QUESTIONS = ["Wat moet ik als eerste verbeteren?", "Welke content moet ik deze maand maken?", "Hoe krijg ik meer reviews?"];

export function StatusMark({ status, size = 22, decorative = false }: { status: FindingStatus; size?: number; decorative?: boolean }) {
  const { Icon, label } = STATUS[status];
  return (
    <span className={"rs-mark is-" + status} style={{ width: size, height: size }} title={decorative ? undefined : label} aria-hidden={decorative || undefined}>
      <Icon size={Math.round(size * 0.6)} aria-hidden="true" />
      {!decorative && <span className="sr-only">{label}</span>}
    </span>
  );
}

function FindingCard({ f }: { f: Finding }) {
  return (
    <article className={"rs-finding is-" + f.status}>
      <header>
        <StatusMark status={f.status} />
        <h4>{f.title}</h4>
        {f.priority && f.status === "improve" && <span className={"rs-priority is-" + f.priority}>{PRIORITY[f.priority]}</span>}
      </header>
      <dl>
        <div>
          <dt>Gemeten</dt>
          <dd>{f.found}</dd>
        </div>
        <div>
          <dt>Waarom belangrijk</dt>
          <dd>{f.why}</dd>
        </div>
        <div>
          <dt>{f.status === "uncertain" ? "Wat nodig is" : f.status === "good" ? "Tip" : "Wat te doen"}</dt>
          <dd>{f.action}</dd>
        </div>
      </dl>
    </article>
  );
}

export function ResearchReportView({
  report,
  onAsk,
}: {
  report: ResearchReport;
  onAsk?: (question: string) => Promise<string>;
}) {
  const [question, setQuestion] = useState("");
  const [qa, setQa] = useState<{ q: string; a: string }[]>([]);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const count = (s: FindingStatus) => report.findings.filter((f) => f.status === s).length;
  const good = report.findings.filter((f) => f.status === "good");
  const areas = AREA_ORDER.filter((a) => report.findings.some((f) => f.area === a));
  const name = report.businessName || (report.businessKind === "restaurant" ? "je restaurant" : "je bedrijf");

  async function ask(q: string, e?: FormEvent) {
    e?.preventDefault();
    if (!onAsk || q.trim().length < 3 || asking) return;
    setAsking(true);
    setAskError("");
    try {
      const a = await onAsk(q.trim());
      setQa((list) => [...list, { q: q.trim(), a }]);
      setQuestion("");
    } catch (err) {
      setAskError(err instanceof Error ? err.message : "Mavi kon de vraag niet beantwoorden.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="rs-report">
      <header className="rs-report-head">
        <p className="rs-eyebrow">Onderzoek · {periodLabel(report.period)}</p>
        <h2>Zo staat {name} ervoor</h2>
        <p className="rs-summary">{report.summary}</p>
        <div className="rs-legend" aria-label="Overzicht">
          {(["good", "improve", "uncertain"] as FindingStatus[]).map((s) => (
            <span key={s}>
              <StatusMark status={s} size={18} decorative />
              {count(s)} {STATUS[s].label.toLowerCase()}
            </span>
          ))}
        </div>
      </header>

      {report.topPriorities.length > 0 && (
        <section className="rs-top" aria-labelledby="rs-top-title">
          <h3 id="rs-top-title">{report.topPriorities.length === 1 ? "De belangrijkste verbetering voor deze maand" : `De ${report.topPriorities.length} belangrijkste dingen om deze maand te verbeteren`}</h3>
          <ol>
            {report.topPriorities.map((t, i) => (
              <li key={t.findingId}>
                <span className="rs-top-n">{i + 1}</span>
                <div>
                  <strong>{t.title}</strong>
                  <p>{t.action}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {good.length > 0 && (
        <section className="rs-block">
          <h3>Wat goed gaat</h3>
          <ul className="rs-bullets">
            {good.map((f) => (
              <li key={f.id}>
                <StatusMark status="good" size={18} />
                <span>
                  <strong>{f.title}.</strong> {f.found}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {areas.map((a) => (
        <section className="rs-block" key={a}>
          <h3>{AREA_LABEL[a]}</h3>
          <div className="rs-findings">
            {report.findings
              .filter((f) => f.area === a)
              .map((f) => (
                <FindingCard key={f.id} f={f} />
              ))}
          </div>
        </section>
      ))}

      {report.plan.length > 0 && (
        <section className="rs-block">
          <h3>Actieplan voor de komende 30 dagen</h3>
          <ol className="rs-plan">
            {report.plan.map((w) => (
              <li key={w.week}>
                <span className="rs-week">Week {w.week}</span>
                <div>
                  <strong>{w.title}</strong>
                  <ul>
                    {w.actions.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="rs-block rs-sources">
        <h3>
          <Database size={15} aria-hidden="true" /> Waar dit onderzoek op is gebaseerd
        </h3>
        <ul>
          {report.sources
            .filter((s) => s.status === "used")
            .map((s) => (
              <li key={s.id}>
                <StatusMark status="good" size={16} />
                <span>
                  <strong>{s.label}</strong> — {s.note}
                </span>
              </li>
            ))}
        </ul>
        {report.notResearched.length > 0 && (
          <>
            <h4>Nog niet onderzocht</h4>
            <ul>
              {report.notResearched.map((s) => (
                <li key={s.label}>
                  <StatusMark status="uncertain" size={16} />
                  <span>
                    <strong>{s.label}</strong> — {s.reason}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="rs-note">
          Gemeten gegevens komen rechtstreeks uit je gekoppelde bronnen. &ldquo;Waarom belangrijk&rdquo; en de adviezen zijn de interpretatie van Mavix.
          {report.summarySource === "ai" ? " De samenvatting is geschreven door Mavi op basis van deze bevindingen." : ""}
        </p>
      </section>

      {onAsk && (
        <section className="rs-block rs-ask" aria-labelledby="rs-ask-title">
          <h3 id="rs-ask-title">
            <Mavi size={16} /> Vraag Mavi over dit onderzoek
          </h3>
          {qa.map((x, i) => (
            <div className="rs-qa" key={i}>
              <p className="rs-q">{x.q}</p>
              <p className="rs-a">{x.a}</p>
            </div>
          ))}
          {!qa.length && (
            <div className="rs-suggest">
              {QUESTIONS.map((q) => (
                <button key={q} type="button" onClick={() => void ask(q)} disabled={asking}>
                  {q}
                </button>
              ))}
            </div>
          )}
          <form className="rs-ask-form" onSubmit={(e) => void ask(question, e)}>
            <label className="sr-only" htmlFor="rs-question">
              Vraag over het onderzoek
            </label>
            <input id="rs-question" value={question} maxLength={500} placeholder="Bijvoorbeeld: waarom scoort mijn website slecht?" onChange={(e) => setQuestion(e.target.value)} />
            <button type="submit" className="composer-send" aria-label="Vraag stellen" disabled={asking || question.trim().length < 3}>
              <ArrowUp size={16} />
            </button>
          </form>
          {asking && <p className="rs-note">Mavi denkt na…</p>}
          {askError && (
            <p className="rs-error" role="alert">
              {askError}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
