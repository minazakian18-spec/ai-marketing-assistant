import { NextResponse } from "next/server";
import { workspace, failure, limited } from "@/lib/server/access";
import { hasRole } from "@/lib/security";
import { LibrarySetupError, listLibrary } from "@/lib/server/library";

// Albums, files (with short-lived preview URLs) and storage usage.
export async function GET() {
  try {
    const auth = await workspace();
    await limited("library-list:" + auth.user.id, 60);
    return NextResponse.json(await listLibrary(auth.workspaceId, hasRole(auth.role, ["OWNER", "ADMIN"])), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    // "setup": the page shows a friendly "being set up" state instead of an error.
    if (e instanceof LibrarySetupError) return NextResponse.json({ error: e.message, setup: true }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return failure(e);
  }
}
