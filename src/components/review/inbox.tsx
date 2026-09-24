"use client";
import { useState } from "react";
import { Inbox as InboxIcon } from "lucide-react";
import type { Review } from "@/lib/review-model";
import { ReviewCard } from "./review-card";

type Filter = "all" | "pending" | "flagged" | "published";

export function ReviewInbox({
  reviews,
  onApprove,
  onPublish,
  onRegenerate,
  onSaveResponse,
}: {
  reviews: Review[];
  onApprove: (id: string) => void;
  onPublish: (id: string) => void;
  onRegenerate: (id: string) => void;
  onSaveResponse: (id: string, text: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const filtered = reviews
    .filter((r) => {
      if (filter === "pending") return r.status === "new" || r.status === "drafted";
      if (filter === "flagged") return r.status === "flagged";
      if (filter === "published") return r.status === "published";
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const counts = {
    all: reviews.length,
    pending: reviews.filter((r) => r.status === "new" || r.status === "drafted").length,
    flagged: reviews.filter((r) => r.status === "flagged").length,
    published: reviews.filter((r) => r.status === "published").length,
  };
  const filters: [Filter, string][] = [
    ["all", "Alle"],
    ["pending", "Wacht op goedkeuring"],
    ["flagged", "Aandacht nodig"],
    ["published", "Gepubliceerd"],
  ];
  return (
    <section>
      <div className="ig-section-title">
        <div>
          <h2>Review-inbox</h2>
          <p>Al je Google-reviews op één plek, met een AI-conceptreactie klaar.</p>
        </div>
      </div>
      <div className="rv-filters">
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="rv-filter-pill"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label} <span>{counts[key]}</span>
          </button>
        ))}
      </div>
      {filtered.length ? (
        filtered.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            onApprove={() => onApprove(review.id)}
            onPublish={() => onPublish(review.id)}
            onRegenerate={() => onRegenerate(review.id)}
            onSaveResponse={(text) => onSaveResponse(review.id, text)}
          />
        ))
      ) : (
        <div className="panel ig-empty">
          <InboxIcon size={28} />
          <h2>Niets te zien hier</h2>
          <p>Er zijn geen reviews met dit filter.</p>
        </div>
      )}
    </section>
  );
}
