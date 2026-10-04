"use client";
import { useRef, useState } from "react";
import { Upload, Images as ImagesIcon } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { AssetCard } from "@/components/library/asset-card";
import { useWorkspace } from "@/components/workspace-provider";
import { readImages } from "@/lib/local-images";
import { downloadFile } from "@/lib/download";
import type { LibraryAsset, LibraryAssetType } from "@/lib/library-model";
import "../../library.css";

type Filter = "all" | LibraryAssetType;
const filters: [Filter, string][] = [
  ["all", "Alle"],
  ["image", "Afbeeldingen"],
  ["video", "Video's"],
  ["logo", "Logo's"],
  ["ai", "AI-creaties"],
];

export default function LibraryPage() {
  const { data, ready, save } = useWorkspace();
  const assets = data.library;
  const [filter, setFilter] = useState<Filter>("all");
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LibraryAsset | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const filtered =
    filter === "all" ? assets : assets.filter((a) => a.type === filter);

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    try {
      const images = await readImages(files, 10);
      const added: LibraryAsset[] = images.map((preview, i) => ({
        id: "lib-upload-" + Date.now() + "-" + i,
        name:
          files[i]?.name.replace(/\.[^.]+$/, "") || "Nieuwe afbeelding " + (i + 1),
        type: "image",
        preview,
        dateAdded: new Date().toISOString(),
      }));
      if (await save({ ...data, library: [...added, ...assets] }))
        setMessage(
          added.length + (added.length === 1 ? " bestand" : " bestanden") +
            " toegevoegd aan je Library.",
        );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Uploaden is niet gelukt.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function handleUse(asset: LibraryAsset) {
    setMessage(
      "Download '" +
        asset.name +
        "' en upload het bestand bij Social of E-mail om het te gebruiken. Rechtstreeks kiezen vanuit de Bibliotheek volgt in een latere stap.",
    );
  }
  function handleDownload(asset: LibraryAsset) {
    if (asset.preview) {
      const link = document.createElement("a");
      link.href = asset.preview;
      link.download = asset.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      downloadFile(
        asset.name + ".txt",
        "Voorbeeldbestand uit de Mavix Library: " + asset.name,
        "text/plain",
      );
    }
    setMessage("'" + asset.name + "' wordt gedownload.");
  }
  async function handleRename(id: string, name: string) {
    if (
      await save({
        ...data,
        library: assets.map((a) => (a.id === id ? { ...a, name } : a)),
      })
    )
      setMessage("Naam bijgewerkt.");
  }
  async function handleDelete() {
    if (!deleteTarget) return;
    if (
      await save({
        ...data,
        library: assets.filter((a) => a.id !== deleteTarget.id),
      })
    )
      setMessage("'" + deleteTarget.name + "' is verwijderd.");
    setDeleteTarget(null);
  }
  if (!ready) return <p role="status">Library laden…</p>;
  return (
    <>
      <PageHeading
        eyebrow="Merk"
        title="Bibliotheek"
        description="Al je afbeeldingen, video's, logo's en creaties op één plek."
        action={
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={(e) => handleUpload(e.target.files)}
            />
            <button
              className="button primary"
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={16} />
              Upload
            </button>
          </>
        }
      />
      <div className="lib-toolbar" role="group" aria-label="Filter op type">
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="lib-filter-pill"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <p role="status" className="ig-feedback ig-top-feedback">
        {message}
      </p>
      {filtered.length ? (
        <div className="lib-grid">
          {filtered.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onUse={handleUse}
              onDownload={handleDownload}
              onRename={handleRename}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      ) : (
        <div className="panel ig-empty">
          <ImagesIcon size={28} />
          <h2>Nog geen content in deze weergave</h2>
          <p>Upload afbeeldingen of kies een ander filter.</p>
        </div>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Content verwijderen?"
        confirmLabel="Verwijderen"
        danger
        onConfirm={handleDelete}
      >
        <p>
          Weet je zeker dat je “{deleteTarget?.name}” wilt verwijderen? Dit kan
          niet ongedaan worden gemaakt.
        </p>
      </ConfirmDialog>
    </>
  );
}
