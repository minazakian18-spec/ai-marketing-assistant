"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Lock, RotateCcw } from "lucide-react";
import { MaviAvatar } from "@/components/mavi";
import { useWorkspace } from "@/components/workspace-provider";
import { isBrowserDemo } from "@/lib/demo";
import { analyze } from "@/lib/research/rules";
import { answerFromReport, buildReport, nextEligibleAt, periodLabel, researchPeriod } from "@/lib/research/report";
import { businessKindOf, contentFacts, emailFacts, profileFacts } from "@/lib/research/extract";
import { RESEARCH_STAGES, type ResearchReport } from "@/lib/research/types";
import { ResearchReportView } from "./research-report";

type State = {
  period: string;
  nextEligibleAt: string;
  canRun: boolean;
  current: null | { id: string; status: "running" | "completed" | "failed"; stage: string | null; report: ResearchReport | null; error: string | null };
  history: { id: string; period: string; completedAt: string | null }[];
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init?.body ? { ...init, headers: { "Content-Type": "application/json" } } : init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Er ging iets mis. Probeer het opnieuw.");
  return d as T;
}
const dateLong = (iso: string) => new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" });

// "Onderzoek mijn restaurant": one button, one clear monthly report.
export function ResearchSection() {
  const { data } = useWorkspace();
  const [demo, setDemo] = useState(false);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [viewing, setViewing] = useState<{ id: string; report: ResearchReport } | null>(null);
  const [demoReport, setDemoReport] = useState<ResearchReport | null>(null);

  const kind = businessKindOf(data.profile.industry || "", data.profile.description || "");
  const label = kind === "restaurant" ? "Onderzoek mijn restaurant" : "Onderzoek mijn bedrijf";

  const load = useCallback(async () => {
    try {
      const s = await api<State>("/api/research");
      setState(s);
      setError("");
      return s;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Het onderzoek kon niet worden geladen.");
      return null;
    }
  }, []);

  useEffect(() => {
    const d = isBrowserDemo();
    setDemo(d);
    if (!d) void load();
  }, [load]);

  // Poll the real stage while the server is working.
  const running = state?.current?.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => void load(), 2500);
    return () => window.clearInterval(t);
  }, [running, load]);

  async function start() {
    if (demo) {
      // Test mode: same analysis on the local example workspace, not stored.
      const profile = profileFacts(data);
      const input = {
        businessKind: businessKindOf(profile.industry, profile.description),
        collectedAt: new Date().toISOString(),
        sources: [{ id: "profile" as const, label: "Bedrijfsprofiel (Brand Hub)", status: "used" as const, note: "Voorbeeldgegevens uit de testmodus." }],
        profile,
        content: contentFacts(data),
        email: emailFacts(data),
      };
      setDemoReport(buildReport(input, analyze(input), researchPeriod()));
      return;
    }
    setStarting(true);
    setError("");
    try {
      await api("/api/research", { method: "POST", body: "{}" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Het onderzoek kon niet worden gestart.");
      void load();
    } finally {
      setStarting(false);
    }
  }

  async function openHistory(id: string) {
    try {
      const d = await api<{ id: string; report: ResearchReport }>("/api/research/" + id);
      setViewing({ id: d.id, report: d.report });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dit onderzoek kon niet worden geopend.");
    }
  }

  const ask = (id: string) => async (question: string) =>
    (await api<{ answer: string }>(`/api/research/${id}/ask`, { method: "POST", body: JSON.stringify({ question }) })).answer;

  const current = state?.current;
  const completed = current?.status === "completed" && current.report ? { id: current.id, report: current.report } : null;
  const shown = viewing || completed;
  const period = state?.period || researchPeriod();
  const next = state?.nextEligibleAt || nextEligibleAt(period);
  const earlier = (state?.history || []).filter((h) => h.id !== completed?.id);

  return (
    <section className="rs" aria-labelledby="rs-title">
      <div className="rs-intro">
        <MaviAvatar size={44} state={running ? "thinking" : "idle"} />
        <div>
          <p className="rs-eyebrow">AI-onderzoek</p>
          <h2 id="rs-title">{label}</h2>
          <p>
            Mavix onderzoekt alles wat over {kind === "restaurant" ? "je restaurant" : "je bedrijf"} beschikbaar is en vertelt je in gewone taal wat goed gaat, wat beter kan en waar je deze maand mee moet beginnen.
          </p>
        </div>
      </div>

      {error && (
        <p className="rs-error" role="alert">
          {error}
        </p>
      )}

      {demo ? (
        demoReport ? (
          <>
            <p className="rs-demo">Voorbeeld in de testmodus, alleen op basis van je voorbeeldprofiel. Met een echt account neemt Mavix ook je reviews, Google-profiel en website mee.</p>
            <ResearchReportView report={demoReport} onAsk={async (q) => answerFromReport(q, demoReport)} />
          </>
        ) : (
          <div className="rs-cta">
            <button type="button" className="button primary rs-start" onClick={() => void start()}>
              {label}
            </button>
            <p>Testmodus: je ziet een voorbeeld op basis van je voorbeeldprofiel. Er wordt niets opgeslagen.</p>
          </div>
        )
      ) : !state ? (
        !error && <p className="rs-note">Laden…</p>
      ) : running ? (
        <div className="rs-progress" role="status" aria-live="polite">
          <p className="rs-progress-title">Mavix onderzoekt {kind === "restaurant" ? "je restaurant" : "je bedrijf"}… dit duurt meestal minder dan een minuut.</p>
          <ol>
            {RESEARCH_STAGES.map((s, i) => {
              const at = RESEARCH_STAGES.findIndex((x) => x.id === current?.stage);
              const st = i < at ? "done" : i === at ? "active" : "todo";
              return (
                <li key={s.id} className={"is-" + st}>
                  <span className="rs-step">{st === "done" ? <Check size={13} /> : st === "active" ? <Loader2 size={13} className="rs-spin" /> : null}</span>
                  {s.label}
                </li>
              );
            })}
          </ol>
          <p className="rs-note">Je kunt deze pagina gerust verlaten; het onderzoek gaat door.</p>
        </div>
      ) : shown ? (
        <>
          <div className="rs-status-bar">
            <span>
              <Lock size={14} aria-hidden="true" />
              {completed && !viewing ? "Je maandelijkse onderzoek is al uitgevoerd." : `Onderzoek van ${periodLabel(shown.report.period)}.`} Het volgende onderzoek is beschikbaar vanaf {dateLong(next)}.
            </span>
            {viewing && !completed && (
              <button type="button" className="button secondary" onClick={() => setViewing(null)}>
                Terug
              </button>
            )}
            {(earlier.length > 0 || viewing) && (
              <label className="rs-history">
                <span className="sr-only">Eerder onderzoek</span>
                <select
                  value={shown.id}
                  onChange={(e) => (e.target.value === completed?.id ? setViewing(null) : void openHistory(e.target.value))}
                >
                  {completed && <option value={completed.id}>{periodLabel(completed.report.period)}</option>}
                  {earlier.map((h) => (
                    <option key={h.id} value={h.id}>
                      {periodLabel(h.period)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <ResearchReportView report={shown.report} onAsk={ask(shown.id)} />
        </>
      ) : (
        <div className="rs-cta">
          {current?.status === "failed" && (
            <p className="rs-error" role="alert">
              {current.error || "Het vorige onderzoek kon niet worden afgerond."} Je kunt het opnieuw proberen; dit telt niet als nieuw onderzoek.
            </p>
          )}
          <button type="button" className="button primary rs-start" onClick={() => void start()} disabled={starting || !state.canRun}>
            {current?.status === "failed" ? <RotateCcw size={16} /> : null}
            {starting ? "Starten…" : current?.status === "failed" ? "Opnieuw proberen" : label}
          </button>
          <p>Eén keer per maand. Je rapport blijft bewaard en kun je altijd teruglezen.</p>
          {earlier.length > 0 && (
            <p className="rs-note">
              Eerder onderzoek:{" "}
              {earlier.map((h, i) => (
                <span key={h.id}>
                  {i > 0 && ", "}
                  <button type="button" className="rs-link" onClick={() => void openHistory(h.id)}>
                    {periodLabel(h.period)}
                  </button>
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
