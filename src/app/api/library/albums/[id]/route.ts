import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { deleteAlbum, updateAlbum } from "@/lib/server/library";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("library-edit:" + auth.user.id, 60);
    const { id } = await params;
    const body = z.object({ name: z.string().max(80).optional(), description: z.string().max(300).optional() }).parse(await request.json());
    await updateAlbum(auth.workspaceId, id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige albumgegevens."));
    return failure(e);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("library-edit:" + auth.user.id, 60);
    const { id } = await params;
    await deleteAlbum(auth.workspaceId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
