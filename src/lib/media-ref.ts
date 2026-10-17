// Images in posts are stored in the Bibliotheek (private Supabase Storage,
// per workspace). A post only keeps a reference: the media route checks the
// session and workspace and redirects to a short-lived signed URL, so the
// reference works in <img> tags but never exposes a public file.
// Older posts may still hold data URLs; both forms are accepted everywhere.

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const REF = new RegExp(`^/api/library/media/(${UUID})$`, "i");

export const mediaRef = (fileId: string) => `/api/library/media/${fileId}`;
export const mediaIdOf = (src: string) => REF.exec(src)?.[1] || null;
export const isMediaRef = (src: string) => REF.test(src);
export const isDataImage = (src: string) => /^data:image\/(jpeg|png|webp);base64,/.test(src);
