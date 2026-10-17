import { NextResponse } from "next/server";
import { workspace, failure, limited } from "@/lib/server/access";
import { mediaUrl } from "@/lib/server/library";

type Context = { params: Promise<{ id: string }> };

// Shows an image from the Bibliotheek (post images, AI images). Checks the
// session and workspace, then redirects to a signed URL valid for an hour.
// Used directly as <img src>; never public.
export async function GET(_request: Request, { params }: Context) {
  try {
    const auth = await workspace();
    await limited("library-media:" + auth.user.id, 600);
    const { id } = await params;
    return NextResponse.redirect(await mediaUrl(auth.workspaceId, id), { headers: { "Cache-Control": "private, max-age=600" } });
  } catch (e) {
    return failure(e);
  }
}
