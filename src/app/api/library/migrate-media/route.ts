import { NextResponse } from "next/server";
import { workspace, failure, limited, sameOrigin, audit } from "@/lib/server/access";
import { storeImage } from "@/lib/server/library";
import { mutateWorkspace, readWorkspace } from "@/lib/server/workspace-store";
import { isDataImage, mediaRef } from "@/lib/media-ref";
import type { Post } from "@/lib/types";

// Moves images that older posts still keep inside the workspace document
// (data URLs) into the Bibliotheek and replaces them with references. The
// same image is stored once (content hash). Safe to run more than once.
const MAX_PER_RUN = 40;

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("library-migrate:" + auth.user.id, 5);
    const ws = await readWorkspace(auth.workspaceId);
    const pending = ((ws.posts || []) as Post[]).flatMap((p) => (p.media || []).filter(isDataImage));
    const unique = [...new Set(pending)].slice(0, MAX_PER_RUN);
    const refs = new Map<string, string>();
    for (const src of unique) {
      const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(src)!;
      const id = await storeImage({ workspaceId: auth.workspaceId, userId: auth.user.id }, Buffer.from(m[2], "base64"), { kind: "image", mime: m[1] });
      refs.set(src, mediaRef(id));
    }
    // Replace only what was stored; concurrent edits are retried, never overwritten.
    const moved = await mutateWorkspace(auth.workspaceId, (data) => {
      let n = 0;
      const posts = ((data.posts || []) as Post[]).map((p) => ({ ...p, media: (p.media || []).map((s) => (refs.has(s) ? (n++, refs.get(s)!) : s)) }));
      return { data: { ...data, posts }, result: n };
    });
    await audit(auth.workspaceId, auth.user.id, "library_media_migrated").catch(() => {});
    return NextResponse.json({ moved, stored: refs.size, remaining: Math.max(0, new Set(pending).size - unique.length) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
