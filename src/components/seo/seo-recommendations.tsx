"use client";
import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Mavi } from "@/components/mavi";
import { CATEGORY_LABEL } from "@/lib/seo/checks";
import type { Recommendation, Severity } from "@/lib/seo/types";
import { CopyButton, pathOf } from "./seo-parts";

const SEVERITY_LABEL: Record<Severity, string> = { critical: "Kritiek", high: "Hoog", medium: "Gemiddeld", low: "Laag" };
const SEVERITY_HINT: Record<Severity, string> = {
  critical: "Los dit eerst op: dit kan je vindbaarheid ernstig schaden.",
  high: "Grote invloed op je vindbaarheid of bezoekers.",
  medium: "Merkbare verbetering als je dit oplost.",
  low: "Kleine verbetering, handig om mee te nemen.",
};
const KIND_LABEL = { title: "titel", description: "metabeschrijving", structure: "kopstructuur" } as const;

function asText(r: Recommendation) {
  return [r.problem, "", "Waarom: " + r.why, "Actie: " + r.action, "", ...r.guidance.map((g) => "- " + g), ...(r.urls.length ? ["", "Pagina's:", ...r.urls] : [])].join("\n");
}

function Suggestions({ scanId, rec }: { scanId: string; rec: Recommendation }) {
  const [url, setUrl] = useState(rec.urls[0] || "");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  if (!rec.suggest || !rec.urls.length) return null;
  async function run() {
    setBusy(true);
    setError("");
    setItems(null);
    try {
      const r = await fetch(`/api/seo/scans/${scanId}/suggest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, kind: rec.suggest }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Mavi kon geen voorstel maken.");
      setItems(d.suggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mavi kon geen voorstel maken.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="seo-suggest">
      <div className="seo-suggest-head">
        <Mavi size={16} state={busy ? "thinking" : "idle"} />
        <span>Laat Mavi een betere {KIND_LABEL[rec.suggest]} voorstellen</span>
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
          {busy ? "Bezig…" : "Voorstellen"}
        </button>
      </div>
      {error && (
        <p className="seo-error" role="alert">
          {error}
        </p>
      )}
      {items && (
        <ul className="seo-suggest-list">
          {(rec.suggest === "structure" ? [items.join("\n")] : items).map((s, i) => (
            <li key={i}>
              <pre>{s}</pre>
              <span className="seo-suggest-meta">{rec.suggest !== "structure" && `${s.length} tekens`}</span>
              <CopyButton text={s} small />
            </li>
          ))}
        </ul>
      )}
      {items && <p className="seo-note">Mavi past je website niet zelf aan. Kopieer de tekst en plak hem in je websitebouwer.</p>}
    </div>
  );
}

export function Recommendations({ scanId, items }: { scanId: string; items: Recommendation[] }) {
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [open, setOpen] = useState<string | null>(items[0]?.id || null);
  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const r of items) c[r.severity]++;
    return c;
  }, [items]);
  const shown = items.filter((r) => severity === "all" || r.severity === severity);
  if (!items.length)
    return (
      <div className="seo-empty">
        <strong>Geen verbeterpunten gevonden</strong>
        <p>Alle gemeten onderdelen zijn in orde. Blijf je website regelmatig controleren, bijvoorbeeld na een grote wijziging.</p>
      </div>
    );
  return (
    <div className="seo-recs">
      <div className="seo-chips" role="group" aria-label="Filter op ernst">
        <button type="button" aria-pressed={severity === "all"} onClick={() => setSeverity("all")}>
          Alles <span>{items.length}</span>
        </button>
        {(Object.keys(counts) as Severity[]).map((s) =>
          counts[s] ? (
            <button key={s} type="button" aria-pressed={severity === s} onClick={() => setSeverity(s)} className={"is-" + s}>
              {SEVERITY_LABEL[s]} <span>{counts[s]}</span>
            </button>
          ) : null,
        )}
      </div>
      <ol className="seo-rec-list">
        {shown.map((r) => {
          const expanded = open === r.id;
          return (
            <li key={r.id} className={"seo-rec" + (expanded ? " is-open" : "")}>
              <button type="button" className="seo-rec-head" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : r.id)}>
                <span className={"seo-sev is-" + r.severity} title={SEVERITY_HINT[r.severity]}>
                  {SEVERITY_LABEL[r.severity]}
                </span>
                <span className="seo-rec-title">
                  {r.problem}
                  <small>
                    {CATEGORY_LABEL[r.category]}
                    {r.totalUrls ? ` · ${r.totalUrls} ${r.totalUrls === 1 ? "pagina" : "pagina's"}` : ""}
                  </small>
                </span>
                <ChevronDown size={16} aria-hidden="true" className="seo-rec-chevron" />
              </button>
              {expanded && (
                <div className="seo-rec-body">
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
                        {r.urls.map((u) => (
                          <li key={u}>
                            <a href={u} target="_blank" rel="noopener noreferrer nofollow">
                              {pathOf(u)}
                              <ExternalLink size={12} aria-hidden="true" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <Suggestions scanId={scanId} rec={r} />
                  <div className="seo-rec-actions">
                    <CopyButton text={asText(r)} label="Aanbeveling kopiëren" small />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
