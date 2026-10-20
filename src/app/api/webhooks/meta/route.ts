import { after } from "next/server";
import { verifyChallenge, verifyMetaSignature } from "@/lib/inbox/core";
import { webhookSecrets } from "@/lib/server/meta";
import { processMetaWebhook } from "@/lib/server/inbox";
import { recordWebhookDiagnostic } from "@/lib/server/webhook-diagnostics";

// One public webhook for Instagram, Messenger and WhatsApp (Meta).
// GET: subscription handshake with META_WEBHOOK_VERIFY_TOKEN.
// POST: X-Hub-Signature-256 checked against the raw body before anything is
// parsed; answered with 200 right away and processed after the response.
// A missing server secret answers 503 (Meta retries POST deliveries) and logs
// the variable name only, never a value.

const notConfigured = (missing: string, object?: string) => {
  console.error(
    JSON.stringify({
      event: "meta_webhook_not_configured",
      missing,
      ...(object ? { object } : {}),
    }),
  );
  return new Response("Webhook not configured", { status: 503 });
};

export async function GET(request: Request) {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || "";
  if (!verifyToken) return notConfigured("META_WEBHOOK_VERIFY_TOKEN");
  const challenge = verifyChallenge(new URL(request.url).searchParams, verifyToken);
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
  // Instagram events: Meta app secret (Facebook Login) or, for older
  // connections, the Instagram app secret. Others: the Meta app secret.
  const secrets = webhookSecrets(object);
  if (!secrets.length) return notConfigured("META_CLIENT_SECRET", object.slice(0, 40));
  const signature = request.headers.get("x-hub-signature-256");
  // One line per delivery: that Meta sent something and whether the
  // signature is valid. Never the signature, body or secrets themselves.
  const valid = secrets.some((secret) => verifyMetaSignature(raw, signature, secret));
  console.info(JSON.stringify({ event: "meta_webhook_received", object: object.slice(0, 40), bytes: raw.length, signature: !signature ? "missing" : valid ? "valid" : "invalid", secrets: secrets.length }));
  if (!valid) {
    console.warn(JSON.stringify({ event: "meta_webhook_rejected", object: object.slice(0, 40) }));
    // Recorded as rejected only; nothing from an unverified body is trusted or processed.
    after(() => recordWebhookDiagnostic("rejected", object, { signature: signature ? "invalid" : "missing" }));
    return new Response(null, { status: 401 });
  }
  after(() => recordWebhookDiagnostic("verified", object, { bytes: raw.length }));
  after(async () => {
    try {
      await processMetaWebhook(payload);
    } catch (e) {
      const code = String((e as { code?: string })?.code || "error").slice(0, 20);
      console.error(JSON.stringify({ event: "meta_webhook_failed", object, code }));
      await recordWebhookDiagnostic("failed", object, { code });
    }
  });
  return new Response(null, { status: 200 });
}
