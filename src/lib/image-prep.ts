// Browser-side image preparation for brand assets: only PNG, JPEG and WebP,
// decoded and redrawn on a canvas (drops metadata such as GPS location),
// scaled down and re-encoded so stored images stay small. SVG is refused.

const TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function prepareImage(file: File, { maxSide = 800, maxInputMb = 8, keepPng = false } = {}): Promise<string> {
  if (!TYPES.includes(file.type)) throw new Error("Gebruik een PNG-, JPG- of WebP-afbeelding.");
  if (file.size > maxInputMb * 1024 * 1024) throw new Error(`Deze afbeelding is groter dan ${maxInputMb} MB.`);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw new Error("Deze afbeelding kon niet worden gelezen.");
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Deze afbeelding kon niet worden verwerkt.");
    ctx.drawImage(img, 0, 0, w, h);
    // Logos keep transparency (PNG); photos become compact WebP (JPEG fallback).
    if (keepPng && file.type === "image/png") {
      const png = canvas.toDataURL("image/png");
      if (png.length > 1_000_000) throw new Error("Dit logo is te groot na verkleinen. Kies een eenvoudiger of kleiner bestand.");
      return png;
    }
    const webp = canvas.toDataURL("image/webp", 0.82);
    const result = webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.82);
    if (result.length > (maxSide <= 800 ? 400_000 : 1_000_000)) throw new Error("Deze afbeelding is te groot na verkleinen. Kies een kleiner bestand.");
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}
