import type { Post } from "./types";
import type { ContentType } from "./instagram-model";

// One prompt, one result: the caption and the AI image Mavix makes for it.
// The selected images (the editor's `media`) are the single source of truth
// for the preview; `post.aiImage` only remembers which of them Mavix made for
// this concept, so "Opnieuw genereren" can replace it while own photos stay.
// Pure: the component supplies the generators and the save function.

/** Formats that get an automatic image (Carousel has its own slide studio). */
export const AUTO_IMAGE_TYPES: ContentType[] = ["Post", "Image"];

/** The AI image of this concept, if it is still among the selected images. */
export function linkedImage(post: Pick<Post, "aiImage"> | null | undefined, media: string[]) {
  return post?.aiImage && media.includes(post.aiImage) ? post.aiImage : undefined;
}

/** True when the user chose own photos (they win over an automatic image). */
export function hasOwnPhotos(media: string[], linked: string | undefined) {
  return media.some((m) => m !== linked);
}

/** Make an image automatically: right format, switched on, no own photos. */
export function wantsAutoImage(o: { type: ContentType; auto: boolean; media: string[]; linked?: string }) {
  return o.auto && AUTO_IMAGE_TYPES.includes(o.type) && !hasOwnPhotos(o.media, o.linked);
}

/** The new AI image takes the place of the previous one; own photos keep theirs. */
export function replaceLinked(media: string[], linked: string | undefined, image: string) {
  return [image, ...media.filter((m) => m !== linked)].slice(0, 4);
}

/** Image brief from the same prompt, matched to the chosen format. */
export function imageBrief(prompt: string, type: ContentType) {
  const p = prompt.trim();
  return type === "Image" ? `${p}\n\nInstagram-beeldpost: het beeld draagt de boodschap; laat rustige ruimte voor een korte tekst.` : `${p}\n\nInstagram-post: één helder beeld dat bij de caption past.`;
}

export type ImageOutcome = { state: "none" } | { state: "done"; image: string } | { state: "error"; message: string };

type Deps = {
  /** Generate the caption concept (already includes prompt, type, variant). */
  text: () => Promise<Post>;
  /** Generate one image for a brief; returns its media reference. */
  image: (brief: string) => Promise<string>;
  /** Save a concept; resolves false when the save failed. */
  persist: (post: Post) => Promise<boolean>;
};

/**
 * Text first (saved right away, shown via onText), then the matching image,
 * which replaces the previous AI image of this concept. A failed image never
 * removes the saved text or the previous image.
 */
export async function generateWithImage(
  o: Deps & {
    prompt: string;
    type: ContentType;
    auto: boolean;
    current: { post: Post | null; media: string[]; date?: string };
    onText?: (post: Post, imageComing: boolean) => void;
  },
): Promise<{ post: Post; media: string[]; image: ImageOutcome }> {
  const linked = linkedImage(o.current.post, o.current.media);
  const next = await o.text();
  if (o.current.post) {
    next.id = o.current.post.id;
    next.createdAt = o.current.post.createdAt;
  }
  if (o.current.date) next.date = o.current.date;
  next.media = o.current.media;
  next.aiImage = linked;
  next.updatedAt = new Date().toISOString();
  if (!(await o.persist(next))) throw new Error("Het concept kon niet worden opgeslagen. Probeer het opnieuw.");
  const imageComing = wantsAutoImage({ type: o.type, auto: o.auto, media: o.current.media, linked });
  o.onText?.(next, imageComing);
  if (!imageComing) return { post: next, media: o.current.media, image: { state: "none" } };
  return regenerateImage({ ...o, post: next, media: o.current.media });
}

/** "Alleen afbeelding opnieuw genereren": a new AI image, text untouched. */
export async function regenerateImage(o: Pick<Deps, "image" | "persist"> & { prompt: string; type: ContentType; post: Post; media: string[] }): Promise<{ post: Post; media: string[]; image: ImageOutcome }> {
  const linked = linkedImage(o.post, o.media);
  let image: string;
  try {
    image = await o.image(imageBrief(o.prompt || o.post.prompt, o.type));
  } catch (e) {
    return { post: o.post, media: o.media, image: { state: "error", message: e instanceof Error ? e.message : "De afbeelding kon niet worden gemaakt." } };
  }
  const media = replaceLinked(o.media, linked, image);
  const saved: Post = { ...o.post, media, aiImage: image, updatedAt: new Date().toISOString() };
  if (!(await o.persist(saved))) return { post: o.post, media, image: { state: "error", message: "De afbeelding is gemaakt, maar nog niet opgeslagen. Klik op Opslaan." } };
  return { post: saved, media, image: { state: "done", image } };
}
