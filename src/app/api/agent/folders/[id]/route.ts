import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { deleteFolder, renameFolder, setFolderInstructions } from "@/lib/server/agent-store";

type Context = { params: Promise<{ id: string }> };
const input = z.union([z.object({ name: z.string().trim().min(1).max(60) }).strict(), z.object({ instructions: z.string().max(2000) }).strict()]);
const headers = { "Cache-Control": "private, no-store" };

export async function PATCH(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("agent-edit:" + auth.user.id, 60);
    const body = input.parse(await request.json());
    const owner = { workspaceId: auth.workspaceId, userId: auth.user.id };
    const id = (await params).id;
    // Project instructions: plain text the agent follows in this project's conversations.
    if ("instructions" in body) return NextResponse.json({ folder: await setFolderInstructions(owner, id, body.instructions) }, { headers });
    return NextResponse.json({ folder: await renameFolder(owner, id, body.name) }, { headers });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Geef het project een naam van maximaal 60 tekens en instructies van maximaal 2000 tekens."));
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
