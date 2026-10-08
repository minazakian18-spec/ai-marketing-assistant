// Google Business Profile reviews: frontend-safe shapes and pure helpers.
// No server imports here, so the browser and tests can use these types.

export type GoogleReview = {
  id: string;
  provider: "google";
  location: string;
  reviewer: { name: string; photoUrl: string | null; anonymous: boolean };
  rating: 1 | 2 | 3 | 4 | 5 | null;
  comment: string;
  createTime: string;
  updateTime: string;
  reply: { comment: string; updateTime: string } | null;
};

export type ReviewsPage = {
  reviews: GoogleReview[];
  nextPageToken: string | null;
  /** Straight from Google (whole location), only on the first page. */
  averageRating: number | null;
  totalReviewCount: number | null;
};

export type BusinessLocation = {
  account: string; // accounts/{id}
  location: string; // locations/{id}
  title: string;
  address: string;
  closed: boolean;
  verified: boolean | null;
};

const STARS: Record<string, 1 | 2 | 3 | 4 | 5> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
export const REVIEW_ID = /^[\w-]{1,300}$/;
export const ACCOUNT_ID = /^accounts\/\d{1,30}$/;
export const LOCATION_ID = /^locations\/\d{1,30}$/;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const iso = (v: unknown) => (typeof v === "string" && !isNaN(Date.parse(v)) ? new Date(v).toISOString() : "");

// Profile photos are only accepted from Google's own image host.
function safePhoto(v: unknown) {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v.startsWith("//") ? "https:" + v : v);
    return u.protocol === "https:" && /(^|\.)googleusercontent\.com$/.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Normalizes one v4 Review resource; returns null for unusable data. */
export function normalizeReview(raw: Record<string, unknown>, location: string): GoogleReview | null {
  const name = str(raw.name, 1000);
  const id = str(raw.reviewId, 300) || name.split("/").pop() || "";
  if (!REVIEW_ID.test(id)) return null;
  const reviewer = (raw.reviewer || {}) as Record<string, unknown>;
  const reply = (raw.reviewReply || null) as Record<string, unknown> | null;
  const anonymous = reviewer.isAnonymous === true;
  return {
    id,
    provider: "google",
    location,
    reviewer: {
      name: anonymous ? "Anonieme Google-gebruiker" : str(reviewer.displayName, 200) || "Google-gebruiker",
      photoUrl: anonymous ? null : safePhoto(reviewer.profilePhotoUrl),
      anonymous,
    },
    rating: STARS[str(raw.starRating, 20)] ?? null,
    comment: str(raw.comment, 10000).trim(),
    createTime: iso(raw.createTime),
    updateTime: iso(raw.updateTime) || iso(raw.createTime),
    reply: reply && typeof reply.comment === "string" ? { comment: reply.comment.slice(0, 4096), updateTime: iso(reply.updateTime) } : null,
  };
}

export function normalizeReviewsPage(raw: Record<string, unknown>, location: string, first: boolean): ReviewsPage {
  const list = Array.isArray(raw.reviews) ? (raw.reviews as Record<string, unknown>[]) : [];
  const avg = Number(raw.averageRating);
  const total = Number(raw.totalReviewCount);
  return {
    reviews: list.map((r) => normalizeReview(r, location)).filter((r): r is GoogleReview => r !== null),
    nextPageToken: typeof raw.nextPageToken === "string" && raw.nextPageToken ? raw.nextPageToken : null,
    averageRating: first && Number.isFinite(avg) && avg > 0 ? Math.round(avg * 10) / 10 : null,
    totalReviewCount: first && Number.isInteger(total) && total >= 0 ? total : null,
  };
}

/** Normalizes a Business Information Location (readMask name,title,storefrontAddress,openInfo,metadata). */
export function normalizeLocation(raw: Record<string, unknown>, account: string): BusinessLocation | null {
  const location = str(raw.name, 100);
  if (!LOCATION_ID.test(location) || !ACCOUNT_ID.test(account)) return null;
  const addr = (raw.storefrontAddress || {}) as Record<string, unknown>;
  const lines = Array.isArray(addr.addressLines) ? (addr.addressLines as unknown[]).filter((l): l is string => typeof l === "string") : [];
  const address = [lines.join(", "), [str(addr.postalCode, 20), str(addr.locality, 100)].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const metadata = (raw.metadata || {}) as Record<string, unknown>;
  const openInfo = (raw.openInfo || {}) as Record<string, unknown>;
  return {
    account,
    location,
    title: str(raw.title, 200) || "Naamloze locatie",
    address: address.slice(0, 300),
    closed: openInfo.status === "CLOSED_PERMANENTLY",
    verified: typeof metadata.hasVoiceOfMerchant === "boolean" ? metadata.hasVoiceOfMerchant : null,
  };
}

export type ReviewFilter = "all" | "unanswered" | "answered" | "low" | "mid" | "high";
export const REVIEW_FILTERS: [ReviewFilter, string][] = [
  ["all", "Alles"],
  ["unanswered", "Onbeantwoord"],
  ["answered", "Beantwoord"],
  ["low", "1–2 sterren"],
  ["mid", "3 sterren"],
  ["high", "4–5 sterren"],
];
export function matchesFilter(r: GoogleReview, f: ReviewFilter) {
  if (f === "unanswered") return !r.reply;
  if (f === "answered") return !!r.reply;
  if (f === "low") return r.rating !== null && r.rating <= 2;
  if (f === "mid") return r.rating === 3;
  if (f === "high") return r.rating !== null && r.rating >= 4;
  return true;
}

/** Metrics derived only from the reviews that were actually loaded. */
export function loadedStats(reviews: GoogleReview[], now = Date.now()) {
  const month = now - 30 * 86400000;
  return {
    loaded: reviews.length,
    unanswered: reviews.filter((r) => !r.reply).length,
    lastThirtyDays: reviews.filter((r) => Date.parse(r.createTime) >= month).length,
  };
}
