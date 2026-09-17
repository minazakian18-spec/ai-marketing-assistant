export type WorkspaceView = "overview" | "assist" | "auto" | "full";
export function workspaceView(
  tab: string | null,
  editing: boolean,
  mode: string,
): WorkspaceView {
  if (editing) return "assist";
  if (tab === "create") return "assist";
  if (tab === "autopilot") return mode === "full" ? "full" : "auto";
  if (tab === "approvals") return "auto";
  return tab === "assist" || tab === "auto" || tab === "full"
    ? tab
    : "overview";
}
export const modeName = (mode: string) =>
  mode === "full"
    ? "Full Autopilot"
    : mode === "auto"
      ? "Auto Create"
      : "Assist";
