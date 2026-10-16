import { NextResponse } from "next/server";
import { applyWebhookEvent, verifyWebhook } from "@/lib/server/email-campaigns";

// Delivery events from the e-mail provider (delivered, bounced, complained,
// opened, clicked). Signed with RESEND_WEBHOOK_SECRET (Svix); unsigned or
// stale requests are refused. Bounces and complaints suppress the address.
export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > 100_000 || !verifyWebhook(request.headers, body)) return NextResponse.json({ error: "Niet toegestaan." }, { status: 401 });
  try {
    await applyWebhookEvent(JSON.parse(body));
  } catch {
    console.error(JSON.stringify({ event: "email_webhook_failed" }));
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
