import { NextResponse } from "next/server";
import { workspace, failure, limited } from "@/lib/server/access";
import { downloadUrl } from "@/lib/server/library";

type Context = { params: Promise<{ id: string }> };

// Redirects to a 2-minute signed download URL after checking membership.
export async function GET(_request: Request, { params }: Context) {
  try {
    const auth = await workspace();
    await limited("library-download:" + auth.user.id, 60);
    const { id } = await params;
    return NextResponse.redirect(await downloadUrl(auth.workspaceId, id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
