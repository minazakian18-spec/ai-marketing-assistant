"use client";
import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import { Mavi } from "@/components/mavi";
import { CATEGORY_LABEL } from "@/lib/seo/checks";
import { KIND_LABEL, classifyPage } from "@/lib/seo/classify";
import type { CheckChange } from "@/lib/seo/compare";
import type { CheckResult, Recommendation, Severity, StoredPage } from "@/lib/seo/types";
import { CopyButton, pathOf } from "./seo-parts";

// SEO action plan: the recommendations of the latest analysis, highest
// priority first, with the team's own status per item and what the analysis
// itself observed compared with the previous one. A status is a note: only a
// new analysis can show that a problem is really gone.

export type TaskStatus = "todo" | "in_progress" | "resolved" | "ignored";
export type Tasks = { available: boolean; tasks: Record<string, { status: TaskStatus; updatedAt: string }> };

const SEVERITY_LABEL: Record<Severity, string> = { critical: "Kritiek", high: "Hoog", medium: "Gemiddeld", low: "Laag" };
const SEVERITY_HINT: Record<Severity, string> = {
  critical: "Los dit eerst op: dit kan je vindbaarheid ernstig schaden.",
  high: "Grote invloed op je vindbaarheid of bezoekers.",
  medium: "Merkbare verbetering als je dit oplost.",
  low: "Kleine verbetering, handig om mee te nemen.",
};
const STATUS_LABEL: Record<TaskStatus, string> = { todo: "Te doen", in_progress: "Bezig", resolved: "Opgelost", ignored: "Genegeerd" };
const CHANGE_LABEL: Partial<Record<CheckChange, string>> = { new: "Nieuw sinds vorige analyse", worse: "Verslechterd", improved: "Verbeterd, nog niet opgelost" };
const KIND_TEXT = { title: "titel", description: "metabeschrijving", structure: "kopstructuur" } as const;
const LENGTH = { title: [30, 60], description: [70, 160] } as const;

function asText(r: Recommendation) {
  return [r.problem, "", "Waarom: " + r.why, "Actie: " + r.action, "", ...r.guidance.map((g) => "- " + g), ...(r.urls.length ? ["", "Pagina's:", ...r.urls] : [])].join("\n");
}

function lengthNote(kind: "title" | "description", text: string) {
  const [min, max] = LENGTH[kind];
  const n = text.length;
  return n < min ? { ok: false, text: `${n} tekens · kort (richtlijn ${min}-${max})` } : n > max ? { ok: false, text: `${n} tekens · lang, kan worden afgekapt` } : { ok: true, text: `${n} tekens · goede lengte` };
}

function Suggestions({ scanId, rec, keyword }: { scanId: string; rec: Recommendation; keyword: string }) {
  const [url, setUrl] = useState(rec.urls[0] || "");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  if (!rec.suggest || !rec.urls.length) return null;
  const kind = rec.suggest;
  async function run() {
    setBusy(true);
    setError("");
    setItems(null);
    try {
      const r = await fetch(`/api/seo/scans/${scanId}/suggest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, kind }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Mavix kon geen voorstel maken.");
      setItems(d.suggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mavix kon geen voorstel maken.");
    } finally {
      setBusy(false);
    }
  }
  const kw = keyword.trim().toLowerCase();
  return (
    <div className="seo-suggest">
      <div className="seo-suggest-head">
        <Mavi size={16} state={busy ? "thinking" : "idle"} />
        <span>
          Laat Mavix {kind === "structure" ? "een betere kopstructuur" : `drie alternatieven voor de ${KIND_TEXT[kind]}`} voorstellen, op basis van de pagina en je Brand Hub
        </span>
      </div>
      <div className="seo-suggest-row">
        {rec.urls.length > 1 && (
          <select value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Pagina">
            {rec.urls.map((u) => (
              <option key={u} value={u}>
                {pathOf(u)}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="button secondary" onClick={() => void run()} disabled={busy}>
          {busy ? "Bezig…" : items ? "Nieuwe voorstellen" : "Voorstellen"}
        </button>
      </div>
      {error && (
        <p className="seo-error" role="alert">
          {error}
        </p>
      )}
      {items && (
        <ul className="seo-suggest-list">
          {(kind === "structure" ? [items.join("\n")] : items).map((s, i) => {
            const len = kind !== "structure" ? lengthNote(kind, s) : null;
            const hasKw = kw && kind !== "structure" ? s.toLowerCase().includes(kw) : null;
            return (
              <li key={i}>
                <pre>{s}</pre>
                <span className="seo-suggest-meta">
                  {len && <span className={len.ok ? "is-ok" : "is-warn"}>{len.text}</span>}
                  {hasKw !== null && <span className={hasKw ? "is-ok" : ""}>{hasKw ? "bevat je zoekwoord" : "zonder je zoekwoord"}</span>}
                </span>
                <CopyButton text={s} small />
              </li>
            );
          })}
        </ul>
      )}
      {items && <p className="seo-note">Dit zijn voorstellen: Mavix past je website niet zelf aan. Kopieer de tekst, plak hem in je websitebouwer en start daarna een nieuwe analyse.</p>}
    </div>
  );
}

type Props = {
  scanId: string;
  items: Recommendation[];
  checks: CheckResult[];
  pages: StoredPage[];
  homeUrl: string;
  keyword: string;
  changes: Record<string, CheckChange> | null;
  tasks: Tasks | null;
  canRescan: boolean;
  onStatus: (checkId: string, status: TaskStatus) => void;
  onRescan: () => void;
};

export function Recommendations({ scanId, items, checks, pages, homeUrl, keyword, changes, tasks, canRescan, onStatus, onRescan }: Props) {
  const [filter, setFilter] = useState<"open" | "all" | Severity>("open");
  const [open, setOpen] = useState<string | null>(items[0]?.id || null);
  const statusOf = (id: string): TaskStatus => tasks?.tasks[id]?.status || "todo";
  const kindOf = useMemo(() => {
    const m = new Map(pages.map((p) => [p.url, classifyPage(p, homeUrl)]));
    return (url: string) => m.get(url);
  }, [pages, homeUrl]);
  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const r of items) c[r.severity]++;
    return c;
  }, [items]);
  // Ignored items move to the end; otherwise the analysis order (severity, weight) stays.
  const ordered = useMemo(() => [...items].sort((a, b) => Number(statusOf(a.id) === "ignored") - Number(statusOf(b.id) === "ignored")), [items, tasks]); // eslint-disable-line react-hooks/exhaustive-deps
  const isOpen = (r: Recommendation) => !["resolved", "ignored"].includes(statusOf(r.id));
  const shown = ordered.filter((r) => (filter === "all" ? true : filter === "open" ? isOpen(r) : r.severity === filter));
  const fixed = changes ? checks.filter((c) => changes[c.id] === "fixed") : [];

  return (
    <div className="seo-recs">
      {fixed.length > 0 && (
        <div className="seo-fixed" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <div>
            <strong>Opgelost volgens deze analyse</strong>
            <p>{fixed.map((c) => c.label).join(" · ")}</p>
          </div>
        </div>
      )}
      {!items.length ? (
        <div className="seo-empty">
          <strong>Geen verbeterpunten gevonden</strong>
          <p>Alle gemeten onderdelen zijn in orde. Controleer je website opnieuw na een grote wijziging.</p>
        </div>
      ) : (
        <>
          <div className="seo-recs-toolbar">
            <div className="seo-chips" role="group" aria-label="Filter">
              <button type="button" aria-pressed={filter === "open"} onClick={() => setFilter("open")}>
                Open <span>{items.filter(isOpen).length}</span>
              </button>
              <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
                Alles <span>{items.length}</span>
              </button>
              {(Object.keys(counts) as Severity[]).map((s) =>
                counts[s] ? (
                  <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)} className={"is-" + s}>
                    {SEVERITY_LABEL[s]} <span>{counts[s]}</span>
                  </button>
                ) : null,
              )}
            </div>
            {canRescan && (
              <button type="button" className="button secondary" onClick={onRescan}>
                <RefreshCw size={14} aria-hidden="true" /> Opnieuw controleren
              </button>
            )}
          </div>
          {tasks && !tasks.available && <p className="seo-note">Status bijhouden is binnenkort beschikbaar. De aanbevelingen zelf werken al.</p>}
          {!shown.length && (
            <div className="seo-empty">
              <strong>Niets meer open in deze selectie</strong>
              <p>Alles is opgepakt of genegeerd. Start een nieuwe analyse om te controleren of de problemen echt zijn verdwenen.</p>
            </div>
          )}
          <ol className="seo-rec-list">
            {shown.map((r) => {
              const expanded = open === r.id;
              const status = statusOf(r.id);
              const change = changes?.[r.checkId];
              return (
                <li key={r.id} className={"seo-rec" + (expanded ? " is-open" : "") + (status === "ignored" ? " is-muted" : "")}>
                  <div className="seo-rec-row">
                    <button type="button" className="seo-rec-head" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : r.id)}>
                      <span className={"seo-sev is-" + r.severity} title={SEVERITY_HINT[r.severity]}>
                        {SEVERITY_LABEL[r.severity]}
                      </span>
                      <span className="seo-rec-title">
                        {r.problem}
                        <small>
                          {CATEGORY_LABEL[r.category]}
                          {r.totalUrls ? ` · ${r.totalUrls} ${r.totalUrls === 1 ? "pagina" : "pagina's"}` : ""}
                          {change && CHANGE_LABEL[change] ? <em className={"seo-change is-" + change}>{CHANGE_LABEL[change]}</em> : null}
                        </small>
                      </span>
                      <ChevronDown size={16} aria-hidden="true" className="seo-rec-chevron" />
                    </button>
                    {tasks?.available && (
                      <select className={"seo-status-select is-" + status} value={status} onChange={(e) => onStatus(r.id, e.target.value as TaskStatus)} aria-label={"Status van: " + r.problem}>
                        {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {expanded && (
                    <div className="seo-rec-body">
                      {status === "resolved" && (
                        <p className="seo-note seo-rec-flag">Je hebt dit als opgelost gemarkeerd, maar deze analyse vindt het probleem nog. Start na je aanpassing een nieuwe analyse om het te controleren.</p>
                      )}
                      <div className="seo-rec-cols">
                        <div>
                          <h4>Waarom dit belangrijk is</h4>
                          <p>{r.why}</p>
                        </div>
                        <div>
                          <h4>Wat je kunt doen</h4>
                          <p>{r.action}</p>
                        </div>
                      </div>
                      <h4>Zo pak je het aan</h4>
                      <ol className="seo-steps">
                        {r.guidance.map((g, i) => (
                          <li key={i}>{g}</li>
                        ))}
                      </ol>
                      {r.urls.length > 0 && (
                        <>
                          <h4>Betrokken pagina&apos;s{r.totalUrls > r.urls.length ? ` (eerste ${r.urls.length} van ${r.totalUrls})` : ""}</h4>
                          <ul className="seo-urls">
                            {r.urls.map((u) => {
                              const k = kindOf(u);
                              return (
                                <li key={u}>
                                  <a href={u} target="_blank" rel="noopener noreferrer nofollow">
                                    {pathOf(u)}
                                    <ExternalLink size={12} aria-hidden="true" />
                                  </a>
                                  {k && k !== "page" && <span className="seo-kind">{KIND_LABEL[k]}</span>}
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      )}
                      <Suggestions scanId={scanId} rec={r} keyword={keyword} />
                      <div className="seo-rec-actions">
                        <CopyButton text={asText(r)} label="Aanbeveling kopiëren" small />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
