import type { EmailCampaign, EmailSettings } from "./email-model";
import type { InstagramSettings, ContentType } from "./instagram-model";
import type { Review, ReviewAutoReplySettings } from "./review-model";
import type { LocalCalendarEvent } from "./calendar/local";
import type { LibraryAsset } from "./library-model";
import type { AudienceSegment, Product, BrandVoice } from "./brand-model";
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
  segments?: AudienceSegment[];
  productList?: Product[];
  brandVoice?: BrandVoice;
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
export type ContactStatus = "Ingeschreven" | "Niet bevestigd" | "Uitgeschreven";
export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  group?: string;
  status: ContactStatus;
  source: "manual" | "import" | "sample";
  createdAt: string;
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
export type Integrations = {
  instagram: boolean;
  email: boolean;
  outlook: boolean;
  googleBusiness: boolean;
  website: boolean;
  shopify: boolean;
  woocommerce: boolean;
};
export type Workspace = {
  instagram?: InstagramSettings;
  email?: { settings: EmailSettings; campaigns: EmailCampaign[] };
  review: { settings: ReviewAutoReplySettings; reviews: Review[] };
  library: LibraryAsset[];
  profile: Profile;
  posts: Post[];
  contacts: Contact[];
  account: Account;
  notifications: Notifications;
  integrations: Integrations;
  // Events in Mavix' own calendars (src/lib/calendar/local.ts).
  calendar?: { events: LocalCalendarEvent[] };
};
