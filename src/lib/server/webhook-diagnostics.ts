import "server-only";
import { adminClient } from "./supabase";

// Minimal, durable diagnostics for Meta webhook delivery, stored as audit_log
// events without a workspace (audit_logs has RLS and no policies: only the
// server and Mavix administrators, via /api/admin, can read them).
// Stored: the stage, the object type and counts; for unmatched deliveries the
// business account id. Never message contents, sender ids, tokens, secrets or
// signatures. A diagnostics problem never affects webhook handling.

export const DIAG_PREFIX = "meta_webhook:";
const OBJECTS = new Set(["instagram", "page", "whatsapp_business_account"]);
const PER_MINUTE = 30;
const KEEP_DAYS = 14;

export type DiagStage = "rejected" | "verified" | "processed" | "unmatched" | "failed";

export function diagEvent(stage: DiagStage, object: string, details: Record<string, string | number> = {}) {
  const obj = OBJECTS.has(object) ? object : "other";
  const parts = Object.entries(details)
    .filter(([k, v]) => /^[a-z]{1,20}$/.test(k) && /^[\w,.-]{0,80}$/.test(String(v)))
    .map(([k, v]) => k + "=" + v);
  return [DIAG_PREFIX + obj, stage, ...parts].join(":").slice(0, 300);
}

export async function recordWebhookDiagnostic(stage: DiagStage, object: string, details: Record<string, string | number> = {}) {
  try {
    const db = adminClient();
    // Rate limit: at most PER_MINUTE diagnostic rows per minute in total.
    const { data: allowed, error: rlError } = await db.rpc("consume_rate_limit", { p_key: "meta_webhook_diag", p_limit: PER_MINUTE, p_window: 60 });
    if (rlError || !allowed) return;
    await db.from("audit_logs").insert({ workspace_id: null, actor_id: null, event: diagEvent(stage, object, details) });
    // Occasional cleanup of old diagnostics (only these events).
    if (Math.random() < 0.05)
      await db.from("audit_logs").delete().ilike("event", DIAG_PREFIX + "%").lt("created_at", new Date(Date.now() - KEEP_DAYS * 86400000).toISOString());
  } catch {
    /* diagnostics must never break webhook handling */
  }
}
