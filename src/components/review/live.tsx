"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";
import { API_ACCESS_TEXT } from "@/components/account/google-integration-card";
import { REVIEW_FILTERS, type BusinessLocation, loadedStats, matchesFilter, monthlyTrend, replyQueue, type GoogleReview, type ReviewFilter, type ReviewsPage } from "@/lib/reviews/google";
import { StarRating } from "./shared";
import { LiveReviewCard } from "./live-card";

type Status = {
  status: string;
  connected: boolean;
  accountEmail: string | null;
  location: { name: string; address: string } | null;
  apiMessage?: string | null;
  apiKind?: "disabled" | "quota" | "project" | null;
};
type Data = { reviews: GoogleReview[]; next: string | null; average: number | null; total: number | null };
type Check = { state: string; message?: string; locations?: BusinessLocation[]; location?: { name: string; address: string } };

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Er ging iets mis. Probeer het opnieuw.");
  return d as T;
}
async function post<T>(url: string, body: unknown = {}): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Er ging iets mis. Probeer het opnieuw.");
  return d as T;
}

/** Title and text per connection state; only a missing or expired login needs Google consent again. */
export function gateContent(s: Status): { title: string; text: string; check: boolean; connect: string | null } {
  switch (s.status) {
    case "selection_required":
      return { title: "Google-account gekoppeld — locatie kiezen", text: "Kies welke bedrijfslocatie Mavix beheert. Daarna laden je reviews.", check: true, connect: null };
    case "api_access_required":
      return {
        title: s.apiKind === "disabled" ? "Google API nog niet ingeschakeld" : s.apiKind === "project" ? "Verkeerd Google Cloud-project" : "Google heeft nog geen API-quota beschikbaar",
        text: s.apiMessage || API_ACCESS_TEXT,
        check: true,
        connect: null,
      };
    case "reconnect_required":
    case "error":
      return { title: "Koppeling verlopen — opnieuw verbinden", text: "Google accepteert de opgeslagen toegang niet meer. Verbind je Google-account opnieuw; je locatiekeuze blijft bewaard.", check: false, connect: "Opnieuw verbinden" };
    case "permission_missing":
      return { title: "Toestemming ontbreekt — opnieuw verbinden", text: "Mavix mist de toestemming om je bedrijfsprofiel te beheren. Verbind opnieuw en vink de toestemming voor Google Bedrijfsprofiel aan.", check: false, connect: "Opnieuw verbinden" };
    default:
      return { title: "Koppel Google Bedrijfsprofiel", text: "Beheer je bedrijfsprofiel en reviews rechtstreeks vanuit Mavix. Met één koppeling zie en beantwoord je al je Google-reviews.", check: false, connect: "Koppelen" };
  }
}

// Connection states shown instead of reviews (never sample data). Existing
// connections are checked again with the stored access ("Opnieuw
// controleren"); Google consent is only asked for when it is really needed.
function Gate({ status, onConnected }: { status: Status; onConnected: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Check | null>(null);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState("");
  const content = gateContent(status);
  const base = "/api/integrations/google_business/";

  async function run(fn: () => Promise<Check>) {
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      setResult(r);
      if (r.state === "connected") onConnected();
      else if (r.locations?.length) setChoice(r.locations.length === 1 ? r.locations[0].location : "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const check = () => run(() => post<Check>(base + "check"));
  const choose = () => {
    const pick = result?.locations?.find((l) => l.location === choice);
    if (!pick) return setError("Kies eerst een locatie.");
    void run(() => post<Check>(base + "select", { account: pick.account, location: pick.location }));
  };
  // The latest check wins over the stored status text.
  const title =
    result?.state === "api_access_required" || result?.state === "location_access" || result?.state === "no_locations"
      ? result.state === "location_access"
        ? "Geen toegang tot deze bedrijfslocatie"
        : result.state === "no_locations"
          ? "Geen bedrijfslocatie gevonden"
          : content.title
      : content.title;
  const text = result?.message || content.text;

  return (
    <section className="ui-card rvl-gate" aria-busy={busy}>
      <span className="rvl-gate-icon" aria-hidden="true">
        <BrandIcon brand="google_business" size={24} />
      </span>
      <h2>{busy ? "Google-koppeling controleren…" : title}</h2>
      <p>{text}</p>
      {(status.accountEmail || status.location) && (
        <p className="rvl-gate-meta">
          {status.accountEmail && <span>Google-account: {status.accountEmail}</span>}
          {status.location && <span>Locatie: {status.location.name}</span>}
        </p>
      )}
      {result?.locations && result.locations.length > 0 && (
        <fieldset className="rvl-gate-picker">
          <legend>Kies je bedrijfslocatie</legend>
          {result.locations.map((l) => (
            <label key={l.location}>
              <input type="radio" name="gbp-location" value={l.location} checked={choice === l.location} onChange={() => setChoice(l.location)} disabled={busy} />
              <span>
                <strong>{l.title}</strong>
                {l.address && <small>{l.address}</small>}
                {l.closed && <small>Gesloten</small>}
              </span>
            </label>
          ))}
          <button type="button" className="button primary" onClick={choose} disabled={busy || !choice}>
            Deze locatie gebruiken
          </button>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="rvl-error">
          {error}
        </p>
      )}
      <div className="rvl-gate-actions">
        {content.check && !result?.locations?.length && (
          <button type="button" className="button primary" onClick={() => void check()} disabled={busy}>
            <RefreshCw size={14} aria-hidden="true" />
            {busy ? "Controleren…" : status.status === "selection_required" ? "Locaties ophalen" : "Opnieuw controleren"}
          </button>
        )}
        {content.connect && (
          <Link className="button primary" href="/account/integraties">
            {content.connect}
          </Link>
        )}
        {content.check && (
          <Link className="button secondary" href="/account/integraties">
            Koppeling bekijken
          </Link>
        )}
      </div>
    </section>
  );
}

// Real Google reviews of the selected location (Google is the source of truth).
export function LiveReviews({ tab }: { tab: "overview" | "inbox" }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<ReviewFilter>("all");

  const load = useCallback(async (pageToken?: string) => {
    setLoading(true);
    setError("");
    try {
      const page = await get<ReviewsPage>("/api/reviews?" + new URLSearchParams({ pageSize: "25", ...(pageToken ? { pageToken } : {}) }));
      setData((prev) =>
        pageToken && prev
          ? { ...prev, reviews: [...prev.reviews, ...page.reviews.filter((r) => !prev.reviews.some((p) => p.id === r.id))], next: page.nextPageToken }
          : { reviews: page.reviews, next: page.nextPageToken, average: page.averageRating, total: page.totalReviewCount },
      );
    } catch (e) {
      setError((e as Error).message);
      if (!pageToken) get<Status>("/api/integrations/google_business/status").then(setStatus, () => {});
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    get<Status>("/api/integrations/google_business/status")
      .then((s) => {
        setStatus(s);
        if (s.connected) void load();
      })
      .catch((e) => setStatusError((e as Error).message));
  }, [load]);
  useEffect(() => refresh(), [refresh]);

  const reviews = useMemo(() => data?.reviews || [], [data]);
  const stats = useMemo(() => loadedStats(reviews), [reviews]);
  const trend = useMemo(() => monthlyTrend(reviews), [reviews]);
  const maxCount = Math.max(1, ...trend.map((m) => m.count));
  const shown = reviews.filter((r) => matchesFilter(r, filter));
  const update = (next: GoogleReview) => setData((d) => (d ? { ...d, reviews: d.reviews.map((r) => (r.id === next.id ? next : r)) } : d));

  if (statusError)
    return (
      <p role="alert" className="rvl-error rvl-page-error">
        {statusError}
      </p>
    );
  if (!status)
    return (
      <div className="rvl-skeleton" role="status" aria-label="Reviews laden">
        <span />
        <span />
        <span />
      </div>
    );
  if (!status.connected) return <Gate status={status} onConnected={refresh} />;

  const errorBox = error && (
    <div className={"rvl-banner" + (error === API_ACCESS_TEXT ? " is-warn" : " is-error")} role="alert">
      <p>{error}</p>
      <button type="button" className="button secondary" onClick={() => void load()} disabled={loading}>
        <RefreshCw size={14} aria-hidden="true" />
        Opnieuw proberen
      </button>
    </div>
  );

  const summary = (
    <section className="ui-card rvl-summary" aria-label="Samenvatting">
      <div className="rvl-score">
        <strong>{data?.average !== null && data?.average !== undefined ? data.average.toLocaleString("nl-NL", { minimumFractionDigits: 1 }) : "—"}</strong>
        <div>
          {data?.average ? <StarRating rating={Math.round(data.average)} /> : null}
          <span>Gemiddelde op Google</span>
        </div>
      </div>
      <dl>
        <div>
          <dt>Reviews op Google</dt>
          <dd>{data?.total ?? "—"}</dd>
        </div>
        <div>
          <dt>Onbeantwoord</dt>
          <dd>{data ? stats.unanswered : "—"}</dd>
        </div>
        <div className={stats.urgent ? "is-urgent" : undefined}>
          <dt>Negatief en onbeantwoord</dt>
          <dd>{data ? stats.urgent : "—"}</dd>
        </div>
        <div>
          <dt>Nieuw (30 dagen)</dt>
          <dd>{data ? stats.lastThirtyDays : "—"}</dd>
        </div>
      </dl>
      {trend.length > 1 && (
        <div className="rvl-trend" aria-label="Reviews per maand">
          {trend.map((m) => (
            <div key={m.month} className="rvl-trend-col">
              <span className="rvl-trend-bar" style={{ height: Math.max(4, (m.count / maxCount) * 48) + "px" }} aria-hidden="true" />
              <small>{new Date(m.month + "-01T12:00:00Z").toLocaleDateString("nl-NL", { month: "short" })}</small>
              <span className="sr-only">
                {m.count} reviews{m.average !== null ? `, gemiddeld ${m.average}` : ""}
              </span>
              <small aria-hidden="true">{m.count ? `${m.count} · ${m.average ?? "—"}★` : "0"}</small>
            </div>
          ))}
        </div>
      )}
      <p className="rvl-scope">
        <BrandIcon brand="google_business" size={13} />
        {status.location?.name}
        {data ? ` · onbeantwoord, negatief, nieuw en het verloop zijn gebaseerd op de ${stats.loaded} geladen reviews` : ""}
      </p>
    </section>
  );

  if (tab === "overview") {
    // Negative reviews first: they need a personal answer soonest.
    const waiting = replyQueue(reviews).slice(0, 3);
    return (
      <>
        {summary}
        {errorBox}
        <section className="rvl-section">
          <div className="rvl-section-head">
            <h2>Wacht op antwoord</h2>
            <Link className="text-link" href="/reviews?tab=inbox">
              Alle reviews <ArrowUpRight size={14} />
            </Link>
          </div>
          {!data && loading ? (
            <div className="rvl-skeleton" role="status" aria-label="Reviews laden">
              <span />
              <span />
            </div>
          ) : waiting.length ? (
            waiting.map((r) => <LiveReviewCard key={r.id} review={r} onChange={update} />)
          ) : (
            <p className="rvl-empty">{reviews.length ? "Alle recente reviews zijn beantwoord. Netjes!" : "Er zijn nog geen reviews voor deze locatie."}</p>
          )}
        </section>
      </>
    );
  }

  return (
    <>
      {summary}
      {errorBox}
      <div className="rvl-filters" role="group" aria-label="Filter reviews">
        {REVIEW_FILTERS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label}
            {data && <span>{reviews.filter((r) => matchesFilter(r, id)).length}</span>}
          </button>
        ))}
      </div>
      <section className="rvl-list" aria-busy={loading}>
        {!data && loading ? (
          <div className="rvl-skeleton" role="status" aria-label="Reviews laden">
            <span />
            <span />
            <span />
          </div>
        ) : shown.length ? (
          shown.map((r) => <LiveReviewCard key={r.id} review={r} onChange={update} />)
        ) : (
          <p className="rvl-empty">
            {reviews.length ? "Geen reviews met dit filter in de geladen reviews." : "Er zijn nog geen reviews voor deze locatie."}
            {data?.next ? " Laad meer reviews om verder te zoeken." : ""}
          </p>
        )}
        {data?.next && (
          <button type="button" className="button secondary rvl-more" onClick={() => void load(data.next!)} disabled={loading}>
            {loading ? "Laden…" : "Meer laden"}
          </button>
        )}
      </section>
    </>
  );
}
