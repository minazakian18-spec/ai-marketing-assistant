// Bibliotheek types and rules shared by the API and the browser.

export type LibraryKind = "image" | "video" | "logo" | "ai" | "document" | "other";

export const KIND_LABEL: Record<LibraryKind, string> = {
  image: "Afbeelding",
  video: "Video",
  logo: "Logo",
  ai: "AI-creatie",
  document: "Document",
  other: "Bestand",
};

// Accepted uploads (must match the bucket's allowed_mime_types).
export const LIBRARY_TYPES: Record<string, LibraryKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/svg+xml": "logo",
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
  "application/pdf": "document",
  "text/plain": "document",
  "text/csv": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "document",
};
export const LIBRARY_MAX_BYTES = 50 * 1024 * 1024;

export const SYSTEM_ALBUMS: { key: string; name: string }[] = [
  { key: "instagram", name: "Instagram" },
  { key: "email", name: "E-mail" },
  { key: "ads", name: "Advertenties" },
  { key: "products", name: "Productfoto's" },
  { key: "brand", name: "Brand assets" },
  { key: "videos", name: "Video's" },
  { key: "ai", name: "AI-creaties" },
];

export type LibraryFile = {
  id: string;
  name: string;
  kind: LibraryKind;
  mimeType: string;
  size: number;
  albumId: string | null;
  createdAt: string;
  url: string; // short-lived signed URL (preview)
};

export type LibraryAlbum = {
  id: string;
  name: string;
  description: string;
  system: boolean;
  count: number;
  createdAt: string;
};

export type LibraryData = {
  albums: LibraryAlbum[];
  files: LibraryFile[];
  usage: { used: number; quota: number | null };
  canEdit: boolean;
};

export function formatBytes(n: number) {
  if (n < 1024) return n + " B";
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return new Intl.NumberFormat("nl-NL", { maximumFractionDigits: v < 10 ? 1 : 0 }).format(v) + " " + units[i];
}

export function cleanName(name: string) {
  return name.replace(/[\u0000-\u001f\u007f/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}
