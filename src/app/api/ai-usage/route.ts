import { NextResponse } from "next/server";
import { workspace, failure, limited } from "@/lib/server/access";
import { usageSummary } from "@/lib/server/ai-usage";
import { aiConfigured } from "@/lib/server/openai";

// This month's AI usage for the current workspace (owners and admins).
export async function GET() {
  try {
    const auth = await workspace(["OWNER", "ADMIN"]);
    await limited("ai-usage:" + auth.user.id, 60);
    return NextResponse.json({ ...(await usageSummary(auth.workspaceId)), configured: aiConfigured() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}
