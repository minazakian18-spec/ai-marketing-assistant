import type { Post } from "./types";

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
export function publishProblems(p: Pick<Post, "caption" | "hashtags" | "media" | "contentType">): string[] {
  const out: string[] = [];
  const caption = instagramCaption(p);
  const media = p.media || [];
  if (p.contentType && !["Post", "Image", "Carousel"].includes(p.contentType))
    out.push(`${p.contentType} kan Mavix nog niet publiceren. Alleen foto's en carrousels worden ondersteund.`);
  if (!media.length) out.push("Voeg minstens één foto toe. Instagram publiceert geen berichten zonder beeld.");
  if (media.length > CAROUSEL_MAX) out.push(`Een carrousel heeft maximaal ${CAROUSEL_MAX} foto's.`);
  if (media.some((m) => !IMAGE.test(m))) out.push("Gebruik JPG-, PNG- of WebP-foto's. Video's kan Mavix nog niet publiceren.");
  if (media.some((m) => Math.floor((m.length - m.indexOf(",") - 1) * 0.75) > IMAGE_BYTES_MAX)) out.push("Een foto is groter dan 8 MB.");
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
