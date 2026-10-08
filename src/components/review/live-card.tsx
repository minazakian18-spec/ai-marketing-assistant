"use client";
import { useState } from "react";
import { Loader2, MessageSquareReply, Pencil, Send, Sparkles, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import type { GoogleReview } from "@/lib/reviews/google";
import { StarRating, relativeDate } from "./shared";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "G";
const longDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : "");

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Er ging iets mis. Probeer het opnieuw.");
  return d as T;
}

// One real Google review. Replies go to Google first; the card only shows a
// reply after Google accepted it (Google stays the source of truth).
export function LiveReviewCard({ review, onChange }: { review: GoogleReview; onChange: (next: GoogleReview) => void }) {
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"" | "post" | "suggest" | "delete">("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const edited = review.updateTime && review.createTime && Date.parse(review.updateTime) - Date.parse(review.createTime) > 60000;

  function open(text = "") {
    setDraft(text);
    setError("");
    setComposing(true);
  }

  async function suggest() {
    setBusy("suggest");
    setError("");
    try {
      const { text } = await call<{ text: string }>(`/api/reviews/${encodeURIComponent(review.id)}/suggest`, { method: "POST", body: "{}" });
      setDraft(text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function post() {
    if (!draft.trim()) return setError("Schrijf eerst een antwoord.");
    setBusy("post");
    setError("");
    try {
      const { reply } = await call<{ reply: GoogleReview["reply"] }>(`/api/reviews/${encodeURIComponent(review.id)}/reply`, {
        method: "PUT",
        body: JSON.stringify({ comment: draft.trim() }),
      });
      onChange({ ...review, reply });
      setComposing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    setConfirm(false);
    setBusy("delete");
    setError("");
    try {
      await call(`/api/reviews/${encodeURIComponent(review.id)}/reply`, { method: "DELETE" });
      onChange({ ...review, reply: null });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <article className="rvl-card">
      <header className="rvl-head">
        <span className="rvl-avatar" aria-hidden="true">
          {review.reviewer.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Google profile photo (googleusercontent.com only)
            <img src={review.reviewer.photoUrl} alt="" referrerPolicy="no-referrer" loading="lazy" />
          ) : (
            initials(review.reviewer.name)
          )}
        </span>
        <div className="rvl-who">
          <strong>{review.reviewer.name}</strong>
          <span className="rvl-meta">
            {review.rating ? <StarRating rating={review.rating} /> : <span>Geen sterren</span>}
            <time dateTime={review.createTime} title={longDate(review.createTime)}>
              {review.createTime ? relativeDate(review.createTime) : ""}
            </time>
            {edited && <span>· bewerkt</span>}
          </span>
        </div>
        <span className={"rvl-status " + (review.reply ? "is-answered" : "is-open")}>{review.reply ? "Beantwoord" : "Onbeantwoord"}</span>
      </header>

      <p className={"rvl-text" + (review.comment ? "" : " is-empty")}>{review.comment || "Geen tekst, alleen een sterrenbeoordeling."}</p>

      {review.reply && !composing && (
        <div className="rvl-reply">
          <div className="rvl-reply-head">
            <span>Jouw antwoord{review.reply.updateTime ? " · " + relativeDate(review.reply.updateTime) : ""}</span>
            <div>
              <button type="button" className="rvl-link" onClick={() => open(review.reply!.comment)} disabled={!!busy}>
                <Pencil size={13} aria-hidden="true" />
                Bewerken
              </button>
              <button type="button" className="rvl-link is-danger" onClick={() => setConfirm(true)} disabled={!!busy}>
                {busy === "delete" ? <Loader2 size={13} className="int-spin" aria-hidden="true" /> : <Trash2 size={13} aria-hidden="true" />}
                Verwijderen
              </button>
            </div>
          </div>
          <p>{review.reply.comment}</p>
        </div>
      )}

      {composing ? (
        <div className="rvl-compose">
          <label className="sr-only" htmlFor={"reply-" + review.id}>
            Antwoord aan {review.reviewer.name}
          </label>
          <textarea
            id={"reply-" + review.id}
            rows={4}
            maxLength={4096}
            value={draft}
            autoFocus
            placeholder="Schrijf een persoonlijk antwoord. Dit wordt openbaar getoond op Google."
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="rvl-compose-bar">
            <button type="button" className="button secondary" onClick={() => void suggest()} disabled={!!busy}>
              {busy === "suggest" ? <Loader2 size={14} className="int-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
              {busy === "suggest" ? "Mavi denkt mee…" : "Voorstel van Mavi"}
            </button>
            <span className="rvl-count">{draft.length} / 4096</span>
            <button type="button" className="button secondary" onClick={() => setComposing(false)} disabled={busy === "post"}>
              Annuleren
            </button>
            <button type="button" className="button primary" onClick={() => void post()} disabled={!!busy || !draft.trim()}>
              {busy === "post" ? <Loader2 size={14} className="int-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
              {busy === "post" ? "Plaatsen bij Google…" : review.reply ? "Bijwerken" : "Plaatsen"}
            </button>
          </div>
          <p className="rvl-note">Een voorstel van Mavi wordt nooit automatisch geplaatst. Jij controleert en plaatst het antwoord.</p>
        </div>
      ) : (
        !review.reply && (
          <button type="button" className="button secondary rvl-answer" onClick={() => open()}>
            <MessageSquareReply size={14} aria-hidden="true" />
            Beantwoorden
          </button>
        )
      )}
      {error && (
        <p role="alert" className="rvl-error">
          {error}
        </p>
      )}

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Antwoord verwijderen?" confirmLabel="Verwijderen" danger onConfirm={() => void remove()}>
        <p>Je antwoord wordt ook bij Google verwijderd. De review zelf blijft staan.</p>
      </ConfirmDialog>
    </article>
  );
}
