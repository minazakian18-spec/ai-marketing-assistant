"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  Download,
  FileText,
  Film,
  FolderInput,
  FolderPlus,
  Images as ImagesIcon,
  LayoutGrid,
  List,
  MoreHorizontal,
  Palette,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
  Files,
  Folder,
  NotebookPen,
  Clock,
} from "lucide-react";
import { PageHeading, IconButton, EmptyState } from "@/components/ui";
import { Menu } from "@/components/menu";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { FileTile, Thumb } from "@/components/library/file-tile";
import { Drafts, workspaceDrafts } from "@/components/library/drafts";
import { useWorkspace } from "@/components/workspace-provider";
import { isBrowserDemo } from "@/lib/demo";
import {
  formatBytes,
  KIND_LABEL,
  LIBRARY_MAX_BYTES,
  LIBRARY_TYPES,
  type LibraryAlbum,
  type LibraryData,
  type LibraryFile,
  type LibraryKind,
} from "@/lib/library/shared";
import "../../library.css";

type Section = { type: "all" } | { type: "kind"; kind: LibraryKind } | { type: "album"; id: string } | { type: "drafts" };
type Sort = "newest" | "oldest" | "name" | "size";
const KINDS: [LibraryKind, string, typeof ImagesIcon][] = [
  ["image", "Afbeeldingen", ImagesIcon],
  ["video", "Video's", Film],
  ["logo", "Logo's", Palette],
  ["ai", "AI-creaties", Sparkles],
  ["document", "Documenten", FileText],
];
const SORTS: [Sort, string][] = [
  ["newest", "Nieuwste eerst"],
  ["oldest", "Oudste eerst"],
  ["name", "Naam"],
  ["size", "Grootte"],
];
const VIEW_KEY = "mavix.library.view";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init?.body && typeof init.body === "string" ? { ...init, headers: { "Content-Type": "application/json" } } : init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || "Er ging iets mis. Probeer het opnieuw."), { setup: !!d.setup });
  return d as T;
}

export default function LibraryPage() {
  const { data: workspace, save } = useWorkspace();
  const [demo, setDemo] = useState(false);
  const [lib, setLib] = useState<LibraryData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [setupPending, setSetupPending] = useState(false);
  const [message, setMessage] = useState("");
  const [section, setSection] = useState<Section>({ type: "all" });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<string[]>([]);
  const [uploading, setUploading] = useState("");
  const [dragging, setDragging] = useState(false);
  const [viewer, setViewer] = useState<LibraryFile | null>(null);
  const [rename, setRename] = useState<{ file: LibraryFile; name: string } | null>(null);
  const [move, setMove] = useState<{ ids: string[]; albumId: string } | null>(null);
  const [remove, setRemove] = useState<string[] | null>(null);
  const [albumForm, setAlbumForm] = useState<{ id?: string; name: string; description: string } | null>(null);
  const [albumDelete, setAlbumDelete] = useState<LibraryAlbum | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setLib(await api<LibraryData>("/api/library"));
      setLoadError("");
      setSetupPending(false);
    } catch (e) {
      setSetupPending(!!(e as { setup?: boolean }).setup);
      setLoadError(e instanceof Error ? e.message : "De bibliotheek kon niet worden geladen.");
    }
  }, []);
  useEffect(() => {
    const isDemo = isBrowserDemo();
    setDemo(isDemo);
    try {
      if (localStorage.getItem(VIEW_KEY) === "list") setLayout("list");
    } catch {
      /* Optional. */
    }
    if (!isDemo) void load();
  }, [load]);
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(t);
  }, [message]);

  const files = useMemo(() => lib?.files || [], [lib]);
  const albums = useMemo(() => lib?.albums || [], [lib]);
  const albumName = (id: string | null) => albums.find((a) => a.id === id)?.name;
  const canEdit = !!lib?.canEdit;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = files.filter(
      (f) =>
        (section.type === "all" ||
          (section.type === "kind" && f.kind === section.kind) ||
          (section.type === "album" && f.albumId === section.id)) &&
        (!q || f.name.toLowerCase().includes(q)),
    );
    return [...list].sort((a, b) =>
      sort === "newest"
        ? b.createdAt.localeCompare(a.createdAt)
        : sort === "oldest"
          ? a.createdAt.localeCompare(b.createdAt)
          : sort === "name"
            ? a.name.localeCompare(b.name, "nl")
            : b.size - a.size,
    );
  }, [files, section, query, sort]);

  const currentAlbum = section.type === "album" ? albums.find((a) => a.id === section.id) : undefined;
  const drafts = useMemo(() => workspaceDrafts(workspace), [workspace]);
  const title =
    section.type === "all" ? "Alle bestanden" : section.type === "drafts" ? "Concepten" : section.type === "kind" ? KINDS.find((k) => k[0] === section.kind)![1] : currentAlbum?.name || "Album";

  /* ---------- actions ---------- */
  async function upload(list: FileList | File[] | null) {
    if (!list || !canEdit) return;
    const all = Array.from(list);
    const ok = all.filter((f) => LIBRARY_TYPES[f.type] && f.size <= LIBRARY_MAX_BYTES);
    const skipped = all.length - ok.length;
    if (!ok.length) return setMessage("Deze bestanden kunnen niet worden geüpload (type niet ondersteund of groter dan 50 MB).");
    try {
      for (let i = 0; i < ok.length; i += 5) {
        setUploading(`Uploaden… ${Math.min(i + 5, ok.length)} van ${ok.length}`);
        const form = new FormData();
        ok.slice(i, i + 5).forEach((f) => form.append("files", f));
        if (section.type === "album") form.append("albumId", section.id);
        if (section.type === "kind" && (section.kind === "logo" || section.kind === "ai")) form.append("kind", section.kind);
        await api("/api/library/files", { method: "POST", body: form });
      }
      setMessage(ok.length + (ok.length === 1 ? " bestand geüpload." : " bestanden geüpload.") + (skipped ? ` ${skipped} overgeslagen.` : ""));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Uploaden is niet gelukt.");
    } finally {
      setUploading("");
      if (fileInput.current) fileInput.current.value = "";
      await load();
    }
  }
  async function run(work: () => Promise<unknown>, done: string) {
    try {
      await work();
      setMessage(done);
      await load();
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Er ging iets mis.");
      return false;
    }
  }
  const patchFiles = (ids: string[], body: object, done: string) =>
    run(() => api("/api/library/files", { method: "PATCH", body: JSON.stringify({ ids, ...body }) }), done);

  // One-time import of images from the previous (workspace-JSON) library.
  const legacy = (workspace.library || []).filter((a) => a.preview?.startsWith("data:"));
  async function importLegacy() {
    const imported: string[] = [];
    setUploading("Importeren…");
    try {
      for (const a of legacy) {
        const blob = await (await fetch(a.preview!)).blob();
        const ext = blob.type.split("/")[1] || "png";
        const form = new FormData();
        form.append("files", new File([blob], `${a.name}.${ext}`, { type: blob.type }));
        if (a.type === "logo" || a.type === "ai") form.append("kind", a.type);
        await api("/api/library/files", { method: "POST", body: form });
        imported.push(a.id);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Importeren is niet volledig gelukt.");
    } finally {
      if (imported.length)
        await save({ ...workspace, library: workspace.library.filter((a) => !imported.includes(a.id)) }, imported.length + " bestanden geïmporteerd");
      setUploading("");
      await load();
    }
  }

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const drop = (e: DragEvent, on: boolean) => {
    if (!canEdit || !e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDragging(on);
  };

  /* ---------- render ---------- */
  const used = lib?.usage.used || 0;
  const quota = lib?.usage.quota || null;
  const pct = quota ? Math.min(100, Math.round((used / quota) * 100)) : 0;

  const navButton = (active: boolean, label: string, icon: ReactNode, count: number, onClick: () => void) => (
    <button key={label} type="button" className="lb-nav-item" aria-current={active ? "true" : undefined} onClick={onClick}>
      {icon}
      <span>{label}</span>
      <small>{count}</small>
    </button>
  );

  return (
    <div className="lb">
      <PageHeading
        eyebrow="Merk"
        title="Bibliotheek"
        description="Al je afbeeldingen, video's, logo's en creaties op één plek."
        action={
          canEdit && (
            <>
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                accept={Object.keys(LIBRARY_TYPES).join(",")}
                onChange={(e) => void upload(e.target.files)}
              />
              <button className="button primary" onClick={() => fileInput.current?.click()} disabled={!!uploading}>
                <Upload size={16} />
                {uploading || "Upload bestanden"}
              </button>
            </>
          )
        }
      />

      {demo ? (
        <section className="ui-card">
          <EmptyState icon={<ImagesIcon size={18} />} title="Bibliotheek vereist een account">
            De bibliotheek bewaart bestanden in beveiligde opslag per werkruimte. In de testmodus kun je geen bestanden uploaden.
          </EmptyState>
        </section>
      ) : loadError ? (
        <section className="ui-card">
          <EmptyState
            icon={setupPending ? <Clock size={18} /> : <ImagesIcon size={18} />}
            title={setupPending ? "De bibliotheek wordt nog ingericht" : "Bibliotheek even niet beschikbaar"}
            action={
              <button className="button secondary" onClick={() => void load()}>
                Opnieuw proberen
              </button>
            }
          >
            {setupPending
              ? "De opslag voor je bestanden is nog niet klaar. Je bestaande gegevens zijn veilig. Probeer het later opnieuw; blijft dit zo, neem dan contact op met je Mavix-beheerder."
              : loadError}
          </EmptyState>
        </section>
      ) : !lib ? (
        <div className="lb-skeleton" role="status" aria-label="Bibliotheek laden">
          <div className="lb-skel lb-skel-bar" />
          <div className="lb-skel-layout">
            <div className="lb-skel lb-skel-nav" />
            <div className="lb-skel-grid">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="lb-skel lb-skel-tile" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <section className="ui-card lb-storage" aria-label="Opslag">
            <div className="lb-storage-head">
              <strong>Opslag gebruikt</strong>
              <span>{quota ? `${pct}% van ${formatBytes(quota)}` : formatBytes(used)}</span>
            </div>
            {quota ? (
              <>
                <div className="lb-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Opslag gebruikt">
                  <span style={{ width: pct + "%" }} className={pct >= 90 ? "is-full" : ""} />
                </div>
                <p>
                  {formatBytes(used)} gebruikt · {formatBytes(Math.max(0, quota - used))} beschikbaar
                </p>
              </>
            ) : (
              <p>{files.length} bestanden · er is nog geen opslaglimit ingesteld voor deze werkruimte.</p>
            )}
          </section>

          {legacy.length > 0 && canEdit && (
            <p className="lb-legacy" role="status">
              Je hebt {legacy.length} {legacy.length === 1 ? "afbeelding" : "afbeeldingen"} uit de vorige bibliotheek.
              <button type="button" className="button secondary" onClick={() => void importLegacy()} disabled={!!uploading}>
                Importeren
              </button>
            </p>
          )}

          <div className="lb-layout">
            <nav className="lb-nav" aria-label="Bibliotheek">
              {navButton(section.type === "all", "Alle bestanden", <Files size={16} />, files.length, () => setSection({ type: "all" }))}
              {KINDS.map(([kind, label, Icon]) =>
                navButton(section.type === "kind" && section.kind === kind, label, <Icon size={16} />, files.filter((f) => f.kind === kind).length, () =>
                  setSection({ type: "kind", kind }),
                ),
              )}
              {navButton(section.type === "drafts", "Concepten", <NotebookPen size={16} />, drafts.length, () => setSection({ type: "drafts" }))}
              <div className="lb-nav-head">
                <h2>Albums</h2>
                {canEdit && (
                  <IconButton label="Nieuw album" onClick={() => setAlbumForm({ name: "", description: "" })}>
                    <FolderPlus size={15} />
                  </IconButton>
                )}
              </div>
              {albums.map((a) =>
                navButton(section.type === "album" && section.id === a.id, a.name, <Folder size={16} />, a.count, () => setSection({ type: "album", id: a.id })),
              )}
              {canEdit && (
                <button type="button" className="lb-nav-new" onClick={() => setAlbumForm({ name: "", description: "" })}>
                  + Nieuw album
                </button>
              )}
            </nav>

            <section
              className={"lb-main" + (dragging ? " is-dragging" : "")}
              onDragOver={(e) => drop(e, true)}
              onDragEnter={(e) => drop(e, true)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
              }}
              onDrop={(e) => {
                drop(e, false);
                if (canEdit) void upload(e.dataTransfer.files);
              }}
            >
              <div className="lb-head">
                <div className="lb-head-title">
                  <h2>{title}</h2>
                  {currentAlbum?.description && <p>{currentAlbum.description}</p>}
                </div>
                {currentAlbum && canEdit && (
                  <Menu
                    label="Albumacties"
                    trigger={<MoreHorizontal size={16} />}
                    items={[
                      { label: "Hernoemen", icon: <Pencil size={15} />, onSelect: () => setAlbumForm({ id: currentAlbum.id, name: currentAlbum.name, description: currentAlbum.description }) },
                      ...(!currentAlbum.system
                        ? [{ label: "Album verwijderen", icon: <Trash2 size={15} />, danger: true, onSelect: () => setAlbumDelete(currentAlbum) }]
                        : []),
                    ]}
                  />
                )}
              </div>

              <div className="lb-tools">
                <label className="lb-search">
                  <Search size={15} aria-hidden="true" />
                  <span className="sr-only">Zoeken in bibliotheek</span>
                  <input type="search" placeholder="Zoeken in bibliotheek…" value={query} maxLength={100} onChange={(e) => setQuery(e.target.value)} />
                </label>
                <label className="lb-sort">
                  <span className="sr-only">Sorteren</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                    {SORTS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="lb-toggle" role="group" aria-label="Weergave">
                  {(["grid", "list"] as const).map((v) => (
                    <IconButton
                      key={v}
                      label={v === "grid" ? "Rasterweergave" : "Lijstweergave"}
                      active={layout === v}
                      onClick={() => {
                        setLayout(v);
                        try {
                          localStorage.setItem(VIEW_KEY, v);
                        } catch {
                          /* Optional. */
                        }
                      }}
                    >
                      {v === "grid" ? <LayoutGrid size={16} /> : <List size={16} />}
                    </IconButton>
                  ))}
                </div>
              </div>

              {selected.length > 0 && (
                <div className="lb-bulk" role="toolbar" aria-label="Geselecteerde bestanden">
                  <strong>{selected.length} geselecteerd</strong>
                  <button type="button" className="button secondary" onClick={() => setMove({ ids: selected, albumId: "" })}>
                    <FolderInput size={14} /> Naar album
                  </button>
                  <button type="button" className="button secondary" onClick={() => setRemove(selected)}>
                    <Trash2 size={14} /> Verwijderen
                  </button>
                  <button type="button" className="lb-link" onClick={() => setSelected(shown.map((f) => f.id))}>
                    Alles selecteren
                  </button>
                  <IconButton label="Selectie opheffen" onClick={() => setSelected([])}>
                    <X size={15} />
                  </IconButton>
                </div>
              )}
              {message && (
                <p className="lb-message" role="status">
                  {message}
                </p>
              )}

              {section.type === "drafts" ? (
                <Drafts drafts={drafts} query={query} />
              ) : shown.length ? (
                <ul className={layout === "grid" ? "lb-grid" : "lb-list"}>
                  {layout === "list" && (
                    <li className="lb-row lb-row-head" aria-hidden="true">
                      {canEdit && <span className="lb-check-space" />}
                      <span className="lb-row-main">Naam</span>
                      <span className="lb-row-cell">Type</span>
                      <span className="lb-row-cell lb-hide-sm">Album</span>
                      <span className="lb-row-cell lb-hide-sm">Datum</span>
                      <span className="lb-row-cell lb-num">Grootte</span>
                      <span className="lb-menu-space" />
                    </li>
                  )}
                  {shown.map((f) => (
                    <FileTile
                      key={f.id}
                      file={f}
                      layout={layout}
                      selected={selected.includes(f.id)}
                      canEdit={canEdit}
                      albumName={albumName(f.albumId)}
                      onToggle={() => toggle(f.id)}
                      onOpen={() => setViewer(f)}
                      onRename={() => setRename({ file: f, name: f.name })}
                      onMove={() => setMove({ ids: [f.id], albumId: f.albumId || "" })}
                      onDelete={() => setRemove([f.id])}
                    />
                  ))}
                </ul>
              ) : (
                <div className="lb-empty">
                  <EmptyState
                    icon={<ImagesIcon size={18} />}
                    title={query ? "Geen bestanden gevonden" : "Nog geen bestanden"}
                    action={
                      canEdit && !query ? (
                        <button className="button secondary" onClick={() => fileInput.current?.click()}>
                          <Upload size={15} /> Bestanden uploaden
                        </button>
                      ) : undefined
                    }
                  >
                    {query ? "Probeer een andere zoekterm." : canEdit ? "Sleep bestanden hierheen of upload ze via de knop." : "Er zijn nog geen bestanden in deze weergave."}
                  </EmptyState>
                </div>
              )}
              {dragging && <div className="lb-drop">Laat los om te uploaden{section.type === "album" ? " naar " + title : ""}</div>}
            </section>
          </div>
        </>
      )}

      {viewer && (
        <>
          <div className="lb-viewer-scrim" onClick={() => setViewer(null)} aria-hidden="true" />
          <div className="lb-viewer" role="dialog" aria-modal="true" aria-label={viewer.name}>
            <header>
              <div>
                <strong>{viewer.name}</strong>
                <small>
                  {KIND_LABEL[viewer.kind]} · {formatBytes(viewer.size)}
                  {albumName(viewer.albumId) ? " · " + albumName(viewer.albumId) : ""}
                </small>
              </div>
              <a className="ui-icon-button" href={`/api/library/files/${viewer.id}/download`} aria-label="Downloaden" title="Downloaden">
                <Download size={16} />
              </a>
              <IconButton label="Sluiten" onClick={() => setViewer(null)} autoFocus>
                <X size={16} />
              </IconButton>
            </header>
            <div className="lb-viewer-body">
              {viewer.kind === "video" && viewer.url ? (
                <video src={viewer.url} controls playsInline />
              ) : viewer.mimeType.startsWith("image/") && viewer.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewer.url} alt={viewer.name} referrerPolicy="no-referrer" />
              ) : viewer.mimeType === "application/pdf" && viewer.url ? (
                <iframe src={viewer.url} title={viewer.name} sandbox="" />
              ) : (
                <div className="lb-viewer-file">
                  <Thumb file={viewer} />
                  <p>Geen voorbeeld beschikbaar. Download het bestand om het te openen.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!rename}
        onClose={() => setRename(null)}
        title="Bestand hernoemen"
        confirmLabel="Opslaan"
        onConfirm={async () => {
          if (rename && (await patchFiles([rename.file.id], { name: rename.name }, "Naam bijgewerkt."))) setRename(null);
        }}
      >
        <label className="lb-field">
          Naam
          <input value={rename?.name || ""} maxLength={200} onChange={(e) => rename && setRename({ ...rename, name: e.target.value })} />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!move}
        onClose={() => setMove(null)}
        title={move && move.ids.length > 1 ? `${move.ids.length} bestanden verplaatsen` : "Naar album verplaatsen"}
        confirmLabel="Verplaatsen"
        onConfirm={async () => {
          if (!move) return;
          if (await patchFiles(move.ids, { albumId: move.albumId || null }, move.albumId ? "Verplaatst naar " + albumName(move.albumId) + "." : "Uit album gehaald.")) {
            setMove(null);
            setSelected([]);
          }
        }}
      >
        <label className="lb-field">
          Album
          <select value={move?.albumId || ""} onChange={(e) => move && setMove({ ...move, albumId: e.target.value })}>
            <option value="">Geen album</option>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!remove}
        onClose={() => setRemove(null)}
        title={remove && remove.length > 1 ? `${remove.length} bestanden verwijderen?` : "Bestand verwijderen?"}
        confirmLabel="Verwijderen"
        danger
        onConfirm={async () => {
          if (!remove) return;
          const ids = remove;
          setRemove(null);
          if (await run(() => api("/api/library/files", { method: "DELETE", body: JSON.stringify({ ids }) }), ids.length > 1 ? ids.length + " bestanden verwijderd." : "Bestand verwijderd."))
            setSelected((s) => s.filter((id) => !ids.includes(id)));
        }}
      >
        <p>De bestanden worden definitief uit de opslag verwijderd. Dit kan niet ongedaan worden gemaakt.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!albumForm}
        onClose={() => setAlbumForm(null)}
        title={albumForm?.id ? "Album bewerken" : "Nieuw album"}
        confirmLabel={albumForm?.id ? "Opslaan" : "Album maken"}
        onConfirm={async () => {
          if (!albumForm) return;
          const body = JSON.stringify({ name: albumForm.name, description: albumForm.description });
          const ok = albumForm.id
            ? await run(() => api("/api/library/albums/" + albumForm.id, { method: "PATCH", body }), "Album bijgewerkt.")
            : await run(async () => {
                const d = await api<{ id: string }>("/api/library/albums", { method: "POST", body });
                setSection({ type: "album", id: d.id });
              }, "Album gemaakt.");
          if (ok) setAlbumForm(null);
        }}
      >
        <label className="lb-field">
          Naam
          <input value={albumForm?.name || ""} maxLength={80} onChange={(e) => albumForm && setAlbumForm({ ...albumForm, name: e.target.value })} />
        </label>
        <label className="lb-field">
          Omschrijving (optioneel)
          <textarea rows={2} value={albumForm?.description || ""} maxLength={300} onChange={(e) => albumForm && setAlbumForm({ ...albumForm, description: e.target.value })} />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!albumDelete}
        onClose={() => setAlbumDelete(null)}
        title="Album verwijderen?"
        confirmLabel="Album verwijderen"
        danger
        onConfirm={async () => {
          if (!albumDelete) return;
          const id = albumDelete.id;
          setAlbumDelete(null);
          if (await run(() => api("/api/library/albums/" + id, { method: "DELETE" }), "Album verwijderd. De bestanden staan nog in Alle bestanden.")) setSection({ type: "all" });
        }}
      >
        <p>Het album “{albumDelete?.name}” wordt verwijderd. De bestanden zelf blijven bewaard.</p>
      </ConfirmDialog>
    </div>
  );
}
