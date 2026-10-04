import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { getConversation, updateConversation } from "@/lib/server/inbox";

type Context = { params: Promise<{ id: string }> };

// One conversation with its newest 50 messages (or older ones via ?before=),
// context panel data and the messaging window. Opening it marks it read.
export async function GET(request: Request, { params }: Context) {
  try {
    const auth = await workspace();
    await limited("inbox-read:" + auth.user.id, 120);
    const { id } = await params;
    const before = new URL(request.url).searchParams.get("before") || undefined;
    return NextResponse.json(await getConversation(auth.workspaceId, id, before), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}

const patch = z
  .object({
    status: z.enum(["open", "pending", "resolved"]).optional(),
    assignedUserId: z.string().uuid().nullable().optional(),
    unread: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0);

export async function PATCH(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("inbox-update:" + auth.user.id, 60);
    const { id } = await params;
    await updateConversation(auth.workspaceId, id, patch.parse(await request.json()));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige wijziging."));
    return failure(e);
  }
}
