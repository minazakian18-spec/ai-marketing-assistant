"use client";
import { useState, useEffect } from "react";
import {
  GenerationSkeleton,
  previewMock,
} from "@/components/generation-skeleton";
import {
  ImagePlus,
  Layers,
  Film,
  Image as ImageIcon,
  Type,
  Lightbulb,
  Sparkles,
  Package,
  Globe,
  RefreshCw,
  Save,
  Check,
} from "lucide-react";
import Link from "next/link";
import type { Post, Profile } from "@/lib/types";
import type { ContentType } from "@/lib/instagram-model";
import { generateContent } from "@/lib/providers/mock";
import { readImages } from "@/lib/local-images";
import { PostVisual } from "./shared";
const quick = [
  ["Post", "Create Post", ImageIcon],
  ["Carousel", "Create Carousel", Layers],
  ["Story", "Create Story", ImagePlus],
  ["Image", "Create Image", ImageIcon],
  ["Reel", "Create Reel", Film],
  ["Animate Image", "Animate Image", Sparkles],
  ["Photos to Reel", "Photos to Reel", Layers],
] as const;
export function CreateStudio({
  profile,
  editPost,
  onPersist,
}: {
  profile: Profile;
  editPost?: Post;
  onPersist: (post: Post) => boolean;
}) {
  const [type, setType] = useState<ContentType>("Post");
  const [prompt, setPrompt] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [product, setProduct] = useState("");
  const [website, setWebsite] = useState(false);
  const [videoMode, setVideoMode] = useState("Short AI Reel");
  const [duration, setDuration] = useState<5 | 10>(5);
  const [post, setPost] = useState<Post | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (editPost) {
      setPost(editPost);
      setPrompt(editPost.prompt);
      setType(editPost.contentType || "Post");
      setPhotos(editPost.media || []);
      setCaption(editPost.caption);
      setHashtags(editPost.hashtags);
      setDate(editPost.date);
      setDuration(editPost.duration === 10 ? 10 : 5);
      setVideoMode(editPost.videoMode || "Short AI Reel");
    }
  }, [editPost]);
  const video = ["Reel", "Animate Image", "Photos to Reel"].includes(type);
  const products = (profile.products || "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  async function generate(again = false) {
    setMessage("");
    if (!prompt.trim()) {
      setMessage("Beschrijf eerst wat je wilt maken.");
      return;
    }
    const mode = type === "Reel" ? videoMode : type;
    if (mode === "Animate Image" && !photos.length) {
      setMessage("Voeg één foto toe om te animeren.");
      return;
    }
    if (mode === "Photos to Reel" && photos.length < 2) {
      setMessage("Voeg minimaal twee foto’s toe voor Photos to Reel.");
      return;
    }
    setBusy(true);
    try {
      const next = await previewMock(
        generateContent({
          prompt: prompt.trim(),
          type,
          profile,
          product,
          useWebsite: website,
          photos,
          duration,
          videoMode: mode,
          variant: again && post ? post.variant + 1 : 0,
        }),
      );
      if (again && post) next.id = post.id;
      if (onPersist(next)) {
        setPost(next);
        setCaption(next.caption);
        setHashtags(next.hashtags);
        setDate("");
        setMessage(
          "Mockconcept opgeslagen. Je vindt het in de goedkeuringswachtrij.",
        );
      }
    } catch {
      setMessage("Genereren is niet gelukt. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }
  function persist(approve = false) {
    if (!post) return;
    if (!caption.trim()) {
      setMessage("Vul een caption in.");
      return;
    }
    if (date && new Date(date).getTime() <= Date.now()) {
      setMessage("Kies een tijdstip in de toekomst of maak de datum leeg.");
      return;
    }
    const next: Post = {
      ...post,
      caption,
      hashtags,
      date,
      status: approve ? (date ? "scheduled" : "approved") : "draft",
      failureReason: undefined,
    };
    if (onPersist(next)) {
      setPost(next);
      setMessage(
        approve
          ? "Goedgekeurd. " +
              (date
                ? "Je content is lokaal ingepland."
                : "Kies een datum in de contentkalender.")
          : "Wijzigingen opgeslagen als concept.",
      );
    }
  }
  return (
    <div className="ig-create-grid">
      <div>
        <section className="panel ig-prompt-card">
          <div className="ig-card-head">
            <h2>Wat wil je dat Mavix maakt?</h2>
            <span className="badge draft">Mock AI</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
          >
            <label className="sr-only" htmlFor="ig-prompt">
              Wat wil je dat Mavix maakt?
            </label>
            <textarea
              id="ig-prompt"
              required
              rows={4}
              maxLength={2000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Bijvoorbeeld: Maak een Instagram-post over ons nieuwe product."
            />
            <div className="ig-source-options">
              <label className="ig-upload">
                <ImagePlus size={16} />
                Foto toevoegen
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  disabled={busy}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    e.target.value = "";
                    if (!files.length) return;
                    setBusy(true);
                    try {
                      setPhotos(await readImages(files));
                      setMessage("Foto’s toegevoegd.");
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "Foto uploaden mislukt.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </label>
              <span>
                <Package size={16} />
                Product kiezen
              </span>
              <span>
                <Globe size={16} />
                Website-informatie
              </span>
            </div>
            {photos.length > 0 && (
              <div className="ig-photo-strip">
                {photos.map((photo, i) => (
                  <div key={i}>
                    <img src={photo} alt={"Foto " + (i + 1)} />
                    <button
                      type="button"
                      aria-label={"Verwijder foto " + (i + 1)}
                      onClick={() =>
                        setPhotos(photos.filter((_, n) => n !== i))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="ig-two-fields">
              <label>
                Product/dienst
                <select
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                >
                  <option value="">Geen product geselecteerd</option>
                  {products.map((p, i) => (
                    <option key={i}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="ig-website-choice">
                <input
                  type="checkbox"
                  disabled={!profile.website}
                  checked={website}
                  onChange={(e) => setWebsite(e.target.checked)}
                />
                Website-informatie gebruiken
              </label>
            </div>
            <p className="field-note">
              {products.length ? "" : "Voeg producten toe in Brand Hub. "}
              Websitegebruik neemt alleen de opgeslagen bedrijfsomschrijving
              mee; er wordt geen website opgehaald.
            </p>
            <div className="ig-generate-footer">
              <span>
                {type}
                {video ? " · " + duration + " sec · 9:16" : ""}
              </span>
              <button
                className="button primary"
                aria-busy={busy}
                disabled={busy || !prompt.trim()}
              >
                <Sparkles size={17} />
                {busy ? "Bezig…" : "Genereren"}
              </button>
            </div>
          </form>
        </section>
        <section className="ig-quick">
          <div className="ig-section-title">
            <h2>Quick Create</h2>
            <span>Kies je formaat</span>
          </div>
          <div className="ig-quick-grid">
            {quick.map(([key, label, Icon]) => (
              <button
                key={key}
                aria-pressed={type === key}
                onClick={() => {
                  setType(key);
                  setMessage("");
                }}
              >
                <Icon size={21} />
                <strong>{label}</strong>
                <small>
                  {["Reel", "Animate Image", "Photos to Reel"].includes(key)
                    ? "5–10 sec · mock storyboard"
                    : "Caption & beeldconcept"}
                </small>
              </button>
            ))}
          </div>
          <div className="ig-small-tools">
            {(
              [
                ["Captions & Hashtags", Type],
                ["Content Ideas", Lightbulb],
              ] as const
            ).map(([key, Icon]) => (
              <button
                key={key}
                aria-pressed={type === key}
                onClick={() => setType(key)}
              >
                <Icon size={17} />
                {key}
              </button>
            ))}
          </div>
        </section>
        {video && (
          <section className="panel ig-video-options">
            <h2>Korte video, sterk verhaal</h2>
            <p>
              Een realistisch storyboard voor een korte 5–10 seconden video.
            </p>
            <label>
              Videorichting
              <select
                value={type === "Reel" ? videoMode : type}
                onChange={(e) => {
                  setType("Reel");
                  setVideoMode(e.target.value);
                }}
              >
                <option>Animate Image</option>
                <option>Photos to Reel</option>
                <option>Short AI Reel</option>
              </select>
            </label>
            <label>
              Lengte
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) as 5 | 10)}
              >
                <option value={5}>5 seconden</option>
                <option value={10}>10 seconden</option>
              </select>
            </label>
            <div className="ig-video-features">
              {[
                "Logo",
                "Tekst overlays",
                "Captions",
                "CTA",
                "Muziek",
                "Verticaal 9:16",
              ].map((f) => (
                <span key={f}>{f} · later</span>
              ))}
            </div>
            <p className="field-note">
              Nu: storyboard en fotopreview. Geen videobestand of muziek. Later
              kunnen meerdere foto’s/video’s worden gecombineerd.
            </p>
          </section>
        )}
      </div>
      <aside className="ig-preview">
        <div className="ig-section-title">
          <h2>Content preview</h2>
          <span>{post ? "Lokaal concept" : "Jouw volgende idee"}</span>
        </div>
        {busy ? (
          <section className="panel">
            <GenerationSkeleton />
          </section>
        ) : post ? (
          <section
            className="panel ig-preview-card result-enter"
            key={post.id + post.variant}
          >
            <PostVisual post={post} />
            <div className="ig-preview-body">
              <span className="badge draft">
                {post.contentType || "Post"} · voorbeeld
              </span>
              {["Reel", "Animate Image", "Photos to Reel"].includes(
                post.contentType || "",
              ) && (
                <div className="ig-storyboard">
                  <strong>Storyboard · {post.duration || 5} sec · 9:16</strong>
                  <ol>
                    <li>Intro met jouw beeld</li>
                    <li>Korte tekstoverlay</li>
                    <li>Afsluiting met CTA</li>
                  </ol>
                  <small>Geen echte video gegenereerd.</small>
                </div>
              )}
              <label>
                Caption
                <textarea
                  aria-label="Caption"
                  rows={6}
                  maxLength={4000}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </label>
              <label>
                Hashtags
                <textarea
                  aria-label="Hashtags"
                  rows={2}
                  maxLength={1000}
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                />
              </label>
              <label>
                Geplande datum/tijd (optioneel)
                <input
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <div className="ig-preview-actions">
                <button className="button secondary" onClick={() => persist()}>
                  <Save size={15} />
                  Opslaan
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void generate(true)}
                >
                  <RefreshCw size={15} />
                  Opnieuw
                </button>
                <button
                  className="button primary"
                  onClick={() => persist(true)}
                >
                  <Check size={15} />
                  Goedkeuren
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="panel ig-preview-empty">
            <Sparkles size={36} />
            <h2>Van idee naar impact.</h2>
            <p>Je caption, beeldconcept of storyboard verschijnt hier.</p>
            <Link href="/brand-hub">Begin met je Brand Hub →</Link>
          </section>
        )}
        <p role="status" className="ig-feedback">
          {message}
        </p>
      </aside>
    </div>
  );
}
