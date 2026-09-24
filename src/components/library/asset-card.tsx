"use client";
import { useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Film,
  Palette,
  Sparkles,
  LayoutTemplate,
  MoreHorizontal,
  MousePointerClick,
  Download,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { usePresence } from "@/components/use-presence";
import {
  assetTypeLabel,
  relativeDateLabel,
  type LibraryAsset,
} from "@/lib/library-model";

const typeIcon = {
  image: ImageIcon,
  video: Film,
  logo: Palette,
  ai: Sparkles,
  template: LayoutTemplate,
};

export function AssetCard({
  asset,
  onUse,
  onDownload,
  onRename,
  onDelete,
}: {
  asset: LibraryAsset;
  onUse: (asset: LibraryAsset) => void;
  onDownload: (asset: LibraryAsset) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (asset: LibraryAsset) => void;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(asset.name);
  const present = usePresence(open);
  const root = useRef<HTMLDivElement>(null);
  const Icon = typeIcon[asset.type];
  useEffect(() => {
    if (!open) return;
    function outside(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <article className="panel lib-card">
      <div
        className={"lib-thumb lib-type-" + asset.type}
        role="img"
        aria-label={asset.name}
      >
        {asset.preview ? (
          <img src={asset.preview} alt="" />
        ) : (
          <Icon size={34} />
        )}
        {asset.usedBefore && (
          <span className="lib-thumb-used">Eerder gebruikt</span>
        )}
      </div>
      <div className="lib-card-body">
        <div className="lib-card-head">
          {renaming ? (
            <form
              className="lib-rename-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) onRename(asset.id, draft.trim());
                setRenaming(false);
              }}
            >
              <input
                autoFocus
                value={draft}
                maxLength={80}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button
                type="submit"
                className="lib-menu-trigger"
                aria-label="Naam opslaan"
              >
                <Check size={16} />
              </button>
              <button
                type="button"
                className="lib-menu-trigger"
                aria-label="Annuleren"
                onClick={() => {
                  setDraft(asset.name);
                  setRenaming(false);
                }}
              >
                <X size={16} />
              </button>
            </form>
          ) : (
            <>
              <h3>{asset.name}</h3>
              <div className="lib-menu-wrap" ref={root}>
                <button
                  type="button"
                  className="lib-menu-trigger"
                  aria-haspopup="menu"
                  aria-expanded={open}
                  aria-label={"Acties voor " + asset.name}
                  onClick={() => setOpen(!open)}
                >
                  <MoreHorizontal size={17} />
                </button>
                {present && (
                  <div
                    className="lib-menu"
                    role="menu"
                    data-state={open ? "open" : "closed"}
                    inert={!open}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        onUse(asset);
                      }}
                    >
                      <MousePointerClick size={15} /> Gebruik content
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        onDownload(asset);
                      }}
                    >
                      <Download size={15} /> Downloaden
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        setDraft(asset.name);
                        setRenaming(true);
                      }}
                    >
                      <Pencil size={15} /> Hernoemen
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="lib-menu-danger"
                      onClick={() => {
                        setOpen(false);
                        onDelete(asset);
                      }}
                    >
                      <Trash2 size={15} /> Verwijderen
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="lib-card-meta">
          <span className="lib-type-tag">{assetTypeLabel[asset.type]}</span>
          <span className="lib-card-date">
            {relativeDateLabel(asset.dateAdded)}
          </span>
        </div>
      </div>
    </article>
  );
}
