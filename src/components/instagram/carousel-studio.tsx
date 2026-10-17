"use client";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, GripVertical, ImagePlus, Images, Plus, RefreshCw, Sparkles, Trash2, Wand2 } from "lucide-react";
import { LibraryPicker } from "@/components/library/library-picker";
import { UpgradeNotice, usePlan } from "@/components/plan-gate";
import { generateCarouselPlan, generateImage, type CarouselPlanResult } from "@/lib/api-client";
import { DEFAULT_STYLE, FONTS, MIN_SLIDES, SIZES, creditEstimate, moveSlide, newSlide, replaceSlide, styleOf, withCarousel } from "@/lib/carousel";
import { downloadCarousel, isLight, renderFinalSlides } from "@/lib/carousel-download";
import { isBrowserDemo } from "@/lib/demo";
import { mediaRef } from "@/lib/media-ref";
import { readImages } from "@/lib/local-images";
import { publishProblems } from "@/lib/instagram-publish";
import type { Carousel, CarouselSlide, Post, Profile, SlideTextStyle } from "@/lib/types";
import { InspirationPicker } from "./inspiration-picker";

// Instagram carousel: ONE post with several slides that tell one story.
// Phase A: one plan (story, slide texts, image briefs, shared visual style,
// one caption). Phase B: one AI image per slide, slide 1 as style reference
// for the others. Every slide is saved as soon as it exists, so a failure at
// slide 4 keeps slides 1-3; only failed slides need a retry. Slide texts are
// an editable layer (exact spelling), drawn on the images when downloading.

const GOALS: [string, string][] = [
  ["merkbekendheid", "Merkbekendheid"],
  ["verkoop", "Verkoop"],
  ["reserveringen", "Reserveringen"],
  ["betrokkenheid", "Betrokkenheid"],
  ["informeren", "Informeren"],
];

async function ownPhoto(file: File): Promise<string> {
  if (isBrowserDemo()) return (await readImages([file], 1))[0];
  const form = new FormData();
  form.append("files", file);
  form.append("kind", "image");
  const r = await fetch("/api/library/files", { method: "POST", body: form });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "De foto kon niet worden opgeslagen.");
  return mediaRef(d.ids[0]);
}

// Final composed slide (image + text) into the Bibliotheek; same name = same file (deduplicated).
async function uploadRendered(blob: Blob, name: string): Promise<string> {
  if (isBrowserDemo()) return (await readImages([new File([blob], name, { type: "image/jpeg" })], 1))[0];
  return ownPhoto(new File([blob], name, { type: "image/jpeg" }));
}

const STEPS = ["Beschrijven", "Plan controleren", "Afbeeldingen maken", "Slides bewerken", "Goedkeuren"];
const POSITIONS: [SlideTextStyle["position"], string][] = [["top", "Boven"], ["center", "Midden"], ["bottom", "Onder"]];
const ALIGNS: [SlideTextStyle["align"], string][] = [["left", "Links"], ["center", "Midden"], ["right", "Rechts"]];

export function CarouselStudio({ profile, editPost, initialBrief = "", onPersist, onSingle }: { profile: Profile; editPost?: Post; initialBrief?: string; onPersist: (p: Post) => Promise<boolean>; onSingle: () => void }) {
  const plan = usePlan();
  const demo = isBrowserDemo();
  const maxSlides = demo ? 5 : plan?.carouselSlides ?? 0;
  const entitled = demo || !!plan?.entitlements.includes("carousels");
  const accent = profile.brandVoice?.colors?.find((c) => /^#[0-9a-f]{6}$/i.test(c)) || "#7c3aed";

  const [brief, setBrief] = useState(editPost?.prompt || initialBrief);
  const [goal, setGoal] = useState("merkbekendheid");
  const [count, setCount] = useState(Math.min(5, Math.max(MIN_SLIDES, maxSlides || 5)));
  const [product, setProduct] = useState("");
  const [cta, setCta] = useState("");
  const [inspiration, setInspiration] = useState<string[]>([]);
  const [useBrand, setUseBrand] = useState(true);
  const [format, setFormat] = useState<Carousel["format"]>(editPost?.carousel?.format || "portrait");

  const [post, setPost] = useState<Post | null>(editPost || null);
  const [slides, setSlides] = useState<CarouselSlide[]>(editPost?.carousel?.slides || []);
  const [caption, setCaption] = useState(editPost?.caption || "");
  const [hashtags, setHashtags] = useState(editPost?.hashtags || "");
  const [date, setDate] = useState(editPost?.date || "");
  const [planMeta, setPlanMeta] = useState<Carousel["plan"]>(editPost?.carousel?.plan);
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [picker, setPicker] = useState<null | string>(null);
  const [drag, setDrag] = useState<number | null>(null);

  const cur = slides[Math.min(active, slides.length - 1)];
  const effectiveMax = Math.max(maxSlides, 10);
  const estimate = useMemo(() => creditEstimate(count), [count]);

  // Saves the whole carousel as one concept; media mirrors the slide images.
  async function save(nextSlides = slides, extra: Partial<Post> = {}, quiet = false) {
    const now = new Date().toISOString();
    const base: Post = post || { id: crypto.randomUUID(), prompt: brief.trim().slice(0, 1000), caption: "", hashtags: "", status: "draft", date: "", createdAt: now, variant: 0, contentType: "Carousel", source: "manual", media: [] };
    const next = withCarousel({ ...base, caption, hashtags, date, updatedAt: now, ...extra }, { slides: nextSlides, format, plan: planMeta });
    const ok = await onPersist(next);
    if (ok) setPost(next);
    else if (!quiet) setError("Opslaan is niet gelukt. Je wijzigingen staan nog in de editor.");
    return ok ? next : null;
  }

  async function slideImage(s: CarouselSlide, index: number, total: number, all: CarouselSlide[], visualStyle: string) {
    const first = all.find((x, i) => i !== index && x.image && x.source === "ai")?.image;
    return generateImage({
      mode: "generate",
      brief: s.imageBrief || brief,
      format,
      useBrand,
      references: inspiration.length ? inspiration : undefined,
      slide: { visualStyle, slideBrief: s.imageBrief || brief, index: index + 1, total, styleReference: first },
    });
  }

  // Step 2: only the plan (2 credits). No paid images yet: the user reviews
  // and edits the story, texts and image briefs first.
  async function makePlan() {
    if (brief.trim().length < 5) return setError("Beschrijf in een paar woorden wat de carrousel moet vertellen.");
    setError("");
    setMessage("");
    setFailed({});
    setBusy("plan");
    try {
      setProgress("Concept maken…");
      const p: CarouselPlanResult = await generateCarouselPlan({ brief: brief.trim(), goal, slides: count, product: product || undefined, cta: cta || undefined, useBrand });
      const list = p.slides.map((s) => newSlide({ headline: s.headline, body: s.body, imageBrief: s.image_brief, style: { ...DEFAULT_STYLE } }));
      const meta = { title: p.title, concept: p.concept, audience: p.audience, goal: p.goal, visualStyle: p.visual_style };
      setPlanMeta(meta);
      setSlides(list);
      setCaption(p.caption);
      setHashtags(p.hashtags);
      setActive(0);
      // The plan is saved right away: it survives any later image failure.
      const nowPost = withCarousel(
        { ...(post || { id: crypto.randomUUID(), status: "draft", createdAt: new Date().toISOString(), variant: 0, source: "manual" as const, date: "" }), prompt: brief.trim().slice(0, 1000), caption: p.caption, hashtags: p.hashtags, date, contentType: "Carousel", updatedAt: new Date().toISOString() } as Post,
        { slides: list, format, plan: meta },
      );
      if (await onPersist(nowPost)) setPost(nowPost);
      setMessage("Je carrouselplan staat klaar. Controleer de teksten en beeldbeschrijvingen per slide en pas ze aan waar nodig. Daarna maak je de afbeeldingen.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Het carrouselplan kon niet worden gemaakt.");
    } finally {
      setProgress("");
      setBusy("");
    }
  }

  // Step 3: one AI image per slide that has none yet (also the retry for failed slides).
  async function generate() {
    setError("");
    setMessage("");
    setBusy("generate");
    const meta = planMeta || { title: "", concept: "", audience: "", goal: "", visualStyle: "" };
    let list = slides;
    const base = post || withCarousel({ id: crypto.randomUUID(), prompt: brief.trim().slice(0, 1000), caption, hashtags, status: "draft", date, createdAt: new Date().toISOString(), variant: 0, source: "manual" }, { slides: list, format, plan: meta });
    try {
      const fails: Record<string, string> = {};
      const todo = list.map((s, i) => (s.image ? -1 : i)).filter((i) => i >= 0);
      for (let k = 0; k < todo.length; k++) {
        const i = todo[k];
        setProgress(`Slide ${i + 1} van ${list.length} wordt gegenereerd (${k + 1} van ${todo.length})…`);
        try {
          const image = await slideImage(list[i], i, list.length, list, meta.visualStyle);
          list = replaceSlide(list, list[i].id, { image, source: "ai" });
          setSlides(list);
          setProgress("Afbeelding opslaan…");
          await persistList(list, base, caption, hashtags, meta);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Deze slide is niet gelukt.";
          fails[list[i].id] = msg;
          setFailed({ ...fails });
          // Out of credits or images: stop instead of trying the rest.
          if (/tegoed|gebruikt|abonnement|besloten test|testmodus/i.test(msg)) {
            list.slice(i + 1).forEach((s) => (fails[s.id] = msg));
            setFailed({ ...fails });
            break;
          }
        }
      }
      const done = list.filter((s) => s.image).length;
      setProgress("");
      setMessage(done === list.length ? "Je carrousel is klaar. Bekijk de slides, pas tekst of beelden aan en keur hem goed." : `${done} van ${list.length} slides hebben een afbeelding. Het plan en de gemaakte slides zijn bewaard; maak alleen de ontbrekende slides opnieuw of gebruik een eigen foto.`);
    } catch (e) {
      setProgress("");
      setError(e instanceof Error ? e.message : "De afbeeldingen konden niet worden gemaakt.");
    } finally {
      setBusy("");
    }
  }

  // Save helper during generation (state is not yet updated in this render).
  async function persistList(list: CarouselSlide[], base: Post, cap: string, tags: string, meta: Carousel["plan"]) {
    const next = withCarousel({ ...base, caption: cap, hashtags: tags, updatedAt: new Date().toISOString() }, { slides: list, format, plan: meta });
    if (await onPersist(next)) setPost(next);
  }

  // Only this slide gets a new image; all other slides stay exactly as they are.
  async function regenerate(s: CarouselSlide) {
    setError("");
    setBusy("slide:" + s.id);
    const index = slides.findIndex((x) => x.id === s.id);
    try {
      const image = await slideImage(s, index, slides.length, slides, planMeta?.visualStyle || "");
      const next = replaceSlide(slides, s.id, { image, source: "ai" });
      setSlides(next);
      const f = { ...failed };
      delete f[s.id];
      setFailed(f);
      await save(next);
      setMessage(`Slide ${index + 1} is opnieuw gemaakt. De andere slides zijn niet veranderd.`);
    } catch (e) {
      setFailed({ ...failed, [s.id]: e instanceof Error ? e.message : "Niet gelukt." });
    } finally {
      setBusy("");
    }
  }

  function startManual() {
    const list = Array.from({ length: Math.max(MIN_SLIDES, Math.min(count, effectiveMax)) }, () => newSlide());
    setSlides(list);
    setActive(0);
    setMessage("Voeg per slide een eigen foto en tekst toe. Je kunt later ook slides met AI laten maken.");
  }

  const updateCur = (patch: Partial<CarouselSlide>) => cur && setSlides(replaceSlide(slides, cur.id, patch));
  const curStyle = cur ? styleOf(cur) : DEFAULT_STYLE;
  const setStyle = (patch: Partial<SlideTextStyle>) => updateCur({ style: { ...curStyle, ...patch } });
  const colors = Array.from(new Set(["#ffffff", "#111111", ...(profile.brandVoice?.colors || []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).map((c) => c.toLowerCase())])).slice(0, 8);
  const missing = slides.filter((s) => !s.image).length;
  const textOnly = slides.filter((s) => s.showText && (s.headline.trim() || s.body.trim()));
  // Problems apart from the final images, which approving makes itself.
  const problems = post ? publishProblems({ caption, hashtags, media: slides.map((s) => s.image).filter(Boolean), contentType: "Carousel", carousel: { slides: slides.map((s) => ({ ...s, rendered: s.rendered || "pending" })), format } }) : [];
  const step = !slides.length ? 0 : slides.every((s) => !s.image) ? 1 : missing ? 2 : post?.status === "approved" || post?.status === "scheduled" ? 4 : 3;

  async function approve() {
    setError("");
    if (slides.some((s) => !s.image)) return setError("Geef eerst elke slide een afbeelding.");
    setBusy("approve");
    try {
      // The final images (photo + text layer) are made now; the calendar and
      // later publishing use exactly these images.
      if (textOnly.length) setProgress(`Definitieve slides maken (${textOnly.length})…`);
      const final = await renderFinalSlides({ slides, format, plan: planMeta }, accent, uploadRendered);
      setSlides(final);
      const future = date && new Date(date).getTime() > Date.now();
      const saved = await save(final, { status: future ? "scheduled" : "approved" });
      if (saved) setMessage((future ? "Goedgekeurd en ingepland in de kalender." : "Goedgekeurd. Kies een datum om hem in de kalender in te plannen.") + " Mavix kan carrousels nog niet zelf op Instagram plaatsen: download de slides en plaats ze zelf in de Instagram-app.");
    } catch (e) {
      setError(e instanceof Error && e.message !== "render" ? e.message : "De definitieve slides konden niet worden gemaakt. Probeer het opnieuw.");
    } finally {
      setProgress("");
      setBusy("");
    }
  }

  return (
    <div className="cs-studio cr">
      <div className="cs-toolbar">
        <div className="cs-toolbar-title">
          <h2>{post ? planMeta?.title || "Instagram-carrousel" : "Nieuwe Instagram-carrousel"}</h2>
        </div>
        <button type="button" className="button secondary" onClick={onSingle}>
          <ArrowLeft size={15} aria-hidden="true" /> Enkele post
        </button>
      </div>

      {!entitled && plan !== undefined && (
        <UpgradeNotice entitlement="carousels" feature="AI-carrousels" title="Maak complete Instagram-carrousels met Mavix Growth.">
          Met Growth maakt Mavix met één opdracht een carrousel tot 5 slides: het verhaal, de beelden en één caption. Met Premium tot 10 slides.
        </UpgradeNotice>
      )}

      <ol className="cr-steps" aria-label="Stappen">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? "is-current" : i < step ? "is-done" : ""} aria-current={i === step ? "step" : undefined}>
            <span>{i + 1}</span> {s}
          </li>
        ))}
      </ol>

      {!slides.length ? (
        <section className="cr-setup" aria-label="Carrouselinstellingen">
          <label className="cs-label" htmlFor="cr-brief">
            Wat wil je maken?
          </label>
          <textarea id="cr-brief" rows={4} maxLength={1000} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Bijvoorbeeld: een gezellige Italiaanse avond. Begin met een grap, laat pizza, pasta en cocktails zien en eindig met een uitnodiging om te reserveren." />
          <div className="cr-grid">
            <label>
              <span className="cs-label">Doel</span>
              <select value={goal} onChange={(e) => setGoal(e.target.value)}>
                {GOALS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="cs-label">
                Aantal slides <small>(2–{entitled ? maxSlides || 10 : 10})</small>
              </span>
              <input type="number" min={MIN_SLIDES} max={entitled ? maxSlides || 10 : 10} value={count} onChange={(e) => setCount(Math.max(MIN_SLIDES, Math.min(entitled ? maxSlides || 10 : 10, Number(e.target.value) || MIN_SLIDES)))} />
            </label>
            <label>
              <span className="cs-label">Product of dienst (optioneel)</span>
              <input value={product} maxLength={160} onChange={(e) => setProduct(e.target.value)} />
            </label>
            <label>
              <span className="cs-label">Call-to-action (optioneel)</span>
              <input value={cta} maxLength={120} onChange={(e) => setCta(e.target.value)} placeholder="Bijvoorbeeld: Reserveer je tafel" />
            </label>
          </div>
          <InspirationPicker value={inspiration} onChange={setInspiration} max={plan?.inspirationMax ?? 3} disabled={!!busy} />
          <div className="cs-visual-format" role="radiogroup" aria-label="Afbeeldingsformaat">
            <button type="button" role="radio" aria-checked={format === "portrait"} onClick={() => setFormat("portrait")}>
              Staand 4:5 (aanbevolen)
            </button>
            <button type="button" role="radio" aria-checked={format === "square"} onClick={() => setFormat("square")}>
              Vierkant
            </button>
          </div>
          <label className="cs-check">
            <input type="checkbox" checked={useBrand} onChange={(e) => setUseBrand(e.target.checked)} />
            <span>Brand Hub meenemen (toon, kleuren, doelgroep), als die is ingevuld</span>
          </label>
          <p className="cr-estimate">
            <Sparkles size={14} aria-hidden="true" /> Eerst maakt Mavix een plan (2 credits). Je controleert het plan en kiest daarna zelf of je de afbeeldingen laat maken: maximaal {estimate} credits in totaal, 10 per AI-slide. Elke AI-slide telt mee in je maandlimiet voor AI-afbeeldingen.
          </p>
          <div className="cr-actions">
            <button type="button" className="button primary" disabled={!!busy || !entitled} onClick={() => void makePlan()}>
              <Wand2 size={15} aria-hidden="true" /> {busy ? "Plan wordt gemaakt…" : "Carrouselplan maken"}
            </button>
            <button type="button" className="button secondary" disabled={!!busy || !entitled} onClick={startManual}>
              Zelf samenstellen
            </button>
          </div>
        </section>
      ) : (
        <section className="cr-editor" aria-label="Carrousel-editor">
          <div className="cr-stage">
            <div className={"cr-frame is-" + format}>
              {cur?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cur.image} alt={`Slide ${active + 1}`} />
              ) : (
                <span className="cr-empty">{busy.startsWith("slide") || busy === "generate" ? "Wordt gemaakt…" : failed[cur?.id || ""] ? "Niet gelukt" : "Nog geen afbeelding"}</span>
              )}
              {cur?.showText && (cur.headline || cur.body) && (
                <div
                  className={`cr-text is-${curStyle.position} is-${isLight(curStyle.color) ? "light" : "dark"}`}
                  style={{ ["--accent" as string]: accent, ["--head" as string]: SIZES[curStyle.size].head, ["--body" as string]: SIZES[curStyle.size].body, color: curStyle.color, fontFamily: FONTS[curStyle.font].css, textAlign: curStyle.align }}
                >
                  <span className="cr-text-bar" aria-hidden="true" />
                  {cur.headline && <strong>{cur.headline}</strong>}
                  {cur.body && <span>{cur.body}</span>}
                </div>
              )}
              <button type="button" className="cr-nav is-prev" aria-label="Vorige slide" disabled={active === 0} onClick={() => setActive(active - 1)}>
                <ChevronLeft size={18} />
              </button>
              <button type="button" className="cr-nav is-next" aria-label="Volgende slide" disabled={active >= slides.length - 1} onClick={() => setActive(active + 1)}>
                <ChevronRight size={18} />
              </button>
              <span className="cr-count">
                {active + 1}/{slides.length}
              </span>
            </div>
            <ol className="cr-thumbs" aria-label="Slides (sleep om de volgorde te wijzigen)">
              {slides.map((s, i) => (
                <li
                  key={s.id}
                  draggable
                  onDragStart={() => setDrag(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (drag !== null) {
                      setSlides(moveSlide(slides, drag, i));
                      setActive(i);
                    }
                    setDrag(null);
                  }}
                  className={(i === active ? "is-active" : "") + (failed[s.id] ? " is-failed" : "")}
                >
                  <button type="button" aria-label={`Slide ${i + 1}${failed[s.id] ? " (niet gelukt)" : ""}`} aria-current={i === active} onClick={() => setActive(i)}>
                    {s.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt="" />
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </button>
                  <GripVertical size={12} className="cr-grip" aria-hidden="true" />
                </li>
              ))}
              {slides.length < effectiveMax && (
                <li>
                  <button type="button" className="cr-add" aria-label="Slide toevoegen" onClick={() => (setSlides([...slides, newSlide()]), setActive(slides.length))}>
                    <Plus size={16} />
                  </button>
                </li>
              )}
            </ol>
            {progress && (
              <p className="cr-progress" role="status">
                {progress}
              </p>
            )}
            {missing > 0 && entitled && (
              <div className="cr-plan">
                {planMeta?.concept && (
                  <>
                    <h3>Carrouselplan{planMeta.title ? `: ${planMeta.title}` : ""}</h3>
                    <p>{planMeta.concept}</p>
                    <label className="cs-label" htmlFor="cr-visual">
                      Gezamenlijke beeldstijl (voor alle slides)
                    </label>
                    <textarea id="cr-visual" rows={2} maxLength={600} value={planMeta.visualStyle} onChange={(e) => setPlanMeta({ ...planMeta, visualStyle: e.target.value })} />
                  </>
                )}
                <p className="cr-estimate">
                  Controleer per slide de tekst en de beeldbeschrijving. {missing} {missing === 1 ? "slide heeft" : "slides hebben"} nog geen afbeelding: maximaal {missing * 10} credits.
                </p>
                <button type="button" className="button primary" disabled={!!busy} onClick={() => void generate()}>
                  <Sparkles size={15} aria-hidden="true" /> {busy === "generate" ? "Bezig…" : missing === slides.length ? (planMeta?.concept ? "Plan goedkeuren en afbeeldingen maken" : "Alle afbeeldingen met AI maken") : `Ontbrekende ${missing === 1 ? "slide" : "slides"} maken`}
                </button>
              </div>
            )}
          </div>

          {cur && (
            <div className="cr-panel">
              <h3>Slide {active + 1}</h3>
              <div className="cr-move">
                <button type="button" className="button secondary" disabled={active === 0} onClick={() => (setSlides(moveSlide(slides, active, active - 1)), setActive(active - 1))}>
                  <ChevronLeft size={14} /> Naar voren
                </button>
                <button type="button" className="button secondary" disabled={active >= slides.length - 1} onClick={() => (setSlides(moveSlide(slides, active, active + 1)), setActive(active + 1))}>
                  Naar achteren <ChevronRight size={14} />
                </button>
              </div>
              <label className="cs-label" htmlFor="cr-headline">
                Titel op de slide
              </label>
              <input id="cr-headline" maxLength={120} value={cur.headline} onChange={(e) => updateCur({ headline: e.target.value })} />
              <label className="cs-label" htmlFor="cr-body">
                Korte tekst (optioneel)
              </label>
              <input id="cr-body" maxLength={200} value={cur.body} onChange={(e) => updateCur({ body: e.target.value })} />
              <label className="cs-check">
                <input type="checkbox" checked={cur.showText} onChange={(e) => updateCur({ showText: e.target.checked })} />
                <span>Tekst op deze slide tonen</span>
              </label>
              {cur.showText && (
                <fieldset className="cr-style">
                  <legend>Opmaak van de tekst</legend>
                  <div className="cr-seg" role="radiogroup" aria-label="Positie">
                    {POSITIONS.map(([v, l]) => (
                      <button key={v} type="button" role="radio" aria-checked={curStyle.position === v} onClick={() => setStyle({ position: v })}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <div className="cr-seg" role="radiogroup" aria-label="Uitlijning">
                    {ALIGNS.map(([v, l]) => (
                      <button key={v} type="button" role="radio" aria-checked={curStyle.align === v} onClick={() => setStyle({ align: v })}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <div className="cr-seg" role="radiogroup" aria-label="Grootte">
                    {(Object.keys(SIZES) as SlideTextStyle["size"][]).map((v) => (
                      <button key={v} type="button" role="radio" aria-checked={curStyle.size === v} onClick={() => setStyle({ size: v })}>
                        {SIZES[v].label}
                      </button>
                    ))}
                  </div>
                  <label>
                    <span className="cs-label">Lettertype</span>
                    <select value={curStyle.font} onChange={(e) => setStyle({ font: e.target.value as SlideTextStyle["font"] })}>
                      {(Object.keys(FONTS) as SlideTextStyle["font"][]).map((v) => (
                        <option key={v} value={v}>
                          {FONTS[v].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="cr-colors" role="radiogroup" aria-label="Tekstkleur (wit, zwart en je Brand Hub-kleuren)">
                    {colors.map((c) => (
                      <button key={c} type="button" role="radio" aria-checked={curStyle.color.toLowerCase() === c} aria-label={c} title={c} style={{ background: c }} onClick={() => setStyle({ color: c })} />
                    ))}
                  </div>
                  <div className="cr-move">
                    <button type="button" className="button secondary" onClick={() => setSlides(slides.map((s) => (s.id === cur.id ? s : replaceSlide([s], s.id, { style: { ...curStyle } })[0])))}>
                      Op alle slides toepassen
                    </button>
                    <button type="button" className="button secondary" onClick={() => updateCur({ headline: "", body: "" })}>
                      <Trash2 size={14} /> Tekst verwijderen
                    </button>
                  </div>
                </fieldset>
              )}
              <label className="cs-label" htmlFor="cr-brief-slide">
                {cur.image ? "Nieuwe opdracht voor deze slide (alleen deze slide)" : "Wat staat er op de afbeelding?"}
              </label>
              <textarea id="cr-brief-slide" rows={2} maxLength={600} value={cur.imageBrief} onChange={(e) => updateCur({ imageBrief: e.target.value })} />
              {failed[cur.id] && (
                <p className="cs-error" role="alert">
                  {failed[cur.id]}
                </p>
              )}
              <div className="cr-slide-actions">
                <button type="button" className="button primary" disabled={!!busy || !entitled || !(cur.imageBrief || brief).trim()} onClick={() => void regenerate(cur)}>
                  <RefreshCw size={14} /> {busy === "slide:" + cur.id ? "Bezig…" : cur.image ? "Deze slide opnieuw genereren" : "Afbeelding voor deze slide maken"}
                </button>
                <label className="button secondary">
                  <ImagePlus size={14} /> Eigen foto
                  <input
                    type="file"
                    hidden
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      try {
                        const image = await ownPhoto(f);
                        setSlides(replaceSlide(slides, cur.id, { image, source: "own" }));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "De foto kon niet worden toegevoegd.");
                      }
                    }}
                  />
                </label>
                <button type="button" className="button secondary" onClick={() => setPicker(cur.id)}>
                  <Images size={14} /> Uit Bibliotheek
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={slides.length <= MIN_SLIDES}
                  onClick={() => {
                    setSlides(slides.filter((s) => s.id !== cur.id));
                    setActive(Math.max(0, active - 1));
                  }}
                >
                  <Trash2 size={14} /> Verwijderen
                </button>
              </div>

              <hr />
              <label className="cs-label" htmlFor="cr-caption">
                Caption voor de hele carrousel <small>{caption.length} / 2200</small>
              </label>
              <textarea id="cr-caption" rows={6} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} />
              <label className="cs-label" htmlFor="cr-tags">
                Hashtags
              </label>
              <textarea id="cr-tags" rows={2} maxLength={1000} value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
              <label className="cs-label" htmlFor="cr-date">
                Inplannen (optioneel)
              </label>
              <input id="cr-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
              {problems.length > 0 && (
                <ul className="cs-checks">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              <div className="cr-slide-actions">
                <button type="button" className="button secondary" disabled={!!busy || (!entitled && !editPost?.carousel)} onClick={() => void save(slides, post?.status === "approved" || post?.status === "scheduled" ? { status: "draft" } : {}).then((p) => p && setMessage("Carrousel opgeslagen als concept."))}>
                  Opslaan
                </button>
                <button type="button" className="button primary" disabled={!!busy || missing > 0 || (!entitled && !editPost?.carousel)} onClick={() => void approve()}>
                  {busy === "approve" ? "Slides worden gemaakt…" : "Goedkeuren"}
                </button>
                <button type="button" className="button secondary" disabled={!slides.some((s) => s.image)} onClick={() => void downloadCarousel({ slides, format, plan: planMeta }, caption, hashtags, accent, planMeta?.title || "carrousel").catch(() => setError("Downloaden is niet gelukt."))}>
                  <Download size={14} /> Alle slides downloaden
                </button>
              </div>
              <p className="cr-note">Mavix plaatst carrousels nog niet zelf op Instagram. Download de slides (met tekst) en de caption, en plaats ze zelf in de Instagram-app.</p>
            </div>
          )}
        </section>
      )}

      {(message || error) && (
        <p role={error ? "alert" : "status"} className={error ? "cs-error" : "cs-message"}>
          {error || message}
        </p>
      )}
      <LibraryPicker
        open={!!picker}
        max={1}
        onClose={() => setPicker(null)}
        onPick={(imgs) => {
          if (picker && imgs[0]) setSlides(replaceSlide(slides, picker, { image: imgs[0], source: "own" }));
        }}
      />
    </div>
  );
}
