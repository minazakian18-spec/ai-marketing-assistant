import type { Post } from "./types";
import { isMediaRef } from "./media-ref.ts";
import { amsterdamToUtc } from "./automation.ts";

// Rules of Instagram's Content Publishing API that Mavix checks before a post
// can be scheduled or published (browser and server use the same checks).
// Source: Meta "Content Publishing" docs: JPEG images, caption at most 2,200
// characters, at most 30 hashtags, carousels of 2 to 10 items, image aspect
// ratio between 4:5 and 1.91:1 (checked on the server after decoding).

export const CAPTION_LIMIT = 2200;
export const HASHTAG_LIMIT = 30;
export const CAROUSEL_MAX = 10;
export const IMAGE_BYTES_MAX = 8 * 1024 * 1024;

/** Caption as it is sent to Instagram: text, then the hashtags. */
export function instagramCaption(p: Pick<Post, "caption" | "hashtags">) {
  return [p.caption.trim(), p.hashtags.trim()].filter(Boolean).join("\n\n");
}

export function hashtagCount(text: string) {
  return (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) || []).length;
}

const IMAGE = /^data:image\/(jpeg|png|webp);base64,/;

/** Problems that block publishing this post to Instagram (empty = ok). */
export function publishProblems(p: Pick<Post, "caption" | "hashtags" | "media" | "contentType"> & { carousel?: Post["carousel"] }): string[] {
  const out: string[] = [];
  if (p.carousel) {
    if (p.carousel.slides.some((s) => !s.image)) out.push("Niet elke slide heeft een afbeelding. Genereer of kies eerst een afbeelding voor elke slide.");
    if (p.carousel.slides.length < 2) out.push("Een carrousel heeft minstens 2 slides.");
    // Slides with text are published as the final composed image (made when approving).
    if (p.carousel.slides.some((s) => s.showText && (s.headline.trim() || s.body.trim()) && !s.rendered))
      out.push("De definitieve slides met tekst zijn nog niet gemaakt. Keur de carrousel goed om ze te maken.");
  }
  const caption = instagramCaption(p);
  const media = p.media || [];
  if (p.contentType && !["Post", "Image", "Carousel"].includes(p.contentType))
    out.push(`${p.contentType} kan Mavix nog niet publiceren. Alleen foto's en carrousels worden ondersteund.`);
  if (!media.length) out.push("Voeg minstens één foto toe. Instagram publiceert geen berichten zonder beeld.");
  if (media.length > CAROUSEL_MAX) out.push(`Een carrousel heeft maximaal ${CAROUSEL_MAX} foto's.`);
  // Photos are Bibliotheek references (checked on the server) or older data URLs.
  if (media.some((m) => !IMAGE.test(m) && !isMediaRef(m))) out.push("Gebruik JPG-, PNG- of WebP-foto's. Video's kan Mavix nog niet publiceren.");
  if (media.some((m) => IMAGE.test(m) && Math.floor((m.length - m.indexOf(",") - 1) * 0.75) > IMAGE_BYTES_MAX)) out.push("Een foto is groter dan 8 MB.");
  if (caption.length > CAPTION_LIMIT) out.push(`Tekst en hashtags samen zijn ${caption.length} tekens; Instagram staat er ${CAPTION_LIMIT} toe.`);
  if (hashtagCount(caption) > HASHTAG_LIMIT) out.push(`Gebruik maximaal ${HASHTAG_LIMIT} hashtags.`);
  return out;
}

/** Problems that block scheduling at `date` (local "YYYY-MM-DDTHH:mm"). */
export function scheduleProblems(date: string, now = new Date()) {
  if (!date) return ["Kies een datum en tijd."];
  const t = Date.parse(date);
  if (Number.isNaN(t)) return ["Deze datum klopt niet."];
  if (t < now.getTime() + 5 * 60_000) return ["Kies een moment minstens 5 minuten in de toekomst."];
  if (t > now.getTime() + 75 * 86_400_000) return ["Plan maximaal 75 dagen vooruit."];
  return [];
}

/** Whether a "published" post was really published (not the earlier simulation). */
export const reallyPublished = (p: Pick<Post, "status" | "instagram">) => p.status === "published" && !!p.instagram?.mediaId;

/** What the publish capability means for the user, in one short line (Social header). */
export type PublishCapabilityView = { ready: boolean; code: string; message: string; account?: string };
export function publishStatusText(cap: PublishCapabilityView | null) {
  if (!cap) return "Instagram-status laden…";
  if (cap.ready) return "Publiceren naar " + (cap.account ? "@" + cap.account.replace(/^@/, "") : "Instagram") + " staat klaar";
  if (cap.code === "demo") return "Testmodus: er wordt niets gepubliceerd";
  if (cap.code === "not_connected") return "Instagram is nog niet gekoppeld";
  if (cap.code === "permission_missing") return "Instagram gekoppeld, publiceren wacht op toestemming van Meta";
  if (cap.code === "reconnect") return "Koppel Instagram opnieuw";
  return cap.message;
}

/** A scheduled post counts as missed this long after its moment (the planner runs every 5 minutes). */
export const MISSED_AFTER_MS = 15 * 60_000;
/**
 * One definition of "ingepland" for Social, Content Studio and the calendar:
 * upcoming = scheduled, moment still ahead (or just now); missed = scheduled,
 * but the moment passed without a publication. Dates are Amsterdam local time.
 */
export function scheduleState(p: Pick<Post, "status" | "date">, now = Date.now()): "upcoming" | "missed" | null {
  if (p.status !== "scheduled" || !p.date) return null;
  const t = amsterdamToUtc(p.date);
  if (!Number.isFinite(t)) return null;
  return t + MISSED_AFTER_MS < now ? "missed" : "upcoming";
}

/**
 * A short, readable title for a post: the saved title, otherwise the first
 * sentence of the prompt or caption without markdown, at most 60 characters.
 */
export function postTitle(p: Pick<Post, "prompt" | "caption"> & { title?: string }) {
  const clean = (v: string) =>
    (v || "")
      .replace(/^\s*(#{1,6}|[-*•>]|\d+[.)])\s+/gm, "")
      .replace(/[*_`~]/g, "")
      .replace(/\[(.*?)\]\([^)]*\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  const src = clean(p.title || "") || clean(p.prompt || "") || clean(p.caption || "");
  if (!src) return "Instagram-post";
  const first = src.split(/(?<=[.!?])\s/)[0];
  const t = first.length <= 60 ? first : first.slice(0, 60).replace(/\s+\S*$/, "") + "…";
  return t.charAt(0).toUpperCase() + t.slice(1);
}
