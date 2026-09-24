import { Star } from "lucide-react";

export function StarRating({ rating }: { rating: number }) {
  return (
    <span className="rv-stars" aria-label={rating + " van de 5 sterren"}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={n <= rating ? "" : "rv-star-empty"}
          fill={n <= rating ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

export function relativeDate(iso: string) {
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "Vandaag";
  if (days === 1) return "Gisteren";
  if (days < 7) return days + " dagen geleden";
  return date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
