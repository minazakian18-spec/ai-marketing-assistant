"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";
import { API_ACCESS_TEXT } from "@/components/account/google-integration-card";
import { REVIEW_FILTERS, loadedStats, matchesFilter, type GoogleReview, type ReviewFilter, type ReviewsPage } from "@/lib/reviews/google";
import { StarRating } from "./shared";
import { LiveReviewCard } from "./live-card";

type Status = { status: string; connected: boolean; accountEmail: string | null; location: { name: string; address: string } | null };
type Data = { reviews: GoogleReview[]; next: string | null; average: number | null; total: number | null };

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Er ging iets mis. Probeer het opnieuw.");
  return d as T;
}

// Connection states shown instead of reviews (never sample data).
function Gate({ status }: { status: Status | null }) {
  const s = status?.status || "disconnected";
  const content =
    s === "selection_required"
      ? { title: "Kies je bedrijfslocatie", text: "Je Google-account is gekoppeld. Kies welke locatie Mavix beheert.", cta: "Locatie kiezen", href: "/account/integraties?select=google_business" }
      : s === "api_access_required"
        ? { title: "Wacht op toegang van Google", text: API_ACCESS_TEXT, cta: "Bekijk koppeling", href: "/account/integraties" }
        : s === "reconnect_required" || s === "permission_missing" || s === "error"
          ? { title: "Koppel Google Bedrijfsprofiel opnieuw", text: "De koppeling is verlopen of mist toestemming. Na opnieuw koppelen zie je je reviews weer.", cta: "Opnieuw koppelen", href: "/account/integraties" }
          : { title: "Koppel Google Bedrijfsprofiel", text: "Beheer je bedrijfsprofiel en reviews rechtstreeks vanuit Mavix. Met één koppeling zie en beantwoord je al je Google-reviews.", cta: "Koppelen", href: "/account/integraties" };
  return (
    <section className="ui-card rvl-gate">
      <span className="rvl-gate-icon" aria-hidden="true">
        <BrandIcon brand="google_business" size={24} />
      </span>
      <h2>{content.title}</h2>
      <p>{content.text}</p>
      <Link className="button primary" href={content.href}>
        {content.cta}
      </Link>
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

  useEffect(() => {
    get<Status>("/api/integrations/google_business/status")
      .then((s) => {
        setStatus(s);
        if (s.connected) void load();
      })
      .catch((e) => setStatusError((e as Error).message));
  }, [load]);

  const reviews = useMemo(() => data?.reviews || [], [data]);
  const stats = useMemo(() => loadedStats(reviews), [reviews]);
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
  if (!status.connected) return <Gate status={status} />;

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
        <div>
          <dt>Nieuw (30 dagen)</dt>
          <dd>{data ? stats.lastThirtyDays : "—"}</dd>
        </div>
      </dl>
      <p className="rvl-scope">
        <BrandIcon brand="google_business" size={13} />
        {status.location?.name}
        {data ? ` · onbeantwoord en nieuw gebaseerd op de ${stats.loaded} meest recente reviews` : ""}
      </p>
    </section>
  );

  if (tab === "overview") {
    const waiting = reviews.filter((r) => !r.reply).slice(0, 3);
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
