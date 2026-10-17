import "server-only";
import { HttpError } from "./access";
import { readImage } from "./library";
import { mediaIdOf } from "../media-ref";

// Shared by every route that generates images (single images, inspiration
// images, carousel plans and slides): the closed-test access rule and the
// validation of images users hand in.

// Closed live test: only these workspaces may generate AI images.
// AI_IMAGE_WORKSPACES (comma-separated workspace ids) overrides the default;
// "*" opens it to every approved workspace.
const TEST_WORKSPACES = ["a81c4faa-e42b-4ba0-95cc-ed8a3cdc812e"]; // Telepizza Amstelveen
export function imageAccess(workspaceId: string) {
  const configured = (process.env.AI_IMAGE_WORKSPACES || "").trim();
  if (configured === "*") return true;
  const list = configured ? configured.split(",").map((s) => s.trim()) : TEST_WORKSPACES;
  return list.includes(workspaceId);
}
export function assertImageAccess(workspaceId: string) {
  if (!imageAccess(workspaceId)) throw new HttpError(403, "AI-afbeeldingen zijn nog in een besloten test en nog niet beschikbaar voor jouw werkruimte. Eigen foto's gebruiken kan wel.");
}

const DATA = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;
const MAX_BYTES = 8 * 1024 * 1024;
const MIN_SIDE = 256;
const MAX_SIDE = 8000;

/**
 * One image from the user: a Bibliotheek reference of THIS workspace or a
 * data URL. The bytes are decoded and checked for real content (PNG, JPEG or
 * WebP), size and resolution; the declared type is not trusted.
 */
export async function loadImageInput(workspaceId: string, src: string, label = "De afbeelding"): Promise<{ data: Buffer; mime: string }> {
  const ref = mediaIdOf(src);
  const m = ref ? null : DATA.exec(src);
  if (!ref && !m) throw new HttpError(400, `${label} moet een JPG-, PNG- of WebP-afbeelding zijn.`);
  const img = ref ? await readImage(workspaceId, ref) : { data: Buffer.from(m![2], "base64"), mime: "image/" + m![1] };
  if (img.data.length > MAX_BYTES) throw new HttpError(413, `${label} is groter dan 8 MB.`);
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(img.data).metadata();
    const format = String(meta.format) === "jpg" ? "jpeg" : String(meta.format);
    if (!["jpeg", "png", "webp"].includes(String(format))) throw new Error("type");
    if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < MIN_SIDE) throw new HttpError(400, `${label} is te klein. Gebruik minimaal ${MIN_SIDE} × ${MIN_SIDE} pixels.`);
    if (Math.max(meta.width, meta.height) > MAX_SIDE) throw new HttpError(400, `${label} is te groot (maximaal ${MAX_SIDE} pixels per zijde).`);
    return { data: img.data, mime: "image/" + format };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, `${label} kon niet worden gelezen. Gebruik een JPG-, PNG- of WebP-bestand.`);
  }
}
