"use client";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Lock } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";
import { LineChart } from "./line-chart";
import { Info, pathOf, shortDate } from "./seo-parts";

// Private Google Search Console data for one website. Separate from the
// public audit: only for properties the connected Google account may read.

type Metrics = { clicks: number; impressions: number; ctr: number; position: number };
type Data =
  | { status: "not_connected" | "reconnect" | "permission" }
  | { status: "no_property"; properties: { siteUrl: string }[] }
  | {
      status: "ok";
      property: string;
      properties: { siteUrl: string }[];
      range: { start: string; end: string };
      totals: Metrics;
      daily: (Metrics & { date: string })[];
      queries: (Metrics & { key: string })[];
      pages: (Metrics & { key: string })[];
    };

const nl = (n: number) => n.toLocaleString("nl-NL");
const SERIES_BLUE = "#2a78d6";

export function SearchConsole({ siteId, canManage }: { siteId: string; canManage: boolean }) {
  const [days, setDays] = useState("28");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setData(null);
    try {
      const r = await fetch(`/api/seo/sites/${siteId}/search-console?days=${days}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Search Console-gegevens konden niet worden geladen.");
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search Console-gegevens konden niet worden geladen.");
    }
  }, [siteId, days]);
  useEffect(() => {
    void load();
  }, [load]);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/integrations/google_search_console/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Koppelen is niet gelukt.");
      window.location.assign(d.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koppelen is niet gelukt.");
      setBusy(false);
    }
  }
  async function choose(property: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/seo/sites/${siteId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gscProperty: property }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Opslaan is niet gelukt.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  const intro = (
    <p className="seo-note seo-private">
      <Lock size={13} aria-hidden="true" />
      Privégegevens van Google: alleen zichtbaar voor jouw werkruimte en alleen voor websites waar je Google-account toegang toe heeft in Search Console. Mavix leest alleen; er verandert niets in Search Console.
    </p>
  );

  if (error)
    return (
      <div className="seo-gsc">
        {intro}
        <p className="seo-error" role="alert">
          {error}
        </p>
      </div>
    );
  if (!data) return <div className="seo-skeleton seo-skeleton-block" aria-busy="true" aria-label="Laden" />;

  if (data.status !== "ok" && data.status !== "no_property")
    return (
      <div className="seo-gsc">
        <div className="seo-connect">
          <BrandIcon brand="search_console" size={26} />
          <div>
            <strong>{data.status === "not_connected" ? "Koppel Google Search Console" : "Koppel Search Console opnieuw"}</strong>
            <p>
              Zie hoe vaak je website in Google verschijnt, hoeveel mensen klikken, op welke zoekwoorden je gevonden wordt en welke pagina&apos;s het best scoren. Deze gegevens
              zijn er alleen voor websites die in je Search Console staan.
            </p>
          </div>
          {canManage ? (
            <button type="button" className="button primary" onClick={() => void connect()} disabled={busy}>
              {data.status === "not_connected" ? "Koppelen" : "Opnieuw koppelen"}
            </button>
          ) : (
            <span className="seo-note">Een eigenaar of beheerder kan dit koppelen.</span>
          )}
        </div>
        {intro}
      </div>
    );

  if (data.status === "no_property")
    return (
      <div className="seo-gsc">
        <div className="seo-connect">
          <div>
            <strong>Geen passende Search Console-property gevonden</strong>
            <p>
              {data.properties.length
                ? "Kies de property die bij deze website hoort."
                : "Het gekoppelde Google-account heeft geen toegang tot deze website in Search Console. Voeg de website toe in Search Console of koppel een ander account."}
            </p>
            {data.properties.length > 0 && canManage && (
              <div className="seo-suggest-row">
                <select defaultValue="" onChange={(e) => e.target.value && void choose(e.target.value)} disabled={busy} aria-label="Search Console-property">
                  <option value="">Kies een property</option>
                  {data.properties.map((p) => (
                    <option key={p.siteUrl} value={p.siteUrl}>
                      {p.siteUrl}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <a className="button secondary" href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">
            Search Console <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
        {intro}
      </div>
    );

  const points = data.daily.map((d) => ({ x: d.date, label: shortDate(d.date), values: { clicks: d.clicks, impressions: d.impressions } }));
  return (
    <div className="seo-gsc">
      <div className="seo-gsc-head">
        <p className="seo-note">
          Property <strong>{data.property}</strong> · {shortDate(data.range.start)} t/m {shortDate(data.range.end)}
          <Info label="Waarom loopt dit achter?">Google verwerkt zoekgegevens met 2 à 3 dagen vertraging. Mavix toont alleen definitieve cijfers.</Info>
        </p>
        <div className="seo-seg" role="group" aria-label="Periode">
          {["7", "28", "90"].map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>
              {d} dagen
            </button>
          ))}
        </div>
      </div>
      <div className="seo-kpis">
        <div>
          <span>
            Klikken <Info label="Uitleg klikken">Hoe vaak iemand vanuit Google op je website klikte.</Info>
          </span>
          <strong>{nl(data.totals.clicks)}</strong>
        </div>
        <div>
          <span>
            Vertoningen <Info label="Uitleg vertoningen">Hoe vaak je website in de zoekresultaten verscheen.</Info>
          </span>
          <strong>{nl(data.totals.impressions)}</strong>
        </div>
        <div>
          <span>
            Gem. CTR <Info label="Uitleg CTR">Het percentage vertoningen dat tot een klik leidde.</Info>
          </span>
          <strong>{data.totals.ctr.toLocaleString("nl-NL")}%</strong>
        </div>
        <div>
          <span>
            Gem. positie <Info label="Uitleg positie">De gemiddelde plek in de zoekresultaten (1 = bovenaan).</Info>
          </span>
          <strong>{data.totals.position ? data.totals.position.toLocaleString("nl-NL") : "—"}</strong>
        </div>
      </div>
      {points.length > 0 ? (
        <div className="seo-chart-pair">
          <LineChart title="Klikken per dag" points={points} series={[{ key: "clicks", label: "Klikken", color: SERIES_BLUE }]} format={nl} height={190} />
          <LineChart title="Vertoningen per dag" points={points} series={[{ key: "impressions", label: "Vertoningen", color: SERIES_BLUE }]} format={nl} height={190} />
        </div>
      ) : (
        <p className="seo-note">Nog geen zoekgegevens in deze periode.</p>
      )}
      <div className="seo-two">
        <section className="seo-block">
          <h3>Zoekwoorden</h3>
          <TopTable rows={data.queries} label="Zoekwoord" />
        </section>
        <section className="seo-block">
          <h3>Pagina&apos;s</h3>
          <TopTable rows={data.pages} label="Pagina" path />
        </section>
      </div>
      {intro}
    </div>
  );
}

function TopTable({ rows, label, path = false }: { rows: (Metrics & { key: string })[]; label: string; path?: boolean }) {
  if (!rows.length) return <p className="seo-note">Geen gegevens.</p>;
  return (
    <div className="seo-table-wrap">
      <table className="seo-table">
        <thead>
          <tr>
            <th scope="col">{label}</th>
            <th scope="col">Klikken</th>
            <th scope="col">Vertoningen</th>
            <th scope="col">CTR</th>
            <th scope="col">Positie</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" className="seo-cell-text">
                {path ? pathOf(r.key) : r.key}
              </th>
              <td>{nl(r.clicks)}</td>
              <td>{nl(r.impressions)}</td>
              <td>{r.ctr.toLocaleString("nl-NL")}%</td>
              <td>{r.position.toLocaleString("nl-NL")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
