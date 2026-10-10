import "server-only";
import { adminClient } from "./supabase";
import { HttpError } from "./access";

// The Brand Hub profile as stored for this workspace. AI features read it on
// the server so a browser can never inject someone else's (or a forged)
// business context.
export async function storedProfile(workspaceId: string): Promise<Record<string, unknown>> {
  const { data, error } = await adminClient().from("business_profiles").select("data").eq("workspace_id", workspaceId).maybeSingle();
  if (error) throw new HttpError(503, "Je bedrijfsprofiel kon niet worden geladen.");
  return ((data?.data as { profile?: Record<string, unknown> } | undefined)?.profile || {}) as Record<string, unknown>;
}
