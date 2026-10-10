import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, HttpError } from "@/lib/server/access";
import { channelStates, listConversations, unreadByChannel } from "@/lib/server/inbox";

const query = z.object({
  channel: z.enum(["gmail", "instagram", "messenger", "whatsapp"]).optional(),
  filter: z.enum(["open", "unread", "mine", "resolved"]).optional(),
  q: z.string().max(100).optional(),
  cursor: z.string().max(100).optional(),
  sort: z.enum(["newest", "oldest"]).optional(),
});

// Conversation list (30 per page) with channel states and unread counts
// (total and per channel).
export async function GET(request: Request) {
  try {
    const auth = await workspace();
    await limited("inbox-list:" + auth.user.id, 60);
    const params = query.parse(Object.fromEntries(new URL(request.url).searchParams));
    const [list, channels, unreadPerChannel] = await Promise.all([
      listConversations(auth.workspaceId, auth.user.id, params),
      channelStates(auth.workspaceId),
      unreadByChannel(auth.workspaceId),
    ]);
    const unread = Object.values(unreadPerChannel).reduce((a, b) => a + b, 0);
    return NextResponse.json({ ...list, channels, unread, unreadByChannel: unreadPerChannel, userId: auth.user.id }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige filter."));
    return failure(e);
  }
}
