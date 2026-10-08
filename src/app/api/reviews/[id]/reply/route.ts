import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, audit, HttpError } from "@/lib/server/access";
import { deleteReviewReply, putReviewReply } from "@/lib/server/google-business";

type Context = { params: Promise<{ id: string }> };
const input = z.object({ comment: z.string().trim().min(1).max(4096) }).strict();
const json = { headers: { "Cache-Control": "private, no-store" } };

// Create or update the public owner reply. Only Google's accepted reply is
// returned; Mavix never shows a reply that Google did not confirm.
export async function PUT(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("reviews-reply:" + auth.workspaceId, 30);
    const { comment } = input.parse(await request.json());
    const { id } = await params;
    const reply = await putReviewReply(auth.workspaceId, id, comment);
    await audit(auth.workspaceId, auth.user.id, "review_reply_saved");
    return NextResponse.json({ reply }, json);
  } catch (e) {
    if (e instanceof z.ZodError || e instanceof SyntaxError) return failure(new HttpError(400, "Schrijf een antwoord van maximaal 4.096 tekens."));
    return failure(e);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("reviews-reply:" + auth.workspaceId, 30);
    const { id } = await params;
    await deleteReviewReply(auth.workspaceId, id);
    await audit(auth.workspaceId, auth.user.id, "review_reply_deleted");
    return NextResponse.json({ ok: true }, json);
  } catch (e) {
    return failure(e);
  }
}
