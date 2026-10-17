"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ImageOff, X } from "lucide-react";
import { IconButton } from "@/components/ui";
import { isBrowserDemo } from "@/lib/demo";
import { mediaRef } from "@/lib/media-ref";

// Pick images from the Bibliotheek for a post. The library serves short-lived
// signed URLs, so a chosen image is downloaded once and stored with the post
// the same way an uploaded photo is (resized data URL): the post keeps
// working after the link expires and nothing is duplicated in storage.
type LibraryFile = { id: string; name: string; kind: string; mimeType: string; url?: string };

export function LibraryPicker({ open, max, onClose, onPick }: { open: boolean; max: number; onClose: () => void; onPick: (images: string[]) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [files, setFiles] = useState<LibraryFile[] | null>(null);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = dialog.current;
    if (open && !el?.open) el?.showModal();
    if (!open && el?.open) el.close();
    if (!open) return;
    setChosen([]);
    setError("");
    if (isBrowserDemo()) {
      setFiles([]);
      setError("De Bibliotheek werkt alleen met een echt account.");
      return;
    }
    setFiles(null);
    fetch("/api/library", { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || "De Bibliotheek kon niet worden geladen.");
        setFiles(((body.files || []) as LibraryFile[]).filter((f) => /^image\/(png|jpeg|webp)$/.test(f.mimeType) && f.url));
      })
      .catch((e) => {
        setFiles([]);
        setError(e.message);
      });
  }, [open]);

  async function confirm() {
    const picked = (files || []).filter((f) => chosen.includes(f.id));
    if (!picked.length) return;
    setBusy(true);
    setError("");
    try {
      if (picked.length > max) throw new Error("Kies maximaal " + max + " afbeeldingen.");
      // A reference to the file in the Bibliotheek: no copy, no re-encoding.
      onPick(picked.map((f) => mediaRef(f.id)));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Afbeeldingen toevoegen is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className="account-dialog lp-dialog" aria-labelledby="lp-title" onClose={onClose} data-state={open ? "open" : "closed"}>
      <header className="lp-head">
        <h2 id="lp-title">Kies uit Bibliotheek</h2>
        <IconButton label="Sluiten" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>
      {error && (
        <p className="cs-error" role="alert">
          {error}
        </p>
      )}
      {files === null ? (
        <div className="lp-grid" aria-busy="true" aria-label="Afbeeldingen laden">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="lp-skel" />
          ))}
        </div>
      ) : files.length ? (
        <ul className="lp-grid">
          {files.map((f) => {
            const on = chosen.includes(f.id);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  className={"lp-item" + (on ? " is-on" : "")}
                  aria-pressed={on}
                  disabled={!on && chosen.length >= max}
                  onClick={() => setChosen(on ? chosen.filter((x) => x !== f.id) : [...chosen, f.id])}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={f.name} loading="lazy" />
                  {on && (
                    <span className="lp-check" aria-hidden="true">
                      <Check size={13} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        !error && (
          <div className="cs-empty lp-empty">
            <ImageOff size={28} aria-hidden="true" />
            <p>
              Er staan nog geen afbeeldingen in je Bibliotheek. <Link href="/library">Upload ze in de Bibliotheek</Link> of voeg hier direct een foto toe.
            </p>
          </div>
        )
      )}
      <footer className="lp-foot">
        <small>{chosen.length ? `${chosen.length} van max. ${max} gekozen` : `Kies maximaal ${max} afbeeldingen`}</small>
        <button type="button" className="button secondary" onClick={onClose}>
          Annuleren
        </button>
        <button type="button" className="button primary" disabled={!chosen.length || busy} onClick={() => void confirm()}>
          {busy ? "Toevoegen…" : "Toevoegen"}
        </button>
      </footer>
    </dialog>
  );
}
