import { NextResponse, after } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dueSites, runScan, startScan } from "@/lib/server/seo";

// Scheduled SEO scans. Called by an external scheduler (for example a
// Hostinger cron job) with "Authorization: Bearer <CRON_SECRET>". Starts at
// most 3 due scans per call; they run one after another after the response.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  const given = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  const started: string[] = [];
  for (const site of await dueSites(3)) {
    try {
      started.push(await startScan(site.workspace_id, site.id, null, "scheduled"));
    } catch (e) {
      console.warn(JSON.stringify({ event: "seo_cron_skipped", code: (e as { status?: number }).status || "error" }));
    }
  }
  after(async () => {
    for (const id of started) await runScan(id);
  });
  return NextResponse.json({ started: started.length });
}