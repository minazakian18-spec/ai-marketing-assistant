"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  RotateCcw,
  Pencil,
  Check,
  ArrowRight,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
} from "lucide-react";
import Link from "next/link";
import { useWorkspace } from "@/components/workspace-provider";
import { Artwork, PageHeading, Status } from "@/components/ui";
import { generateMock } from "@/lib/content-generator";
import type { Post } from "@/lib/types";
function ContentEditor() {
  const { data, ready, save } = useWorkspace();
  const search = useSearchParams();
  const id = search.get("post");
  const [prompt, setPrompt] = useState("");
  const [post, setPost] = useState<Post | null>(null);
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (ready && id) {
      const found = data.posts.find((p) => p.id === id);
      if (found) {
        setPost(found);
        setPrompt(found.prompt);
      } else
        setMessage(
          "Dit concept is niet gevonden. Maak hieronder een nieuwe versie.",
        );
    }
  }, [ready, id, data.posts]);
  function persist(next: Post) {
    const posts = data.posts.some((p) => p.id === next.id)
      ? data.posts.map((p) => (p.id === next.id ? next : p))
      : [next, ...data.posts];
    if (save({ ...data, posts })) {
      setPost(next);
      return true;
    }
    return false;
  }
  function generate(again = false) {
    const next = generateMock(
      prompt.trim(),
      data.profile,
      again && post ? post.variant + 1 : 0,
    );
    if (again && post) next.id = post.id;
    if (persist(next)) {
      setEditing(false);
      setMessage(
        again
          ? "Nieuwe versie opgeslagen als concept."
          : "Je concept is opgeslagen.",
      );
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="JOUW CREATIEVE STUDIO"
        title="Van idee naar Instagram-post"
        description="Vertel wat je wilt delen en geef je volgende post vorm."
      />
      <div className="studio-grid">
        <section className="panel prompt-panel">
          <div className="section-heading">
            <h2>
              <Sparkles size={20} /> Wat wil je maken?
            </h2>
            <span className="badge draft">Mockmodus</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            <label htmlFor="prompt">Jouw idee</label>
            <textarea
              id="prompt"
              required
              maxLength={2000}
              rows={7}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Maak een Instagram-post voor onze weekendactie."
            />
            <span className="input-hint">
              Een onderwerp, actie of klein idee is genoeg.
            </span>
            <div className="suggestions">
              {[
                "Een weekendactie",
                "Een kijkje achter de schermen",
                "Ons nieuwste product",
              ].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() =>
                    setPrompt(
                      `Maak een Instagram-post over ${s.toLowerCase()}.`,
                    )
                  }
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="channel-row">
              <span className="instagram-mark">◎</span>
              <div>
                <strong>Instagram-post</strong>
                <p>Caption, hashtags en een beeldplaceholder</p>
              </div>
              <Check size={18} />
            </div>
            <button
              className="button primary full"
              disabled={!ready || !prompt.trim()}
            >
              <Sparkles size={18} />
              Genereren
            </button>
          </form>
          <p className="mock-note">
            Dit is een voorbeeldgenerator, zonder echte AI. Je invoer blijft in
            deze browser. Het bedrijfsprofiel wordt nog niet volledig verwerkt.
          </p>
          <p role="status" className="success-message">
            {message}
          </p>
        </section>
        <section className="preview-area">
          <div className="preview-heading">
            <h2>Je preview</h2>
            {post && <Status status={post.status} />}
          </div>
          {post ? (
            <>
              <article className="instagram-card">
                <div className="instagram-header">
                  <span className="avatar">
                    {(data.profile.name || "M").slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{data.profile.name || "Jouw bedrijf"}</strong>
                    <p>Instagram · Voorbeeld</p>
                  </div>
                  <span>•••</span>
                </div>
                <Artwork variant={post.variant} />
                <div className="instagram-body">
                  <div className="social-icons" aria-hidden="true">
                    <Heart />
                    <MessageCircle />
                    <Send />
                    <Bookmark />
                  </div>
                  {editing ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (
                          persist({
                            ...post,
                            caption,
                            hashtags,
                            status: "draft",
                            date: "",
                          })
                        ) {
                          setEditing(false);
                          setMessage("Wijzigingen opgeslagen als concept.");
                        }
                      }}
                    >
                      <label>
                        Caption
                        <textarea
                          required
                          rows={7}
                          maxLength={4000}
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
                        />
                      </label>
                      <label>
                        Hashtags
                        <textarea
                          rows={2}
                          maxLength={1000}
                          value={hashtags}
                          onChange={(e) => setHashtags(e.target.value)}
                        />
                      </label>
                      <div className="edit-actions">
                        <button className="button primary">Opslaan</button>
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => setEditing(false)}
                        >
                          Annuleren
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p className="caption">{post.caption}</p>
                      <p className="hashtags">{post.hashtags}</p>
                    </>
                  )}
                </div>
              </article>
              <div className="post-actions">
                <button
                  disabled={editing}
                  className="button secondary"
                  onClick={() => {
                    setCaption(post.caption);
                    setHashtags(post.hashtags);
                    setEditing(true);
                  }}
                >
                  <Pencil size={16} />
                  Bewerken
                </button>
                <button
                  disabled={editing || !prompt.trim()}
                  className="button secondary"
                  onClick={() => generate(true)}
                >
                  <RotateCcw size={16} />
                  Opnieuw maken
                </button>
                <button
                  disabled={editing || post.status !== "draft"}
                  className="button primary"
                  onClick={() => {
                    if (persist({ ...post, status: "approved" }))
                      setMessage(
                        "Goedgekeurd! Plan je post in via de contentkalender.",
                      );
                  }}
                >
                  <Check size={16} />
                  {post.status === "draft" ? "Goedkeuren" : "Goedgekeurd"}
                </button>
              </div>
              {post.status !== "draft" && (
                <Link
                  href="/contentkalender"
                  className="text-link calendar-link"
                >
                  Naar de contentkalender <ArrowRight size={17} />
                </Link>
              )}
            </>
          ) : (
            <div className="preview-empty">
              <span className="preview-star">✦</span>
              <h2>Een idee vol mogelijkheden.</h2>
              <p>
                Jouw post verschijnt hier.
                <br />
                Begin met een idee aan de linkerkant.
              </p>
              <div className="ghost-lines">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
export default function ContentPage() {
  return (
    <Suspense fallback={<p>Werkruimte laden…</p>}>
      <ContentEditor />
    </Suspense>
  );
}
