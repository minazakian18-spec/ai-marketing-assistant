"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plug } from "lucide-react";
import { isBrowserDemo } from "@/lib/demo";

// "Websitebezoekers" on /inzichten: connect Google Analytics 4, choose the
// property, then show the last 28 days next to the 28 before.
// Server: src/lib/server/google-analytics.ts. Read-only.
type Status = { connected: boolean; status: string; email: string | null; propertyId: string | null; propertyName: string | null };
type Property = { id: string; label: string };
type Metric = { value: number; previous: number };
type Report = {
  users: Metric;
  sessions: Metric;
  newUsers: Metric;
  keyEvents: Metric;
  weeks: { week: string; users: number; sessions: number }[];
  channels: { name: string; sessions: number }[];
  pages: { path: string; views: number }[];
};
const BASE = "/api/integrations/google_analytics/";
const nl = new Intl.NumberFormat("nl-NL");

const CHANNEL: Record<string, string> = {
  "Organic Search": "Google (zoeken)",
  Direct: "Direct",
  "Organic Social": "Social media",
  "Paid Search": "Google Ads",
  Referral: "Andere websites",
  Email: "E-mail",
  "Paid Social": "Betaalde social",
  "Organic Maps": "Google Maps",
  Unassigned: "Onbekend",
};

function Delta({ m }: { m: Metric }) {
  if (!m.previous) return <span className="ga-delta">eerste periode</span>;
  const pct = Math.round(((m.value - m.previous) / m.previous) * 100);
  return <span className={"ga-delta " + (pct >= 0 ? "up" : "down")}>{(pct >= 0 ? "+" : "") + pct}% t.o.v. de 28 dagen ervoor</span>;
}

export function GoogleAnalytics() {
  const demo = isBrowserDemo();
  const [status, setStatus] = useState<Status | null>(null);
  const [props, setProps] = useState<Property[] | null>(null);
  const [choice, setChoice] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (demo) return;
    const r = await fetch(BASE + "status", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setError(d.error || "De status kon niet worden geladen.");
    setStatus(d);
  }, [demo]);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!status?.connected) return;
    if (status.status === "connected") {
      if (report) return;
      void (async () => {
        const r = await fetch(BASE + "report", { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return setError(d.error || "De bezoekerscijfers konden niet worden geladen.");
        setReport(d);
      })();
    } else if (status.status === "selection_required" && !props) {
      void (async () => {
        const r = await fetch(BASE + "properties", { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return setError(d.error || "Je Analytics-properties konden niet worden geladen.");
        setProps(d.properties);
        if (d.properties?.length) setChoice(d.properties[0].id);
      })();
    }
  }, [status, props, report]);

  async function post(action: string, body: object = {}) {
    setBusy(action);
    setError("");
    const r = await fetch(BASE + action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) {
      setError(d.error || "Dat is niet gelukt. Probeer het opnieuw.");
      return null;
    }
    return d;
  }

  async function connect() {
    const d = await post("connect");
    if (d?.url) window.location.assign(d.url);
  }

  const max = Math.max(1, ...(report?.weeks.map((w) => w.users) || [1]));
  const maxCh = Math.max(1, ...(report?.channels.map((c) => c.sessions) || [1]));

  return (
    <section className="ga card" aria-labelledby="ga-title">
      <div className="ga-head">
        <h2 id="ga-title">Websitebezoekers</h2>
        <span className="ga-source">Bron: Google Analytics, laatste 28 dagen</span>
      </div>

      {demo ? (
        <p className="ads-connect-note">In de testmodus kun je Google Analytics niet koppelen. Met een echt account zie je hier je websitebezoekers.</p>
      ) : !status ? (
        <p className="ads-connect-note">Laden…</p>
      ) : !status.connected || status.status === "reconnect_required" ? (
        <div className="ads-connect">
          <p className="ads-connect-note">Zie hoeveel mensen je website bezoeken, waar ze vandaan komen (Google, Instagram, e-mail, Google Ads) en welke pagina&apos;s ze bekijken.</p>
          <button type="button" className="button primary" disabled={!!busy} onClick={() => void connect()}>
            {busy === "connect" ? <Loader2 size={15} className="int-spin" aria-hidden="true" /> : <Plug size={15} aria-hidden="true" />}
            {status.status === "reconnect_required" ? "Opnieuw koppelen" : "Koppel Google Analytics"}
          </button>
          <p className="ads-connect-note">Log in met het Google-account waarmee je Google Analytics gebruikt. Mavix leest alleen mee en wijzigt niets.</p>
        </div>
      ) : status.status !== "connected" ? (
        <div className="ads-connect-pick">
          <p>
            Ingelogd als <strong>{status.email}</strong>. Kies welke website (property) Mavix mag lezen:
          </p>
          {props === null ? (
            !error && <p className="ads-connect-note">Properties laden…</p>
          ) : props.length ? (
            <div className="ads-connect-row">
              <label className="sr-only" htmlFor="ga-property">
                Google Analytics-property
              </label>
              <select id="ga-property" value={choice} onChange={(e) => setChoice(e.target.value)}>
                {props.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button type="button" className="button primary" disabled={!!busy || !choice} onClick={() => void post("select", { propertyId: choice }).then((d) => d && load())}>
                {busy === "select" ? "Opslaan…" : "Gebruik deze property"}
              </button>
            </div>
          ) : (
            <p className="ads-connect-note">Met deze Google-login is geen Google Analytics 4-property gevonden. Log in met het account dat toegang heeft, of maak eerst een property aan in Google Analytics.</p>
          )}
          <button type="button" className="button secondary" disabled={!!busy} onClick={() => void post("disconnect").then((d) => d && (setProps(null), load()))}>
            Ander Google-account
          </button>
        </div>
      ) : (
        <>
          {report ? (
            <>
              <div className="ga-stats">
                {(
                  [
                    ["Bezoekers", report.users],
                    ["Bezoeken", report.sessions],
                    ["Nieuwe bezoekers", report.newUsers],
                    ["Conversies", report.keyEvents],
                  ] as [string, Metric][]
                ).map(([label, m]) => (
                  <div key={label} className="ga-stat">
                    <span>{label}</span>
                    <strong>{nl.format(m.value)}</strong>
                    <Delta m={m} />
                  </div>
                ))}
              </div>
              <div className="ga-grid">
                <div>
                  <h3>Bezoekers per week</h3>
                  <ul className="ga-bars">
                    {report.weeks.map((w) => (
                      <li key={w.week}>
                        <span>Week {w.week.slice(4)}</span>
                        <span className="ga-bar" style={{ width: (w.users / max) * 100 + "%" }} />
                        <strong>{nl.format(w.users)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Waar bezoekers vandaan komen</h3>
                  <ul className="ga-bars">
                    {report.channels.map((c) => (
                      <li key={c.name}>
                        <span>{CHANNEL[c.name] || c.name}</span>
                        <span className="ga-bar" style={{ width: (c.sessions / maxCh) * 100 + "%" }} />
                        <strong>{nl.format(c.sessions)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Meest bekeken pagina&apos;s</h3>
                  <ol className="ga-pages">
                    {report.pages.map((p) => (
                      <li key={p.path}>
                        <span>{p.path}</span>
                        <strong>{nl.format(p.views)}</strong>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </>
          ) : (
            !error && <p className="ads-connect-note">Cijfers laden…</p>
          )}
          <div className="ads-connect-done">
            <Check size={15} aria-hidden="true" />
            <span>
              Gekoppeld: <strong>{status.propertyName || status.propertyId}</strong>
              {status.email ? ` (${status.email})` : ""}
            </span>
            <button type="button" className="button secondary" disabled={!!busy} onClick={() => void post("disconnect").then((d) => d && (setProps(null), setReport(null), load()))}>
              Ontkoppelen
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="ads-connect-error">
          {error}
        </p>
      )}
    </section>
  );
}
