import { NextResponse } from "next/server";
import { workspace, failure } from "@/lib/server/access";
import { workspacePlan } from "@/lib/server/plan";

// The workspace's plan and entitlements, for showing upgrade hints in the UI.
// The server enforces the same rules on every route; this is display only.
export async function GET() {
  try {
    const auth = await workspace();
    const wp = await workspacePlan(auth.workspaceId);
    return NextResponse.json(
      {
        state: wp.state,
        planId: wp.planId,
        name: wp.plan.name,
        entitlements: wp.plan.entitlements,
        credits: wp.plan.credits,
        periodEnd: wp.period.end.toISOString(),
        inspirationMax: wp.plan.inspirationMax,
        carouselSlides: wp.plan.carouselSlides,
        imageLimit: wp.plan.limits.image_generate ?? null,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
