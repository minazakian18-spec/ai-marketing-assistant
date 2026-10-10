"use client";
import { useState } from "react";
import type { FieldMetric, PsiResult } from "@/lib/seo/types";
import { Info, ToneBadge, ToneIcon, type Tone } from "./seo-parts";

// Google PageSpeed Insights results. Lab data = one Lighthouse run by Google
// during the scan; field data = real Chrome users (CrUX, last 28 days).

const LAB: { key: "fcp" | "lcp" | "tbt" | "cls" | "si"; label: string; help: string; good: number; poor: number }[] = [
  { key: "lcp", label: "Largest Contentful Paint", help: "Hoe snel het grootste stuk inhoud (foto of tekstblok) zichtbaar is. Goed: binnen 2,5 seconde.", good: 2500, poor: 4000 },
  { key: "fcp", label: "First Contentful Paint", help: "Wanneer de eerste tekst of afbeelding verschijnt. Goed: binnen 1,8 seconde.", good: 1800, poor: 3000 },
  { key: "tbt", label: "Total Blocking Time", help: "Hoe lang de pagina niet reageert omdat scripts bezig zijn. Goed: onder 200 ms.", good: 200, poor: 600 },
  { key: "cls", label: "Cumulative Layout Shift", help: "Hoeveel de pagina verspringt tijdens het laden. Goed: onder 0,1.", good: 0.1, poor: 0.25 },
  { key: "si", label: "Speed Index", help: "Hoe snel de pagina er zichtbaar compleet uitziet. Goed: binnen 3,4 seconde.", good: 3400, poor: 5800 },
];
const FIELD: { key: "lcp" | "inp" | "cls" | "fcp" | "ttfb"; label: string; help: string; fmt: (v: number) => string; core?: boolean }[] = [
  { key: "lcp", label: "Laadsnelheid (LCP)", help: "75% van de bezoekers zag de grootste inhoud binnen deze tijd.", fmt: (v) => (v / 1000).toFixed(1).replace(".", ",") + " s", core: true },
  { key: "inp", label: "Reactiesnelheid (INP)", help: "Hoe snel de pagina reageert op klikken en tikken.", fmt: (v) => Math.round(v) + " ms", core: true },
  { key: "cls", label: "Visuele stabiliteit (CLS)", help: "Hoeveel de pagina verspringt.", fmt: (v) => (v / 100).toFixed(2).replace(".", ","), core: true },
  { key: "fcp", label: "Eerste inhoud (FCP)", help: "Wanneer de eerste inhoud verscheen.", fmt: (v) => (v / 1000).toFixed(1).replace(".", ",") + " s" },
  { key: "ttfb", label: "Serverreactie (TTFB)", help: "Hoe snel de server begon met antwoorden.", fmt: (v) => (v / 1000).toFixed(1).replace(".", ",") + " s" },
];
const FIELD_TONE: Record<FieldMetric["category"], Tone> = { FAST: "good", AVERAGE: "warning", SLOW: "critical" };
const FIELD_LABEL: Record<FieldMetric["category"], string> = { FAST: "Goed", AVERAGE: "Kan beter", SLOW: "Slecht" };
const labTone = (v: number, good: number, poor: number): Tone => (v <= good ? "good" : v <= poor ? "warning" : "critical");

export function Performance({ psi, pagespeedKey }: { psi: { mobile: PsiResult; desktop: PsiResult } | null; pagespeedKey: boolean }) {
  const [strategy, setStrategy] = useState<"mobile" | "desktop">("mobile");
  if (!psi)
    return (
      <div className="seo-empty">
        <strong>Geen snelheidsmeting</strong>
        <p>Deze analyse bevat geen PageSpeed Insights-resultaat.</p>
      </div>
    );
  const r = psi[strategy];
  return (
    <div className="seo-perf">
      <div className="seo-perf-head">
        <div className="seo-seg" role="group" aria-label="Apparaat">
          <button type="button" aria-pressed={strategy === "mobile"} onClick={() => setStrategy("mobile")}>
            Mobiel
          </button>
          <button type="button" aria-pressed={strategy === "desktop"} onClick={() => setStrategy("desktop")}>
            Desktop
          </button>
        </div>
        <p className="seo-note">
          Gemeten met Google PageSpeed Insights{r.ok && r.lighthouseVersion ? ` (Lighthouse ${r.lighthouseVersion})` : ""}.
        </p>
      </div>
      {!r.ok ? (
        <div className="seo-empty">
          <strong>Geen meting beschikbaar</strong>
          <p>
            {r.error}
            {!pagespeedKey && " Zonder eigen API-sleutel deelt Mavix een beperkte gratis limiet van Google."}
          </p>
        </div>
      ) : (
        <>
          <section className="seo-block">
            <h3>
              Lighthouse-scores <span className="seo-pill">Labmeting</span>
              <Info label="Wat is een labmeting?">Eén testmeting door Google op een gesimuleerd apparaat tijdens deze analyse. Handig om problemen te vinden, maar het is geen meting bij echte bezoekers.</Info>
            </h3>
            <div className="seo-lh">
              {(
                [
                  ["performance", "Prestaties"],
                  ["accessibility", "Toegankelijkheid"],
                  ["bestPractices", "Best practices"],
                  ["seo", "SEO-basis"],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="seo-lh-item">
                  <strong>{r.categories[k] ?? "—"}</strong>
                  <span>{label}</span>
                  <ToneBadge score={r.categories[k]} />
                </div>
              ))}
            </div>
            <table className="seo-table seo-metrics">
              <thead>
                <tr>
                  <th scope="col">Meetwaarde</th>
                  <th scope="col">Resultaat</th>
                  <th scope="col">Beoordeling</th>
                </tr>
              </thead>
              <tbody>
                {LAB.map((m) => {
                  const v = r.lab[m.key];
                  const t = v ? labTone(v.value, m.good, m.poor) : "none";
                  return (
                    <tr key={m.key}>
                      <th scope="row">
                        {m.label} <Info label={"Uitleg " + m.label}>{m.help}</Info>
                      </th>
                      <td>{v ? v.display || String(Math.round(v.value)) : "—"}</td>
                      <td>
                        <span className={"seo-tone is-" + t}>
                          <ToneIcon t={t} size={12} />
                          {t === "good" ? "Goed" : t === "warning" ? "Kan beter" : t === "critical" ? "Slecht" : "Niet gemeten"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="seo-block">
            <h3>
              Core Web Vitals <span className="seo-pill is-field">Echte bezoekers</span>
              <Info label="Wat zijn veldgegevens?">Metingen bij echte Chrome-gebruikers over de afgelopen 28 dagen (Chrome UX Report). Alleen beschikbaar als je website genoeg bezoekers heeft.</Info>
            </h3>
            {r.field ? (
              <>
                <p className="seo-note">
                  {r.field.scope === "url" ? "Gegevens van deze pagina." : "Te weinig gegevens voor deze pagina; dit zijn de gegevens van je hele website."}
                  {r.field.overall && ` Totaaloordeel van Google: ${FIELD_LABEL[r.field.overall].toLowerCase()}.`}
                </p>
                <div className="seo-cwv">
                  {FIELD.map((m) => {
                    const v = r.field!.metrics[m.key];
                    return (
                      <div key={m.key} className={"seo-cwv-item" + (m.core ? " is-core" : "")}>
                        <span className="seo-cwv-label">
                          {m.label} <Info label={"Uitleg " + m.label}>{m.help}</Info>
                        </span>
                        <strong>{v ? m.fmt(v.percentile) : "—"}</strong>
                        {v ? (
                          <span className={"seo-tone is-" + FIELD_TONE[v.category]}>
                            <ToneIcon t={FIELD_TONE[v.category]} size={12} />
                            {FIELD_LABEL[v.category]}
                          </span>
                        ) : (
                          <span className="seo-tone is-none">Geen gegevens</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="seo-note">Google heeft (nog) niet genoeg bezoekersgegevens voor je website. Dat is normaal voor kleinere websites; gebruik dan de labmeting hierboven.</p>
            )}
          </section>

          {r.opportunities.length > 0 && (
            <section className="seo-block">
              <h3>Grootste verbeterpunten volgens Lighthouse</h3>
              <ul className="seo-opps">
                {r.opportunities.map((o) => (
                  <li key={o.id}>
                    <span>{o.title}</span>
                    {o.display && <small>{o.display}</small>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
