"use client";
import { Check, Download, Eye, FileText, FolderInput, MoreHorizontal, Pencil, Play, Sparkles, Trash2 } from "lucide-react";
import { Menu } from "@/components/menu";
import { formatBytes, KIND_LABEL, type LibraryFile } from "@/lib/library/shared";

const date = (iso: string) => new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });

export function Thumb({ file }: { file: LibraryFile }) {
  if ((file.kind === "image" || file.kind === "logo" || file.kind === "ai") && file.mimeType.startsWith("image/") && file.url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={file.url} alt="" loading="lazy" referrerPolicy="no-referrer" />;
  if (file.kind === "video" && file.url)
    return (
      <>
        <video src={file.url + "#t=0.5"} preload="metadata" muted playsInline />
        <span className="lb-play" aria-hidden="true">
          <Play size={14} />
        </span>
      </>
    );
  return (
    <span className="lb-thumb-icon" aria-hidden="true">
      {file.kind === "ai" ? <Sparkles size={22} /> : <FileText size={22} />}
      <small>{file.mimeType.split("/").pop()?.split(".").pop()?.slice(0, 5).toUpperCase()}</small>
    </span>
  );
}

export function FileTile({
  file,
  layout,
  selected,
  canEdit,
  albumName,
  onToggle,
  onOpen,
  onRename,
  onMove,
  onDelete,
}: {
  file: LibraryFile;
  layout: "grid" | "list";
  selected: boolean;
  canEdit: boolean;
  albumName?: string;
  onToggle: () => void;
  onOpen: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const menu = (
    <Menu
      label={"Acties voor " + file.name}
      trigger={<MoreHorizontal size={16} />}
      items={[
        { label: "Bekijken", icon: <Eye size={15} />, onSelect: onOpen },
        { label: "Downloaden", icon: <Download size={15} />, onSelect: () => window.location.assign(`/api/library/files/${file.id}/download`) },
        ...(canEdit
          ? [
              { label: "Hernoemen", icon: <Pencil size={15} />, onSelect: onRename },
              { label: "Naar album verplaatsen", icon: <FolderInput size={15} />, onSelect: onMove },
              { type: "separator" as const },
              { label: "Verwijderen", icon: <Trash2 size={15} />, danger: true, onSelect: onDelete },
            ]
          : []),
      ]}
    />
  );
  const check = canEdit && (
    <button
      type="button"
      className={"lb-check" + (selected ? " is-on" : "")}
      role="checkbox"
      aria-checked={selected}
      aria-label={"Selecteer " + file.name}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {selected && <Check size={12} />}
    </button>
  );

  if (layout === "list")
    return (
      <li className={"lb-row" + (selected ? " is-selected" : "")}>
        {check}
        <button type="button" className="lb-row-main" onClick={onOpen}>
          <span className="lb-row-thumb">
            <Thumb file={file} />
          </span>
          <strong>{file.name}</strong>
        </button>
        <span className="lb-row-cell">{KIND_LABEL[file.kind]}</span>
        <span className="lb-row-cell lb-hide-sm">{albumName || "—"}</span>
        <span className="lb-row-cell lb-hide-sm">{date(file.createdAt)}</span>
        <span className="lb-row-cell lb-num">{formatBytes(file.size)}</span>
        {menu}
      </li>
    );

  return (
    <li className={"lb-card" + (selected ? " is-selected" : "")}>
      <button type="button" className="lb-thumb" onClick={onOpen} aria-label={"Bekijk " + file.name}>
        <Thumb file={file} />
      </button>
      {check}
      <div className="lb-card-body">
        <div>
          <strong title={file.name}>{file.name}</strong>
          <small>
            {KIND_LABEL[file.kind]} · {date(file.createdAt)} · {formatBytes(file.size)}
          </small>
        </div>
        {menu}
      </div>
    </li>
  );
}
