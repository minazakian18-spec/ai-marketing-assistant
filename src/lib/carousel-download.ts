import type { Carousel, CarouselSlide } from "./types";
import { zip } from "./zip";
import { FONTS, SIZES, styleOf } from "./carousel";

/** Light text (white-ish) gets a dark shade behind it, dark text a light one. */
export function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

// Download a carousel: every slide as slide-01.jpg … in order, with its text
// layer drawn on the image (same layout as the editor preview), plus the
// caption and hashtags as caption.txt, in one ZIP. Runs in the browser.

const W = 1080;

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > max && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

async function loadImage(src: string) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  return img;
}

/** One slide as a JPEG (cover-fit image + optional text layer). */
export async function renderSlide(s: CarouselSlide, format: Carousel["format"], accent: string): Promise<Blob> {
  const H = format === "portrait" ? 1350 : 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const img = await loadImage(s.image);
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const iw = img.naturalWidth * scale,
    ih = img.naturalHeight * scale;
  ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
  if (s.showText && (s.headline.trim() || s.body.trim())) {
    const st = styleOf(s);
    const font = FONTS[st.font].css;
    const sz = SIZES[st.size];
    const light = isLight(st.color);
    // Shade behind the text for legibility: dark under light text, light under dark text.
    const shade = (a: number) => (light ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`);
    const [g0, g1] = st.position === "top" ? [H * 0.55, 0] : st.position === "bottom" ? [H * 0.45, H] : [0, 0];
    if (st.position === "center") {
      ctx.fillStyle = shade(0.38);
      ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, g0, 0, g1);
      g.addColorStop(0, shade(0));
      g.addColorStop(1, shade(0.72));
      ctx.fillStyle = g;
      ctx.fillRect(0, Math.min(g0, g1), W, Math.abs(g1 - g0));
    }
    const pad = W * 0.075;
    const maxW = W - pad * 2;
    ctx.font = `700 ${Math.round(W * sz.head)}px ${font}`;
    const head = wrap(ctx, s.headline.trim(), maxW).slice(0, 4);
    ctx.font = `400 ${Math.round(W * sz.body)}px ${font}`;
    const body = wrap(ctx, s.body.trim(), maxW).slice(0, 4);
    const hl = W * sz.head * 1.2,
      bl = W * sz.body * 1.35,
      gap = body.length && head.length ? W * 0.02 : 0,
      bar = W * 0.045;
    const block = bar + head.length * hl + gap + body.length * bl;
    // Never outside the image: the block is clamped inside the padding.
    const top = Math.max(pad, Math.min(H - pad - block, st.position === "top" ? pad : st.position === "center" ? (H - block) / 2 : H - pad - block));
    const x = st.align === "center" ? W / 2 : st.align === "right" ? W - pad : pad;
    ctx.textAlign = st.align;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = accent;
    const barW = W * 0.08;
    ctx.fillRect(st.align === "center" ? (W - barW) / 2 : st.align === "right" ? W - pad - barW : pad, top, barW, W * 0.008);
    ctx.fillStyle = st.color;
    ctx.font = `700 ${Math.round(W * sz.head)}px ${font}`;
    head.forEach((l, i) => ctx.fillText(l, x, top + bar + (i + 1) * hl - hl * 0.22));
    ctx.font = `400 ${Math.round(W * sz.body)}px ${font}`;
    const by = top + bar + head.length * hl + gap;
    body.forEach((l, i) => ctx.fillText(l, x, by + (i + 1) * bl - bl * 0.25));
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("render"))), "image/jpeg", 0.92));
}

/**
 * Makes the final composed image for every slide that shows text and stores
 * it in the Bibliotheek (deduplicated by content). Returns the slides with
 * `rendered` set; publishing and the calendar use these images.
 */
export async function renderFinalSlides(c: Carousel, accent: string, upload: (blob: Blob, name: string) => Promise<string>): Promise<CarouselSlide[]> {
  const out: CarouselSlide[] = [];
  for (const s of c.slides) {
    if (!s.image || !(s.showText && (s.headline.trim() || s.body.trim()))) {
      out.push({ ...s, rendered: undefined });
      continue;
    }
    if (s.rendered) {
      out.push(s);
      continue;
    }
    const blob = await renderSlide(s, c.format, accent);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())))
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    out.push({ ...s, rendered: await upload(blob, `slide-${hash}.jpg`) });
  }
  return out;
}

export async function downloadCarousel(c: Carousel, caption: string, hashtags: string, accent: string, name = "carrousel") {
  const files: { name: string; data: Uint8Array }[] = [];
  for (let i = 0; i < c.slides.length; i++) {
    const s = c.slides[i];
    if (!s.image) continue;
    let blob: Blob;
    try {
      blob = await renderSlide(s, c.format, accent);
    } catch {
      // A slide WITH text may never be downloaded without it: say so instead.
      if (s.showText && (s.headline.trim() || s.body.trim())) throw new Error(`Slide ${i + 1} kon niet met tekst worden samengesteld. Probeer het opnieuw.`);
      blob = await (await fetch(s.image)).blob();
    }
    files.push({ name: `slide-${String(i + 1).padStart(2, "0")}.jpg`, data: new Uint8Array(await blob.arrayBuffer()) });
  }
  files.push({ name: "caption.txt", data: new TextEncoder().encode([caption.trim(), hashtags.trim()].filter(Boolean).join("\n\n") + "\n") });
  const blob = new Blob([zip(files) as BlobPart], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60) + ".zip";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
