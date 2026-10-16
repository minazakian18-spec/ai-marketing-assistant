"use client";
import { useEffect, useState } from "react";
import { ExternalLink, Send } from "lucide-react";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { isBrowserDemo } from "@/lib/demo";
import { publishProblems, reallyPublished } from "@/lib/instagram-publish";
import type { Post } from "@/lib/types";

// Real Instagram publishing (POST /api/social/publish). The button is only
// active when Meta granted the publish permission; otherwise it says why.
// Nothing is published without the confirmation dialog.

export type Capability = { ready: boolean; code: string; message: string; account?: string };
const DEMO: Capability = { ready: false, code: "demo", message: "In de testmodus publiceert Mavix niet naar Instagram." };

let cached: Promise<Capability> | null = null;
export function usePublishCapability() {
  const [cap, setCap] = useState<Capability | null>(null);
  useEffect(() => {
    if (isBrowserDemo()) {
      setCap(DEMO);
      return;
    }
    cached ??= fetch("/api/social/publish", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()).capability as Capability) : { ready: false, code: "error", message: "De publicatiestatus kon niet worden geladen." }))
      .catch(() => ({ ready: false, code: "error", message: "De publicatiestatus kon niet worden geladen." }));
    let live = true;
    void cached.then((c) => live && setCap(c));
    return () => {
      live = false;
    };
  }, []);
  return cap;
}

/** Status line for a post: real publication, simulation, or ready/blocked. */
export function PublishStatus({ post }: { post: Post }) {
  if (reallyPublished(post))
    return (
      <span className="ig-pub is-live">
        Gepubliceerd op Instagram
        {post.instagram?.permalink && (
          <a href={post.instagram.permalink} target="_blank" rel="noreferrer">
            Bekijk <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </span>
    );
  if (post.status === "published") return <span className="ig-pub is-sim">Gepubliceerd (simulatie, niet op Instagram)</span>;
  return null;
}

export function PublishButton({ post, capability }: { post: Post; capability: Capability | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (post.status !== "approved" && post.status !== "scheduled") return null;
  const problems = publishProblems(post);
  const blocked = !capability?.ready || problems.length > 0;
  const reason = !capability ? "Publicatiestatus laden…" : !capability.ready ? capability.message : problems[0];

  async function publish() {
    setOpen(false);
    setBusy(true);
    setError("");
    const r = await fetch("/api/social/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: post.id, confirm: true }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(d.error || "Publiceren is niet gelukt. Er is niets gepubliceerd.");
    window.dispatchEvent(new Event("mavix:workspace-reload"));
  }

  return (
    <div className="ig-publish">
      <button type="button" className="button primary" disabled={blocked || busy} onClick={() => setOpen(true)} aria-describedby={blocked ? "pub-" + post.id : undefined}>
        <Send size={14} aria-hidden="true" />
        {busy ? "Publiceren…" : "Nu publiceren"}
      </button>
      {blocked && reason && (
        <small id={"pub-" + post.id} className="field-note">
          {reason}
        </small>
      )}
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
      <ConfirmDialog open={open} onClose={() => setOpen(false)} title="Nu publiceren op Instagram?" confirmLabel="Publiceren" onConfirm={() => void publish()}>
        {`Deze post wordt direct op ${capability?.account || "je Instagram-account"} geplaatst, met ${(post.media || []).length === 1 ? "1 foto" : (post.media || []).length + " foto's"}. Verwijderen of aanpassen doe je daarna in Instagram zelf.`}
      </ConfirmDialog>
    </div>
  );
}
