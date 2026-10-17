import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { adminClient } from "./supabase";
import { HttpError } from "./access";
import { workspacePlan } from "./plan";
import {
  cleanName,
  LIBRARY_MAX_BYTES,
  LIBRARY_TYPES,
  SYSTEM_ALBUMS,
  type LibraryData,
  type LibraryKind,
} from "../library/shared";

// Bibliotheek on Supabase Storage (private bucket "library") with metadata
// in library_files / library_albums. Every query is scoped to the caller's
// workspace; files are only exposed through short-lived signed URLs.

const BUCKET = "library";
const db = () => adminClient();
const UUID = /^[0-9a-f-]{36}$/;

// The database or storage is not set up (migration 202610060001_library.sql
// not applied). Users get a plain message; the server log names what is
// missing so an administrator can fix it. Nothing is hidden or faked.
export class LibrarySetupError extends HttpError {
  constructor(public missing: string) {
    super(503, "De bibliotheek wordt nog ingericht. Probeer het later opnieuw.");
  }
}
const MISSING_TABLE = ["PGRST205", "42P01", "PGRST202", "42883"];
function setupCheck(error: { code?: string; message?: string } | null, what: string) {
  if (!error) return;
  const missing = MISSING_TABLE.includes(error.code || "") || /bucket not found|nosuchbucket/i.test(error.message || "");
  console.error(JSON.stringify({ event: missing ? "library_not_provisioned" : "library_db_error", missing: what, code: error.code || "storage" }));
  throw missing ? new LibrarySetupError(what) : new HttpError(503, "De bibliotheek is tijdelijk niet beschikbaar. Probeer het later opnieuw.");
}

// Optional storage limit per workspace. Without it Mavix shows usage only
// and does not invent a quota.
export function quotaBytes(): number | null {
  const n = Number(process.env.LIBRARY_QUOTA_BYTES);
  return Number.isFinite(n) && n > 0 ? n : null;
}
/** Storage limit of this workspace: its plan (Starter 500 MB, Growth 2 GB, Premium 5 GB), or the global override when lower. */
export async function quotaFor(workspaceId: string): Promise<number> {
  const plan = (await workspacePlan(workspaceId)).plan.storageBytes;
  const global = quotaBytes();
  return global !== null ? Math.min(global, plan) : plan;
}

async function ensureSystemAlbums(workspaceId: string) {
  const { error } = await db()
    .from("library_albums")
    .upsert(
      SYSTEM_ALBUMS.map((a) => ({ workspace_id: workspaceId, system_key: a.key, name: a.name })),
      { onConflict: "workspace_id,system_key", ignoreDuplicates: true },
    );
  setupCheck(error, "table library_albums");
}

async function usage(workspaceId: string) {
  const { data, error } = await db().rpc("library_usage", { p_workspace: workspaceId });
  setupCheck(error, "function library_usage");
  return Number(data) || 0;
}

export async function listLibrary(workspaceId: string, canEdit: boolean): Promise<LibraryData> {
  await ensureSystemAlbums(workspaceId);
  const [{ data: albums, error: aErr }, { data: files, error: fErr }, used] = await Promise.all([
    db().from("library_albums").select("id,name,description,system_key,created_at").eq("workspace_id", workspaceId).order("created_at"),
    db()
      .from("library_files")
      .select("id,name,kind,mime_type,size_bytes,album_id,storage_path,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(2000),
    usage(workspaceId),
  ]);
  setupCheck(aErr || fErr, "table library_files");
  const paths = (files || []).map((f) => f.storage_path as string);
  const signed = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 500) {
    const { data, error } = await db().storage.from(BUCKET).createSignedUrls(paths.slice(i, i + 500), 3600);
    setupCheck(error && /bucket/i.test(error.message) ? error : null, "storage bucket library");
    for (const s of data || []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }
  const counts = new Map<string, number>();
  for (const f of files || []) if (f.album_id) counts.set(f.album_id, (counts.get(f.album_id) || 0) + 1);
  const order = (key: string | null) => (key ? SYSTEM_ALBUMS.findIndex((a) => a.key === key) : 99);
  return {
    albums: (albums || [])
      .map((a) => ({
        id: a.id as string,
        name: a.name as string,
        description: a.description as string,
        system: !!a.system_key,
        count: counts.get(a.id) || 0,
        createdAt: a.created_at as string,
        order: order(a.system_key),
      }))
      .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
      .map(({ order: _o, ...a }) => a),
    files: (files || []).map((f) => ({
      id: f.id as string,
      name: f.name as string,
      kind: f.kind as LibraryKind,
      mimeType: f.mime_type as string,
      size: Number(f.size_bytes),
      albumId: (f.album_id as string) || null,
      createdAt: f.created_at as string,
      url: signed.get(f.storage_path as string) || "",
    })),
    usage: { used, quota: await quotaFor(workspaceId) },
    canEdit,
  };
}

async function albumInWorkspace(workspaceId: string, albumId: string | null | undefined) {
  if (!albumId) return null;
  if (!UUID.test(albumId)) throw new HttpError(400, "Onbekend album.");
  const { data } = await db().from("library_albums").select("id").eq("workspace_id", workspaceId).eq("id", albumId).maybeSingle();
  if (!data) throw new HttpError(404, "Album niet gevonden.");
  return albumId;
}

export async function uploadFiles(
  ctx: { workspaceId: string; userId: string },
  files: File[],
  options: { albumId?: string | null; kind?: LibraryKind },
) {
  if (!files.length) throw new HttpError(400, "Kies minimaal één bestand.");
  if (files.length > 20) throw new HttpError(400, "Upload maximaal 20 bestanden tegelijk.");
  const albumId = await albumInWorkspace(ctx.workspaceId, options.albumId);
  for (const f of files) {
    if (!LIBRARY_TYPES[f.type]) throw new HttpError(415, `"${cleanName(f.name)}" heeft een bestandstype dat niet wordt ondersteund.`);
    if (f.size > LIBRARY_MAX_BYTES) throw new HttpError(413, `"${cleanName(f.name)}" is groter dan 50 MB.`);
  }
  const quota = await quotaFor(ctx.workspaceId);
  {
    const total = files.reduce((n, f) => n + f.size, 0);
    if ((await usage(ctx.workspaceId)) + total > quota) throw new HttpError(413, "Er is niet genoeg opslag beschikbaar voor deze bestanden.");
  }
  const created: string[] = [];
  for (const f of files) {
    // The same file (name and size) is stored once per workspace.
    const { data: same } = await db().from("library_files").select("id").eq("workspace_id", ctx.workspaceId).eq("name", cleanName(f.name.replace(/\.[^.]+$/, "")) || "Bestand").eq("size_bytes", f.size).limit(1);
    if (same?.[0]) {
      created.push(same[0].id as string);
      continue;
    }
    const ext = (f.name.match(/\.([a-z0-9]{1,8})$/i)?.[1] || "bin").toLowerCase();
    const path = `${ctx.workspaceId}/${randomUUID()}.${ext}`;
    const { error: upErr } = await db().storage.from(BUCKET).upload(path, f, { contentType: f.type, upsert: false });
    if (upErr && /bucket/i.test(upErr.message)) setupCheck(upErr, "storage bucket library");
    if (upErr) throw new HttpError(502, "Uploaden is niet gelukt. Probeer het opnieuw.");
    const kind = options.kind && options.kind !== "other" ? options.kind : LIBRARY_TYPES[f.type];
    const { data, error } = await db()
      .from("library_files")
      .insert({
        workspace_id: ctx.workspaceId,
        album_id: albumId,
        name: cleanName(f.name.replace(/\.[^.]+$/, "")) || "Bestand",
        kind,
        mime_type: f.type,
        size_bytes: f.size,
        storage_path: path,
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error) {
      await db().storage.from(BUCKET).remove([path]);
      throw new HttpError(503, "Het bestand kon niet worden opgeslagen.");
    }
    created.push(data.id as string);
  }
  return created;
}

export async function updateFiles(
  workspaceId: string,
  ids: string[],
  patch: { name?: string; albumId?: string | null; kind?: LibraryKind },
) {
  if (!ids.length || ids.some((id) => !UUID.test(id))) throw new HttpError(400, "Ongeldige selectie.");
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) {
    if (ids.length !== 1) throw new HttpError(400, "Hernoem één bestand tegelijk.");
    const name = cleanName(patch.name);
    if (!name) throw new HttpError(400, "Geef het bestand een naam.");
    update.name = name;
  }
  if (patch.albumId !== undefined) update.album_id = await albumInWorkspace(workspaceId, patch.albumId);
  if (patch.kind) update.kind = patch.kind;
  const { error } = await db().from("library_files").update(update).eq("workspace_id", workspaceId).in("id", ids);
  if (error) throw error;
}

export async function deleteFiles(workspaceId: string, ids: string[]) {
  if (!ids.length || ids.some((id) => !UUID.test(id))) throw new HttpError(400, "Ongeldige selectie.");
  const { data: rows, error } = await db().from("library_files").select("id,storage_path").eq("workspace_id", workspaceId).in("id", ids);
  if (error) throw error;
  if (!rows?.length) return 0;
  const { error: rmErr } = await db().storage.from(BUCKET).remove(rows.map((r) => r.storage_path as string));
  if (rmErr) throw new HttpError(502, "Verwijderen uit de opslag is niet gelukt.");
  const { error: delErr } = await db().from("library_files").delete().eq("workspace_id", workspaceId).in("id", rows.map((r) => r.id));
  if (delErr) throw delErr;
  return rows.length;
}

/**
 * Stores one image (AI result or a photo moved out of a post) in the
 * Bibliotheek. The same bytes are stored once per workspace: the content
 * hash is part of the name, and an existing file with that name and size is
 * reused instead of uploading a copy. Returns the library file id.
 */
export async function storeImage(ctx: { workspaceId: string; userId: string | null }, bytes: Buffer, o: { kind: "ai" | "image"; mime: string }) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(o.mime)) throw new HttpError(415, "Dit afbeeldingstype wordt niet ondersteund.");
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const name = (o.kind === "ai" ? "AI-afbeelding " : "Foto ") + hash;
  const { data: existing, error: findError } = await db().from("library_files").select("id").eq("workspace_id", ctx.workspaceId).eq("name", name).eq("size_bytes", bytes.length).limit(1);
  setupCheck(findError, "library_files");
  if (existing?.[0]) return existing[0].id as string;
  const quota = await quotaFor(ctx.workspaceId);
  if ((await usage(ctx.workspaceId)) + bytes.length > quota) throw new HttpError(413, "Er is niet genoeg opslag beschikbaar in je Bibliotheek.");
  const path = `${ctx.workspaceId}/${randomUUID()}.${o.mime.split("/")[1] === "jpeg" ? "jpg" : o.mime.split("/")[1]}`;
  const { error: upErr } = await db().storage.from(BUCKET).upload(path, bytes, { contentType: o.mime, upsert: false });
  if (upErr && /bucket/i.test(upErr.message)) setupCheck(upErr, "storage bucket library");
  if (upErr) throw new HttpError(502, "De afbeelding kon niet worden opgeslagen.");
  const { data, error } = await db()
    .from("library_files")
    .insert({ workspace_id: ctx.workspaceId, album_id: null, name, kind: o.kind, mime_type: o.mime, size_bytes: bytes.length, storage_path: path, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !data) {
    await db().storage.from(BUCKET).remove([path]);
    throw new HttpError(503, "De afbeelding kon niet worden opgeslagen.");
  }
  return data.id as string;
}

/** Signed URL to show an image (no download header), after the workspace check. */
export async function mediaUrl(workspaceId: string, id: string) {
  if (!UUID.test(id)) throw new HttpError(404, "Bestand niet gevonden.");
  const { data: f } = await db().from("library_files").select("storage_path,mime_type").eq("workspace_id", workspaceId).eq("id", id).maybeSingle();
  if (!f || !String(f.mime_type).startsWith("image/")) throw new HttpError(404, "Bestand niet gevonden.");
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(f.storage_path as string, 3600);
  if (error || !data) throw new HttpError(502, "De afbeelding kon niet worden geladen.");
  return data.signedUrl;
}

/** The bytes of one image in this workspace (for publishing and AI edits). */
export async function readImage(workspaceId: string, id: string): Promise<{ data: Buffer; mime: string }> {
  if (!UUID.test(id)) throw new HttpError(404, "Afbeelding niet gevonden.");
  const { data: f } = await db().from("library_files").select("storage_path,mime_type").eq("workspace_id", workspaceId).eq("id", id).maybeSingle();
  if (!f || !String(f.mime_type).startsWith("image/")) throw new HttpError(404, "Afbeelding niet gevonden.");
  const { data, error } = await db().storage.from(BUCKET).download(f.storage_path as string);
  if (error || !data) throw new HttpError(502, "De afbeelding kon niet worden geladen.");
  return { data: Buffer.from(await data.arrayBuffer()), mime: String(f.mime_type) };
}

export async function downloadUrl(workspaceId: string, id: string) {
  if (!UUID.test(id)) throw new HttpError(404, "Bestand niet gevonden.");
  const { data: f } = await db().from("library_files").select("name,storage_path").eq("workspace_id", workspaceId).eq("id", id).maybeSingle();
  if (!f) throw new HttpError(404, "Bestand niet gevonden.");
  const ext = (f.storage_path as string).split(".").pop();
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(f.storage_path as string, 120, { download: `${f.name}.${ext}` });
  if (error || !data) throw new HttpError(502, "Downloaden is niet gelukt.");
  return data.signedUrl;
}

export async function createAlbum(ctx: { workspaceId: string; userId: string }, name: string, description = "") {
  const clean = cleanName(name).slice(0, 80);
  if (!clean) throw new HttpError(400, "Geef het album een naam.");
  const { count } = await db().from("library_albums").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspaceId);
  if ((count || 0) >= 100) throw new HttpError(400, "Je kunt maximaal 100 albums maken.");
  const { data, error } = await db()
    .from("library_albums")
    .insert({ workspace_id: ctx.workspaceId, name: clean, description: description.trim().slice(0, 300), created_by: ctx.userId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateAlbum(workspaceId: string, id: string, patch: { name?: string; description?: string }) {
  if (!UUID.test(id)) throw new HttpError(404, "Album niet gevonden.");
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) {
    const clean = cleanName(patch.name).slice(0, 80);
    if (!clean) throw new HttpError(400, "Geef het album een naam.");
    update.name = clean;
  }
  if (patch.description !== undefined) update.description = patch.description.trim().slice(0, 300);
  const { data, error } = await db().from("library_albums").update(update).eq("workspace_id", workspaceId).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new HttpError(404, "Album niet gevonden.");
}

// Deleting an album keeps its files (they move to "Alle bestanden").
export async function deleteAlbum(workspaceId: string, id: string) {
  if (!UUID.test(id)) throw new HttpError(404, "Album niet gevonden.");
  const { data: album } = await db().from("library_albums").select("system_key").eq("workspace_id", workspaceId).eq("id", id).maybeSingle();
  if (!album) throw new HttpError(404, "Album niet gevonden.");
  if (album.system_key) throw new HttpError(400, "Standaardalbums kun je hernoemen, maar niet verwijderen.");
  const { error } = await db().from("library_albums").delete().eq("workspace_id", workspaceId).eq("id", id);
  if (error) throw error;
}
