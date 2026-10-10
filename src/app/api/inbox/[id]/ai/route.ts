import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { conversationForAi } from "@/lib/server/inbox";
import { generateInboxReply, rewriteInboxReply, summarizeConversation } from "@/lib/server/ai";

type Context = { params: Promise<{ id: string }> };
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), instruction: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("summary") }),
  z.object({
    action: z.literal("rewrite"),
    draft: z.string().trim().min(1).max(4000),
    style: z.enum(["professional", "friendly", "formal", "shorter", "longer"]),
  }),
]);

// "Mavi antwoord voorstellen", rewriting a draft (tone/length) and summaries.
// Returns a draft only; it is never sent automatically.
export async function POST(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("inbox-ai:" + auth.user.id, 10);
    await limited("inbox-ai-ws:" + auth.workspaceId, 40);
    const { id } = await params;
    const body = input.parse(await request.json());
    const conversation = await conversationForAi(auth.workspaceId, id);
    const text =
      body.action === "reply"
        ? await generateInboxReply(conversation, body.instruction)
        : body.action === "rewrite"
          ? await rewriteInboxReply(conversation, body.draft, body.style)
          : await summarizeConversation(conversation);
    return NextResponse.json({ text }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige aanvraag."));
    return failure(e);
  }
}
