import "server-only";
import { z } from "zod";
import { DATA_IMAGE, strategyValid } from "../brand-strategy";

export const brandProfileSchema = z
  .object({
    name: z.string().max(160),
    industry: z.string().max(300).optional(),
    description: z.string().max(3000).optional(),
    audience: z.string().max(1000).optional(),
    voice: z.string().max(500).optional(),
    website: z.string().max(300).optional(),
    products: z.string().max(3000).optional(),
    offers: z.string().max(2000).optional(),
    contentPreferences: z.string().max(2000).optional(),
    strategy: z.custom(strategyValid).optional(),
    brandVoice: z
      .object({
        colors: z.array(z.string().regex(/^(|#[0-9a-f]{6})$/i)).max(4),
        preferredWords: z.string().max(500),
        avoidWords: z.string().max(500),
        emojiUsage: z.enum(["geen", "af en toe", "veel"]),
        formality: z.enum(["formeel", "neutraal", "informeel"]),
        marketingStyle: z.string().max(500),
      })
      .optional(),
  })
  .passthrough();

/** Inspect bytes as well as the declared MIME; never allow active SVG/HTML. */
export function rasterImageValid(value: unknown, maxLength: number): boolean {
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    !DATA_IMAGE.test(value)
  )
    return false;
  const bytes = Buffer.from(value.slice(value.indexOf(",") + 1), "base64");
  if (value.startsWith("data:image/png;"))
    return (
      bytes.length >= 24 &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  if (value.startsWith("data:image/jpeg;"))
    return (
      bytes.length >= 4 &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255
    );
  return (
    bytes.length >= 16 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  );
}

export function brandAssetsValid(
  profile: Record<string, unknown>,
  previous: Record<string, unknown>,
): boolean {
  // Existing hosted assets remain usable; new uploads must be bounded rasters.
  const oldImages = [
    previous.logo,
    ...(Array.isArray(previous.media) ? previous.media : []),
  ];
  const image = (v: unknown) =>
    v === "" || oldImages.includes(v) || rasterImageValid(v, 1_000_000);
  if (profile.logo !== undefined && !image(profile.logo)) return false;
  if (
    profile.media !== undefined &&
    !(
      Array.isArray(profile.media) &&
      profile.media.length <= 12 &&
      profile.media.every(image)
    )
  )
    return false;
  const strategy = profile.strategy as
    { referenceImages?: unknown[] } | undefined;
  return (
    !strategy?.referenceImages ||
    strategy.referenceImages.every((v) => rasterImageValid(v, 400_000))
  );
}
