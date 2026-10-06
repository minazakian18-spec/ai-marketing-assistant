import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, HttpError } from "@/lib/server/access";
import { createAlbum } from "@/lib/server/library";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("library-edit:" + auth.user.id, 60);
    const body = z.object({ name: z.string().trim().min(1).max(80), description: z.string().max(300).optional() }).parse(await request.json());
    const id = await createAlbum({ workspaceId: auth.workspaceId, userId: auth.user.id }, body.name, body.description);
    return NextResponse.json({ id });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Geef het album een naam (maximaal 80 tekens)."));
    return failure(e);
  }
}
