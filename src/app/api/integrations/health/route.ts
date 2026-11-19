import { NextResponse } from "next/server";
import { workspace, failure } from "@/lib/server/access";
import { adminClient } from "@/lib/server/supabase";
import { metaConfigured } from "@/lib/server/meta";
import { healthFor, type ProviderId } from "@/lib/integration-health";
import { sendingCapability } from "@/lib/server/email-campaigns";
import { CHECK_FRESH_MS, checkGoogleConnection, GOOGLE_PROVIDERS, lastCheck } from "@/lib/server/google-health";

// Health per provider for the Integrations page and the Dashboard. Only
// booleans about platform setup are returned, never names or values of keys.
// Google connections that were not proven to work in the last 24 hours get a
// real check first (token refresh at Google, src/lib/server/google-health.ts).
const PROVIDERS: ProviderId[] = ["gmail", "google_calendar", "google_business", "google_search_console", "instagram", "email_sending", "google_ads"];

export async function GET() {
  try {
    const auth = await workspace();
    const query = () => adminClient().from("integration_connections").select("id,workspace_id,provider,status,scopes,last_synced_at,expires_at,encrypted_credentials,connection_generation,metadata").eq("workspace_id", auth.workspaceId);
    let { data, error } = await query();
    if (error) throw error;
    const stale = (data || []).filter((c) => (GOOGLE_PROVIDERS as readonly string[]).includes(c.provider) && c.status === "connected" && !isFresh(c.metadata));
    if (stale.length) {
      await Promise.all(stale.map((c) => checkGoogleConnection(c as Parameters<typeof checkGoogleConnection>[0]).catch(() => null)));
      ({ data, error } = await query());
      if (error) throw error;
    }
    const google = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.OAUTH_ENCRYPTION_KEY);
    const mail = sendingCapability();
    const health = PROVIDERS.map((provider) => {
      if (provider === "email_sending") return healthFor({ provider, platformReady: mail.ready, pendingApproval: mail.ready ? undefined : mail.message, connection: null });
      if (provider === "google_ads") return healthFor({ provider, platformReady: false, connection: null });
      const row = (data || []).find((c) => c.provider === provider && c.status !== "disconnected");
      return healthFor({
        provider,
        platformReady: provider.startsWith("google") || provider === "gmail" ? google : metaConfigured(provider as "instagram"),
        connection: row ? { status: row.status, scopes: row.scopes || [], lastSyncedAt: row.last_synced_at || lastCheck(row.metadata)?.at || null, expiresAt: row.expires_at || null } : null,
        verified: (GOOGLE_PROVIDERS as readonly string[]).includes(provider) ? isFresh(row?.metadata) : undefined,
      });
    });
    return NextResponse.json({ health }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return failure(e);
  }
}

function isFresh(metadata: unknown) {
  const c = lastCheck(metadata);
  return !!c && c.ok && Date.now() - Date.parse(c.at) < CHECK_FRESH_MS;
}
