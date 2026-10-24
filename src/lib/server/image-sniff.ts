// The real format of image bytes from users, from their first bytes (file
// signature), before any image library sees them. sharp detects SVG, TIFF,
// PDF and more on its own; SVG goes through librsvg, which had a vulnerability
// (GHSA-wq5f-xc86-pv6w). Mavix only accepts JPEG, PNG and WebP, so anything
// else is refused here instead of being parsed.
export type ImageFormat = "jpeg" | "png" | "webp";

export function sniffImage(b: Buffer): ImageFormat | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "webp";
  return null;
}
