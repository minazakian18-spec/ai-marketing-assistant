import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { deleteConversation, getConversation, listMessages, updateConversation } from "@/lib/server/agent-store";

type Context = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "private, no-store" };
const patch = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    folderId: z.string().uuid().nullable().optional(),
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0);

const owner = (auth: { workspaceId: string; user: { id: string } }) => ({ workspaceId: auth.workspaceId, userId: auth.user.id });

// One conversation with its newest messages (?before=<created_at> for older).
export async function GET(request: Request, { params }: Context) {
  try {
    const auth = await workspace();
    await limited("agent-read:" + auth.user.id, 240);
    const { id } = await params;
    const o = owner(auth);
    const [conversation, page] = await Promise.all([getConversation(o, id), listMessages(o, id, new URL(request.url).searchParams.get("before"))]);
    return NextResponse.json({ conversation, ...page }, { headers });
  } catch (e) {
    return failure(e);
  }
}

// Rename, move to a folder (or out of it), pin, archive or restore.
export async function PATCH(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("agent-edit:" + auth.user.id, 60);
    const body = patch.parse(await request.json());
    return NextResponse.json({ conversation: await updateConversation(owner(auth), (await params).id, body) }, { headers });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige wijziging."));
    return failure(e);
  }
}

// Permanently deletes this conversation and its messages (confirmed in the UI).
export async function DELETE(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("agent-edit:" + auth.user.id, 60);
    await deleteConversation(owner(auth), (await params).id);
    return NextResponse.json({ ok: true }, { headers });
  } catch (e) {
    return failure(e);
  }
}
