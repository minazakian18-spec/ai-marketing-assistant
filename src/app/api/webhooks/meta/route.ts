import { after } from "next/server";
import { verifyChallenge, verifyMetaSignature } from "@/lib/inbox/core";
import { webhookSecret } from "@/lib/server/meta";
import { processMetaWebhook } from "@/lib/server/inbox";

// One public webhook for Instagram, Messenger and WhatsApp (Meta).
// GET: subscription handshake with META_WEBHOOK_VERIFY_TOKEN.
// POST: X-Hub-Signature-256 checked against the raw body before anything is
// parsed; answered with 200 right away and processed after the response.

export async function GET(request: Request) {
  const challenge = verifyChallenge(new URL(request.url).searchParams, process.env.META_WEBHOOK_VERIFY_TOKEN || "");
  return challenge
    ? new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } })
    : new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > 1_000_000) return new Response(null, { status: 413 });
  let payload: unknown;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return new Response(null, { status: 400 });
  }
  const object = String((payload as { object?: string })?.object || "");
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), webhookSecret(object))) {
    console.warn(JSON.stringify({ event: "meta_webhook_rejected", object }));
    return new Response(null, { status: 401 });
  }
  after(async () => {
    try {
      await processMetaWebhook(payload);
    } catch (e) {
      console.error(JSON.stringify({ event: "meta_webhook_failed", object, code: (e as { code?: string })?.code || "error" }));
    }
  });
  return new Response(null, { status: 200 });
}
