import "server-only";
import { adminClient } from "./supabase";
import { HttpError } from "./access";

/**
 * Applies a server-side change to the workspace document with optimistic
 * locking: read data+version, apply, write only if the version is unchanged;
 * retry on a concurrent save. Browsers then see a newer version and reload
 * instead of overwriting the change.
 */
export async function mutateWorkspace<T>(workspaceId: string, change: (data: Record<string, unknown>) => { data: Record<string, unknown>; result: T }, attempts = 3): Promise<T> {
  const db = adminClient();
  for (let i = 0; i < attempts; i++) {
    const { data: row, error } = await db.from("business_profiles").select("data,version").eq("workspace_id", workspaceId).single();
    if (error || !row) throw new HttpError(503, "De werkruimte kon niet worden geladen.");
    const { data, result } = change((row.data || {}) as Record<string, unknown>);
    const { data: updated, error: saveError } = await db
      .from("business_profiles")
      .update({ data, version: (row.version as number) + 1, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("version", row.version)
      .select("version")
      .maybeSingle();
    if (saveError) throw new HttpError(503, "Opslaan is niet gelukt.");
    if (updated) return result;
  }
  throw new HttpError(409, "De werkruimte werd tegelijk gewijzigd. Probeer het opnieuw.");
}

/** Reads the workspace document (server-side, service role). */
export async function readWorkspace(workspaceId: string) {
  const { data, error } = await adminClient().from("business_profiles").select("data").eq("workspace_id", workspaceId).maybeSingle();
  if (error) throw new HttpError(503, "De werkruimte kon niet worden geladen.");
  return (data?.data || {}) as Record<string, unknown>;
}
