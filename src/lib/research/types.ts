// Mavix business research ("Onderzoek mijn restaurant"): shared types.
// Data collection, analysis, report generation, persistence and UI are
// separate layers that only exchange these shapes, so real sources
// (Instagram insights, competitors, reservations) can be added later
// without changing the report or the UI.

export type SourceId =
  | "profile"
  | "google_profile"
  | "reviews"
  | "website"
  | "content"
  | "email"
  | "inbox"
  | "instagram_insights"
  | "competitors"
  | "reservations";

export type SourceStatus = "used" | "not_connected" | "unavailable" | "error";
export type SourceInfo = { id: SourceId; label: string; status: SourceStatus; note: string };

// ---- Collected data (facts only) ----
export type ProfileData = {
  name: string;
  industry: string;
  audience: string;
  description: string;
  website: string;
  city: string;
  hasAddress: boolean;
  phone: string;
  products: { name: string; price?: number }[];
  offers: string;
  hasBrandVoice: boolean;
  segments: number;
};
export type ReviewData = {
  total: number;
  average: number | null;
  recent90: number;
  recentAverage: number | null;
  replied: number;
  unanswered: number;
  unansweredNegative: number;
  themes: { theme: string; positive: number; negative: number }[];
};
export type GoogleProfileData = {
  title: string;
  hasHours: boolean;
  hasWebsite: boolean;
  hasPhone: boolean;
  hasDescription: boolean;
  categories: string[];
  descriptionLength: number;
};
export type WebsiteData = {
  url: string;
  https: boolean;
  status: number;
  title: string;
  metaDescription: string;
  h1: string;
  mobileViewport: boolean;
  mentionsMenu: boolean;
  menuLink: boolean;
  mentionsReservation: boolean;
  reservationLink: boolean;
  phoneLink: boolean;
  mentionsOpeningHours: boolean;
  restaurantSchema: boolean;
  ogImage: boolean;
  wordCount: number;
  loadMs: number;
};
export type ContentData = { last30: number; scheduledAhead: number; drafts: number; formats: Record<string, number>; withPhotos: number };
export type EmailData = { campaigns90: number; contacts: number; subscribed: number };
export type InboxData = { conversations30: number; waitingOver24h: number; channels: string[] };

export type ResearchInput = {
  businessKind: "restaurant" | "business";
  collectedAt: string;
  sources: SourceInfo[];
  profile: ProfileData;
  reviews?: ReviewData;
  google?: GoogleProfileData;
  website?: WebsiteData;
  content: ContentData;
  email: EmailData;
  inbox?: InboxData;
};

// ---- Analysis ----
export type FindingStatus = "good" | "improve" | "uncertain";
export type Priority = "high" | "medium" | "low";
export type Area = "profile" | "reviews" | "google" | "website" | "social" | "marketing" | "customers" | "competitors";

export type Finding = {
  id: string;
  area: Area;
  status: FindingStatus;
  title: string;
  found: string; // observed facts (what Mavix measured)
  why: string; // interpretation: why it matters
  action: string; // recommendation
  priority?: Priority;
  impact: number; // 1-5, used for ordering
  sources: SourceId[];
};

export type ActionWeek = { week: 1 | 2 | 3 | 4; title: string; actions: string[] };

export type ResearchReport = {
  version: 1;
  businessName: string;
  businessKind: "restaurant" | "business";
  period: string; // YYYY-MM
  generatedAt: string;
  summary: string;
  summarySource: "ai" | "rules";
  topPriorities: { findingId: string; title: string; action: string }[];
  findings: Finding[];
  plan: ActionWeek[];
  sources: SourceInfo[];
  notResearched: { label: string; reason: string }[];
};

export const AREA_LABEL: Record<Area, string> = {
  profile: "Bedrijfsprofiel",
  reviews: "Klanten en reviews",
  google: "Online zichtbaarheid en Google",
  website: "Website en vindbaarheid",
  social: "Social media en content",
  marketing: "Marketing en e-mail",
  customers: "Klantcontact",
  competitors: "Concurrenten",
};

// Real stages, in the order the server runs them.
export const RESEARCH_STAGES = [
  { id: "collect", label: "Bedrijfsgegevens verzamelen" },
  { id: "reviews", label: "Reviews analyseren" },
  { id: "visibility", label: "Online zichtbaarheid onderzoeken" },
  { id: "website", label: "Website controleren" },
  { id: "content", label: "Social media en content bekijken" },
  { id: "advice", label: "Aanbevelingen maken" },
] as const;
export type StageId = (typeof RESEARCH_STAGES)[number]["id"];
