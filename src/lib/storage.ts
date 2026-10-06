import { emailSettingsError, emailCampaignValid } from "./email-model.ts";
import { settingsError } from "./instagram-model.ts";
import { sampleContacts, contactValid } from "./contact-data.ts";
import {
  defaultReviewSettings,
  reviewSettingsError,
  reviewValid,
  sampleReviews,
} from "./review-model.ts";
import { sampleLibraryAssets, libraryAssetValid } from "./library-model.ts";
import { segmentValid, productValid, brandVoiceValid } from "./brand-model.ts";
import type { Workspace } from "./types";
import { localEventValid } from "./calendar/local.ts";
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
  contacts: sampleContacts(),
  review: { settings: defaultReviewSettings, reviews: sampleReviews() },
  library: sampleLibraryAssets(),
  account: { firstName: "", lastName: "", email: "", phone: "", photo: "" },
  notifications: {
    approval: true,
    scheduled: true,
    campaign: true,
    billing: true,
    updates: false,
  },
  integrations: {
    instagram: false,
    email: false,
    outlook: false,
    googleBusiness: false,
    website: false,
    shopify: false,
    woocommerce: false,
  },
};
// Migrates settings saved before Full Autopilot was folded into Auto Create:
// the old "full" mode becomes "auto" with requireApproval off, and older
// "auto"/"assist" settings (which always required approval) get that made explicit.
function migrateAutopilotMode(
  raw: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object") return raw;
  if (raw.mode === "full")
    return { ...raw, mode: "auto", requireApproval: false };
  if (typeof raw.requireApproval !== "boolean")
    return { ...raw, requireApproval: true };
  return raw;
}
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
  merged.contacts = Array.isArray(data.contacts)
    ? data.contacts
    : structuredClone(emptyWorkspace.contacts);
  merged.library = Array.isArray(data.library)
    ? data.library
    : structuredClone(emptyWorkspace.library);
  merged.review = data.review
    ? {
        settings: { ...defaultReviewSettings, ...data.review.settings },
        reviews: Array.isArray(data.review.reviews)
          ? data.review.reviews
          : structuredClone(sampleReviews()),
      }
    : structuredClone(emptyWorkspace.review);
  // Invalid Mavix calendar events are dropped rather than failing the load.
  if (merged.calendar)
    merged.calendar = {
      events: Array.isArray(merged.calendar.events)
        ? merged.calendar.events.filter(localEventValid)
        : [],
    };
  if (merged.instagram)
    merged.instagram = migrateAutopilotMode(merged.instagram);
  if (merged.email)
    merged.email = {
      ...merged.email,
      settings: migrateAutopilotMode(merged.email.settings),
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
  if (!merged.contacts.every(contactValid))
    throw new Error("Ongeldige contactgegevens");
  if (
    merged.email &&
    (emailSettingsError(merged.email.settings) ||
      !Array.isArray(merged.email.campaigns) ||
      !merged.email.campaigns.every(emailCampaignValid))
  )
    throw new Error("Ongeldige e-mailgegevens");
  if (!merged.library.every(libraryAssetValid))
    throw new Error("Ongeldige library-gegevens");
  if (
    reviewSettingsError(merged.review.settings) ||
    !merged.review.reviews.every(reviewValid)
  )
    throw new Error("Ongeldige reviewgegevens");
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
  if (
    merged.profile.segments &&
    (!Array.isArray(merged.profile.segments) ||
      !merged.profile.segments.every(segmentValid))
  )
    throw new Error("Ongeldige doelgroepsegmenten");
  if (
    merged.profile.productList &&
    (!Array.isArray(merged.profile.productList) ||
      !merged.profile.productList.every(productValid))
  )
    throw new Error("Ongeldige productgegevens");
  if (merged.profile.brandVoice && !brandVoiceValid(merged.profile.brandVoice))
    throw new Error("Ongeldige merkstem-instellingen");
  return merged;
}
export function writeWorkspace(data: Workspace) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
export function removeWorkspace() {
  localStorage.removeItem(STORAGE_KEY);
}
