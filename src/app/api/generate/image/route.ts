import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, sameOrigin, limited, failure, HttpError } from "@/lib/server/access";
import { metered } from "@/lib/server/ai-usage";
import { aiConfigured, aiImage } from "@/lib/server/openai";
import { storedProfile } from "@/lib/server/stored-profile";
import { brandStyleOf, buildImagePrompt } from "@/lib/image-prompt";

// AI images for Social / Content Studio (OpenAI Images API, metered as
// image_generate / image_edit). "generate" makes a new visual from the brief,
// with Brand Hub only as optional style context; no business photo is needed.
// "edit" changes one photo the user chose. The image is returned to the
// browser as a JPEG data URL; nothing is saved or published here.

const PHOTO = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;
const input = z.object({
  mode: z.enum(["generate", "edit"]),
  brief: z.string().trim().min(3).max(800),
  format: z.enum(["square", "portrait"]).default("square"),
  photo: z.string().max(12_000_000).optional(),
  useBrand: z.boolean().default(true),
});

/** Instagram accepts 4:5 at most for portrait; the model makes 2:3, so crop the centre. */
async function toInstagramRatio(jpeg: Buffer, format: "square" | "portrait") {
  if (format === "square") return jpeg;
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(jpeg).resize(1024, 1280, { fit: "cover", position: "centre" }).jpeg({ quality: 85 }).toBuffer();
  } catch {
    throw new HttpError(503, "Staande afbeeldingen zijn nu niet beschikbaar. Kies vierkant.");
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("ai-image:" + auth.user.id, 5);
    await limited("ai-image-ws:" + auth.workspaceId, 10);
    await limited("ai-ws:" + auth.workspaceId, 60);
    const body = input.parse(await request.json());
    if (!aiConfigured()) throw new HttpError(503, "AI is nog niet geconfigureerd. Er is geen afbeelding gemaakt.");
    let photo: { data: Buffer; mime: string } | undefined;
    if (body.mode === "edit") {
      const m = body.photo ? PHOTO.exec(body.photo) : null;
      if (!m) throw new HttpError(400, "Kies eerst een foto (JPG, PNG of WebP) om te bewerken.");
      const data = Buffer.from(m[2], "base64");
      if (data.length > 8 * 1024 * 1024) throw new HttpError(413, "Deze foto is groter dan 8 MB.");
      photo = { data, mime: "image/" + m[1] };
    }
    const profile = body.useBrand ? await storedProfile(auth.workspaceId) : null;
    const prompt = buildImagePrompt({ brief: body.brief, mode: body.mode, format: body.format, brand: brandStyleOf(profile as Parameters<typeof brandStyleOf>[0]) });
    const jpeg = await metered(
      auth,
      body.mode === "edit" ? "image_edit" : "image_generate",
      () => aiImage({ prompt, size: body.format === "portrait" ? "1024x1536" : "1024x1024", photo }),
      request.headers.get("idempotency-key"),
    );
    const image = await toInstagramRatio(jpeg, body.format);
    return NextResponse.json({ image: "data:image/jpeg;base64," + image.toString("base64"), ai: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Beschrijf in een paar woorden wat er op de afbeelding moet staan."));
    return failure(e);
  }
}
