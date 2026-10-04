import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { conversationForAi } from "@/lib/server/inbox";
import { generateInboxReply, summarizeConversation } from "@/lib/server/ai";

type Context = { params: Promise<{ id: string }> };
const input = z.object({ action: z.enum(["reply", "summary"]), instruction: z.string().trim().max(500).optional() });

// "Mavi antwoord voorstellen" / summary. Returns a draft only; it is never
// sent automatically.
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
        : await summarizeConversation(conversation);
    return NextResponse.json({ text }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige aanvraag."));
    return failure(e);
  }
}
