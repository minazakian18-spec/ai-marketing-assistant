import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, failure, HttpError, sameOrigin, workspace } from "@/lib/server/access";
import { deleteSite, updateSite } from "@/lib/server/seo";
import { listProperties } from "@/lib/server/search-console";

type Context = { params: Promise<{ id: string }> };
const patch = z
  .object({
    focusKeyword: z.string().trim().max(80).optional(),
    schedule: z.enum(["off", "weekly", "monthly"]).optional(),
    gscProperty: z.string().max(300).nullable().optional(),
  })
  .strict();

export async function PATCH(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    const { id } = await params;
    const body = patch.parse(await request.json());
    // A Search Console property is only stored when Google lists it for this connection.
    if (body.gscProperty) {
      const props = await listProperties(auth.workspaceId);
      if (!props.some((p) => p.siteUrl === body.gscProperty)) throw new HttpError(403, "Deze Search Console-property is niet beschikbaar voor het gekoppelde Google-account.");
    }
    const site = await updateSite(auth.workspaceId, id, body);
    return NextResponse.json({ site });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Ongeldige instelling."));
    return failure(e);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await deleteSite(auth.workspaceId, (await params).id);
    await audit(auth.workspaceId, auth.user.id, "seo_site_removed");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}