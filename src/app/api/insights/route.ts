import { NextResponse } from "next/server";
import { workspace, failure, limited } from "@/lib/server/access";
import { insights } from "@/lib/server/insights";

// Measured marketing results per source (see lib/server/insights.ts).
export async function GET() {
  try {
    const auth = await workspace();
    await limited("insights:" + auth.user.id, 20);
    return NextResponse.json(await insights(auth.workspaceId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}
