"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ImagePlus,
  Image as ImageIcon,
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
  CalendarDays,
  Camera,
} from "lucide-react";
import { GenerationSkeleton, previewMock } from "@/components/generation-skeleton";
import { GlowBorder } from "@/components/glow-border";
import { Mavi } from "@/components/mavi";
import { Menu } from "@/components/menu";
import { SaveIndicator, type SaveStatus } from "@/components/save-indicator";
import { useWorkspace } from "@/components/workspace-provider";
import type { Post, Profile } from "@/lib/types";
import { defaultInstagram, type ContentType } from "@/lib/instagram-model";
import { generateInstagramContent, editContentText, generateImage, CONTENT_EDIT_LABELS, type ContentEditAction } from "@/lib/api-client";
import { readImages } from "@/lib/local-images";
import { InstagramPublishPanel, PublishButton, usePublishCapability } from "./publish";
import { AUTO_IMAGE_TYPES, generateWithImage, linkedImage, regenerateImage } from "@/lib/post-image";
import { isBrowserDemo } from "@/lib/demo";
import { mediaRef } from "@/lib/media-ref";
import { usePlan } from "@/components/plan-gate";
import { CarouselStudio } from "./carousel-studio";
import { instagramGoals, normalizeGoal, plannedGoal, weekdayOfDate, type InstagramGoal } from "@/lib/ai/instagram-instruction";
import { PlanningNotice } from "@/components/calendar/planning-notice";
import { LibraryPicker } from "@/components/library/library-picker";
import { CAPTION_LIMIT, HASHTAG_LIMIT, hashtagCount, instagramCaption, publishProblems, scheduleProblems } from "@/lib/instagram-publish";

// Content Studio for Instagram, in three steps on one page:
//   1. what you make (post or carousel), 2. the goal of this post (with an
//   optional weekly plan: Monday awareness, Friday offer, ...), 3. one brief.
// From that one brief Mavix writes the caption and makes a branded image: the
// business's own photos (Brand Hub) are the references, so the picture shows
// its real products and place, never a random look-alike. Without own photos
// Mavix makes no AI image (it asks for photos or an own picture instead).
// The result opens in an editor with a live preview; edits autosave.

// A post is always image + caption (Instagram has no text-only posts). Older
// concepts of the types "Image", "Captions & Hashtags" open as a Post;
// "Content Ideas" concepts still open, but are no longer offered.
const POST_TYPE = (t: ContentType | undefined): ContentType | undefined => (t === "Image" || t === "Captions & Hashtags" ? "Post" : t);
const KINDS: { id: ContentType; label: string; hint: string; Icon: typeof ImageIcon }[] = [
  { id: "Post", label: "Post", hint: "Eén beeld met caption en hashtags", Icon: ImageIcon },
  { id: "Carousel", label: "Carrousel", hint: "Meerdere slides die samen één verhaal vertellen", Icon: Images },
];
const UPCOMING: Record<string, string> = {
  Story: "Verticale stories zijn in ontwikkeling.",
  Reel: "AI-video is in ontwikkeling.",
  "Animate Image": "AI-video is in ontwikkeling.",
  "Photos to Reel": "AI-video is in ontwikkeling.",
};
const VIDEO = ["Reel", "Animate Image", "Photos to Reel"];
const DAYS: [string, string][] = [
  ["1", "Maandag"],
  ["2", "Dinsdag"],
  ["3", "Woensdag"],
  ["4", "Donderdag"],
  ["5", "Vrijdag"],
  ["6", "Zaterdag"],
  ["0", "Zondag"],
];
const dayName = (d: string | null) => DAYS.find(([k]) => k === d)?.[1].toLowerCase() || "";
const AUTOSAVE_MS = 1500;
/** Own photos of the business used as references for every AI image (plan limit). */
export const BRAND_REFERENCE_MAX = 3;

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
  const { data, save, saveState } = useWorkspace();
  const publishCap = usePublishCapability();
  const plan = usePlan();
  const settings = data.instagram || defaultInstagram;
  const known = KINDS.some((f) => f.id === POST_TYPE(initialType as ContentType));
  const [type, setType] = useState<ContentType>(POST_TYPE(editPost?.contentType) || (known ? (POST_TYPE(initialType as ContentType) as ContentType) : "Post"));
  const [notice, setNotice] = useState(initialType && UPCOMING[initialType] ? UPCOMING[initialType] : "");
  const [prompt, setPrompt] = useState(editPost?.prompt || initialBrief);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>(editPost?.media || []);
  const [product, setProduct] = useState("");
  const [date, setDate] = useState(editPost?.date || initialDate || "");
  // The goal follows the weekly plan for the chosen day until the user picks one.
  const [goal, setGoal] = useState<InstagramGoal>(() => plannedGoal(settings.goalPlan, editPost?.date || initialDate || "") || "bekendheid");
  const [goalTouched, setGoalTouched] = useState(false);
  const [weekPlanOpen, setWeekPlanOpen] = useState(false);
  const [segmentId, setSegmentId] = useState("");
  const [cta, setCta] = useState("");
  const [website, setWebsite] = useState(false);
  const [post, setPost] = useState<Post | null>(editPost || null);
  const [caption, setCaption] = useState(editPost?.caption || "");
  const [hashtags, setHashtags] = useState(editPost?.hashtags || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "generate" | "edit" | "upload" | "image" | "brand">("");
  // `busy` only disables the buttons after the next render; this lock is set
  // synchronously, so a fast double click or Enter never starts a second paid
  // AI request while one is running.
  const aiLock = useRef(false);
  const lockAi = () => (aiLock.current ? false : (aiLock.current = true));
  // The image of this result: being made, failed (with the reason) or idle.
  const [imageState, setImageState] = useState<{ state: "idle" | "loading" | "error"; message?: string }>({ state: "idle" });
  const [editOpen, setEditOpen] = useState(false);
  const [editBrief, setEditBrief] = useState("");
  const [status, setStatus] = useState<SaveStatus>(editPost ? "saved" : "idle");
  const [history, setHistory] = useState<{ caption: string; hashtags: string }[]>([]);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [altMode, setAltMode] = useState<"full" | "opening">("full");
  const [view, setView] = useState<"edit" | "preview">(focusPreview && editPost ? "preview" : "edit");
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const linked = linkedImage(post, photos);
  const hasOwn = photos.some((p) => p !== linked);
  // Branded images: the business's own photos are the references. Without
  // them Mavix makes no AI image (no random pictures of someone else's shop).
  const brandPhotos = (profile.media || []).slice(0, Math.min(BRAND_REFERENCE_MAX, plan?.inspirationMax ?? 1));
  const autoApplies = AUTO_IMAGE_TYPES.includes(type) && brandPhotos.length > 0;
  const imageLoading = imageState.state === "loading";
  const planned = plannedGoal(settings.goalPlan, date);
  const hasPlan = Object.values(settings.goalPlan || {}).some(Boolean);
  useEffect(() => {
    if (!goalTouched && planned) setGoal(planned);
  }, [planned, goalTouched]);

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
      setError("Beschrijf eerst in een paar woorden wat je wilt delen.");
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
      // One brief, one result: the caption first, then the branded image
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
          setMessage(imageComing ? "Caption klaar. Mavix maakt nu een beeld met jouw producten…" : again ? "Nieuwe versie gemaakt en opgeslagen als concept." : "Concept gemaakt en opgeslagen.");
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

  // The branded image for this concept: the brief plus the business's own
  // photos as references (products, interior, packaging must match).
  function aiImage(brief: string) {
    if (!brandPhotos.length) return Promise.reject(new Error("Voeg eerst een paar foto's van je zaak of producten toe. Mavix maakt alleen beelden van jóuw bedrijf."));
    return generateImage({ mode: "generate", brief, format: "square", useBrand: true, references: brandPhotos, referenceKind: "brand" });
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

  // "Nieuwe afbeelding": a new branded image for the current concept; caption,
  // hashtags and own photos stay as they are.
  async function regenerateImageOnly() {
    if (!post) return;
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
  async function addOwnPhotos(files: File[]) {
    if (!files.length) return;
    setBusy("upload");
    setError("");
    try {
      const added = await ownPhotos(files);
      // An own photo takes the place of the automatic AI image.
      const next = [...added, ...photos.filter((p) => p !== linked)].slice(0, 4);
      setPhotos(next);
      if (post) await keepImage(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Foto toevoegen is niet gelukt.");
    } finally {
      setBusy("");
    }
  }

  // Photos of the business for Brand Hub (the references for every AI image).
  async function addBrandPhotos(files: File[]) {
    if (!files.length) return;
    setBusy("brand");
    setError("");
    try {
      const added = await readImages(files, BRAND_REFERENCE_MAX);
      const media = [...(profile.media || []), ...added].slice(0, 12);
      if (await save({ ...data, profile: { ...data.profile, media } })) setMessage("Foto's van je zaak opgeslagen in Brand Hub. Mavix gebruikt ze voor elk beeld.");
      else setError("De foto's konden niet worden opgeslagen.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Foto's toevoegen is niet gelukt.");
    } finally {
      setBusy("");
    }
  }

  async function saveWeekPlan(goalPlan: Record<string, string>) {
    const ok = await save({ ...data, instagram: { ...settings, goalPlan } });
    if (ok) setMessage("Weekplan opgeslagen. Het doel volgt voortaan de dag van je post.");
    else setError("Het weekplan kon niet worden opgeslagen.");
    return ok;
  }

  // A paid image must never get lost: save it right away. Without a concept
  // yet, a draft is created for it (caption can follow); with a concept the
  // current editor state is saved with the new photos.
  async function keepImage(media: string[], fresh?: Post, aiImage?: string) {
    const now = new Date().toISOString();
    const base: Post = fresh || post || { id: crypto.randomUUID(), prompt: prompt.trim().slice(0, 1000), caption: "", hashtags: "", status: "draft", date: date || "", createdAt: now, variant: 0, contentType: type, source: "manual", media: [] };
    // aiImage = the image Mavix just made; otherwise keep the existing link while it is still selected.
    const link = aiImage || linkedImage(base, media);
    const next: Post = fresh ? { ...fresh, media, aiImage: link, updatedAt: now } : { ...base, caption, hashtags, date, media, aiImage: link, updatedAt: now };
    setStatus("saving");
    const ok = await onPersist(next);
    setStatus(ok ? "saved" : "error");
    if (ok) setPost(next);
    else setError("De afbeelding staat in de editor, maar is nog niet opgeslagen. Probeer opnieuw op te slaan.");
  }

  // Edit the shown photo with AI; the original stays next to it.
  async function editImage() {
    const photo = photos[0];
    if (!photo) return setError("Kies eerst een foto om te bewerken.");
    if (!lockAi()) return;
    setError("");
    setMessage("");
    setBusy("image");
    try {
      const image = await generateImage({ mode: "edit", brief: editBrief.trim(), format: "square", photo, useBrand: true });
      const next = [image, ...photos].slice(0, 4);
      setPhotos(next);
      await keepImage(next);
      setEditOpen(false);
      setEditBrief("");
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
  const ideas = (post?.contentType || type) === "Content Ideas";
  const generating = busy === "generate";

  // Carousel: its own editor (one post, several slides), same concept storage.
  if (type === "Carousel") return <CarouselStudio profile={profile} editPost={editPost?.contentType === "Carousel" ? editPost : undefined} initialBrief={prompt} onPersist={onPersist} onSingle={() => setType("Post")} />;

  const goalChips = (
    <div className="cs-goals" role="radiogroup" aria-label="Doel van deze post">
      {instagramGoals.map((g) => (
        <button
          key={g.id}
          type="button"
          role="radio"
          aria-checked={goal === g.id}
          disabled={!!busy}
          onClick={() => {
            setGoal(g.id);
            setGoalTouched(true);
          }}
        >
          <strong>{g.label}</strong>
          <small>{g.hint}</small>
        </button>
      ))}
    </div>
  );

  const brief = (
    <form
      className={"cs-brief glow-host" + (post ? " is-compact" : "")}
      onSubmit={(e) => {
        e.preventDefault();
        void generate(!!post);
      }}
    >
      <GlowBorder />
      <label htmlFor="ig-prompt" className="sr-only">
        Wat wil je delen?
      </label>
      <textarea
        id="ig-prompt"
        rows={post ? 2 : 3}
        maxLength={2000}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void generate(!!post);
          }
        }}
        placeholder={post ? "Pas je opdracht aan en genereer opnieuw" : "Bijvoorbeeld: onze pizza van de maand, voor gezinnen in het weekend"}
      />
      {/* Own photos attached to this post (they take the place of the AI image). */}
      {!post && hasOwn && (
        <div className="cs-attach" aria-label="Eigen foto's">
          {photos
            .filter((p) => p !== linked)
            .map((photo, i) => (
              <span key={photo + i}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={"Eigen foto " + (i + 1)} />
                <button type="button" aria-label={"Verwijder foto " + (i + 1)} onClick={() => setPhotos(photos.filter((p) => p !== photo))}>
                  <X size={11} />
                </button>
              </span>
            ))}
        </div>
      )}
      <div className="cs-brief-bar">
        <div className="cs-brief-tools">
          <label className={"cs-tool" + (busy === "upload" ? " is-busy" : "")}>
            <ImagePlus size={15} aria-hidden="true" />
            Eigen foto
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              disabled={!!busy}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = "";
                void addOwnPhotos(files);
              }}
            />
          </label>
          <button type="button" className="cs-tool" disabled={!!busy || photos.length >= 4} onClick={() => setPickerOpen(true)}>
            <Images size={15} aria-hidden="true" />
            Bibliotheek
          </button>
          {!post && (
            <button type="button" className="cs-tool" disabled={!!busy} onClick={startManual}>
              <PenLine size={15} aria-hidden="true" />
              Zelf schrijven
            </button>
          )}
        </div>
        <button className="button primary cs-go" aria-busy={generating} disabled={!!busy || !prompt.trim()}>
          {generating ? <Mavi size={16} state="thinking" tone="brand" live /> : post ? <RefreshCw size={15} /> : <Wand2 size={15} />}
          {generating ? "Caption maken…" : imageLoading ? "Afbeelding maken…" : post ? "Opnieuw genereren" : "Maak mijn post"}
        </button>
      </div>
    </form>
  );

  // What Mavix will do with the brief, said plainly before the first click.
  const imagePlanNote = hasOwn ? (
    <p className="cs-plan-note">
      <Check size={14} aria-hidden="true" /> Mavix schrijft de caption bij jouw eigen foto.
    </p>
  ) : brandPhotos.length ? (
    <p className="cs-plan-note">
      <Camera size={14} aria-hidden="true" /> Mavix schrijft de caption én maakt een beeld met jóuw producten en zaak, op basis van {brandPhotos.length === 1 ? "je foto" : `${brandPhotos.length} foto's`} uit Brand Hub.
    </p>
  ) : (
    <div className="cs-brand-nudge">
      <Camera size={18} aria-hidden="true" />
      <div>
        <strong>Voeg eerst 1 tot 3 foto&apos;s van je zaak toe</strong>
        <span>Mavix maakt alleen beelden van jóuw producten en jóuw zaak, nooit een willekeurige stockfoto. Kies een paar foto&apos;s van je producten, je interieur of je gevel. Je kunt ze later aanpassen in Brand Hub.</span>
      </div>
      <label className={"button secondary" + (busy === "brand" ? " is-busy" : "")}>
        {busy === "brand" ? "Opslaan…" : "Foto's kiezen"}
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={!!busy}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = "";
            void addBrandPhotos(files);
          }}
        />
      </label>
    </div>
  );

  return (
    <>
      {fromCalendar && <PlanningNotice action="Publiceren" dateTime={date} returnDate={returnDate} existing={!!editPost} />}
      <div className="cs-studio">
        <div className="cs-toolbar">
          <div className="cs-toolbar-title">
            <h2>{post ? "Instagram-concept" : "Nieuwe Instagram-post"}</h2>
            <SaveIndicator status={shownStatus} />
          </div>
          {post && (
            <>
              <div className="cs-view-switch" role="tablist" aria-label="Weergave">
                <button type="button" role="tab" aria-selected={view === "edit"} onClick={() => setView("edit")}>
                  <PenLine size={14} aria-hidden="true" /> Bewerken
                </button>
                <button type="button" role="tab" aria-selected={view === "preview"} onClick={() => setView("preview")}>
                  <Eye size={14} aria-hidden="true" /> Voorbeeld
                </button>
              </div>
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
            </>
          )}
        </div>

        {/* Live publishing status for this workspace and the one next step. */}
        <InstagramPublishPanel capability={publishCap} />

        {!post && !generating ? (
          <div className="cs-start">
            <section className="cs-step" aria-labelledby="cs-step-1">
              <header>
                <span className="cs-step-n" aria-hidden="true">
                  1
                </span>
                <h3 id="cs-step-1">Wat maak je?</h3>
              </header>
              <div className="cs-kinds" role="radiogroup" aria-labelledby="cs-step-1">
                {KINDS.map(({ id, label, hint, Icon }) => (
                  <button key={id} type="button" role="radio" aria-checked={type === id} onClick={() => setType(id)}>
                    <span className="cs-kind-icon">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <strong>{label}</strong>
                    <small>{hint}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="cs-step" aria-labelledby="cs-step-2">
              <header>
                <span className="cs-step-n" aria-hidden="true">
                  2
                </span>
                <h3 id="cs-step-2">Doel van deze post</h3>
                <button type="button" className="cs-link" aria-expanded={weekPlanOpen} onClick={() => setWeekPlanOpen((o) => !o)}>
                  <CalendarDays size={14} aria-hidden="true" />
                  {hasPlan ? "Weekplan aanpassen" : "Elke dag een ander doel?"}
                </button>
              </header>
              {goalChips}
              {planned && !goalTouched && (
                <p className="cs-hint cs-plan-hint">
                  Volgens je weekplan is het doel op {dayName(weekdayOfDate(date))} <strong>{instagramGoals.find((g) => g.id === planned)?.label}</strong>. Kies een ander doel als deze post anders is.
                </p>
              )}
              {weekPlanOpen && <WeekPlanEditor plan={settings.goalPlan || {}} busy={!!busy} onSave={saveWeekPlan} onClose={() => setWeekPlanOpen(false)} />}
            </section>

            <section className="cs-step cs-step-brief" aria-labelledby="cs-step-3">
              <header>
                <span className="cs-step-n" aria-hidden="true">
                  3
                </span>
                <h3 id="cs-step-3">Wat wil je delen?</h3>
              </header>
              {brief}
              {imagePlanNote}
              {/* Refinements: optional, folded away so the start stays simple. */}
              <details className="cs-more">
                <summary>Meer opties</summary>
                <label className="cs-field">
                  <span>Product of dienst</span>
                  <select value={product} onChange={(e) => setProduct(e.target.value)}>
                    <option value="">Mavix kiest op basis van je opdracht</option>
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
                <label className="cs-field">
                  <span>Inplannen (optioneel)</span>
                  <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label className="cs-switch">
                  <input type="checkbox" checked={website} disabled={!profile.description} onChange={(e) => setWebsite(e.target.checked)} />
                  <span>
                    <strong>Bedrijfsomschrijving uit Brand Hub gebruiken</strong>
                  </span>
                </label>
              </details>
              {(message || error) && (
                <p role={error ? "alert" : "status"} className={error ? "cs-error" : "cs-message"}>
                  {error || message}
                </p>
              )}
            </section>
          </div>
        ) : (
          <div className="cs-grid cs-grid-ig" data-view={view}>
            <section className="cs-editor" aria-label="Editor">
              {brief}
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
                    <label className="cs-goal-inline">
                      Doel
                      <select
                        value={goal}
                        disabled={!!busy}
                        onChange={(e) => {
                          setGoal(normalizeGoal(e.target.value));
                          setGoalTouched(true);
                        }}
                      >
                        {instagramGoals.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    </label>
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
                    {ideas ? "Ideeën" : "Caption"}
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
                  {!ideas && (
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
                  {!ideas && checks.length > 0 && (
                    <ul id="ig-checks" className="cs-checks" aria-label="Controle voor Instagram">
                      {checks.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
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
                        <Mavi size={18} state="creating" tone="brand" live /> Beeld van jouw zaak wordt gemaakt…
                      </span>
                    </div>
                  ) : imageState.state === "error" && !photos[0] ? (
                    <div className="ig-media-state is-error" role="alert">
                      <strong>De afbeelding kon niet worden gemaakt</strong>
                      <span>{imageState.message}</span>
                      {brandPhotos.length > 0 && (
                        <button type="button" className="button secondary" disabled={!!busy} onClick={() => void regenerateImageOnly()}>
                          <RefreshCw size={14} aria-hidden="true" /> Opnieuw proberen
                        </button>
                      )}
                    </div>
                  ) : photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="ig-preview-photo" src={photos[0]} alt={photos[0] === linked ? "AI-afbeelding bij deze post" : "Gekozen foto"} />
                  ) : (
                    <div className="ig-media-state">
                      <ImageIcon size={22} aria-hidden="true" />
                      <span>{brandPhotos.length ? "Nog geen afbeelding. Maak er een van jouw zaak of kies een eigen foto." : "Nog geen afbeelding. Kies een eigen foto, of voeg foto's van je zaak toe in Brand Hub."}</span>
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

              {/* Image actions: everything about the picture lives next to the picture. */}
              {post && !ideas && (
                <div className="cs-image-actions">
                  {brandPhotos.length > 0 && (
                    <button type="button" className="cs-tool" disabled={!!busy} onClick={() => void regenerateImageOnly()}>
                      <Wand2 size={14} aria-hidden="true" />
                      {photos.length ? "Nieuwe afbeelding" : "Afbeelding maken"}
                    </button>
                  )}
                  <label className={"cs-tool" + (busy === "upload" ? " is-busy" : "")}>
                    <ImagePlus size={14} aria-hidden="true" />
                    Eigen foto
                    <input
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp"
                      disabled={!!busy}
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        e.target.value = "";
                        void addOwnPhotos(files);
                      }}
                    />
                  </label>
                  <button type="button" className="cs-tool" disabled={!!busy || photos.length >= 4} onClick={() => setPickerOpen(true)}>
                    <Images size={14} aria-hidden="true" />
                    Bibliotheek
                  </button>
                  {photos[0] && (
                    <button type="button" className="cs-tool" aria-expanded={editOpen} disabled={!!busy} onClick={() => setEditOpen((o) => !o)}>
                      <PenLine size={14} aria-hidden="true" />
                      Bewerken met AI
                    </button>
                  )}
                </div>
              )}
              {editOpen && photos[0] && (
                <div className="cs-edit-panel">
                  <label className="cs-label" htmlFor="ig-edit-brief">
                    Wat moet Mavix aan deze foto aanpassen?
                  </label>
                  <textarea id="ig-edit-brief" rows={2} maxLength={800} value={editBrief} placeholder="Bijvoorbeeld: maak de achtergrond lichter en voeg een zomers terras toe" onChange={(e) => setEditBrief(e.target.value)} />
                  <div className="cs-brief-bar">
                    <small>Het origineel blijft staan; de bewerkte versie komt ernaast.</small>
                    <button type="button" className="button primary" disabled={!!busy || editBrief.trim().length < 3} onClick={() => void editImage()}>
                      {busy === "image" ? "Foto bewerken…" : "Bewerken"}
                    </button>
                  </div>
                </div>
              )}
              {/* The selected images: the single source for the preview. Click one to show it. */}
              {(photos.length > 1 || (photos.length > 0 && imageLoading)) && (
                <div className="cs-photos" aria-busy={imageLoading}>
                  {imageLoading && <div className="cs-photo-loading" role="status" aria-label="Afbeelding wordt gemaakt" />}
                  {photos.map((photo, i) => (
                    <div key={photo + i} className={i === 0 ? "is-selected" : undefined}>
                      <button type="button" className="cs-photo-pick" aria-label={(photo === linked ? "AI-afbeelding" : "Foto " + (i + 1)) + (i === 0 ? " (getoond)" : " tonen")} disabled={imageLoading || i === 0} onClick={() => setPhotos([photo, ...photos.filter((_, n) => n !== i)])}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt="" />
                      </button>
                      {photo === linked && <span className="cs-photo-tag">AI</span>}
                      <button type="button" aria-label={"Verwijder " + (photo === linked ? "AI-afbeelding" : "foto " + (i + 1))} disabled={imageLoading} onClick={() => setPhotos(photos.filter((_, n) => n !== i))}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length === 1 && !imageLoading && (
                <button type="button" className="cs-undo cs-remove-image" disabled={!!busy} onClick={() => setPhotos([])}>
                  <X size={12} aria-hidden="true" /> Afbeelding verwijderen
                </button>
              )}
            </aside>
          </div>
        )}
        {notice && (
          <p className="cs-message" role="status">
            {notice}
          </p>
        )}
      </div>
      {/* A chosen own photo takes the place of the automatic AI image. */}
      <LibraryPicker
        open={pickerOpen}
        max={Math.max(1, 4 - photos.filter((p) => p !== linked).length)}
        onClose={() => setPickerOpen(false)}
        onPick={(imgs) => {
          const next = [...imgs, ...photos.filter((p) => p !== linked)].slice(0, 4);
          setPhotos(next);
          if (post) void keepImage(next);
        }}
      />
    </>
  );
}

/** Weekly goal plan: one goal per weekday, saved in the Instagram settings. */
function WeekPlanEditor({ plan, busy, onSave, onClose }: { plan: Record<string, string>; busy: boolean; onSave: (plan: Record<string, string>) => Promise<boolean>; onClose: () => void }) {
  const [draft, setDraft] = useState<Record<string, string>>(plan);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(plan);
  return (
    <div className="cs-weekplan" role="group" aria-label="Weekplan">
      <p>Geef elke dag een eigen doel. Kies je een datum voor een post, dan stelt Mavix dat doel voor. Dagen zonder doel laat je leeg.</p>
      <div className="cs-weekplan-grid">
        {DAYS.map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <select value={draft[key] || ""} disabled={busy || saving} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}>
              <option value="">Geen vast doel</option>
              {instagramGoals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="cs-brief-bar">
        <button type="button" className="cs-undo" onClick={onClose}>
          Sluiten
        </button>
        <button
          type="button"
          className="button primary"
          disabled={!dirty || busy || saving}
          onClick={async () => {
            setSaving(true);
            const clean = Object.fromEntries(Object.entries(draft).filter(([, v]) => v));
            if (await onSave(clean)) onClose();
            setSaving(false);
          }}
        >
          {saving ? "Opslaan…" : "Weekplan opslaan"}
        </button>
      </div>
    </div>
  );
}
