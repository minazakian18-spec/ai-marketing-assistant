import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { deleteFolder, renameFolder } from "@/lib/server/agent-store";

type Context = { params: Promise<{ id: string }> };
const input = z.object({ name: z.string().trim().min(1).max(60) });
const headers = { "Cache-Control": "private, no-store" };

export async function PATCH(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("agent-edit:" + auth.user.id, 60);
    const { name } = input.parse(await request.json());
    return NextResponse.json({ folder: await renameFolder({ workspaceId: auth.workspaceId, userId: auth.user.id }, (await params).id, name) }, { headers });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Geef de map een naam van maximaal 60 tekens."));
    return failure(e);
  }
}

// Deletes the folder only; its conversations stay, without a folder.
export async function DELETE(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("agent-edit:" + auth.user.id, 60);
    await deleteFolder({ workspaceId: auth.workspaceId, userId: auth.user.id }, (await params).id);
    return NextResponse.json({ ok: true }, { headers });
  } catch (e) {
    return failure(e);
  }
}
