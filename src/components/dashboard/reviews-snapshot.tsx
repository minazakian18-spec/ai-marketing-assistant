"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Star } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui";
import { loadedStats, type ReviewsPage } from "@/lib/reviews/google";

// Real Google review figures. Average and total come straight from Google;
// unanswered and "new" are counted over the most recent reviews only, and the
// card says so.
export function ReviewsSnapshot() {
  const [page, setPage] = useState<ReviewsPage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reviews?pageSize=50", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Reviews konden niet worden geladen.");
        return d as ReviewsPage;
      })
      .then((d) => !cancelled && setPage(d))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = page ? loadedStats(page.reviews) : null;
  return (
    <Card className="dash-card dash-reviews">
      <SectionHeader
        title="Google-reviews"
        description="Rechtstreeks uit je Google Bedrijfsprofiel."
        icon={<Star size={16} />}
        action={
          <Link className="text-link dash-link" href="/reviews?tab=inbox">
            Reviews <ArrowUpRight size={14} />
          </Link>
        }
      />
      {error ? (
        <p className="dash-note">{error}</p>
      ) : !page || !stats ? (
        <div className="dash-reviews-grid" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="ui-skeleton dash-reviews-skeleton" />
          ))}
        </div>
      ) : (
        <>
          <dl className="dash-reviews-grid">
            <div>
              <dt>Gemiddelde</dt>
              <dd>{page.averageRating !== null ? page.averageRating.toLocaleString("nl-NL", { minimumFractionDigits: 1 }) : "—"}</dd>
            </div>
            <div>
              <dt>Reviews totaal</dt>
              <dd>{page.totalReviewCount ?? "—"}</dd>
            </div>
            <div className={stats.unanswered ? "is-attention" : undefined}>
              <dt>Onbeantwoord</dt>
              <dd>{stats.unanswered}</dd>
            </div>
          </dl>
          <p className="dash-note">
            {stats.lastThirtyDays} nieuw in de laatste 30 dagen · onbeantwoord en nieuw gebaseerd op de {stats.loaded} meest recente reviews.
          </p>
        </>
      )}
    </Card>
  );
}
