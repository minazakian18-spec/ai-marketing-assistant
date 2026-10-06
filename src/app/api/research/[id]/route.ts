import { NextResponse } from "next/server";
import { workspace, failure, limited } from "@/lib/server/access";
import { getReport } from "@/lib/server/research";

type Context = { params: Promise<{ id: string }> };

// A stored report (this or an earlier month). Reading never regenerates it.
export async function GET(_request: Request, { params }: Context) {
  try {
    const auth = await workspace();
    await limited("research-read:" + auth.user.id, 120);
    const { id } = await params;
    const row = await getReport(auth.workspaceId, id);
    return NextResponse.json({ id: row.id, period: row.period, completedAt: row.completed_at, report: row.report }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}
