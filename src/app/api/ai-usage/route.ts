import { NextResponse } from "next/server";
import { workspace, failure, limited } from "@/lib/server/access";
import { usageSummary } from "@/lib/server/ai-usage";

// This month's AI usage for the current workspace (owners and admins).
export async function GET() {
  try {
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("ai-usage:" + auth.user.id, 60);
    return NextResponse.json({ ...(await usageSummary(auth.workspaceId)), configured: !!process.env.ANTHROPIC_API_KEY }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}
