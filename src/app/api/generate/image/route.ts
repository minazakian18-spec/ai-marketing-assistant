import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, sameOrigin, limited, failure, HttpError } from "@/lib/server/access";
import { metered } from "@/lib/server/ai-usage";
import { aiConfigured, aiImage, imagePlan } from "@/lib/server/openai";
import { storedProfile } from "@/lib/server/stored-profile";
import { storeImage } from "@/lib/server/library";
import { workspacePlan } from "@/lib/server/plan";
import { assertImageAccess, loadImageInput } from "@/lib/server/image-input";
import { brandStyleOf, buildImagePrompt } from "@/lib/image-prompt";
import { mediaRef } from "@/lib/media-ref";

// AI images for Social / Content Studio (OpenAI Images API). Three modes:
//   generate  a new image from the brief                      → image_generate
//             with inspiration images (references): new image
//             in their style, references sent as real inputs   → image_inspire
//   edit      change one own photo                             → image_edit
// A carousel slide is a generate request with `slide` context; it needs the
// carousel entitlement and may carry the first slide as style reference.
// Every request is one metered image: credits and the monthly image limit
// apply per image, so carousels cannot bypass them. Results are stored once
// in the Bibliotheek and returned as a media reference.

const input = z.object({
  mode: z.enum(["generate", "edit"]),
  brief: z.string().trim().min(3).max(800),
  format: z.enum(["square", "portrait"]).default("square"),
  photo: z.string().max(12_000_000).optional(),
  references: z.array(z.string().max(12_000_000)).max(5).default([]),
  useBrand: z.boolean().default(true),
  slide: z
    .object({
      visualStyle: z.string().trim().max(600),
      slideBrief: z.string().trim().min(3).max(600),
      index: z.number().int().min(1).max(10),
      total: z.number().int().min(2).max(10),
      styleReference: z.string().max(12_000_000).optional(),
    })
    .optional(),
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
    assertImageAccess(auth.workspaceId);
    await limited("ai-image:" + auth.user.id, 5);
    await limited("ai-image-ws:" + auth.workspaceId, 10);
    const body = input.parse(await request.json());
    if (!aiConfigured()) throw new HttpError(503, "AI is nog niet geconfigureerd. Er is geen afbeelding gemaakt.");
    const wp = await workspacePlan(auth.workspaceId);

    let photo: { data: Buffer; mime: string } | undefined;
    if (body.mode === "edit") {
      if (!body.photo) throw new HttpError(400, "Kies eerst een foto (JPG, PNG of WebP) om te bewerken.");
      photo = await loadImageInput(auth.workspaceId, body.photo, "De foto");
    }
    // Inspiration images: plan maximum per request (Starter 1, Growth 3, Premium 5).
    if (body.references.length > wp.plan.inspirationMax)
      throw new HttpError(402, `Je ${wp.plan.name}-abonnement staat ${wp.plan.inspirationMax} ${wp.plan.inspirationMax === 1 ? "inspiratiebeeld" : "inspiratiebeelden"} per afbeelding toe.`);
    if (body.slide) {
      if (!wp.plan.entitlements.includes("carousels")) throw new HttpError(402, `AI-carrousels zitten niet in je ${wp.plan.name}-abonnement. Maak complete Instagram-carrousels met Mavix Growth.`);
      if (body.slide.total > wp.plan.carouselSlides) throw new HttpError(402, `Je ${wp.plan.name}-abonnement staat carrousels tot ${wp.plan.carouselSlides} slides toe.`);
    }
    const references = body.mode === "generate" ? await Promise.all(body.references.map((r, i) => loadImageInput(auth.workspaceId, r, `Inspiratiebeeld ${i + 1}`))) : [];
    // Carousel consistency: the first slide as extra style reference (system-added).
    if (body.mode === "generate" && body.slide?.styleReference) references.push(await loadImageInput(auth.workspaceId, body.slide.styleReference, "De eerste slide"));

    const profile = body.useBrand ? await storedProfile(auth.workspaceId) : null;
    const mode = body.mode === "edit" ? "edit" : references.length ? "inspire" : "generate";
    const prompt = buildImagePrompt({
      brief: body.brief,
      mode,
      format: body.format,
      brand: brandStyleOf(profile as Parameters<typeof brandStyleOf>[0]),
      references: body.references.length,
      slide: body.slide ? { visualStyle: body.slide.visualStyle, slideBrief: body.slide.slideBrief, index: body.slide.index, total: body.slide.total, styleReference: !!body.slide.styleReference } : undefined,
    });
    const plan = imagePlan(body.format);
    const feature = mode === "edit" ? "image_edit" : mode === "inspire" ? "image_inspire" : "image_generate";
    let jpeg = await metered(auth, feature, () => aiImage({ prompt, size: plan.size, photo, references: references.length ? references : undefined }), request.headers.get("idempotency-key"));
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
