export type WorkspaceView = "overview" | "assist" | "auto" | "inbox";
export function workspaceView(
  tab: string | null,
  editing: boolean,
): WorkspaceView {
  if (editing) return "assist";
  if (tab === "create") return "assist";
  // "full" is a legacy tab value (from the old Full Autopilot mode) kept so old links still work.
  if (tab === "autopilot" || tab === "approvals" || tab === "full")
    return "auto";
  if (tab === "inbox" || tab === "berichten") return "inbox";
  return tab === "assist" || tab === "auto" ? tab : "overview";
}
export const modeName = (mode: string) =>
  mode === "auto" ? "Auto Create" : "Assist";
