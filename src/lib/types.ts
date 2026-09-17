import type { EmailCampaign, EmailSettings } from "./email-model";
import type { InstagramSettings, ContentType } from "./instagram-model";
export type Profile = {
  name: string;
  industry: string;
  audience: string;
  description: string;
  voice: string;
  website: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  vatNumber: string;
  products?: string;
  offers?: string;
  logo?: string;
  media?: string[];
  contentPreferences?: string;
};
export type Post = {
  id: string;
  prompt: string;
  caption: string;
  hashtags: string;
  status:
    | "draft"
    | "approved"
    | "scheduled"
    | "rejected"
    | "blocked"
    | "failed"
    | "published";
  contentType?: ContentType;
  source?: "manual" | "autopilot";
  media?: string[];
  videoMode?: string;
  duration?: number;
  failureReason?: string;
  date: string;
  createdAt: string;
  variant: number;
};
export type Account = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  photo: string;
};
export type Notifications = {
  approval: boolean;
  scheduled: boolean;
  campaign: boolean;
  billing: boolean;
  updates: boolean;
};
export type Integrations = { instagram: boolean; email: boolean };
export type Workspace = {
  instagram?: InstagramSettings;
  email?: { settings: EmailSettings; campaigns: EmailCampaign[] };
  profile: Profile;
  posts: Post[];
  account: Account;
  notifications: Notifications;
  integrations: Integrations;
};
