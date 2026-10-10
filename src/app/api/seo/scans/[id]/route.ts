import { NextResponse } from "next/server";
import { failure, limited, workspace } from "@/lib/server/access";
import { getScan } from "@/lib/server/seo";

type Context = { params: Promise<{ id: string }> };

// One analysis (progress while running, the full report when completed).
export async function GET(_request: Request, { params }: Context) {
  try {
    const auth = await workspace();
    await limited("seo-read:" + auth.user.id, 240);
    return NextResponse.json({ scan: await getScan(auth.workspaceId, (await params).id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}