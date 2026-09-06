import type { Workspace } from "./types";
export const STORAGE_KEY = "marketing-ai.workspace.v1";
export const emptyWorkspace: Workspace = {
  profile: {
    name: "",
    industry: "",
    audience: "",
    description: "",
    voice: "Persoonlijk en enthousiast",
  },
  posts: [],
};
export function readWorkspace(): Workspace {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyWorkspace;
  const data = JSON.parse(raw);
  if (
    !data ||
    !data.profile ||
    !["name", "industry", "audience", "description", "voice"].every(
      (k) => typeof data.profile[k] === "string",
    ) ||
    !Array.isArray(data.posts) ||
    !data.posts.every(
      (p: Record<string, unknown>) =>
        p &&
        ["id", "prompt", "caption", "hashtags", "date", "createdAt"].every(
          (k) => typeof p[k] === "string",
        ) &&
        ["draft", "approved", "scheduled"].includes(String(p.status)) &&
        typeof p.variant === "number",
    )
  )
    throw new Error("Ongeldige lokale gegevens");
  return data;
}
export function writeWorkspace(data: Workspace) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
