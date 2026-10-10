"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, FileText, Minus } from "lucide-react";
import { CATEGORY_LABEL } from "@/lib/seo/checks";
import type { Category, ScanReport, Scores } from "@/lib/seo/types";
import { LineChart } from "./line-chart";
import { dateTime, shortDate } from "./seo-parts";

export type ScanSummary = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  trigger: "manual" | "scheduled";
  scores: Scores | null;
  created_at: string;
  completed_at: string | null;
  error: string | null;
};

// Validated categorical slots (light surface), in fixed order.
const SERIES = [
  { key: "overall", label: "Totaal", color: "#2a78d6" },
  { key: "technical", label: "Technisch", color: "#eb6834" },
  { key: "content", label: "Content", color: "#1baf7a" },
  { key: "performance", label: "Prestaties", color: "#eda100" },
];
const CATS = Object.keys(CATEGORY_LABEL) as Category[];

function Delta({ a, b }: { a: number | null | undefined; b: number | null | undefined }) {
  if (a === null || a === undefined || b === null || b === undefined) return <span className="seo-delta">—</span>;
  const d = b - a;
  const Icon = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus;
  return (
    <span className={"seo-delta" + (d > 0 ? " is-up" : d < 0 ? " is-down" : "")}>
      <Icon size={13} aria-hidden="true" />
      {d > 0 ? "+" : ""}
      {d}
      <span className="sr-only">{d > 0 ? " beter" : d < 0 ? " slechter" : " gelijk"}</span>
    </span>
  );
}

export function History({ scans, currentId, onOpen }: { scans: ScanSummary[]; currentId: string | null; onOpen: (id: string) => void }) {
  const done = scans.filter((s) => s.status === "completed" && s.scores).slice().reverse();
  const [a, setA] = useState(done.length > 1 ? done[done.length - 2].id : "");
  const [b, setB] = useState(done.length ? done[done.length - 1].id : "");
  const [cmp, setCmp] = useState<{ a: ScanReport; b: ScanReport } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function compare() {
    if (!a || !b || a === b) return;
    setBusy(true);
    setError("");
    try {
      const [ra, rb] = await Promise.all([a, b].map((id) => fetch("/api/seo/scans/" + id).then((r) => r.json())));
      if (!ra.scan?.report || !rb.scan?.report) throw new Error("Een van de analyses kon niet worden geladen.");
      setCmp({ a: ra.scan.report, b: rb.scan.report });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vergelijken is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  const points = done.map((s) => ({
    x: s.id,
    label: shortDate(s.completed_at || s.created_at),
    values: { overall: s.scores!.overall, technical: s.scores!.categories.technical, content: s.scores!.categories.content, performance: s.scores!.categories.performance },
  }));
  const resolved = cmp ? cmp.a.recommendations.filter((r) => !cmp.b.recommendations.some((x) => x.id === r.id)) : [];
  const added = cmp ? cmp.b.recommendations.filter((r) => !cmp.a.recommendations.some((x) => x.id === r.id)) : [];

  return (
    <div className="seo-history">
      {done.length >= 2 ? (
        <LineChart title="Scores per analyse" points={points} series={SERIES} yMax={100} />
      ) : (
        <p className="seo-note">Na je tweede analyse zie je hier hoe je scores zich ontwikkelen.</p>
      )}

      {done.length >= 2 && (
        <section className="seo-block">
          <h3>Twee analyses vergelijken</h3>
          <div className="seo-compare-row">
            <select value={a} onChange={(e) => setA(e.target.value)} aria-label="Eerste analyse">
              {done.map((s) => (
                <option key={s.id} value={s.id}>
                  {dateTime(s.completed_at)} · score {s.scores!.overall ?? "—"}
                </option>
              ))}
            </select>
            <span aria-hidden="true">→</span>
            <select value={b} onChange={(e) => setB(e.target.value)} aria-label="Tweede analyse">
              {done.map((s) => (
                <option key={s.id} value={s.id}>
                  {dateTime(s.completed_at)} · score {s.scores!.overall ?? "—"}
                </option>
              ))}
            </select>
            <button type="button" className="button secondary" onClick={() => void compare()} disabled={busy || !a || !b || a === b}>
              {busy ? "Laden…" : "Vergelijken"}
            </button>
          </div>
          {error && (
            <p className="seo-error" role="alert">
              {error}
            </p>
          )}
          {cmp && (
            <div className="seo-compare">
              <table className="seo-table">
                <thead>
                  <tr>
                    <th scope="col">Onderdeel</th>
                    <th scope="col">Eerst</th>
                    <th scope="col">Daarna</th>
                    <th scope="col">Verschil</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Totaalscore</th>
                    <td>{cmp.a.scores.overall ?? "—"}</td>
                    <td>{cmp.b.scores.overall ?? "—"}</td>
                    <td>
                      <Delta a={cmp.a.scores.overall} b={cmp.b.scores.overall} />
                    </td>
                  </tr>
                  {CATS.map((c) => (
                    <tr key={c}>
                      <th scope="row">{CATEGORY_LABEL[c]}</th>
                      <td>{cmp.a.scores.categories[c] ?? "—"}</td>
                      <td>{cmp.b.scores.categories[c] ?? "—"}</td>
                      <td>
                        <Delta a={cmp.a.scores.categories[c]} b={cmp.b.scores.categories[c]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="seo-two">
                <div>
                  <h4>Opgelost ({resolved.length})</h4>
                  {resolved.length ? (
                    <ul className="seo-plain">
                      {resolved.map((r) => (
                        <li key={r.id}>{r.problem}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="seo-note">Geen.</p>
                  )}
                </div>
                <div>
                  <h4>Nieuw ({added.length})</h4>
                  {added.length ? (
                    <ul className="seo-plain">
                      {added.map((r) => (
                        <li key={r.id}>{r.problem}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="seo-note">Geen.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="seo-block">
        <h3>Alle analyses</h3>
        <div className="seo-table-wrap">
          <table className="seo-table">
            <thead>
              <tr>
                <th scope="col">Datum</th>
                <th scope="col">Soort</th>
                <th scope="col">Score</th>
                <th scope="col">
                  <span className="sr-only">Acties</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {scans.map((s) => (
                <tr key={s.id} className={s.id === currentId ? "is-current" : ""}>
                  <th scope="row">{dateTime(s.completed_at || s.created_at)}</th>
                  <td>{s.trigger === "scheduled" ? "Automatisch" : "Handmatig"}</td>
                  <td>{s.status === "completed" ? (s.scores?.overall ?? "—") : s.status === "failed" ? "Mislukt" : "Bezig"}</td>
                  <td className="seo-row-actions">
                    {s.status === "completed" && (
                      <>
                        <button type="button" className="button secondary seo-copy is-small" onClick={() => onOpen(s.id)} disabled={s.id === currentId}>
                          {s.id === currentId ? "Geopend" : "Openen"}
                        </button>
                        <Link className="button secondary seo-copy is-small" href={`/seo/rapport/${s.id}`} target="_blank">
                          <FileText size={13} aria-hidden="true" /> Rapport
                        </Link>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
