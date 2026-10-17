import type { Carousel, CarouselSlide, Post, SlideTextStyle } from "./types";
import { ACTIONS } from "./plans";

export const DEFAULT_STYLE: SlideTextStyle = { position: "bottom", size: "m", color: "#ffffff", font: "sans", align: "left" };
/** Fonts that are available in every browser (same in the editor and in the downloaded image). */
export const FONTS: Record<SlideTextStyle["font"], { label: string; css: string }> = {
  sans: { label: "Modern", css: 'Inter, "Segoe UI", Arial, sans-serif' },
  serif: { label: "Klassiek", css: 'Georgia, "Times New Roman", serif' },
  rounded: { label: "Vriendelijk", css: '"Trebuchet MS", "Segoe UI", sans-serif' },
  mono: { label: "Strak", css: '"Courier New", Courier, monospace' },
};
/** Headline / body size as a fraction of the image width. */
export const SIZES: Record<SlideTextStyle["size"], { head: number; body: number; label: string }> = {
  s: { head: 0.052, body: 0.032, label: "Klein" },
  m: { head: 0.066, body: 0.038, label: "Middel" },
  l: { head: 0.084, body: 0.046, label: "Groot" },
};
export const styleOf = (s: Pick<CarouselSlide, "style">): SlideTextStyle => ({ ...DEFAULT_STYLE, ...(s.style || {}) });

/** The image to publish: the final composed image when the slide shows text, else the image itself. */
export const publishImage = (s: CarouselSlide) => (s.showText && (s.headline.trim() || s.body.trim()) ? s.rendered || "" : s.image);

// Instagram carousels: pure helpers shared by the editor, the server and tests.

export const MIN_SLIDES = 2;

export function newSlide(o: Partial<CarouselSlide> = {}): CarouselSlide {
  return { id: o.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)), image: "", headline: "", body: "", showText: true, imageBrief: "", source: "empty", ...o };
}

/**
 * `media` always mirrors the slides in order: the final composed image when
 * the slide carries text and has been rendered, else the slide image. So
 * calendar, preview and (later) publishing use what the customer approved.
 */
export function withCarousel(post: Post, carousel: Carousel): Post {
  return { ...post, contentType: "Carousel", carousel, media: carousel.slides.map((s) => publishImage(s) || s.image).filter(Boolean) };
}

export function moveSlide(slides: CarouselSlide[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= slides.length || to >= slides.length) return slides;
  const next = [...slides];
  const [s] = next.splice(from, 1);
  next.splice(to, 0, s);
  return next;
}

/**
 * Replace one slide; the others stay exactly as they are. Any change to the
 * image or text makes the composed image outdated, so it is cleared.
 */
export const replaceSlide = (slides: CarouselSlide[], id: string, patch: Partial<CarouselSlide>) =>
  slides.map((s) => (s.id === id ? { ...s, ...patch, rendered: "rendered" in patch ? patch.rendered : undefined } : s));

/**
 * Most credits a carousel generation can use: the plan, plus one new AI image
 * per slide (the monthly image limit applies on top).
 */
export function creditEstimate(slides: number) {
  return ACTIONS.carousel.credits + slides * ACTIONS.image_generate.credits;
}

const str = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
/** Shape check for workspace saves (no oversized or malformed carousel data). */
export function carouselValid(c: unknown): boolean {
  if (c === undefined) return true;
  const v = c as Carousel;
  return (
    !!v &&
    Array.isArray(v.slides) &&
    v.slides.length <= 10 &&
    ["square", "portrait"].includes(v.format) &&
    v.slides.every(
      (s) =>
        s &&
        str(s.id, 80) &&
        str(s.image, 12_000_000) &&
        str(s.headline, 120) &&
        str(s.body, 200) &&
        typeof s.showText === "boolean" &&
        str(s.imageBrief, 600) &&
        ["ai", "own", "empty"].includes(s.source) &&
        (s.rendered === undefined || str(s.rendered, 200)) &&
        (s.style === undefined ||
          (["top", "center", "bottom"].includes(s.style.position) &&
            ["s", "m", "l"].includes(s.style.size) &&
            /^#[0-9a-f]{6}$/i.test(s.style.color) &&
            Object.keys(FONTS).includes(s.style.font) &&
            ["left", "center", "right"].includes(s.style.align))),
    ) &&
    (v.plan === undefined || (str(v.plan.title, 160) && str(v.plan.concept, 600) && str(v.plan.visualStyle, 800)))
  );
}

/** Slides that carry visible text (the layer is added when downloading). */
export const textSlides = (c: Carousel | undefined) => (c?.slides || []).filter((s) => s.showText && (s.headline.trim() || s.body.trim()));
