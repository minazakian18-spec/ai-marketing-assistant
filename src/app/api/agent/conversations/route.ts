import { NextResponse } from "next/server";
import { workspace, failure, limited } from "@/lib/server/access";
import { listConversations, listFolders } from "@/lib/server/agent-store";

// The caller's own conversations (private per user, per workspace), newest
// activity first, paginated with ?before=<last_message_at>. ?q= searches
// titles and message text; ?archived=1 lists the archive.
export async function GET(request: Request) {
  try {
    const auth = await workspace();
    await limited("agent-list:" + auth.user.id, 120);
    const url = new URL(request.url);
    const owner = { workspaceId: auth.workspaceId, userId: auth.user.id };
    const [list, folders] = await Promise.all([
      listConversations(owner, { archived: url.searchParams.get("archived") === "1", before: url.searchParams.get("before"), q: url.searchParams.get("q") }),
      listFolders(owner),
    ]);
    return NextResponse.json({ ...list, folders }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}
