"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Images, X } from "lucide-react";
import { LibraryPicker } from "@/components/library/library-picker";
import { isBrowserDemo } from "@/lib/demo";
import { mediaRef } from "@/lib/media-ref";
import { readImages } from "@/lib/local-images";

// Inspiration images for a NEW AI image: upload, drag and drop or pick from
// the Bibliotheek. Uploads go to the private Bibliotheek of the workspace;
// the server validates content, size and resolution again.

const TYPES = ["image/png", "image/jpeg", "image/webp"];

async function upload(files: File[]): Promise<string[]> {
  if (isBrowserDemo()) return readImages(files);
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("kind", "image");
  const r = await fetch("/api/library/files", { method: "POST", body: form });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "De afbeeldingen konden niet worden opgeslagen.");
  return (d.ids as string[]).map(mediaRef);
}

export function InspirationPicker({ value, onChange, max, disabled }: { value: string[]; onChange: (v: string[]) => void; max: number; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const [picker, setPicker] = useState(false);
  const room = Math.max(0, max - value.length);

  async function add(list: File[]) {
    setError("");
    const files = list.filter((f) => TYPES.includes(f.type));
    if (files.length < list.length) setError("Gebruik JPG-, PNG- of WebP-afbeeldingen.");
    if (!files.length) return;
    if (files.some((f) => f.size > 8 * 1024 * 1024)) return setError("Een afbeelding is groter dan 8 MB.");
    if (files.length > room) return setError(`Je kunt nog ${room} ${room === 1 ? "inspiratiebeeld" : "inspiratiebeelden"} toevoegen (maximaal ${max}).`);
    setBusy(true);
    try {
      onChange([...value, ...(await upload(files))].slice(0, max));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toevoegen is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="cs-inspiration">
      <div className="cs-inspiration-head">
        <span className="cs-label">Inspiratiebeelden (optioneel)</span>
        <small>
          {value.length} van {max}
        </small>
      </div>
      <p className="cs-hint">Voeg voorbeelden toe van afbeeldingen waarvan je de stijl mooi vindt. Mavix gebruikt ze als inspiratie om een nieuwe afbeelding te maken; ze worden niet gekopieerd.</p>
      {room > 0 && (
        <div
          className={"cs-dropzone" + (over ? " is-over" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (!disabled && !busy) void add(Array.from(e.dataTransfer.files));
          }}
        >
          <label className="cs-upload">
            <ImagePlus size={15} aria-hidden="true" />
            {busy ? "Toevoegen…" : "Upload of sleep afbeeldingen hierheen"}
            <input
              type="file"
              multiple
              accept={TYPES.join(",")}
              disabled={disabled || busy}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = "";
                void add(files);
              }}
            />
          </label>
          <button type="button" className="cs-upload cs-upload-library" disabled={disabled || busy} onClick={() => setPicker(true)}>
            <Images size={15} aria-hidden="true" /> Uit Bibliotheek
          </button>
        </div>
      )}
      {value.length > 0 && (
        <ul className="cs-inspiration-list" aria-label="Gekozen inspiratiebeelden">
          {value.map((src, i) => (
            <li key={src + i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={"Inspiratiebeeld " + (i + 1)} />
              <div className="cs-inspiration-tools">
                <button type="button" aria-label={"Inspiratiebeeld " + (i + 1) + " naar links"} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ChevronLeft size={12} />
                </button>
                <button type="button" aria-label={"Inspiratiebeeld " + (i + 1) + " verwijderen"} onClick={() => onChange(value.filter((_, n) => n !== i))}>
                  <X size={12} />
                </button>
                <button type="button" aria-label={"Inspiratiebeeld " + (i + 1) + " naar rechts"} disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                  <ChevronRight size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="cs-error" role="alert">
          {error}
        </p>
      )}
      <LibraryPicker open={picker} max={Math.max(1, room)} onClose={() => setPicker(false)} onPick={(imgs) => onChange([...value, ...imgs].slice(0, max))} />
    </div>
  );
}
