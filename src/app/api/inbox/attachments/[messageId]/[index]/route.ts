import { workspace, failure, limited } from "@/lib/server/access";
import { attachment } from "@/lib/server/inbox";

type Context = { params: Promise<{ messageId: string; index: string }> };
const INLINE = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

// Authenticated attachment proxy. Customer files are untrusted: only plain
// raster images are shown inline; everything else downloads, with nosniff
// and a sandboxing CSP.
export async function GET(_request: Request, { params }: Context) {
  try {
    const auth = await workspace();
    await limited("inbox-attachment:" + auth.user.id, 60);
    const { messageId, index } = await params;
    const file = await attachment(auth.workspaceId, messageId, Number(index));
    const type = file.mimeType.toLowerCase().split(";")[0];
    const inline = INLINE.has(type);
    const name = (file.name || "bijlage").replace(/[^\w.\- ]/g, "_").slice(0, 150);
    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": inline ? type : "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(file.name || name)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
