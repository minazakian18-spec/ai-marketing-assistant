import { NextResponse } from "next/server";
import { workspace, failure } from "@/lib/server/access";
import { unreadCount } from "@/lib/server/inbox";

// Number of conversations with unread messages, for the sidebar badge.
export async function GET() {
  try {
    const auth = await workspace();
    return NextResponse.json({ unread: await unreadCount(auth.workspaceId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}
