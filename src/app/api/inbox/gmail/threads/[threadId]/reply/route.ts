import { NextResponse } from "next/server";
import { z } from "zod";
import {
  workspace,
  sameOrigin,
  limited,
  failure,
  HttpError,
} from "@/lib/server/access";
import { replyGmailThread } from "@/lib/server/gmail";
const input = z.object({ body: z.string().trim().min(1).max(20000) }).strict();
export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("gmail-send:" + auth.workspaceId, 20);
    const { body } = input.parse(await request.json());
    const { threadId } = await params;
    return NextResponse.json(
      await replyGmailThread(auth.workspaceId, threadId, body),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(
      e instanceof z.ZodError || e instanceof SyntaxError
        ? new HttpError(400, "Controleer je bericht.")
        : e,
    );
  }
}
