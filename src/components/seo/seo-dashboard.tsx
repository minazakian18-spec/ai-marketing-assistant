"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarClock, Download, FileText, Globe, Loader2, Plus, RefreshCw, Search, ShieldQuestion, Trash2, X } from "lucide-react";
import { isBrowserDemo } from "@/lib/demo";
import { PageHeading } from "@/components/ui";
import { CATEGORY_LABEL, CATEGORY_WEIGHT, CHECKS } from "@/lib/seo/checks";
import type { Category, ScanReport } from "@/lib/seo/types";
import { CopyButton, Info, ScoreRing, ToneBadge, dateTime } from "./seo-parts";
import { Recommendations } from "./seo-recommendations";
import { Performance } from "./seo-performance";
import { SearchConsole } from "./seo-search-console";
import { History, type ScanSummary } from "./seo-history";
import { Pages } from "./seo-pages";

// SEO Intelligence: websites, analyses (crawler + Google PageSpeed Insights),
// recommendations, history and the optional private Search Console data.

type Site = {
  id: string;
  url: string;
  host: string;
  focusKeyword: string;
  verified: boolean;
  verifiedAt: string | null;
  verificationToken: string;
  schedule: "off" | "weekly" | "monthly";
  nextScanAt: string | null;
  gscProperty: string | null;
  pageLimit: number;
  latest: (ScanSummary & { stage: string | null; progress: { pages?: number; limit?: number; links?: number } }) | null;
};
type Overview = { sites: Site[]; searchConsole: string; limits: { sites: number; scansPerDay: number }; pagespeedKey: boolean; role: string };
type Scan = ScanSummary & { stage: string | null; progress: { pages?: number; limit?: number; links?: number }; report?: ScanReport | null };
type Tab = "recs" | "pages" | "perf" | "gsc" | "history";

const TABS: [Tab, string][] = [
  ["recs", "Aanbevelingen"],
  ["pages", "Pagina's"],
  ["perf", "Prestaties"],
  ["gsc", "Zoekresultaten"],
  ["history", "Geschiedenis"],
];
const STAGE: Record<string, string> = {
  queued: "In de wachtrij",
  start: "Voorbereiden",
  robots: "robots.txt controleren",
  sitemap: "Sitemap zoeken",
  crawl: "Pagina's analyseren",
  links: "Links controleren",
  pagespeed: "Snelheid meten met Google PageSpeed",
};
const STAGES = ["queued", "start", "robots", "sitemap", "crawl", "links", "pagespeed"];
const CATS = Object.keys(CATEGORY_WEIGHT) as Category[];
const CAT_HELP: Record<Category, string> = {
  technical: "Kan Google je website vinden, lezen en opnemen? Statuscodes, robots.txt, sitemap, indexering, canonical, doorverwijzingen, kapotte links en gestructureerde data.",
  content: "Begrijpt Google waar je pagina's over gaan? Titels, beschrijvingen, koppen, hoeveelheid tekst en je zoekwoord.",
  performance: "Hoe snel laadt je website? Gemeten door Google Lighthouse (PageSpeed Insights) en, als er genoeg bezoekers zijn, Core Web Vitals van echte bezoekers.",
  mobile: "Werkt je website goed op een telefoon? Viewport, inzoomen en leesbare tekst.",
  security: "HTTPS, doorverwijzing naar HTTPS en basisbeveiligingsheaders.",
  accessibility: "Is je website bruikbaar voor iedereen? Taal, alt-teksten, linkteksten en de Lighthouse-toegankelijkheidsscore.",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init?.body ? { ...init, headers: { "Content-Type": "application/json" } } : init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Er ging iets mis. Probeer het opnieuw.");
  return d as T;
}

function csv(report: ScanReport) {
  const q = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  const rows = [["Ernst", "Onderdeel", "Probleem", "Actie", "Pagina's"].map(q).join(";")];
  const sev: Record<string, string> = { critical: "Kritiek", high: "Hoog", medium: "Gemiddeld", low: "Laag" };
  for (const r of report.recommendations) rows.push([sev[r.severity], CATEGORY_LABEL[r.category], r.problem, r.action, r.urls.join(" ")].map(q).join(";"));
  return "﻿" + rows.join("\r\n");
}

export function SeoDashboard() {
  const [demo, setDemo] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [scan, setScan] = useState<Scan | null>(null);
  const [tab, setTab] = useState<Tab>("recs");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [form, setForm] = useState({ url: "", keyword: "" });

  const site = overview?.sites.find((s) => s.id === siteId) || null;
  const canManage = overview?.role === "OWNER" || overview?.role === "ADMIN";

  const loadOverview = useCallback(async () => {
    const d = await api<Overview>("/api/seo/sites");
    setOverview(d);
    setSiteId((current) => (current && d.sites.some((s) => s.id === current) ? current : d.sites[0]?.id || null));
    return d;
  }, []);

  const loadScans = useCallback(async (id: string) => {
    const d = await api<{ scans: ScanSummary[] }>(`/api/seo/sites/${id}/scans`);
    setScans(d.scans);
    return d.scans;
  }, []);

  const openScan = useCallback(async (id: string) => {
    const d = await api<{ scan: Scan }>(`/api/seo/scans/${id}`);
    setScan(d.scan);
    return d.scan;
  }, []);

  useEffect(() => {
    const isDemo = isBrowserDemo();
    setDemo(isDemo);
    const q = new URLSearchParams(window.location.search);
    const gsc = q.get("gsc");
    if (gsc) {
      const text: Record<string, string> = {
        connected: "Google Search Console is gekoppeld.",
        denied: "Je hebt geen toestemming gegeven. Er is niets gekoppeld.",
        permission: "Mavix kreeg geen leestoegang tot Search Console. Koppel opnieuw en sta de toegang toe.",
        offline_access: "Google gaf geen blijvende toegang. Koppel opnieuw.",
        expired: "De koppelpoging is verlopen. Probeer het opnieuw.",
        failed: "Koppelen is niet gelukt. Probeer het later opnieuw.",
      };
      setNotice(text[gsc] || "");
      if (gsc === "connected") setTab("gsc");
      window.history.replaceState(null, "", "/seo");
    }
    if (isDemo) return;
    loadOverview().catch((e) => setError(e.message));
  }, [loadOverview]);

  // When the website changes: its analyses and the latest completed report.
  useEffect(() => {
    if (!siteId) return;
    setScan(null);
    loadScans(siteId)
      .then((list) => {
        const current = list.find((s) => s.status === "queued" || s.status === "running") || list.find((s) => s.status === "completed") || list[0];
        if (current) void openScan(current.id);
      })
      .catch((e) => setError(e.message));
  }, [siteId, loadScans, openScan]);

  useEffect(() => {
    if (!verifyOpen) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setVerifyOpen(false);
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [verifyOpen]);

  // Poll a running analysis.
  const running = scan && (scan.status === "queued" || scan.status === "running");
  useEffect(() => {
    if (!running || !scan) return;
    const t = window.setInterval(() => {
      openScan(scan.id)
        .then((s) => {
          if (s.status === "completed" || s.status === "failed") {
            if (siteId) void loadScans(siteId);
            void loadOverview();
          }
        })
        .catch(() => {});
    }, 2000);
    return () => window.clearInterval(t);
  }, [running, scan, openScan, loadScans, loadOverview, siteId]);

  async function start(id: string) {
    setBusy(true);
    setError("");
    try {
      const d = await api<{ id: string }>(`/api/seo/sites/${id}/scans`, { method: "POST", body: "{}" });
      setTab("recs");
      await openScan(d.id);
      await loadScans(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "De analyse kon niet worden gestart.");
    } finally {
      setBusy(false);
    }
  }

  async function addSite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await api<{ site: Site }>("/api/seo/sites", { method: "POST", body: JSON.stringify({ url: form.url, focusKeyword: form.keyword }) });
      setForm({ url: "", keyword: "" });
      setAdding(false);
      await loadOverview();
      setSiteId(d.site.id);
      await start(d.site.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "De website kon niet worden toegevoegd.");
    } finally {
      setBusy(false);
    }
  }

  async function patchSite(patch: Record<string, unknown>, message: string) {
    if (!site) return;
    setError("");
    try {
      await api(`/api/seo/sites/${site.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await loadOverview();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan is niet gelukt.");
    }
  }

  async function removeSite() {
    if (!site || !window.confirm(`${site.host} en alle analyses ervan verwijderen?`)) return;
    try {
      await api(`/api/seo/sites/${site.id}`, { method: "DELETE" });
      setSiteId(null);
      setScan(null);
      setScans([]);
      await loadOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verwijderen is niet gelukt.");
    }
  }

  async function verify() {
    if (!site) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/seo/sites/${site.id}/verify`, { method: "POST", body: "{}" });
      await loadOverview();
      setVerifyOpen(false);
      setNotice("Website geverifieerd. Je kunt nu tot 30 pagina's per analyse laten controleren en automatische analyses inplannen.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verifiëren is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  const report = scan?.status === "completed" ? scan.report || null : null;
  const progressPct = useMemo(() => {
    if (!running || !scan) return 0;
    const i = Math.max(0, STAGES.indexOf(scan.stage || "queued"));
    const crawl = scan.stage === "crawl" && scan.progress.limit ? (scan.progress.pages || 0) / scan.progress.limit : 0;
    return Math.min(96, Math.round(((i + crawl) / STAGES.length) * 100));
  }, [running, scan]);

  if (demo)
    return (
      <div className="seo">
        <Header />
        <section className="ui-card seo-hero">
          <h2>SEO-analyse werkt met een echt account</h2>
          <p>In de testmodus voert Mavix geen analyses uit en verstuurt het geen websiteadressen. Log in met je account om je website echt te laten analyseren.</p>
        </section>
      </div>
    );

  return (
    <div className="seo">
      <Header />
      {notice && (
        <p className="seo-notice" role="status">
          {notice}
          <button type="button" onClick={() => setNotice("")} aria-label="Melding sluiten">
            <X size={14} />
          </button>
        </p>
      )}
      {error && (
        <p className="seo-error seo-page-error" role="alert">
          {error}
        </p>
      )}

      {!overview && !error && <div className="seo-skeleton seo-skeleton-hero" aria-busy="true" aria-label="Laden" />}

      {overview && (!overview.sites.length || adding) && (
        <section className="ui-card seo-hero">
          <span className="seo-hero-icon" aria-hidden="true">
            <Search size={20} />
          </span>
          <h2>{overview.sites.length ? "Website toevoegen" : "Hoe vindbaar is je website?"}</h2>
          <p>
            Mavix bekijkt je website zoals een zoekmachine dat doet: titels, beschrijvingen, koppen, links, snelheid, mobiel gebruik en beveiliging. Je krijgt een duidelijke lijst met
            verbeterpunten, van belangrijk naar minder belangrijk.
          </p>
          {canManage ? (
            <form className="seo-add" onSubmit={(e) => void addSite(e)} noValidate>
              <label>
                Website
                <input inputMode="url" autoComplete="url" placeholder="jouwbedrijf.nl" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required maxLength={500} />
              </label>
              <label>
                <span>
                  Belangrijkste zoekwoord <small>(optioneel)</small> <Info label="Wat is een zoekwoord?">Het woord of de woorden waarop je gevonden wilt worden, bijvoorbeeld &quot;italiaans restaurant gouda&quot;. Mavix controleert of het op je homepage staat.</Info>
                </span>
                <input placeholder="italiaans restaurant gouda" value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} maxLength={80} />
              </label>
              <div className="seo-add-actions">
                {overview.sites.length > 0 && (
                  <button type="button" className="button secondary" onClick={() => setAdding(false)}>
                    Annuleren
                  </button>
                )}
                <button type="submit" className="button primary" disabled={busy || !form.url.trim()}>
                  {busy ? <Loader2 size={15} className="seo-spin" aria-hidden="true" /> : <Search size={15} aria-hidden="true" />}
                  Analyse starten
                </button>
              </div>
            </form>
          ) : (
            <p className="seo-note">Een eigenaar of beheerder van deze werkruimte kan een website toevoegen.</p>
          )}
          <p className="seo-note">
            Mavix bekijkt maximaal 10 pagina&apos;s (30 na verificatie), respecteert robots.txt en wacht tussen verzoeken. De snelheid wordt gemeten met Google PageSpeed Insights.
          </p>
        </section>
      )}

      {overview && site && !adding && (
        <>
          <section className="ui-card seo-sitebar">
            <div className="seo-site">
              <Globe size={18} aria-hidden="true" />
              {overview.sites.length > 1 ? (
                <select value={site.id} onChange={(e) => setSiteId(e.target.value)} aria-label="Website">
                  {overview.sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.host}
                    </option>
                  ))}
                </select>
              ) : (
                <strong>{site.host}</strong>
              )}
              {site.verified ? (
                <span className="seo-verified">
                  <BadgeCheck size={14} aria-hidden="true" /> Geverifieerd
                </span>
              ) : (
                <button type="button" className="seo-unverified" onClick={() => setVerifyOpen(true)} disabled={!canManage}>
                  <ShieldQuestion size={14} aria-hidden="true" /> Niet geverifieerd
                </button>
              )}
            </div>
            <div className="seo-site-actions">
              {canManage && (
                <>
                  <label className="seo-inline">
                    <CalendarClock size={14} aria-hidden="true" />
                    <span className="sr-only">Automatische analyse</span>
                    <select
                      value={site.schedule}
                      disabled={!site.verified}
                      title={site.verified ? "Automatische analyse" : "Verifieer je website om analyses in te plannen"}
                      onChange={(e) => void patchSite({ schedule: e.target.value }, e.target.value === "off" ? "Automatische analyse uitgezet." : "Automatische analyse ingepland.")}
                    >
                      <option value="off">Niet automatisch</option>
                      <option value="weekly">Elke week</option>
                      <option value="monthly">Elke maand</option>
                    </select>
                  </label>
                  {overview.sites.length < overview.limits.sites && (
                    <button type="button" className="button secondary" onClick={() => setAdding(true)}>
                      <Plus size={15} aria-hidden="true" /> Website
                    </button>
                  )}
                  <button type="button" className="seo-icon-button" onClick={() => void removeSite()} aria-label={"Verwijder " + site.host}>
                    <Trash2 size={15} />
                  </button>
                </>
              )}
              <button type="button" className="button primary" onClick={() => void start(site.id)} disabled={busy || !!running}>
                {running ? <Loader2 size={15} className="seo-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
                {running ? "Analyse loopt" : "Nieuwe analyse"}
              </button>
            </div>
          </section>

          {running && scan && (
            <section className="ui-card seo-progress" aria-live="polite">
              <div className="seo-progress-head">
                <Loader2 size={18} className="seo-spin" aria-hidden="true" />
                <div>
                  <strong>{STAGE[scan.stage || "queued"] || "Bezig"}</strong>
                  <span>
                    {scan.progress.pages ? `${scan.progress.pages} van maximaal ${scan.progress.limit} pagina's bekeken` : "Dit duurt meestal één tot drie minuten."}
                    {scan.progress.links ? ` · ${scan.progress.links} links gecontroleerd` : ""}
                  </span>
                </div>
              </div>
              <div className="seo-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct} aria-label="Voortgang">
                <span style={{ width: progressPct + "%" }} />
              </div>
              <ol className="seo-stage-list">
                {STAGES.slice(2).map((s) => {
                  const at = STAGES.indexOf(scan.stage || "queued");
                  const me = STAGES.indexOf(s);
                  return (
                    <li key={s} className={me < at ? "is-done" : me === at ? "is-now" : ""}>
                      {STAGE[s]}
                    </li>
                  );
                })}
              </ol>
              <p className="seo-note">Je kunt deze pagina gerust verlaten; de analyse loopt door en het resultaat wordt bewaard.</p>
            </section>
          )}

          {scan?.status === "failed" && !running && (
            <section className="ui-card seo-failed" role="alert">
              <strong>De analyse is niet gelukt</strong>
              <p>{scan.error || "Probeer het later opnieuw."}</p>
            </section>
          )}

          {!scan && !running && scans.length === 0 && (
            <section className="ui-card seo-hero">
              <h2>Nog geen analyse</h2>
              <p>Start je eerste analyse van {site.host}.</p>
            </section>
          )}

          {report && scan && (
            <>
              <section className="ui-card seo-scores">
                <div className="seo-overall">
                  <ScoreRing value={report.scores.overall} size={132} />
                  <div className="seo-overall-text">
                    <h2>
                      Mavix SEO-score <ToneBadge score={report.scores.overall} />
                    </h2>
                    <p>
                      Gebaseerd op {report.checks.filter((c) => c.ratio !== null).length} meetbare controles van {report.site.crawl.crawled}{" "}
                      {report.site.crawl.crawled === 1 ? "pagina" : "pagina's"}. Dit is een score van Mavix, geen officiële Google-score.
                    </p>
                    <p className="seo-meta">
                      Geanalyseerd op {dateTime(scan.completed_at)}
                      {report.site.crawl.stopped === "limit" && ` · limiet van ${report.site.crawl.limit} pagina's bereikt`}
                      {report.site.crawl.skippedByRobots > 0 && ` · ${report.site.crawl.skippedByRobots} pagina's overgeslagen door robots.txt`}
                    </p>
                    <div className="seo-overall-actions">
                      <button type="button" className="seo-link-button" onClick={() => setHowOpen((o) => !o)} aria-expanded={howOpen}>
                        Hoe berekenen we dit?
                      </button>
                      <Link className="seo-link-button" href={`/seo/rapport/${scan.id}`} target="_blank">
                        <FileText size={13} aria-hidden="true" /> Rapport
                      </Link>
                      <a className="seo-link-button" href={"data:text/csv;charset=utf-8," + encodeURIComponent(csv(report))} download={`seo-${site.host}-${(scan.completed_at || "").slice(0, 10)}.csv`}>
                        <Download size={13} aria-hidden="true" /> CSV
                      </a>
                    </div>
                  </div>
                </div>
                <div className="seo-cats">
                  {CATS.map((c) => (
                    <div key={c} className="seo-cat">
                      <ScoreRing value={report.scores.categories[c]} size={64} stroke={6} />
                      <div>
                        <span className="seo-cat-label">
                          {CATEGORY_LABEL[c]} <Info label={"Uitleg " + CATEGORY_LABEL[c]}>{CAT_HELP[c]}</Info>
                        </span>
                        <ToneBadge score={report.scores.categories[c]} />
                      </div>
                    </div>
                  ))}
                </div>
                {howOpen && <HowCalculated report={report} />}
              </section>

              <div className="seo-tabs" role="tablist" aria-label="Onderdelen">
                {TABS.map(([t, label]) => (
                  <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                    {label}
                    {t === "recs" && report.recommendations.length > 0 && <span>{report.recommendations.length}</span>}
                  </button>
                ))}
              </div>
              <section className="ui-card seo-panel" role="tabpanel" key={tab}>
                {tab === "recs" && <Recommendations scanId={scan.id} items={report.recommendations} />}
                {tab === "pages" && <Pages pages={report.pages} />}
                {tab === "perf" && <Performance psi={report.psi} pagespeedKey={overview.pagespeedKey} />}
                {tab === "gsc" && <SearchConsole siteId={site.id} canManage={canManage} />}
                {tab === "history" && <History scans={scans} currentId={scan.id} onOpen={(id) => void openScan(id)} />}
              </section>
            </>
          )}

          {!report && !running && scans.some((s) => s.status === "completed") && scan?.status === "failed" && (
            <p className="seo-note">
              <button type="button" className="seo-link-button" onClick={() => void openScan(scans.find((s) => s.status === "completed")!.id)}>
                Toon de laatste geslaagde analyse
              </button>
            </p>
          )}

          {canManage && (
            <section className="ui-card seo-keyword">
              <label>
                <span>
                  Belangrijkste zoekwoord <Info label="Wat doet het zoekwoord?">Mavix controleert of dit woord in de titel, H1, beschrijving en tekst van je homepage staat, en gebruikt het bij tekstvoorstellen.</Info>
                </span>
                <input
                  defaultValue={site.focusKeyword}
                  key={site.id}
                  maxLength={80}
                  placeholder="bijv. italiaans restaurant gouda"
                  onBlur={(e) => e.target.value.trim() !== site.focusKeyword && void patchSite({ focusKeyword: e.target.value }, "Zoekwoord opgeslagen. Het telt mee vanaf de volgende analyse.")}
                />
              </label>
            </section>
          )}
        </>
      )}

      {verifyOpen && site && (
        <>
          <div className="seo-scrim" onClick={() => setVerifyOpen(false)} aria-hidden="true" />
          <section className="seo-dialog" role="dialog" aria-modal="true" aria-labelledby="seo-verify-title">
            <header>
              <h2 id="seo-verify-title">Bevestig dat {site.host} van jou is</h2>
              <button type="button" className="seo-icon-button" onClick={() => setVerifyOpen(false)} aria-label="Sluiten">
                <X size={16} />
              </button>
            </header>
            <p>Na verificatie bekijkt Mavix tot 30 pagina&apos;s per analyse en kun je automatische analyses inplannen. Kies één manier:</p>
            <h3>1. Code in de &lt;head&gt; van je homepage</h3>
            <pre className="seo-code">{`<meta name="mavix-site-verification" content="${site.verificationToken}">`}</pre>
            <CopyButton text={`<meta name="mavix-site-verification" content="${site.verificationToken}">`} small />
            <h3>2. Of een bestand op je website</h3>
            <p>
              Zet een bestand <code>mavix-verification.txt</code> in de hoofdmap (dus {new URL(site.url).origin}/mavix-verification.txt) met als enige inhoud:
            </p>
            <pre className="seo-code">{site.verificationToken}</pre>
            <CopyButton text={site.verificationToken} small />
            <div className="seo-dialog-actions">
              <button type="button" className="button secondary" onClick={() => setVerifyOpen(false)}>
                Later
              </button>
              <button type="button" className="button primary" onClick={() => void verify()} disabled={busy}>
                {busy ? "Controleren…" : "Nu controleren"}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Header() {
  return <PageHeading eyebrow="Marketing" title="SEO Intelligence" description="Ontdek hoe goed je website vindbaar is en wat je kunt verbeteren." />;
}

function HowCalculated({ report }: { report: ScanReport }) {
  return (
    <div className="seo-how">
      <p>
        Elke controle geeft een percentage (bijvoorbeeld &quot;8 van 10 pagina&apos;s hebben een titel&quot; = 80%). Een onderdeelscore is het gewogen gemiddelde van de controles in dat
        onderdeel. De totaalscore weegt de onderdelen: {CATS.map((c) => `${CATEGORY_LABEL[c].toLowerCase()} ${CATEGORY_WEIGHT[c]}%`).join(", ")}. Wat niet gemeten kon worden (bijvoorbeeld
        prestaties als PageSpeed Insights niet antwoordde) telt niet mee; de andere onderdelen wegen dan naar verhouding zwaarder.
      </p>
      <div className="seo-how-grid">
        {CATS.map((c) => (
          <div key={c}>
            <h4>
              {CATEGORY_LABEL[c]} <span>{report.scores.categories[c] ?? "—"}</span>
            </h4>
            <ul>
              {report.checks
                .filter((k) => k.category === c)
                .map((k) => (
                  <li key={k.id} className={k.ratio === null ? "is-na" : k.ratio >= 1 ? "is-pass" : "is-fail"}>
                    <span>
                      {k.label} <small>gewicht {k.weight}</small>
                    </span>
                    <strong>{k.ratio === null ? "n.v.t." : Math.round(k.ratio * 100) + "%"}</strong>
                    <small className="seo-how-detail">{k.detail}</small>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="seo-note">Prestaties en de Lighthouse-toegankelijkheidsscore komen van Google PageSpeed Insights (labmeting). Alle andere controles meet Mavix zelf tijdens de analyse.</p>
      {CHECKS.length !== report.checks.length && <p className="seo-note">Deze analyse is gemaakt met een eerdere versie van de controles.</p>}
    </div>
  );
}
