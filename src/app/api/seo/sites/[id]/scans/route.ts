import { NextResponse, after } from "next/server";
import { audit, failure, limited, sameOrigin, workspace } from "@/lib/server/access";
import { listScans, runScan, startScan } from "@/lib/server/seo";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const auth = await workspace();
    await limited("seo-read:" + auth.user.id, 240);
    return NextResponse.json({ scans: await listScans(auth.workspaceId, (await params).id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}

// Start an analysis. Answered at once (202); the crawl runs after the response.
export async function POST(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const auth = await workspace();
    await limited("seo-scan:" + auth.workspaceId, 5);
    const id = await startScan(auth.workspaceId, (await params).id, auth.user.id, "manual");
    await audit(auth.workspaceId, auth.user.id, "seo_scan_started");
    after(() => runScan(id));
    return NextResponse.json({ id }, { status: 202 });
  } catch (e) {
    return failure(e);
  }
}