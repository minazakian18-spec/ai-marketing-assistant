import { NextResponse } from "next/server";
import { workspace, failure, limited } from "@/lib/server/access";
import { creditSummary, usageSummary } from "@/lib/server/ai-usage";
import { aiConfigured } from "@/lib/server/openai";

// AI credits and usage of this period for the workspace (owners and admins).
// Customers see credits and counts; model costs in USD stay with Mavix
// administrators (/beheer).
export async function GET() {
  try {
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("ai-usage:" + auth.user.id, 60);
    const [credits, usage] = await Promise.all([creditSummary(auth.workspaceId), usageSummary(auth.workspaceId)]);
    const { costMicroUsd: _cost, pricesConfigured: _p, ...rest } = usage;
    void _cost;
    void _p;
    return NextResponse.json({ ...rest, ...credits, configured: aiConfigured() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}
