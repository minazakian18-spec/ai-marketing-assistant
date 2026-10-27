import type { EmailCampaign, EmailSettings } from "./email-model";
import type { InstagramSettings, ContentType } from "./instagram-model";
import type { Review, ReviewAutoReplySettings } from "./review-model";
import type { LocalCalendarEvent } from "./calendar/local";
import type { LibraryAsset } from "./library-model";
import type { MarketingCopy } from "./studio";
import type { Campaign, ContentVersion } from "./campaigns";
import type { AudienceSegment, Product, BrandVoice } from "./brand-model";
import type { BrandStrategy } from "./brand-strategy";
import type { Goal } from "./insights";
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
  /** Brand Hub setup fields (src/lib/brand-strategy.ts). */
  strategy?: BrandStrategy;
};
export type Post = {
  id: string;
  /** Last edit (Content Studio); older records only have createdAt. */
  updatedAt?: string;
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
  /** The image in `media` that Mavix made for this concept's prompt (src/lib/post-image.ts). */
  aiImage?: string;
  videoMode?: string;
  duration?: number;
  failureReason?: string;
  date: string;
  createdAt: string;
  variant: number;
  /** Content Studio campaign this post belongs to (src/lib/campaigns.ts). */
  campaignId?: string;
  /** Visual brief from a campaign: what the photo should show (no image is generated). */
  visualBrief?: string;
  /** Previous texts, newest first. */
  history?: ContentVersion[];
  /**
   * Set only by the server after Instagram confirmed the publication
   * (src/lib/server/instagram-publish.ts). A "published" post without it
   * comes from the earlier simulation.
   */
  instagram?: { mediaId: string; permalink?: string; publishedAt: string };
  /**
   * Instagram carousel (contentType "Carousel"): the slides in order with
   * their editable text layers and the plan they came from. `media` mirrors
   * the slide images in the same order, so calendar, approvals, preview and
   * publishing keep working (src/lib/carousel.ts keeps them in sync).
   */
  carousel?: Carousel;
};
export type CarouselSlide = {
  id: string;
  /** Bibliotheek reference or data URL; empty while not generated yet. */
  image: string;
  headline: string;
  body: string;
  showText: boolean;
  imageBrief: string;
  source: "ai" | "own" | "empty";
  /** Text layer styling (defaults: bottom, medium, white, sans, left). */
  style?: SlideTextStyle;
  /** Final image with the text drawn in (Bibliotheek reference), used for publishing; cleared when the slide changes. */
  rendered?: string;
};
export type SlideTextStyle = {
  position: "top" | "center" | "bottom";
  size: "s" | "m" | "l";
  color: string;
  font: "sans" | "serif" | "rounded" | "mono";
  align: "left" | "center" | "right";
};
export type Carousel = {
  slides: CarouselSlide[];
  format: "square" | "portrait";
  plan?: { title: string; concept: string; audience: string; goal: string; visualStyle: string };
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
  source: "manual" | "import" | "sample" | "newsletter";
  /** Business source folder, e.g. "thuisbezorgd" or a custom label (src/lib/contact-sources.ts). */
  origin?: string;
  createdAt: string;
  /** Set when the contact is (or was) a newsletter subscriber (src/lib/newsletter.ts). */
  newsletter?: ContactNewsletter;
};
export type ContactNewsletter = {
  subscriberId: string;
  status: "pending" | "subscribed" | "unsubscribed";
  source: string;
  subscribedAt?: string;
  unsubscribedAt?: string;
  privacyPolicyVersion?: string;
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
  // Marketing copy made in Content Studio (src/lib/studio.ts).
  copies?: MarketingCopy[];
  // Multi-channel campaigns; their items stay in posts / email / copies (src/lib/campaigns.ts).
  campaigns?: Campaign[];
  /** Insights goals (src/lib/insights.ts). */
  goals?: Goal[];
};
