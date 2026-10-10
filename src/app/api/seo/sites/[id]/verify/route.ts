import { NextResponse } from "next/server";
import { audit, failure, limited, sameOrigin, workspace } from "@/lib/server/access";
import { verifySite } from "@/lib/server/seo";

type Context = { params: Promise<{ id: string }> };

// Ownership check (meta tag or file with the site's token).
export async function POST(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("seo-verify:" + auth.workspaceId, 10);
    const site = await verifySite(auth.workspaceId, (await params).id);
    await audit(auth.workspaceId, auth.user.id, "seo_site_verified");
    return NextResponse.json({ site });
  } catch (e) {
    return failure(e);
  }
}