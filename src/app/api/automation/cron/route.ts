import { NextResponse } from "next/server";
import { runScheduled } from "@/lib/server/automation";
import { runGoogleHealth } from "@/lib/server/google-health";
import { cronAuthorized } from "@/lib/server/cron-auth";

// Scheduler for permitted automations (scheduled Instagram posts, scheduled
// e-mail campaigns). Called by an external scheduler, e.g. a Hostinger cron
// job every 5 minutes, with "Authorization: Bearer <CRON_SECRET>".
export async function POST(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  try {
    // Google connections are checked once a day; a failure there never blocks the rest.
    const google = await runGoogleHealth().catch(() => ({ googleChecks: 0 }));
    return NextResponse.json({ ...(await runScheduled()), ...google });
  } catch {
    console.error(JSON.stringify({ event: "automation_cron_failed" }));
    return NextResponse.json({ error: "Mislukt." }, { status: 503 });
  }
}
