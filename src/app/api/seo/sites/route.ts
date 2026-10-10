import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, failure, HttpError, limited, sameOrigin, workspace } from "@/lib/server/access";
import { createSite, DAILY_SCANS, listSites, MAX_SITES } from "@/lib/server/seo";
import { gscConnection, gscStatus } from "@/lib/server/search-console";

// SEO websites of the current workspace (from the session, never the body).
export async function GET() {
  try {
    const auth = await workspace();
    await limited("seo-read:" + auth.user.id, 240);
    const [sites, gsc] = await Promise.all([listSites(auth.workspaceId), gscConnection(auth.workspaceId).catch(() => null)]);
    return NextResponse.json(
      { sites, searchConsole: gscStatus(gsc), limits: { sites: MAX_SITES, scansPerDay: DAILY_SCANS }, pagespeedKey: !!process.env.PAGESPEED_API_KEY, role: auth.role },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}

const input = z.object({ url: z.string().trim().min(3).max(500), focusKeyword: z.string().trim().max(80).optional() });

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("seo-sites:" + auth.user.id, 20);
    const site = await createSite(auth.workspaceId, auth.user.id, input.parse(await request.json()));
    await audit(auth.workspaceId, auth.user.id, "seo_site_added");
    return NextResponse.json({ site });
  } catch (e) {
    if (e instanceof z.ZodError) return failure(new HttpError(400, "Vul een geldig webadres in."));
    return failure(e);
  }
}