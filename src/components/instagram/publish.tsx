"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, Send } from "lucide-react";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { isBrowserDemo } from "@/lib/demo";
import { publishProblems, publishStatusText, reallyPublished } from "@/lib/instagram-publish";
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

// Short, honest status for the Social header (replaces a fixed "not connected" text).
export { publishStatusText };

/**
 * Where publishing stands for this workspace, the one next step, and (when it
 * works) the choice to publish scheduled posts automatically. Automatic
 * publishing is the existing permission "instagram_publish_scheduled": it is
 * only switched on after a confirmation, by an owner or admin.
 */
export function InstagramPublishPanel({ capability }: { capability: Capability | null }) {
  const [auto, setAuto] = useState<{ configured: boolean; state: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!capability?.ready) return;
    let live = true;
    fetch("/api/automation", { cache: "no-store" })
      .then(async (r) => (r.ok ? (await r.json()).workflows : []))
      .then((list: { id: string; configured: boolean; state: string }[]) => {
        const w = list.find((x) => x.id === "instagram_publish_scheduled");
        if (live && w) setAuto({ configured: w.configured, state: w.state });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [capability?.ready]);

  async function toggle() {
    setConfirm(false);
    setBusy(true);
    setError("");
    const r = await fetch("/api/automation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workflow: "instagram_publish_scheduled", enabled: !auto?.configured, confirm: true }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(d.error || "Wijzigen is niet gelukt.");
    const w = (d.workflows || []).find((x: { id: string }) => x.id === "instagram_publish_scheduled");
    if (w) setAuto({ configured: w.configured, state: w.state });
  }

  if (!capability) return <p className="ig-pubbar">Instagram-status laden…</p>;
  if (!capability.ready)
    return (
      <div className={"ig-pubbar" + (capability.code === "demo" ? "" : " is-blocked")}>
        <Send size={14} aria-hidden="true" />
        <span>{capability.code === "demo" ? capability.message : capability.message + " Tot die tijd plan je posts in Mavix en plaats je ze zelf, bijvoorbeeld met Kopiëren."}</span>
        {["not_connected", "reconnect", "permission_missing"].includes(capability.code) && (
          <Link className="button secondary" href="/account/integraties">
            {capability.code === "not_connected" ? "Instagram koppelen" : capability.code === "reconnect" ? "Opnieuw koppelen" : "Bekijk koppeling"}
          </Link>
        )}
      </div>
    );
  return (
    <div className="ig-pubbar is-ready">
      <Send size={14} aria-hidden="true" />
      <span>
        <strong>{publishStatusText(capability)}.</strong> Na goedkeuren publiceer je met <em>Nu publiceren</em>
        {auto?.configured ? ", en ingeplande posts gaan automatisch live op hun moment." : ", of laat ingeplande posts automatisch publiceren."}
      </span>
      {auto && (
        <label className="ig-pubbar-switch">
          <input type="checkbox" checked={auto.configured} disabled={busy} onChange={() => (auto.configured ? void toggle() : setConfirm(true))} />
          <span>Ingeplande posts automatisch publiceren</span>
        </label>
      )}
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Ingeplande posts automatisch publiceren?" confirmLabel="Toestaan" onConfirm={() => void toggle()}>
        {`Goedgekeurde en ingeplande posts worden op het geplande moment automatisch op ${capability.account ? "@" + capability.account.replace(/^@/, "") : "je Instagram-account"} geplaatst, zonder dat je nog op een knop drukt. Concepten die niet zijn goedgekeurd worden nooit gepubliceerd. Je kunt dit altijd weer uitzetten.`}
      </ConfirmDialog>
    </div>
  );
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
