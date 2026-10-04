import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, HttpError } from "@/lib/server/access";
import { channelStates, listConversations, unreadCount } from "@/lib/server/inbox";

const query = z.object({
  channel: z.enum(["gmail", "instagram", "messenger", "whatsapp"]).optional(),
  filter: z.enum(["open", "unread", "mine", "resolved"]).optional(),
  q: z.string().max(100).optional(),
  cursor: z.string().max(100).optional(),
});

// Conversation list (30 per page) with channel states and the unread count.
export async function GET(request: Request) {
  try {
    const auth = await workspace();
    await limited("inbox-list:" + auth.user.id, 60);
    const params = query.parse(Object.fromEntries(new URL(request.url).searchParams));
    const [list, channels, unread] = await Promise.all([
      listConversations(auth.workspaceId, auth.user.id, params),
      channelStates(auth.workspaceId),
      unreadCount(auth.workspaceId),
    ]);
    return NextResponse.json({ ...list, channels, unread, userId: auth.user.id }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige filter."));
    return failure(e);
  }
}
