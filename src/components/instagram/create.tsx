"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ImagePlus,
  Image as ImageIcon,
  Type,
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
} from "lucide-react";
import { GenerationSkeleton, previewMock } from "@/components/generation-skeleton";
import { Mavi } from "@/components/mavi";
import { Menu } from "@/components/menu";
import { SaveIndicator, type SaveStatus } from "@/components/save-indicator";
import { useWorkspace } from "@/components/workspace-provider";
import type { Post, Profile } from "@/lib/types";
import type { ContentType } from "@/lib/instagram-model";
import { generateInstagramContent, editContentText, CONTENT_EDIT_LABELS, type ContentEditAction } from "@/lib/api-client";
import { readImages } from "@/lib/local-images";
import { instagramGoals, type InstagramGoal } from "@/lib/ai/instagram-instruction";
import { PostVisual } from "./shared";
import { PlanningNotice } from "@/components/calendar/planning-notice";

// Content Studio for Instagram: controls (left), the editor (centre, the main
// workspace) and a realistic post preview (right). Generation, rewrites and
// alternatives run on the server; every result lands in the editor as an
// editable draft with undo. Edits autosave to the workspace after a pause.

const FORMATS: { id: ContentType; label: string; hint: string; Icon: typeof ImageIcon }[] = [
  { id: "Post", label: "Post", hint: "Caption, hashtags en je foto", Icon: ImageIcon },
  { id: "Image", label: "Afbeelding", hint: "Beeldpost met korte tekst", Icon: ImagePlus },
  { id: "Captions & Hashtags", label: "Caption", hint: "Alleen tekst en hashtags", Icon: Type },
  { id: "Content Ideas", label: "Ideeën", hint: "5 postideeën", Icon: Lightbulb },
];
const UPCOMING: Record<string, string> = {
  Carousel: "Carrousels met meerdere slides zijn in ontwikkeling.",
  Story: "Verticale stories zijn in ontwikkeling.",
  Reel: "AI-video is in ontwikkeling.",
  "Animate Image": "AI-video is in ontwikkeling.",
  "Photos to Reel": "AI-video is in ontwikkeling.",
};
const VIDEO = ["Reel", "Animate Image", "Photos to Reel"];
const AUTOSAVE_MS = 1500;

export function CreateStudio({
  profile,
  editPost,
  initialDate,
  initialType,
  fromCalendar = false,
  returnDate,
  focusPreview = false,
  onPersist,
}: {
  profile: Profile;
  editPost?: Post;
  initialDate?: string;
  initialType?: string;
  fromCalendar?: boolean;
  returnDate?: string;
  focusPreview?: boolean;
  onPersist: (post: Post) => Promise<boolean>;
}) {
  const { saveState } = useWorkspace();
  const known = FORMATS.some((f) => f.id === initialType);
  const [type, setType] = useState<ContentType>(editPost?.contentType || (known ? (initialType as ContentType) : "Post"));
  const [notice, setNotice] = useState(initialType && UPCOMING[initialType] ? UPCOMING[initialType] : "");
  const [prompt, setPrompt] = useState(editPost?.prompt || "");
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
  const [busy, setBusy] = useState<"" | "generate" | "edit" | "upload">("");
  const [status, setStatus] = useState<SaveStatus>(editPost ? "saved" : "idle");
  const [history, setHistory] = useState<{ caption: string; hashtags: string }[]>([]);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [view, setView] = useState<"edit" | "preview">(focusPreview && editPost ? "preview" : "edit");
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const products = profile.productList?.length
    ? profile.productList.filter((p) => p.active).map((p) => p.name)
    : (profile.products || "")
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean);
  const dirty = !!post && (caption !== post.caption || hashtags !== post.hashtags || date !== (post.date || ""));

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
      const next: Post = { ...post, caption, hashtags, date, status: nextStatus || post.status, failureReason: undefined };
      setStatus("saving");
      const ok = await onPersist(next);
      setStatus(ok ? "saved" : "error");
      if (ok) setPost(next);
      return ok;
    },
    [post, caption, hashtags, date, onPersist],
  );

  // Debounced autosave of edits (never while another save runs).
  useEffect(() => {
    if (!dirty || busy) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (saveState !== "saving") void persist();
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer.current);
  }, [dirty, busy, caption, hashtags, date, persist, saveState]);
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
    setBusy("generate");
    try {
      const next = await previewMock(
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
      );
      // Regenerating keeps the same concept (no duplicate drafts) and the
      // previous text stays available through "Ongedaan maken".
      if (post) {
        next.id = post.id;
        next.createdAt = post.createdAt;
        remember();
      }
      if (date) next.date = date;
      setStatus("saving");
      if (await onPersist(next)) {
        setPost(next);
        setCaption(next.caption);
        setHashtags(next.hashtags);
        setDate(next.date || "");
        setAlternatives([]);
        setStatus("saved");
        setMessage(again ? "Nieuwe versie gemaakt en opgeslagen als concept." : "Concept gemaakt en opgeslagen.");
        setView("edit");
      } else setStatus("error");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Genereren is niet gelukt. Probeer het opnieuw.");
    } finally {
      setBusy("");
    }
  }

  async function edit(action: ContentEditAction) {
    if (!caption.trim()) return;
    setError("");
    setMessage("");
    setBusy("edit");
    try {
      const results = await editContentText(action, caption, "instagram");
      if (action === "alternatives") setAlternatives(results);
      else if (results[0]) {
        remember();
        setCaption(results[0]);
        setMessage("Mavix AI heeft je tekst aangepast. Controleer het resultaat.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aanpassen is niet gelukt. Je tekst is niet gewijzigd.");
    } finally {
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
    if (await persist(date ? "scheduled" : "approved"))
      setMessage(date ? "Goedgekeurd en ingepland in de kalender. Publiceren naar Instagram is nog niet gekoppeld." : "Goedgekeurd. Kies een datum om het in te plannen.");
  }

  const video = VIDEO.includes(post?.contentType || type);
  const generating = busy === "generate";

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
              <button type="button" className="button primary" onClick={() => void approve()} disabled={status === "saving"}>
                {date ? <CalendarClock size={15} /> : <Check size={15} />}
                <span>{date ? "Goedkeuren en inplannen" : "Goedkeuren"}</span>
              </button>
            </div>
          )}
        </div>

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
              <p className="cs-hint">Binnenkort: carrousel, story en reel.</p>
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
            {type !== "Captions & Hashtags" && type !== "Content Ideas" && (
              <div className="cs-field">
                <span>Foto&apos;s</span>
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
                        setPhotos(await readImages(files));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Foto toevoegen is niet gelukt.");
                      } finally {
                        setBusy("");
                      }
                    }}
                  />
                </label>
                {photos.length > 0 && (
                  <div className="cs-photos">
                    {photos.map((photo, i) => (
                      <div key={i}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt={"Foto " + (i + 1)} />
                        <button type="button" aria-label={"Verwijder foto " + (i + 1)} onClick={() => setPhotos(photos.filter((_, n) => n !== i))}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                <small>Mavix AI gebruikt je Brand Hub: toon, doelgroep en producten.</small>
                <button className="button primary" aria-busy={generating} disabled={!!busy || !prompt.trim()}>
                  {generating ? <Mavi size={16} state="thinking" tone="brand" live /> : post ? <RefreshCw size={15} /> : <Wand2 size={15} />}
                  {generating ? "Bezig…" : post ? "Opnieuw genereren" : "Genereren"}
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
                  <small>{caption.length} / 2200</small>
                </label>
                <textarea id="ig-caption" className="cs-caption" rows={10} maxLength={4000} value={caption} onChange={(e) => setCaption(e.target.value)} />
                {alternatives.length > 0 && (
                  <div className="cs-alternatives">
                    <p>Kies een alternatief om je caption te vervangen:</p>
                    {alternatives.map((alt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          remember();
                          setCaption(alt);
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
                    <label className="cs-label" htmlFor="ig-hashtags">
                      Hashtags
                    </label>
                    <textarea id="ig-hashtags" rows={2} maxLength={1000} value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
                  </>
                )}
                <label className="cs-label" htmlFor="ig-date">
                  {fromCalendar ? "Publicatiemoment" : "Inplannen (optioneel)"}
                </label>
                <input id="ig-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
                {video && <p className="cs-hint">Dit concept is een video-idee. Mavix maakt nog geen videobestanden.</p>}
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
              <div className="ig-phone-media">{post ? <PostVisual post={{ ...post, media: photos.length ? photos : post.media }} /> : photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[0]} alt="Gekozen foto" />
                ) : <span className="ig-phone-placeholder">Je foto verschijnt hier</span>}</div>
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
    </>
  );
}
