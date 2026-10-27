"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ImagePlus,
  Image as ImageIcon,
  Lightbulb,
  RefreshCw,
  Save,
  Check,
  Copy,
  Undo2,
  Wand2,
  Eye,
  PenLine,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  X,
  CalendarClock,
  Images,
} from "lucide-react";
import { GenerationSkeleton, previewMock } from "@/components/generation-skeleton";
import { Mavi } from "@/components/mavi";
import { Menu } from "@/components/menu";
import { SaveIndicator, type SaveStatus } from "@/components/save-indicator";
import { useWorkspace } from "@/components/workspace-provider";
import type { Post, Profile } from "@/lib/types";
import type { ContentType } from "@/lib/instagram-model";
import { generateInstagramContent, editContentText, generateImage, CONTENT_EDIT_LABELS, type ContentEditAction } from "@/lib/api-client";
import { readImages } from "@/lib/local-images";
import { InstagramPublishPanel, PublishButton, usePublishCapability } from "./publish";
import { AUTO_IMAGE_TYPES, generateWithImage, linkedImage, regenerateImage } from "@/lib/post-image";
import { isBrowserDemo } from "@/lib/demo";
import { mediaRef } from "@/lib/media-ref";
import { usePlan } from "@/components/plan-gate";
import { InspirationPicker } from "./inspiration-picker";
import { CarouselStudio } from "./carousel-studio";
import { instagramGoals, type InstagramGoal } from "@/lib/ai/instagram-instruction";
import { PlanningNotice } from "@/components/calendar/planning-notice";
import { LibraryPicker } from "@/components/library/library-picker";
import { CAPTION_LIMIT, HASHTAG_LIMIT, hashtagCount, instagramCaption, publishProblems, scheduleProblems } from "@/lib/instagram-publish";

// Content Studio for Instagram: controls (left), the editor (centre, the main
// workspace) and a realistic post preview (right). Generation, rewrites and
// alternatives run on the server; every result lands in the editor as an
// editable draft with undo. Edits autosave to the workspace after a pause.

// A post is always image + caption (Instagram has no text-only posts), so
// "Afbeelding" and "Caption" are no separate formats any more. Older concepts
// of those types open as a Post (POST_TYPE).
const FORMATS: { id: ContentType; label: string; hint: string; Icon: typeof ImageIcon }[] = [
  { id: "Post", label: "Post", hint: "Eén beeld met caption en hashtags", Icon: ImageIcon },
  { id: "Carousel", label: "Carrousel", hint: "Meerdere samenhangende slides in één post", Icon: Images },
  { id: "Content Ideas", label: "Ideeën", hint: "5 postideeën", Icon: Lightbulb },
];
const POST_TYPE = (t: ContentType | undefined): ContentType | undefined => (t === "Image" || t === "Captions & Hashtags" ? "Post" : t);
const UPCOMING: Record<string, string> = {
  Story: "Verticale stories zijn in ontwikkeling.",
  Reel: "AI-video is in ontwikkeling.",
  "Animate Image": "AI-video is in ontwikkeling.",
  "Photos to Reel": "AI-video is in ontwikkeling.",
};
const VIDEO = ["Reel", "Animate Image", "Photos to Reel"];
type VisualMode = "ai" | "own" | "edit";
const VISUAL_MODES: { id: VisualMode; label: string; Icon: typeof ImageIcon }[] = [
  { id: "ai", label: "AI-beeld", Icon: Wand2 },
  { id: "own", label: "Eigen foto", Icon: ImagePlus },
  { id: "edit", label: "Foto bewerken", Icon: PenLine },
];
const AUTOSAVE_MS = 1500;

export function CreateStudio({
  profile,
  editPost,
  initialDate,
  initialType,
  fromCalendar = false,
  returnDate,
  focusPreview = false,
  initialBrief = "",
  start,
  onPersist,
}: {
  profile: Profile;
  editPost?: Post;
  initialDate?: string;
  initialType?: string;
  fromCalendar?: boolean;
  returnDate?: string;
  focusPreview?: boolean;
  /** One-line brief from the "Nieuwe content maken" flow. */
  initialBrief?: string;
  /** "ai" generates right away, "manual" opens an empty editor. */
  start?: "ai" | "manual";
  onPersist: (post: Post) => Promise<boolean>;
}) {
  const { saveState } = useWorkspace();
  const publishCap = usePublishCapability();
  const known = FORMATS.some((f) => f.id === POST_TYPE(initialType as ContentType));
  const [type, setType] = useState<ContentType>(POST_TYPE(editPost?.contentType) || (known ? (POST_TYPE(initialType as ContentType) as ContentType) : "Post"));
  const [notice, setNotice] = useState(initialType && UPCOMING[initialType] ? UPCOMING[initialType] : "");
  const [prompt, setPrompt] = useState(editPost?.prompt || initialBrief);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>(editPost?.media || []);
  const [product, setProduct] = useState("");
  const [goal, setGoal] = useState<InstagramGoal>("merkbekendheid");
  const [segmentId, setSegmentId] = useState("");
  const [cta, setCta] = useState("");
  const [website, setWebsite] = useState(false);
  const [post, setPost] = useState<Post | null>(editPost || null);
  const [caption, setCaption] = useState(editPost?.caption || "");
  const [hashtags, setHashtags] = useState(editPost?.hashtags || "");
  const [date, setDate] = useState(editPost?.date || initialDate || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "generate" | "edit" | "upload" | "image">("");
  // `busy` only disables the buttons after the next render; this lock is set
  // synchronously, so a fast double click or Enter never starts a second paid
  // AI request while one is running.
  const aiLock = useRef(false);
  const lockAi = () => (aiLock.current ? false : (aiLock.current = true));
  // Visual: an AI image made with the caption (default), an own photo, or an
  // own photo edited with AI. Own photos already on the concept keep "own".
  const [imageMode, setImageMode] = useState<VisualMode>(editPost?.media?.length && !linkedImage(editPost, editPost.media) ? "own" : "ai");
  // One prompt makes caption + image; the user can switch the image off.
  const [autoImage, setAutoImage] = useState(true);
  // The image of this result: being made, failed (with the reason) or idle.
  const [imageState, setImageState] = useState<{ state: "idle" | "loading" | "error"; message?: string }>({ state: "idle" });
  const [imageBrief, setImageBrief] = useState("");
  const [imageFormat, setImageFormat] = useState<"square" | "portrait">("square");
  const [useBrand, setUseBrand] = useState(true);
  const [editIndex, setEditIndex] = useState(0);
  const [editBrief, setEditBrief] = useState("");
  const [inspiration, setInspiration] = useState<string[]>([]);
  const plan = usePlan();
  const [status, setStatus] = useState<SaveStatus>(editPost ? "saved" : "idle");
  const [history, setHistory] = useState<{ caption: string; hashtags: string }[]>([]);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [altMode, setAltMode] = useState<"full" | "opening">("full");
  const [view, setView] = useState<"edit" | "preview">(focusPreview && editPost ? "preview" : "edit");
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  // Back to Post without own photos: the AI image is the default again.
  useEffect(() => {
    if (AUTO_IMAGE_TYPES.includes(type) && !photos.length) setImageMode("ai");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the format changes
  }, [type]);
  const linked = linkedImage(post, photos);
  const hasOwn = photos.some((p) => p !== linked);
  const autoApplies = imageMode === "ai" && autoImage && AUTO_IMAGE_TYPES.includes(type);
  const imageLoading = imageState.state === "loading";

  const products = profile.productList?.length
    ? profile.productList.filter((p) => p.active).map((p) => p.name)
    : (profile.products || "")
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean);
  const dirty = !!post && (caption !== post.caption || hashtags !== post.hashtags || date !== (post.date || "") || photos.join("|") !== (post.media || []).join("|"));

  // Persist the current editor state. Status only turns "saved" after the
  // server confirmed it (onPersist resolves true).
  const persist = useCallback(
    async (nextStatus?: Post["status"]) => {
      if (!post) return false;
      if (!caption.trim()) {
        setError("Vul een caption in voordat je opslaat.");
        return false;
      }
      if (date && new Date(date).getTime() <= Date.now() && nextStatus) {
        setError("Kies een tijdstip in de toekomst of maak de datum leeg.");
        return false;
      }
      const next: Post = { ...post, caption, hashtags, date, media: photos, aiImage: linkedImage(post, photos), status: nextStatus || post.status, failureReason: undefined, updatedAt: new Date().toISOString() };
      setStatus("saving");
      const ok = await onPersist(next);
      setStatus(ok ? "saved" : "error");
      if (ok) setPost(next);
      return ok;
    },
    [post, caption, hashtags, date, photos, onPersist],
  );

  // Debounced autosave of edits (never while another save runs).
  useEffect(() => {
    if (!dirty || busy) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (saveState !== "saving") void persist();
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer.current);
  }, [dirty, busy, caption, hashtags, date, photos, persist, saveState]);
  const shownStatus: SaveStatus = dirty && status !== "saving" ? "dirty" : status;
  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function remember() {
    setHistory((h) => [...h.slice(-9), { caption, hashtags }]);
  }
  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setCaption(last.caption);
    setHashtags(last.hashtags);
    setHistory((h) => h.slice(0, -1));
    setAlternatives([]);
  }

  async function generate(again = false) {
    setMessage("");
    setError("");
    if (!prompt.trim()) {
      setError("Beschrijf eerst in een paar woorden wat je wilt maken.");
      return;
    }
    if (!lockAi()) return;
    setBusy("generate");
    setImageState({ state: "idle" });
    // Regenerating keeps the same concept (no duplicate drafts) and the
    // previous text stays available through "Ongedaan maken".
    if (post) remember();
    setStatus("saving");
    try {
      // One prompt, one result: the caption first, then the matching image
      // (src/lib/post-image.ts). Own photos are never replaced.
      const r = await generateWithImage({
        prompt: prompt.trim(),
        type,
        auto: autoApplies,
        current: { post, media: photos, date },
        persist: onPersist,
        image: aiImage,
        text: () =>
          previewMock(
            generateInstagramContent({
              prompt: prompt.trim(),
              type,
              profile,
              product,
              useWebsite: website,
              photos,
              duration: 5,
              videoMode: type,
              variant: again && post ? post.variant + 1 : 0,
              goal,
              segmentId: segmentId || undefined,
              cta: cta.trim() || undefined,
            }),
          ),
        onText: (next, imageComing) => {
          setPost(next);
          setCaption(next.caption);
          setHashtags(next.hashtags);
          setDate(next.date || "");
          setAlternatives([]);
          setStatus("saved");
          setView("edit");
          setMessage(imageComing ? "Caption klaar. Mavix maakt nu de bijpassende afbeelding…" : again ? "Nieuwe versie gemaakt en opgeslagen als concept." : "Concept gemaakt en opgeslagen.");
          if (imageComing) {
            setBusy("image");
            setImageState({ state: "loading" });
          }
        },
      });
      showImageOutcome(r, again);
    } catch (e) {
      setStatus(post ? "saved" : "idle");
      setError(e instanceof Error ? e.message : "Genereren is niet gelukt. Probeer het opnieuw.");
    } finally {
      aiLock.current = false;
      setBusy("");
    }
  }

  // Generator for the AI image of this result. A typed image description
  // wins over the briefing; Brand Hub style and inspiration are optional.
  function aiImage(brief: string) {
    return generateImage({ mode: "generate", brief: imageBrief.trim() || brief, format: imageFormat, useBrand, references: inspiration.length ? inspiration : undefined });
  }

  function showImageOutcome(r: Awaited<ReturnType<typeof regenerateImage>>, again = false) {
    setPost(r.post);
    setPhotos(r.media);
    if (r.image.state === "done") {
      setImageState({ state: "idle" });
      setStatus("saved");
      setMessage(again ? "Nieuwe caption en afbeelding gemaakt en opgeslagen." : "Caption en afbeelding gemaakt en opgeslagen als concept.");
    } else if (r.image.state === "error") {
      setImageState({ state: "error", message: r.image.message });
      setMessage("");
    } else setImageState({ state: "idle" });
  }

  // "Alleen afbeelding opnieuw genereren": a new AI image for the current
  // concept; caption, hashtags and own photos stay as they are.
  async function regenerateImageOnly() {
    if (!post) return makeImage();
    if (!lockAi()) return;
    setError("");
    setMessage("");
    setBusy("image");
    setImageState({ state: "loading" });
    try {
      const r = await regenerateImage({ prompt: prompt.trim(), type, post: { ...post, caption, hashtags, date }, media: photos, image: aiImage, persist: onPersist });
      showImageOutcome(r);
      if (r.image.state === "done") setMessage("Nieuwe afbeelding gemaakt en opgeslagen. De caption is niet veranderd.");
    } finally {
      aiLock.current = false;
      setBusy("");
    }
  }

  // Own photos go into the Bibliotheek (private storage) and the post keeps
  // a reference. In test mode there is no storage: small local copies.
  async function ownPhotos(files: File[]): Promise<string[]> {
    if (isBrowserDemo()) return readImages(files);
    if (files.length > 4) throw new Error("Kies maximaal 4 foto's.");
    if (files.some((f) => !["image/png", "image/jpeg", "image/webp"].includes(f.type) || f.size > 8 * 1024 * 1024)) throw new Error("Gebruik JPG, PNG of WebP van maximaal 8 MB per foto.");
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    form.append("kind", "image");
    const r = await fetch("/api/library/files", { method: "POST", body: form });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "De foto's konden niet worden opgeslagen.");
    return (d.ids as string[]).map(mediaRef);
  }

  // A paid image must never get lost: save it right away. Without a concept
  // yet, a draft is created for it (caption can follow); with a concept the
  // current editor state is saved with the new photos.
  async function keepImage(media: string[], fresh?: Post, aiImage?: string) {
    const now = new Date().toISOString();
    // `fresh` = the concept generate() just saved (its text is newer than this render's state).
    const base: Post = fresh || post || { id: crypto.randomUUID(), prompt: (imageBrief.trim() || prompt.trim()).slice(0, 1000), caption: "", hashtags: "", status: "draft", date: date || "", createdAt: now, variant: 0, contentType: type, source: "manual", media: [] };
    // aiImage = the image Mavix just made; otherwise keep the existing link while it is still selected.
    const link = aiImage || linkedImage(base, media);
    const next: Post = fresh ? { ...fresh, media, aiImage: link, updatedAt: now } : { ...base, caption, hashtags, date, media, aiImage: link, updatedAt: now };
    setStatus("saving");
    const ok = await onPersist(next);
    setStatus(ok ? "saved" : "error");
    if (ok) setPost(next);
    else setError("De afbeelding staat in de editor, maar is nog niet opgeslagen. Probeer opnieuw op te slaan.");
  }

  // A new AI image from the brief (Brand Hub only as optional style context).
  // An image before there is a concept (no caption yet): a draft is created
  // for it, linked as this concept's AI image.
  async function makeImage(brief = imageBrief.trim() || prompt.trim()) {
    if (!brief) return setError("Beschrijf wat er op de afbeelding moet staan.");
    if (!lockAi()) return;
    setError("");
    setMessage("");
    setBusy("image");
    setImageState({ state: "loading" });
    try {
      const image = await generateImage({ mode: "generate", brief, format: imageFormat, useBrand, references: inspiration.length ? inspiration : undefined });
      const next = [image, ...photos.filter((p) => p !== linked)].slice(0, 4);
      setPhotos(next);
      await keepImage(next, undefined, image);
      setImageState({ state: "idle" });
      setMessage("AI-afbeelding gemaakt en opgeslagen. Bekijk hem in het voorbeeld; je kunt een nieuwe laten maken of hem verwijderen.");
    } catch (e) {
      setImageState({ state: "error", message: e instanceof Error ? e.message : "De afbeelding kon niet worden gemaakt." });
    } finally {
      aiLock.current = false;
      setBusy("");
    }
  }

  // Edit the chosen own photo with AI; the original stays.
  async function editImage() {
    const photo = photos[editIndex];
    if (!photo) return setError("Kies eerst een foto om te bewerken.");
    if (!lockAi()) return;
    setError("");
    setMessage("");
    setBusy("image");
    try {
      const image = await generateImage({ mode: "edit", brief: editBrief.trim(), format: imageFormat, photo, useBrand });
      const next = [image, ...photos].slice(0, 4);
      setPhotos(next);
      await keepImage(next);
      setEditIndex(0);
      setMessage("Bewerkte foto toegevoegd. Het origineel staat er nog naast.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "De foto kon niet worden bewerkt. Probeer het opnieuw.");
    } finally {
      aiLock.current = false;
      setBusy("");
    }
  }

  // Start without AI: an empty concept that is saved as soon as there is a caption.
  function startManual() {
    setError("");
    const now = new Date().toISOString();
    setPost({ id: crypto.randomUUID(), prompt: prompt.trim(), caption: "", hashtags: "", status: "draft", date: date || "", createdAt: now, updatedAt: now, variant: 0, contentType: type, source: "manual", media: photos });
    setStatus("idle");
    setMessage("Schrijf je caption. Mavix slaat je concept automatisch op.");
    window.setTimeout(() => document.getElementById("ig-caption")?.focus(), 50);
  }

  // Coming from "Nieuwe content maken": start the chosen way once.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || editPost || !start) return;
    started.current = true;
    // Drop brief/start from the URL so a reload never creates a second concept.
    const url = new URL(window.location.href);
    url.searchParams.delete("brief");
    url.searchParams.delete("start");
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
    if (start === "manual") startManual();
    else if (prompt.trim()) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  async function edit(action: ContentEditAction) {
    if (!caption.trim() || !lockAi()) return;
    setError("");
    setMessage("");
    setBusy("edit");
    try {
      const results = await editContentText(action, action === "hashtags" ? caption + "\n" + hashtags : caption, "instagram");
      if (action === "alternatives" || action === "headline") {
        setAltMode(action === "headline" ? "opening" : "full");
        setAlternatives(results);
      } else if (action === "hashtags" && results[0]) {
        remember();
        setHashtags(results[0].replace(/\s+/g, " ").trim());
        setMessage("Hashtags voorgesteld. Pas ze gerust aan.");
      } else if (results[0]) {
        remember();
        setCaption(results[0]);
        setMessage("Mavix AI heeft je tekst aangepast. Controleer het resultaat.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aanpassen is niet gelukt. Je tekst is niet gewijzigd.");
    } finally {
      aiLock.current = false;
      setBusy("");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText([caption, hashtags].filter(Boolean).join("\n\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Kopiëren is niet gelukt. Selecteer de tekst handmatig.");
    }
  }

  async function approve() {
    setMessage("");
    setError("");
    const when = date ? scheduleProblems(date) : [];
    if (when.length) return setError(when[0]);
    if (await persist(date ? "scheduled" : "approved"))
      setMessage(date ? "Goedgekeurd en ingepland in de kalender. Publiceren gebeurt alleen na jouw bevestiging, of automatisch als je dat bij Automatisering hebt toegestaan." : "Goedgekeurd. Kies een datum om het in te plannen, of publiceer het via Geplande content.");
  }

  // Instagram's own limits, checked while editing (same rules as the server).
  const captionTotal = instagramCaption({ caption, hashtags }).length;
  const tags = hashtagCount(caption + " " + hashtags);
  const publishable = ["Post", "Image", "Carousel"].includes(post?.contentType || type);
  const checks = [...(publishable ? publishProblems({ caption, hashtags, media: photos, contentType: post?.contentType || type }) : []), ...(date && post?.status !== "published" ? scheduleProblems(date) : [])];

  const video = VIDEO.includes(post?.contentType || type);
  const generating = busy === "generate";

  // Carousel: its own editor (one post, several slides), same concept storage.
  if (type === "Carousel") return <CarouselStudio profile={profile} editPost={editPost?.contentType === "Carousel" ? editPost : undefined} initialBrief={prompt} onPersist={onPersist} onSingle={() => setType("Post")} />;

  return (
    <>
      {fromCalendar && <PlanningNotice action="Publiceren" dateTime={date} returnDate={returnDate} existing={!!editPost} />}
      <div className="cs-studio">
        <div className="cs-toolbar">
          <div className="cs-toolbar-title">
            <h2>{post ? "Instagram-concept" : "Nieuwe Instagram-post"}</h2>
            <SaveIndicator status={shownStatus} />
          </div>
          <div className="cs-view-switch" role="tablist" aria-label="Weergave">
            <button type="button" role="tab" aria-selected={view === "edit"} onClick={() => setView("edit")}>
              <PenLine size={14} aria-hidden="true" /> Bewerken
            </button>
            <button type="button" role="tab" aria-selected={view === "preview"} onClick={() => setView("preview")}>
              <Eye size={14} aria-hidden="true" /> Voorbeeld
            </button>
          </div>
          {post && (
            <div className="cs-toolbar-actions">
              <button type="button" className="button secondary" onClick={copy} disabled={!caption.trim()}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                <span>{copied ? "Gekopieerd" : "Kopiëren"}</span>
              </button>
              <button type="button" className="button secondary" onClick={() => void persist()} disabled={status === "saving"}>
                <Save size={15} />
                <span>Opslaan</span>
              </button>
              {/* Approved or scheduled: publish now (with confirmation), when Instagram allows it. */}
              {post.status === "approved" || post.status === "scheduled" ? (
                <PublishButton post={{ ...post, caption, hashtags, media: photos }} capability={publishCap} />
              ) : (
                <button type="button" className="button primary" onClick={() => void approve()} disabled={status === "saving"}>
                  {date ? <CalendarClock size={15} /> : <Check size={15} />}
                  <span>{date ? "Goedkeuren en inplannen" : "Goedkeuren"}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Live publishing status for this workspace and the one next step. */}
        <InstagramPublishPanel capability={publishCap} />
        <div className="cs-grid" data-view={view}>
          <aside className="cs-controls" aria-label="Instellingen">
            <fieldset className="cs-field">
              <legend>Formaat</legend>
              <div className="cs-formats">
                {FORMATS.map(({ id, label, hint, Icon }) => (
                  <button key={id} type="button" aria-pressed={type === id} aria-describedby={"fmt-" + id.replace(/\W/g, "")} onClick={() => setType(id)}>
                    <Icon size={15} aria-hidden="true" />
                    {label}
                    <span id={"fmt-" + id.replace(/\W/g, "")} className="sr-only">
                      {hint}
                    </span>
                  </button>
                ))}
              </div>
              <p className="cs-hint">Binnenkort: story en reel.</p>
            </fieldset>
            <label className="cs-field">
              <span>Doel</span>
              <select value={goal} onChange={(e) => setGoal(e.target.value as InstagramGoal)}>
                {instagramGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            {/* Refinements: optional, folded away so the start stays simple. */}
            <details className="cs-more">
              <summary>Meer opties</summary>
            {type !== "Content Ideas" && (
              <>
                <label className="cs-field">
                  <span>Product of dienst</span>
                  <select value={product} onChange={(e) => setProduct(e.target.value)}>
                    <option value="">Geen specifiek product</option>
                    {products.map((p, i) => (
                      <option key={i}>{p}</option>
                    ))}
                  </select>
                  {!products.length && (
                    <small>
                      Voeg producten toe in <Link href="/brand-hub">Brand Hub</Link>.
                    </small>
                  )}
                </label>
                {(profile.segments || []).length > 0 && (
                  <label className="cs-field">
                    <span>Doelgroep</span>
                    <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
                      <option value="">Algemene doelgroep</option>
                      {(profile.segments || []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="cs-field">
                  <span>Call-to-action</span>
                  <input value={cta} maxLength={120} placeholder={profile.strategy?.ctas?.[0] || "Bijv. Bestel via de link in bio"} onChange={(e) => setCta(e.target.value)} />
                </label>
              </>
            )}
            <label className="cs-switch">
              <input type="checkbox" checked={website} disabled={!profile.description} onChange={(e) => setWebsite(e.target.checked)} />
              <span>
                <strong>Bedrijfsomschrijving gebruiken</strong>
                <small>Uit je Brand Hub; er wordt geen website opgehaald.</small>
              </span>
            </label>
            </details>
            {type !== "Content Ideas" && (
              <div className="cs-field">
                <span id="ig-visual-label">Beeld</span>
                <div className="cs-visual-modes" role="radiogroup" aria-labelledby="ig-visual-label">
                  {VISUAL_MODES.map((m) => (
                    <button key={m.id} type="button" role="radio" aria-checked={imageMode === m.id} disabled={!!busy} onClick={() => setImageMode(m.id)}>
                      <m.Icon size={14} aria-hidden="true" />
                      {m.label}
                    </button>
                  ))}
                </div>
                {imageMode === "ai" && (
                  <div className="cs-visual-panel">
                    {AUTO_IMAGE_TYPES.includes(type) && (
                      <label className="cs-check">
                        <input type="checkbox" checked={autoImage} disabled={!!busy} onChange={(e) => setAutoImage(e.target.checked)} />
                        <span>Bij genereren meteen een bijpassende afbeelding maken</span>
                      </label>
                    )}
                    <div className="cs-visual-format" role="radiogroup" aria-label="Vorm van de afbeelding">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={imageFormat === "square"}
                        onClick={() => setImageFormat("square")}
                      >
                        Vierkant
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={imageFormat === "portrait"}
                        onClick={() => setImageFormat("portrait")}
                      >
                        Staand (4:5)
                      </button>
                    </div>
                    {/* The image follows the briefing above; these only fine-tune it. */}
                    <details className="cs-more">
                      <summary>Meer beeldopties</summary>
                      <label className="cs-label" htmlFor="ig-image-brief">
                        Beeld anders dan je briefing <small>optioneel</small>
                      </label>
                      <textarea id="ig-image-brief" rows={2} maxLength={800} value={imageBrief} placeholder="Leeg laten: Mavix gebruikt je briefing" onChange={(e) => setImageBrief(e.target.value)} />
                      <InspirationPicker value={inspiration} onChange={setInspiration} max={plan?.inspirationMax ?? 3} disabled={!!busy} />
                      <label className="cs-check">
                        <input type="checkbox" checked={useBrand} onChange={(e) => setUseBrand(e.target.checked)} />
                        <span>Stijl, kleuren en doelgroep uit Brand Hub meenemen</span>
                      </label>
                    </details>
                    <button type="button" className="button secondary" disabled={!!busy || !(imageBrief.trim() || prompt.trim())} onClick={() => void regenerateImageOnly()}>
                      <RefreshCw size={15} aria-hidden="true" />
                      {imageLoading ? "Afbeelding maken…" : post && photos.length ? "Alleen afbeelding opnieuw genereren" : "Afbeelding genereren"}
                    </button>
                    <p className="cs-hint">Een afbeelding maken duurt meestal 15 tot 40 seconden. Je caption blijft staan.</p>
                  </div>
                )}
                {imageMode === "edit" && photos.length > 0 && (
                  <div className="cs-visual-panel">
                    <span className="cs-label">Kies de foto die je wilt bewerken</span>
                    <div className="cs-photos cs-photos-pick" role="radiogroup" aria-label="Foto om te bewerken">
                      {photos.map((photo, i) => (
                        <button key={i} type="button" role="radio" aria-checked={editIndex === i} onClick={() => setEditIndex(i)} aria-label={"Foto " + (i + 1)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo} alt="" />
                        </button>
                      ))}
                    </div>
                    <label className="cs-label" htmlFor="ig-edit-brief">
                      Wat moet Mavix aanpassen?
                    </label>
                    <textarea id="ig-edit-brief" rows={3} maxLength={800} value={editBrief} placeholder="Bijvoorbeeld: maak de achtergrond lichter en voeg een zomers terras toe" onChange={(e) => setEditBrief(e.target.value)} />
                    <button type="button" className="button primary" disabled={!!busy || editBrief.trim().length < 3} onClick={() => void editImage()}>
                      <Wand2 size={15} aria-hidden="true" />
                      {busy === "image" ? "Foto bewerken…" : "Bewerken met AI"}
                    </button>
                    <p className="cs-hint">Het origineel blijft staan; de bewerkte versie wordt toegevoegd.</p>
                  </div>
                )}
                {imageMode === "edit" && !photos.length && <p className="cs-hint">Kies eerst een eigen foto of een foto uit de Bibliotheek om te bewerken.</p>}
                {imageMode !== "ai" && (
                <>
                <label className={"cs-upload" + (busy === "upload" ? " is-busy" : "")}>
                  <ImagePlus size={16} aria-hidden="true" />
                  {photos.length ? "Andere foto's kiezen" : "Foto toevoegen"}
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp"
                    disabled={!!busy}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      e.target.value = "";
                      if (!files.length) return;
                      setBusy("upload");
                      setError("");
                      try {
                        setPhotos(await ownPhotos(files));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Foto toevoegen is niet gelukt.");
                      } finally {
                        setBusy("");
                      }
                    }}
                  />
                </label>
                <button type="button" className="cs-upload cs-upload-library" disabled={!!busy || photos.length >= 4} onClick={() => setPickerOpen(true)}>
                  <Images size={16} aria-hidden="true" />
                  Kies uit Bibliotheek
                </button>
                </>
                )}
                {/* The selected images: the single source for the preview. */}
                {(photos.length > 0 || imageLoading) && (
                  <div className="cs-photos" aria-busy={imageLoading}>
                    {imageLoading && <div className="cs-photo-loading" role="status" aria-label="Afbeelding wordt gemaakt" />}
                    {photos.map((photo, i) => (
                      <div key={photo + i} className={i === 0 ? "is-selected" : undefined}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt={(photo === linked ? "AI-afbeelding" : "Foto") + " " + (i + 1)} />
                        {photo === linked && <span className="cs-photo-tag">AI</span>}
                        <button type="button" aria-label={"Verwijder " + (photo === linked ? "AI-afbeelding" : "foto " + (i + 1))} disabled={imageLoading} onClick={() => setPhotos(photos.filter((_, n) => n !== i))}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {!photos.length && !imageLoading && post && <p className="cs-hint cs-no-image">Geen afbeelding gekozen. Maak er een met AI of kies een eigen foto.</p>}
              </div>
            )}
          </aside>

          <section className="cs-editor" aria-label="Editor">
            <form
              className="cs-brief"
              onSubmit={(e) => {
                e.preventDefault();
                void generate(!!post);
              }}
            >
              <label htmlFor="ig-prompt">Wat wil je maken?</label>
              <textarea
                id="ig-prompt"
                rows={post ? 2 : 4}
                maxLength={2000}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void generate(!!post);
                  }
                }}
                placeholder="Bijvoorbeeld: een post over onze nieuwe pizza van de maand, voor gezinnen in het weekend."
              />
              <div className="cs-brief-bar">
                <small>{autoApplies && !hasOwn ? "Mavix maakt op basis van je briefing direct een caption én bijpassende afbeelding." : "Mavix AI gebruikt je Brand Hub: toon, doelgroep en producten."}</small>
                {!post && (
                  <button type="button" className="button secondary" disabled={!!busy} onClick={startManual}>
                    <PenLine size={15} />
                    Zelf schrijven
                  </button>
                )}
                <button className="button primary" aria-busy={generating} disabled={!!busy || !prompt.trim()}>
                  {generating ? <Mavi size={16} state="thinking" tone="brand" live /> : post ? <RefreshCw size={15} /> : <Wand2 size={15} />}
                  {generating ? "Caption maken…" : imageLoading ? "Afbeelding maken…" : post ? "Opnieuw genereren" : "Genereren"}
                </button>
              </div>
            </form>

            {generating && !post ? (
              <div className="cs-result">
                <GenerationSkeleton />
              </div>
            ) : post ? (
              <div className={"cs-result" + (generating ? " is-busy" : "")} aria-busy={generating}>
                <div className="cs-ai-bar" role="toolbar" aria-label="Tekst aanpassen met Mavix AI">
                  {CONTENT_EDIT_LABELS.slice(0, 3).map(([action, label]) => (
                    <button key={action} type="button" className="cs-chip" disabled={!!busy || !caption.trim()} onClick={() => void edit(action)}>
                      {label}
                    </button>
                  ))}
                  <Menu
                    label="Meer AI-acties"
                    align="start"
                    trigger={
                      <span className="cs-chip cs-chip-more">
                        <Wand2 size={13} aria-hidden="true" /> Meer
                      </span>
                    }
                    items={CONTENT_EDIT_LABELS.slice(3).map(([action, label]) => ({ label, disabled: !!busy || !caption.trim(), onSelect: () => void edit(action) }))}
                  />
                  {busy === "edit" && (
                    <span className="cs-ai-busy" role="status">
                      <Mavi size={14} state="thinking" tone="brand" live /> Mavix AI past je tekst aan…
                    </span>
                  )}
                  {history.length > 0 && busy !== "edit" && (
                    <button type="button" className="cs-undo" onClick={undo}>
                      <Undo2 size={13} aria-hidden="true" /> Ongedaan maken
                    </button>
                  )}
                </div>
                <label className="cs-label" htmlFor="ig-caption">
                  {type === "Content Ideas" ? "Ideeën" : "Caption"}
                  <small className={captionTotal > CAPTION_LIMIT ? "cs-over" : undefined}>
                    {captionTotal} / {CAPTION_LIMIT} incl. hashtags · {tags} / {HASHTAG_LIMIT} hashtags
                  </small>
                </label>
                <textarea id="ig-caption" className="cs-caption" rows={10} maxLength={4000} value={caption} onChange={(e) => setCaption(e.target.value)} />
                {alternatives.length > 0 && (
                  <div className="cs-alternatives">
                    <p>{altMode === "opening" ? "Kies een nieuwe openingszin (de rest van je caption blijft staan):" : "Kies een alternatief om je caption te vervangen:"}</p>
                    {alternatives.map((alt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          remember();
                          setCaption(altMode === "opening" ? [alt.split("\n")[0], ...caption.split("\n").slice(1)].join("\n") : alt);
                          setAlternatives([]);
                        }}
                      >
                        {alt}
                      </button>
                    ))}
                    <button type="button" className="cs-undo" onClick={() => setAlternatives([])}>
                      Sluiten
                    </button>
                  </div>
                )}
                {type !== "Content Ideas" && (
                  <>
                    <div className="cs-label-row">
                      <label className="cs-label" htmlFor="ig-hashtags">
                        Hashtags
                      </label>
                      <button type="button" className="cs-chip cs-chip-small" disabled={!!busy || !caption.trim()} onClick={() => void edit("hashtags")}>
                        Hashtags voorstellen
                      </button>
                    </div>
                    <textarea id="ig-hashtags" rows={2} maxLength={1000} value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
                  </>
                )}
                <label className="cs-label" htmlFor="ig-date">
                  {fromCalendar ? "Publicatiemoment" : "Inplannen (optioneel)"}
                </label>
                <input id="ig-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} aria-describedby="ig-checks" />
                {video && <p className="cs-hint">Dit concept is een video-idee. Mavix maakt nog geen videobestanden.</p>}
                {type !== "Content Ideas" && checks.length > 0 && (
                  <ul id="ig-checks" className="cs-checks" aria-label="Controle voor Instagram">
                    {checks.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="cs-empty">
                <Mavi size={44} tone="brand" live />
                <h3>Begin met een korte opdracht</h3>
                <p>Kies links het formaat en doel, beschrijf wat je wilt delen en klik op Genereren. Je krijgt een bewerkbaar concept dat automatisch wordt opgeslagen.</p>
              </div>
            )}
            {(message || error) && (
              <p role={error ? "alert" : "status"} className={error ? "cs-error" : "cs-message"}>
                {error || message}
              </p>
            )}
          </section>

          <aside className="cs-preview" aria-label="Voorbeeld">
            <p className="cs-preview-label">Voorbeeld op Instagram</p>
            <div className="ig-phone">
              <header>
                <span className="ig-phone-avatar" aria-hidden="true">
                  {profile.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.logo} alt="" />
                  ) : (
                    (profile.name || "M").slice(0, 1)
                  )}
                </span>
                <strong>{(profile.name || "jouwbedrijf").toLowerCase().replace(/\s+/g, "")}</strong>
              </header>
              {/* Only the selected image (photos[0]) is shown: no saved or stand-in picture. */}
              <div className="ig-phone-media" aria-live="polite">
                {imageLoading ? (
                  <div className="ig-media-state is-loading" role="status">
                    <span className="ig-media-shimmer" aria-hidden="true" />
                    <span className="ig-media-text">
                      <Mavi size={18} state="creating" tone="brand" live /> Afbeelding wordt gemaakt…
                    </span>
                  </div>
                ) : imageState.state === "error" && !photos[0] ? (
                  <div className="ig-media-state is-error" role="alert">
                    <strong>De afbeelding kon niet worden gemaakt</strong>
                    <span>{imageState.message}</span>
                    <button type="button" className="button secondary" disabled={!!busy} onClick={() => void regenerateImageOnly()}>
                      <RefreshCw size={14} aria-hidden="true" /> Opnieuw proberen
                    </button>
                  </div>
                ) : photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="ig-preview-photo" src={photos[0]} alt={photos[0] === linked ? "AI-afbeelding bij deze post" : "Gekozen foto"} />
                ) : (
                  <div className="ig-media-state">
                    <ImageIcon size={22} aria-hidden="true" />
                    <span>{post ? "Geen afbeelding gekozen" : autoApplies ? "Je afbeelding verschijnt hier na het genereren" : "Je foto verschijnt hier"}</span>
                  </div>
                )}
              </div>
              {imageState.state === "error" && photos[0] && !imageLoading && (
                <div className="ig-media-note" role="alert">
                  <span>Nieuwe afbeelding mislukt: {imageState.message} De vorige afbeelding is bewaard.</span>
                  <button type="button" className="cs-undo" disabled={!!busy} onClick={() => void regenerateImageOnly()}>
                    Opnieuw proberen
                  </button>
                </div>
              )}
              <div className="ig-phone-actions" aria-hidden="true">
                <Heart size={20} />
                <MessageCircle size={20} />
                <Send size={20} />
                <Bookmark size={20} className="ig-phone-save" />
              </div>
              <div className="ig-phone-caption">
                {caption ? (
                  <p>
                    <strong>{(profile.name || "jouwbedrijf").toLowerCase().replace(/\s+/g, "")}</strong> {caption}
                  </p>
                ) : (
                  <p className="ig-phone-muted">Je caption verschijnt hier zodra Mavix AI een concept heeft gemaakt.</p>
                )}
                {hashtags && <p className="ig-phone-tags">{hashtags}</p>}
              </div>
            </div>
          </aside>
        </div>
        {notice && (
          <p className="cs-message" role="status">
            {notice}
          </p>
        )}
      </div>
      {/* A chosen own photo takes the place of the automatic AI image. */}
      <LibraryPicker open={pickerOpen} max={Math.max(1, 4 - photos.filter((p) => p !== linked).length)} onClose={() => setPickerOpen(false)} onPick={(imgs) => setPhotos([...imgs, ...photos.filter((p) => p !== linked)].slice(0, 4))} />
    </>
  );
}
