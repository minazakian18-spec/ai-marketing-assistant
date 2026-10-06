import { NextResponse } from "next/server";
import { z } from "zod";
import { workspace, failure, limited, sameOrigin, audit, HttpError } from "@/lib/server/access";
import { deleteFiles, updateFiles, uploadFiles } from "@/lib/server/library";

const kind = z.enum(["image", "video", "logo", "ai", "document", "other"]);
const ids = z.array(z.string().uuid()).min(1).max(500);

// Upload (multipart: files[], albumId?, kind?). Max 20 files of 50 MB.
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (Number(request.headers.get("content-length") || 0) > 210 * 1024 * 1024) throw new HttpError(413, "Upload minder bestanden tegelijk.");
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("library-upload:" + auth.user.id, 20);
    const form = await request.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    const albumId = (form.get("albumId") as string) || null;
    const parsedKind = form.get("kind") ? kind.parse(form.get("kind")) : undefined;
    const created = await uploadFiles({ workspaceId: auth.workspaceId, userId: auth.user.id }, files, { albumId, kind: parsedKind });
    await audit(auth.workspaceId, auth.user.id, "library_upload");
    return NextResponse.json({ ids: created });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldig bestandstype."));
    return failure(e);
  }
}

// Rename one file, or move/retype several.
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("library-edit:" + auth.user.id, 60);
    const body = z
      .object({ ids, name: z.string().max(200).optional(), albumId: z.string().uuid().nullable().optional(), kind: kind.optional() })
      .parse(await request.json());
    await updateFiles(auth.workspaceId, body.ids, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige wijziging."));
    return failure(e);
  }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("library-edit:" + auth.user.id, 60);
    const body = z.object({ ids }).parse(await request.json());
    const removed = await deleteFiles(auth.workspaceId, body.ids);
    await audit(auth.workspaceId, auth.user.id, "library_delete");
    return NextResponse.json({ removed });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige selectie."));
    return failure(e);
  }
}
