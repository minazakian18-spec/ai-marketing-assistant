import { emailSettingsError, emailCampaignValid } from "./email-model.ts";
import { settingsError } from "./instagram-model.ts";
import type { Workspace } from "./types";
export const STORAGE_KEY = "marketing-ai.workspace.v1";
export const emptyWorkspace: Workspace = {
  profile: {
    name: "",
    industry: "",
    audience: "",
    description: "",
    voice: "Persoonlijk en enthousiast",
    website: "",
    phone: "",
    address: "",
    postalCode: "",
    city: "",
    country: "",
    vatNumber: "",
  },
  posts: [],
  account: { firstName: "", lastName: "", email: "", phone: "", photo: "" },
  notifications: {
    approval: true,
    scheduled: true,
    campaign: true,
    billing: true,
    updates: false,
  },
  integrations: { instagram: false, email: false },
};
export function readWorkspace(): Workspace {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(emptyWorkspace);
  const data = JSON.parse(raw);
  if (
    !data?.profile ||
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
        [
          "draft",
          "approved",
          "scheduled",
          "rejected",
          "blocked",
          "failed",
          "published",
        ].includes(String(p.status)) &&
        typeof p.variant === "number",
    )
  )
    throw new Error("Ongeldige lokale gegevens");
  // Preserve the original storage key and migrate existing MVP data in memory.
  const merged = {
    ...data,
    profile: { ...emptyWorkspace.profile, ...data.profile },
    account: { ...emptyWorkspace.account, ...data.account },
    notifications: { ...emptyWorkspace.notifications, ...data.notifications },
    integrations: { ...emptyWorkspace.integrations, ...data.integrations },
  };
  if (
    !Object.keys(emptyWorkspace.profile).every(
      (k) => typeof merged.profile[k] === "string",
    ) ||
    !Object.keys(emptyWorkspace.account).every(
      (k) => typeof merged.account[k] === "string",
    ) ||
    !Object.keys(emptyWorkspace.notifications).every(
      (k) => typeof merged.notifications[k] === "boolean",
    ) ||
    !Object.keys(emptyWorkspace.integrations).every(
      (k) => typeof merged.integrations[k] === "boolean",
    )
  )
    throw new Error("Ongeldige lokale gegevens");
  if (
    merged.account.photo &&
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
      merged.account.photo,
    )
  )
    throw new Error("Ongeldige profielfoto");
  if (merged.instagram && settingsError(merged.instagram))
    throw new Error("Ongeldige Instagram-instellingen");
  if (
    merged.email &&
    (emailSettingsError(merged.email.settings) ||
      !Array.isArray(merged.email.campaigns) ||
      !merged.email.campaigns.every(emailCampaignValid))
  )
    throw new Error("Ongeldige e-mailgegevens");
  const imageValid = (v: unknown) =>
    typeof v === "string" &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v);
  if (
    (merged.profile.logo && !imageValid(merged.profile.logo)) ||
    (merged.profile.media &&
      (!Array.isArray(merged.profile.media) ||
        !merged.profile.media.every(imageValid)))
  )
    throw new Error("Ongeldige merkafbeeldingen");
  return merged;
}
export function writeWorkspace(data: Workspace) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
export function removeWorkspace() {
  localStorage.removeItem(STORAGE_KEY);
}
