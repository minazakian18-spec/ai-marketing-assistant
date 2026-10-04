"use client";
import { useState } from "react";
import { Check, Pencil, RefreshCw, Send, Sparkles } from "lucide-react";
import type { Review } from "@/lib/review-model";
import { statusLabel } from "@/lib/review-model";
import { StarRating, relativeDate } from "./shared";

export function ReviewCard({
  review,
  onApprove,
  onPublish,
  onRegenerate,
  onSaveResponse,
}: {
  review: Review;
  onApprove: () => void;
  onPublish: () => void;
  onRegenerate: () => void;
  onSaveResponse: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.aiResponse);
  const badgeClass =
    review.status === "published" || review.status === "approved"
      ? "approved"
      : review.status === "flagged"
        ? "draft"
        : "scheduled";
  return (
    <article className="panel rv-card">
      <div className="rv-card-head">
        <div className="rv-card-who">
          <span className="rv-avatar" aria-hidden="true">
            {review.initials}
          </span>
          <div>
            <h3>{review.reviewer}</h3>
            <div className="rv-card-meta">
              <StarRating rating={review.rating} />
              <span className="rv-platform-badge">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 11v2.7h6.3c-.27 1.6-1.94 4.7-6.3 4.7-3.8 0-6.9-3.1-6.9-7s3.1-7 6.9-7c2.16 0 3.6.9 4.43 1.7l2.28-2.2C17.15 2.6 14.8 1.6 12 1.6 6.9 1.6 2.7 5.8 2.7 11S6.9 20.4 12 20.4c6.1 0 8.9-4.3 8.9-6.5 0-.7-.06-1.3-.16-1.9H12Z" />
                </svg>
                Google · voorbeeld
              </span>
              <span className="rv-card-date">{relativeDate(review.date)}</span>
            </div>
          </div>
        </div>
        <span className={`badge ${badgeClass}`}>{statusLabel[review.status]}</span>
      </div>
      <p className="rv-review-text">&ldquo;{review.text}&rdquo;</p>
      <div className="rv-ai-block">
        <div className="rv-ai-label">
          <Sparkles /> AI-conceptreactie
        </div>
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
          />
        ) : (
          <p>{review.aiResponse}</p>
        )}
      </div>
      <div className="rv-card-actions">
        {review.autoHandled && (
          <span className="rv-auto-tag">
            <Sparkles size={12} /> Automatisch afgehandeld door Mavix
          </span>
        )}
        <div className="rv-card-actions-buttons">
          {editing ? (
            <button
              className="button secondary"
              onClick={() => {
                onSaveResponse(draft);
                setEditing(false);
              }}
            >
              <Check size={14} /> Opslaan
            </button>
          ) : (
            <button
              className="button secondary"
              onClick={() => {
                setDraft(review.aiResponse);
                setEditing(true);
              }}
            >
              <Pencil size={14} /> Bewerken
            </button>
          )}
          <button
            className="button secondary"
            onClick={() => {
              onRegenerate();
              setEditing(false);
            }}
          >
            <RefreshCw size={14} /> Regenereren
          </button>
          <button
            className="button secondary"
            onClick={onApprove}
            disabled={review.status === "approved" || review.status === "published"}
          >
            <Check size={14} /> Goedkeuren
          </button>
          <button
            className="button primary"
            onClick={onPublish}
            disabled={review.status === "published"}
          >
            <Send size={14} /> Publiceren
          </button>
        </div>
      </div>
    </article>
  );
}
