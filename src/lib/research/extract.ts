// Pure extraction of facts from raw data (workspace JSON, Google reviews,
// website HTML). Used by the server collector and by test mode.
import type { Workspace } from "../types";
import type { ContentData, EmailData, ProfileData, ReviewData, WebsiteData } from "./types.ts";

const RESTAURANT = /restaurant|eetcaf|café|cafe|bistro|brasserie|pizzer|horeca|lunchroom|bar\b|eten|keuken|trattoria|sushi|grill|bakkerij|koffie|food/i;

export function businessKindOf(industry: string, description = ""): "restaurant" | "business" {
  return RESTAURANT.test(industry + " " + description) ? "restaurant" : "business";
}

const parsePrice = (v: string) => {
  const n = Number(String(v || "").replace(/[^\d,.]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function profileFacts(data: Workspace): ProfileData {
  const p = data.profile;
  const list = (p.productList || []).filter((x) => x.active);
  return {
    name: p.name || "",
    industry: p.industry || "",
    audience: p.audience || "",
    description: p.description || "",
    website: p.website || "",
    city: p.city || "",
    hasAddress: !!(p.address && p.city),
    phone: p.phone || "",
    products: list.length
      ? list.map((x) => ({ name: x.name, price: parsePrice(x.price) }))
      : (p.products || "").split("\n").map((s) => s.trim()).filter(Boolean).map((name) => ({ name })),
    offers: p.offers || "",
    hasBrandVoice: !!p.brandVoice,
    segments: (p.segments || []).length,
  };
}

export function contentFacts(data: Workspace, now = new Date()): ContentData {
  const t = now.getTime();
  const day = 86400000;
  const formats: Record<string, number> = {};
  let last30 = 0, ahead = 0, drafts = 0, withPhotos = 0;
  for (const post of data.posts) {
    const when = Date.parse(post.date || post.createdAt);
    if (post.status === "draft") drafts++;
    const recent = (post.status === "published" || post.status === "scheduled" || post.status === "approved") && when <= t && when > t - 30 * day;
    const future = post.status === "scheduled" && when > t;
    if (recent) last30++;
    if (future) ahead++;
    if (recent || future) {
      formats[post.contentType || "Post"] = (formats[post.contentType || "Post"] || 0) + 1;
      if (post.media?.length) withPhotos++;
    }
  }
  return { last30, scheduledAhead: ahead, drafts, formats, withPhotos };
}

export function emailFacts(data: Workspace, now = new Date()): EmailData {
  const since = now.getTime() - 90 * 86400000;
  const campaigns = (data.email?.campaigns || []).filter((c) => (c.status === "sent" || c.status === "scheduled") && Date.parse(c.date || c.createdAt) > since);
  // Example contacts are not real customers.
  const real = data.contacts.filter((c) => c.source !== "sample");
  return { campaigns90: campaigns.length, contacts: real.length, subscribed: real.filter((c) => c.status === "Ingeschreven").length };
}

/* ---------- Reviews (Google Business Profile API shape) ---------- */
type GoogleReview = { starRating?: string; comment?: string; createTime?: string; reviewReply?: { comment?: string } };
const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
const THEMES: [string, RegExp][] = [
  ["het eten", /eten|gerecht|smaak|lekker|heerlijk|vies|koud eten|portie|vlees|vis|pasta|pizza|dessert|food|taste|delicious|dish/i],
  ["de service", /service|bediening|personeel|ober|serveerster|vriendelijk|onvriendelijk|staff|friendly|rude|waiter/i],
  ["de wachttijd", /wacht|lang duren|lang op|traag|snel|vertraging|slow|waiting|wait/i],
  ["de prijs", /prijs|duur|goedkoop|waar voor|prijzig|kosten|price|expensive|value/i],
  ["de sfeer", /sfeer|gezellig|ambiance|inrichting|muziek|druk|lawaai|cosy|cozy|atmosphere|noisy/i],
  ["de hygiëne", /schoon|vies|hygi|toilet|dirty|clean/i],
];

export function reviewFacts(reviews: GoogleReview[], now = new Date()): ReviewData {
  const since = now.getTime() - 90 * 86400000;
  const rated = reviews.map((r) => ({ stars: STARS[r.starRating || ""] || 0, text: r.comment || "", at: Date.parse(r.createTime || ""), replied: !!r.reviewReply?.comment }));
  const valid = rated.filter((r) => r.stars > 0);
  const avg = (xs: typeof valid) => (xs.length ? Math.round((xs.reduce((s, r) => s + r.stars, 0) / xs.length) * 10) / 10 : null);
  const recent = valid.filter((r) => r.at > since);
  const themes = THEMES.map(([theme, re]) => ({
    theme,
    positive: valid.filter((r) => r.stars >= 4 && re.test(r.text)).length,
    negative: valid.filter((r) => r.stars <= 2 && re.test(r.text)).length,
  })).filter((t) => t.positive || t.negative);
  return {
    total: rated.length,
    average: avg(valid),
    recent90: recent.length,
    recentAverage: avg(recent),
    replied: rated.filter((r) => r.replied).length,
    unanswered: rated.filter((r) => !r.replied).length,
    unansweredNegative: rated.filter((r) => !r.replied && r.stars > 0 && r.stars <= 2).length,
    themes,
  };
}

/* ---------- Website HTML ---------- */
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const tag = (html: string, re: RegExp) => decode(html.match(re)?.[1]?.replace(/<[^>]+>/g, " ") || "");

export function websiteFacts(url: string, status: number, html: string, loadMs: number): WebsiteData {
  const body = html.slice(0, 1_500_000);
  const text = body.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
  const lower = text.toLowerCase();
  const links = [...body.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => (m[1] + " " + m[2].replace(/<[^>]+>/g, " ")).toLowerCase());
  const meta = (name: string) => decode(body.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i"))?.[1] || body.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i"))?.[1] || "");
  return {
    url,
    https: url.startsWith("https://"),
    status,
    title: tag(body, /<title[^>]*>([\s\S]*?)<\/title>/i),
    metaDescription: meta("description"),
    h1: tag(body, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
    mobileViewport: /<meta[^>]+name=["']viewport["']/i.test(body),
    mentionsMenu: /\b(menu|menukaart|de kaart|onze kaart|lunchkaart|dinerkaart|wijnkaart)\b/i.test(lower) || links.some((l) => /menu|kaart/.test(l)),
    menuLink: links.some((l) => /menu|kaart/.test(l)),
    mentionsReservation: /reserv|book a table|tafel boeken/i.test(lower) || links.some((l) => /reserv|booking|zenchef|formitable|resengo|opentable|thefork/.test(l)),
    reservationLink: links.some((l) => /reserv|booking|zenchef|formitable|resengo|opentable|thefork/.test(l)),
    phoneLink: /href=["']tel:/i.test(body),
    mentionsOpeningHours: /openingstijden|geopend|openingsuren|opening hours|\b(ma|di|wo|do|vr|za|zo)\b[^<]{0,20}\d{1,2}[:.]\d{2}/i.test(lower),
    restaurantSchema: /"@type"\s*:\s*"(Restaurant|FoodEstablishment|CafeOrCoffeeShop|BarOrPub|Bakery)"/i.test(body),
    ogImage: !!meta("og:image"),
    wordCount: lower.split(/\s+/).filter(Boolean).length,
    loadMs,
  };
}
