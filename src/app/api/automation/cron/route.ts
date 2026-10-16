import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runScheduled } from "@/lib/server/automation";

// Scheduler for permitted automations (scheduled Instagram posts, scheduled
// e-mail campaigns). Called by an external scheduler, e.g. a Hostinger cron
// job every 5 minutes, with "Authorization: Bearer <CRON_SECRET>".
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  const a = Buffer.from((request.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""));
  const b = Buffer.from(secret);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  try {
    return NextResponse.json(await runScheduled());
  } catch {
    console.error(JSON.stringify({ event: "automation_cron_failed" }));
    return NextResponse.json({ error: "Mislukt." }, { status: 503 });
  }
}
