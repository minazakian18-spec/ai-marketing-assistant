"use client";
import { useState } from "react";
import { Camera, Check, Loader2, X } from "lucide-react";
import { isBrowserDemo } from "@/lib/demo";
import { mediaRef } from "@/lib/media-ref";
import { AREA_LABEL, LOCATION_ALBUM, LOCATION_SHOTS, type LocationArea } from "@/lib/locations";
import type { Profile } from "@/lib/types";

// Brand Hub step "Locatie": 20 photos of the business, one per perspective,
// with a short tip for each. Photos go to the Bibliotheek (album
// "Locatiefoto's", named after the perspective); the profile keeps the refs.

async function albumId(): Promise<string | null> {
  const r = await fetch("/api/library", { cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  const found = (d.albums || []).find((a: { id: string; name: string }) => a.name === LOCATION_ALBUM);
  if (found) return found.id;
  const c = await fetch("/api/library/albums", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: LOCATION_ALBUM, description: "Foto's van je zaak per perspectief, gebruikt door Mavix voor AI-beelden." }) });
  const created = await c.json().catch(() => ({}));
  return c.ok ? created.id : null;
}

async function upload(file: File, label: string) {
  const album = await albumId();
  const form = new FormData();
  form.append("files", file);
  form.append("kind", "image");
  if (album) form.append("albumId", album);
  const r = await fetch("/api/library/files", { method: "POST", body: form });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ids?.[0]) throw new Error(d.error || "De foto kon niet worden opgeslagen.");
  const id = d.ids[0] as string;
  // Named after the perspective, so the Bibliotheek shows where it was taken.
  await fetch("/api/library/files", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id], name: "Locatie – " + label }) }).catch(() => null);
  return mediaRef(id);
}

export function LocationShots({ profile, setProfile }: { profile: Profile; setProfile: (patch: Partial<Profile>) => void }) {
  const demo = isBrowserDemo();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const photos = profile.locations || {};
  const done = LOCATION_SHOTS.filter((s) => photos[s.id]).length;
  const areas = Object.keys(AREA_LABEL) as LocationArea[];

  async function add(id: string, label: string, file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setError("Gebruik een JPG-, PNG- of WebP-foto.");
    setError("");
    setBusy(id);
    try {
      const ref = await upload(file, label);
      setProfile({ locations: { ...photos, [id]: ref } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "De foto kon niet worden opgeslagen.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bh-fields">
      <div className="loc-progress" role="status">
        <div className="loc-bar" aria-hidden="true">
          <span style={{ width: `${(done / LOCATION_SHOTS.length) * 100}%` }} />
        </div>
        <span>
          <strong>
            {done} van {LOCATION_SHOTS.length}
          </strong>{" "}
          foto&apos;s. Hoe meer perspectieven, hoe echter Mavix je zaak in beeld brengt.
        </span>
      </div>
      <p className="loc-intro">Maak de foto&apos;s met je telefoon, liggend, overdag en zonder herkenbare gasten. Elke foto toont je zaak vanuit een andere hoek. Bij Social kies je straks op welke plek een post wordt gemaakt.</p>
      {demo && <p className="loc-note">In de testmodus kun je geen foto&apos;s opslaan. Met een echt account komen ze in je Bibliotheek, album &quot;{LOCATION_ALBUM}&quot;.</p>}
      {error && (
        <p className="bh-error" role="alert">
          {error}
        </p>
      )}
      {areas.map((area) => (
        <section key={area} className="loc-area" aria-label={AREA_LABEL[area]}>
          <h4>{AREA_LABEL[area]}</h4>
          <ul className="loc-grid">
            {LOCATION_SHOTS.filter((s) => s.area === area).map((s, i) => {
              const src = photos[s.id];
              const n = LOCATION_SHOTS.indexOf(s) + 1;
              return (
                <li key={s.id} className={"loc-card" + (src ? " is-done" : "")}>
                  <div className="loc-thumb">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={s.label} />
                    ) : (
                      <span className="loc-n" aria-hidden="true">
                        {n}
                      </span>
                    )}
                    {src && (
                      <button type="button" className="loc-remove" aria-label={"Verwijder foto " + s.label} onClick={() => setProfile({ locations: Object.fromEntries(Object.entries(photos).filter(([k]) => k !== s.id)) })}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <div className="loc-text">
                    <strong>
                      {src && <Check size={13} aria-hidden="true" />} {s.label}
                    </strong>
                    <small>{s.tip}</small>
                  </div>
                  <label className={"button secondary loc-add" + (demo ? " is-disabled" : "")} data-key={i}>
                    {busy === s.id ? <Loader2 size={14} className="int-spin" aria-hidden="true" /> : <Camera size={14} aria-hidden="true" />}
                    {busy === s.id ? "Opslaan…" : src ? "Vervangen" : "Foto maken"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      className="sr-only"
                      disabled={demo || !!busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        void add(s.id, s.label, f);
                      }}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
