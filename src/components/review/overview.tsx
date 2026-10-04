import Link from "next/link";
import { ArrowUpRight, Inbox, Sparkles, Wrench } from "lucide-react";
import type { Review, ResponseMode } from "@/lib/review-model";
import { responseModeName, responseModeDescription } from "@/lib/review-model";
import { StarRating } from "./shared";
import { ReviewCard } from "./review-card";

export function ReviewOverview({
  reviews,
  mode,
  enabled,
  onApprove,
  onPublish,
  onRegenerate,
  onSaveResponse,
}: {
  reviews: Review[];
  mode: ResponseMode;
  enabled: boolean;
  onApprove: (id: string) => void;
  onPublish: (id: string) => void;
  onRegenerate: (id: string) => void;
  onSaveResponse: (id: string, text: string) => void;
}) {
  const average = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;
  const pending = reviews.filter((r) =>
    ["new", "drafted", "flagged"].includes(r.status),
  );
  const autoHandled = reviews.filter((r) => r.autoHandled);
  const needsAttention = reviews.filter((r) => r.status === "flagged");
  const recent = [...reviews]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2);
  return (
    <>
      <section className="panel rv-summary-strip">
        <div className="rv-summary-score">
          <strong>{average.toFixed(1)}</strong>
          <StarRating rating={Math.round(average)} />
          <span>Gemiddelde score</span>
        </div>
        <div className="rv-summary-divider" />
        <span className="rv-summary-score">
          <strong>{reviews.length}</strong>
          <span>Reviews totaal · voorbeeld</span>
        </span>
        <div className="rv-summary-divider" />
        <span className="rv-summary-score">
          <strong>{autoHandled.length}</strong>
          <span>Automatisch beantwoord</span>
        </span>
      </section>
      <div className="rv-mode-banner">
        <Sparkles size={16} />
        <span>
          Actieve modus: <strong>{responseModeName(mode)}</strong> ·{" "}
          {enabled ? "Auto Reply actief · simulatie" : "Auto Reply uitgeschakeld"}
        </span>
      </div>
      <div className="channel-kpis">
        {[
          ["Wacht op goedkeuring", String(pending.length), "Jouw blik maakt het verschil"],
          ["Aandacht nodig", String(needsAttention.length), "Lage beoordelingen om zelf te bekijken"],
          ["Automatisch beantwoord", String(autoHandled.length), "Deze week · simulatie"],
          ["Gemiddelde score", average.toFixed(1) + " / 5", "Over alle voorbeeldreviews"],
        ].map(([label, value, note]) => (
          <article className="panel" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
            <span>{note}</span>
          </article>
        ))}
      </div>
      <section className="channel-mode-section">
        <div className="ig-section-title">
          <h2>Laatste reviews</h2>
          <Link className="text-link" href="/reviews?tab=inbox">
            Volledige inbox <ArrowUpRight size={14} />
          </Link>
        </div>
        {recent.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            onApprove={() => onApprove(review.id)}
            onPublish={() => onPublish(review.id)}
            onRegenerate={() => onRegenerate(review.id)}
            onSaveResponse={(text) => onSaveResponse(review.id, text)}
          />
        ))}
      </section>
      <section className="channel-mode-section">
        <div className="ig-section-title">
          <h2>Snel verder</h2>
          <span>Werk op jouw manier</span>
        </div>
        <div className="channel-mode-cards">
          <Link href="/reviews?tab=inbox">
            <Inbox size={22} />
            <strong>Inbox</strong>
            <p>Bekijk, bewerk en publiceer reacties op al je reviews.</p>
            <span>
              Open inbox <ArrowUpRight size={14} />
            </span>
          </Link>
          <Link href="/reviews?tab=auto-reply">
            <Sparkles size={22} />
            <strong>Auto Reply</strong>
            <p>{responseModeDescription(mode)}</p>
            <span>
              Instellen <ArrowUpRight size={14} />
            </span>
          </Link>
          <Link href="/reviews?tab=settings">
            <Wrench size={22} />
            <strong>Instellingen</strong>
            <p>Koppel je Google Business Profile en beheer je voorkeuren.</p>
            <span>
              Bekijken <ArrowUpRight size={14} />
            </span>
          </Link>
        </div>
      </section>
    </>
  );
}
