import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, sameOrigin, limited, failure, HttpError } from "@/lib/server/access";
import { metered } from "@/lib/server/ai-usage";
import { aiConfigured, aiImage, imagePlan } from "@/lib/server/openai";
import { storedProfile } from "@/lib/server/stored-profile";
import { readImage, storeImage } from "@/lib/server/library";
import { brandStyleOf, buildImagePrompt } from "@/lib/image-prompt";
import { mediaIdOf, mediaRef } from "@/lib/media-ref";

// AI images for Social / Content Studio (OpenAI Images API, metered as
// image_generate / image_edit). "generate" makes a new visual from the brief,
// with Brand Hub only as optional style context; no business photo is needed.
// "edit" changes one photo the user chose. The result is stored once in the
// Bibliotheek (private storage, kind "ai") and returned as a media
// reference, so the workspace document only holds a short link.

// Closed live test: only these workspaces may generate or edit AI images.
// AI_IMAGE_WORKSPACES (comma-separated workspace ids) overrides the default;
// "*" opens it to every approved workspace.
const TEST_WORKSPACES = ["a81c4faa-e42b-4ba0-95cc-ed8a3cdc812e"]; // Telepizza Amstelveen
function imageAccess(workspaceId: string) {
  const configured = (process.env.AI_IMAGE_WORKSPACES || "").trim();
  if (configured === "*") return true;
  const list = configured ? configured.split(",").map((s) => s.trim()) : TEST_WORKSPACES;
  return list.includes(workspaceId);
}

const PHOTO = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;
const input = z.object({
  mode: z.enum(["generate", "edit"]),
  brief: z.string().trim().min(3).max(800),
  format: z.enum(["square", "portrait"]).default("square"),
  photo: z.string().max(12_000_000).optional(),
  useBrand: z.boolean().default(true),
});

/** gpt-image-1 portrait (2:3) is cropped to Instagram's 4:5. */
async function crop45(jpeg: Buffer) {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(jpeg).resize(1024, 1280, { fit: "cover", position: "centre" }).jpeg({ quality: 90 }).toBuffer();
  } catch {
    throw new HttpError(503, "Staande afbeeldingen zijn nu niet beschikbaar. Kies vierkant.");
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    if (!imageAccess(auth.workspaceId)) throw new HttpError(403, "AI-afbeeldingen zijn nog in een besloten test en nog niet beschikbaar voor jouw werkruimte. Eigen foto's gebruiken kan wel.");
    await limited("ai-image:" + auth.user.id, 5);
    await limited("ai-image-ws:" + auth.workspaceId, 10);
    const body = input.parse(await request.json());
    if (!aiConfigured()) throw new HttpError(503, "AI is nog niet geconfigureerd. Er is geen afbeelding gemaakt.");
    let photo: { data: Buffer; mime: string } | undefined;
    if (body.mode === "edit") {
      const ref = body.photo ? mediaIdOf(body.photo) : null;
      const m = body.photo ? PHOTO.exec(body.photo) : null;
      if (ref) photo = await readImage(auth.workspaceId, ref);
      else if (m) photo = { data: Buffer.from(m[2], "base64"), mime: "image/" + m[1] };
      else throw new HttpError(400, "Kies eerst een foto (JPG, PNG of WebP) om te bewerken.");
      if (photo.data.length > 8 * 1024 * 1024) throw new HttpError(413, "Deze foto is groter dan 8 MB.");
    }
    const profile = body.useBrand ? await storedProfile(auth.workspaceId) : null;
    const prompt = buildImagePrompt({ brief: body.brief, mode: body.mode, format: body.format, brand: brandStyleOf(profile as Parameters<typeof brandStyleOf>[0]) });
    const plan = imagePlan(body.format);
    let jpeg = await metered(auth, body.mode === "edit" ? "image_edit" : "image_generate", () => aiImage({ prompt, size: plan.size, photo }), request.headers.get("idempotency-key"));
    if (plan.crop) jpeg = await crop45(jpeg);
    // Paid result: store it in the Bibliotheek. If storage is not available,
    // the image is still returned (as data) rather than lost.
    try {
      const id = await storeImage({ workspaceId: auth.workspaceId, userId: auth.user.id }, jpeg, { kind: "ai", mime: "image/jpeg" });
      return NextResponse.json({ image: mediaRef(id), fileId: id, stored: true }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (e) {
      console.error(JSON.stringify({ event: "ai_image_store_failed", code: (e as HttpError).status || "error" }));
      return NextResponse.json({ image: "data:image/jpeg;base64," + jpeg.toString("base64"), stored: false }, { headers: { "Cache-Control": "private, no-store" } });
    }
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Beschrijf in een paar woorden wat er op de afbeelding moet staan."));
    return failure(e);
  }
}
