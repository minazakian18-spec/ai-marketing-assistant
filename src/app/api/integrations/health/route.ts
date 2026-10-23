import { NextResponse } from "next/server";
import { workspace, failure } from "@/lib/server/access";
import { adminClient } from "@/lib/server/supabase";
import { metaConfigured } from "@/lib/server/meta";
import { healthFor, type ProviderId } from "@/lib/integration-health";
import { sendingCapability } from "@/lib/server/email-campaigns";

// Health per provider for the Integrations page and the Dashboard. Only
// booleans about platform setup are returned, never names or values of keys.
const PROVIDERS: ProviderId[] = ["gmail", "google_calendar", "google_business", "google_search_console", "instagram", "messenger", "whatsapp", "email_sending", "google_ads"];

export async function GET() {
  try {
    const auth = await workspace();
    const { data, error } = await adminClient().from("integration_connections").select("provider,status,scopes,last_synced_at,expires_at").eq("workspace_id", auth.workspaceId);
    if (error) throw error;
    const google = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.OAUTH_ENCRYPTION_KEY);
    const mail = sendingCapability();
    const health = PROVIDERS.map((provider) => {
      if (provider === "email_sending") return healthFor({ provider, platformReady: mail.ready, pendingApproval: mail.ready ? undefined : mail.message, connection: null });
      if (provider === "google_ads") return healthFor({ provider, platformReady: false, connection: null });
      const row = (data || []).find((c) => c.provider === provider && c.status !== "disconnected");
      return healthFor({
        provider,
        platformReady: provider.startsWith("google") || provider === "gmail" ? google : metaConfigured(provider as "instagram" | "messenger" | "whatsapp"),
        connection: row ? { status: row.status, scopes: row.scopes || [], lastSyncedAt: row.last_synced_at || null, expiresAt: row.expires_at || null } : null,
      });
    });
    return NextResponse.json({ health }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}
