// Prompt for AI images (OpenAI Images API). The user's brief is the subject;
// Brand Hub data is OPTIONAL context for style, identity, audience and
// colours. Nothing from Brand Hub is required: without it Mavix still makes
// a new image from the brief alone. Business photos are never required.

export type ImageFormat = "square" | "portrait";
export type ImageMode = "generate" | "edit";
export type BrandStyle = {
  name?: string;
  industry?: string;
  audience?: string;
  colors?: string[];
  designStyles?: string[];
  marketingStyle?: string;
};

const HEX = /^#[0-9a-f]{6}$/i;
const clip = (s: string | undefined, n: number) => (s || "").replace(/\s+/g, " ").trim().slice(0, n);

/** Brand context worth passing to the image model (empty when nothing is filled in). */
export function brandStyleOf(profile: { name?: string; industry?: string; audience?: string; brandVoice?: { colors?: string[]; marketingStyle?: string }; strategy?: { designStyles?: string[] } } | null | undefined): BrandStyle {
  if (!profile) return {};
  return {
    name: clip(profile.name, 80) || undefined,
    industry: clip(profile.industry, 120) || undefined,
    audience: clip(profile.audience, 200) || undefined,
    colors: (profile.brandVoice?.colors || []).filter((c) => HEX.test(c)).slice(0, 4),
    designStyles: (profile.strategy?.designStyles || []).slice(0, 3),
    marketingStyle: clip(profile.brandVoice?.marketingStyle, 160) || undefined,
  };
}

export function buildImagePrompt(o: { brief: string; mode: ImageMode; format: ImageFormat; brand?: BrandStyle }): string {
  const b = o.brand || {};
  const lines: string[] = [];
  if (o.mode === "edit") {
    lines.push(`Edit this photo for an Instagram marketing post: ${clip(o.brief, 800)}.`);
    lines.push("Keep the main subject, products and setting recognisable and realistic; only change what the instruction asks for. Finish it like a professional retoucher: natural colours, clean light, crisp detail.");
  } else {
    lines.push(`Professional commercial photograph for an Instagram campaign, as produced by a top marketing agency: ${clip(o.brief, 800)}.`);
    lines.push(
      o.format === "portrait"
        ? "Vertical composition; keep the main subject and everything important inside the central 4:5 area, because the top and bottom will be cropped."
        : "Square composition with a clear focal point and balanced negative space.",
    );
    lines.push(
      "Art direction: one clear hero subject, styled with care; soft directional key light with gentle shadows; shallow depth of field; true-to-life colours with a refined, cohesive colour grade; crisp detail and realistic textures; clean, uncluttered background that supports the subject. Authentic and appetising, never artificial, plastic or over-saturated. Shot on a full-frame camera with a high-quality lens.",
    );
  }
  // Optional brand context: guides the look, never a hard requirement.
  const style: string[] = [];
  if (b.industry) style.push(`for a ${b.industry}${b.name ? ` called "${b.name}"` : ""}`);
  if (b.audience) style.push(`appealing to ${b.audience}`);
  if (b.designStyles?.length) style.push(`visual style: ${b.designStyles.join(", ").toLowerCase()}`);
  if (b.marketingStyle) style.push(`mood: ${b.marketingStyle}`);
  if (b.colors?.length) style.push(`use ${b.colors.join(", ")} as subtle accent colours in props or background`);
  if (style.length) lines.push("Brand context (optional, use as visual direction): " + style.join("; ") + ".");
  lines.push("No text, letters, words, prices, logos, watermarks or brand names in the image. No recognisable real people or celebrities.");
  return lines.join(" ");
}
