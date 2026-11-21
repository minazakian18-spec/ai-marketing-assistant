import { NextResponse } from "next/server";
import { runScheduled } from "@/lib/server/automation";
import { runGoogleHealth } from "@/lib/server/google-health";
import { cronAuthorized } from "@/lib/server/cron-auth";

// Planner: call every 5 minutes (Hostinger cron) with
// "Authorization: Bearer <CRON_SECRET>". Publishes due posts and campaigns
// that have an explicit automation permission; posts more than 6 hours late
// are never published on their own but become "Gemist" (post now / plan again).
// Google connections are health-checked at most once a day per workspace.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  try {
    const google = await runGoogleHealth().catch(() => ({ googleChecks: 0 }));
    return NextResponse.json({ ...(await runScheduled()), ...google });
  } catch {
    console.error(JSON.stringify({ event: "publish_cron_failed" }));
    return NextResponse.json({ error: "Mislukt." }, { status: 503 });
  }
}
export const GET = POST;
