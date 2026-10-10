"use client";
import { use, useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { CATEGORY_LABEL, CATEGORY_WEIGHT } from "@/lib/seo/checks";
import type { Category, ScanReport } from "@/lib/seo/types";
import { TONE_LABEL, dateTime, pathOf, tone } from "@/components/seo/seo-parts";
import "../../../../seo.css";

// Readable SEO report of one completed analysis, made for printing or saving
// as PDF (browser print dialog).

const SEVERITY: Record<string, string> = { critical: "Kritiek", high: "Hoog", medium: "Gemiddeld", low: "Laag" };
const CATS = Object.keys(CATEGORY_WEIGHT) as Category[];

export default function SeoReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [completed, setCompleted] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/seo/scans/" + id)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Het rapport kon niet worden geladen.");
        if (!d.scan?.report) throw new Error("Deze analyse is nog niet afgerond.");
        setReport(d.scan.report);
        setCompleted(d.scan.completed_at);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error)
    return (
      <div className="seo seo-report">
        <p className="seo-error seo-page-error" role="alert">
          {error}
        </p>
      </div>
    );
  if (!report) return <div className="seo seo-report"><div className="seo-skeleton seo-skeleton-hero" aria-busy="true" aria-label="Laden" /></div>;

  const psi = report.psi?.mobile.ok ? report.psi.mobile : null;
  return (
    <div className="seo seo-report">
      <div className="seo-report-actions">
        <button type="button" className="button primary seo-copy" onClick={() => window.print()}>
          <Printer size={15} aria-hidden="true" /> Afdrukken of opslaan als PDF
        </button>
      </div>
      <section className="ui-card">
        <p className="seo-note">SEO-rapport · Mavix</p>
        <h1 style={{ margin: "4px 0 6px", fontSize: 24, color: "#2e1065" }}>{new URL(report.site.finalUrl || report.site.startUrl).host}</h1>
        <p className="seo-note">
          Geanalyseerd op {dateTime(completed)} · {report.site.crawl.crawled} pagina&apos;s · Mavix SEO-score {report.scores.overall ?? "—"} ({TONE_LABEL[tone(report.scores.overall)].toLowerCase()})
        </p>
        <p className="seo-note">De Mavix SEO-score is een eigen score op basis van meetbare controles, geen officiële Google-score. Prestaties komen van Google PageSpeed Insights.</p>
      </section>
      <section className="ui-card">
        <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>Scores</h2>
        <table className="seo-table">
          <thead>
            <tr>
              <th scope="col">Onderdeel</th>
              <th scope="col">Score</th>
              <th scope="col">Oordeel</th>
              <th scope="col">Gewicht</th>
            </tr>
          </thead>
          <tbody>
            {CATS.map((c) => (
              <tr key={c}>
                <th scope="row">{CATEGORY_LABEL[c]}</th>
                <td>{report.scores.categories[c] ?? "Niet gemeten"}</td>
                <td>{TONE_LABEL[tone(report.scores.categories[c])]}</td>
                <td>{CATEGORY_WEIGHT[c]}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {psi && (
          <p className="seo-note" style={{ marginTop: 10 }}>
            Lighthouse mobiel (labmeting): prestaties {psi.categories.performance ?? "—"}, toegankelijkheid {psi.categories.accessibility ?? "—"}, SEO-basis {psi.categories.seo ?? "—"}.
            {psi.field ? ` Core Web Vitals van echte bezoekers: ${Object.entries(psi.field.metrics).map(([k, v]) => `${k.toUpperCase()} ${v!.category === "FAST" ? "goed" : v!.category === "AVERAGE" ? "kan beter" : "slecht"}`).join(", ")}.` : " Geen veldgegevens van echte bezoekers beschikbaar."}
          </p>
        )}
      </section>
      <section className="ui-card">
        <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>Aanbevelingen ({report.recommendations.length})</h2>
        {report.recommendations.length ? (
          <ol className="seo-rec-list">
            {report.recommendations.map((r) => (
              <li key={r.id} className="seo-rec is-open" style={{ padding: 14 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  <span className={"seo-sev is-" + r.severity} style={{ display: "inline-block", marginRight: 8 }}>
                    {SEVERITY[r.severity]}
                  </span>
                  {r.problem}
                </p>
                <p className="seo-note" style={{ marginTop: 6 }}>
                  <strong>Waarom:</strong> {r.why}
                </p>
                <p className="seo-note">
                  <strong>Actie:</strong> {r.action}
                </p>
                <ol className="seo-steps" style={{ marginTop: 6 }}>
                  {r.guidance.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ol>
                {r.urls.length > 0 && <p className="seo-note" style={{ marginTop: 6 }}>Pagina&apos;s: {r.urls.map(pathOf).join(", ")}{r.totalUrls > r.urls.length ? ` en ${r.totalUrls - r.urls.length} meer` : ""}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="seo-note">Geen verbeterpunten gevonden.</p>
        )}
      </section>
      <section className="ui-card">
        <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>Geanalyseerde pagina&apos;s</h2>
        <table className="seo-table">
          <thead>
            <tr>
              <th scope="col">Pagina</th>
              <th scope="col">Status</th>
              <th scope="col">Titel</th>
            </tr>
          </thead>
          <tbody>
            {report.pages.map((p) => (
              <tr key={p.url}>
                <th scope="row" className="seo-cell-text">{pathOf(p.url)}</th>
                <td>{p.status}</td>
                <td className="seo-cell-text">{p.title || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
