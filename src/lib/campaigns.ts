import type { Post, Workspace } from "./types";
import { defaultEmail, type EmailCampaign } from "./email-model.ts";
import type { MarketingCopy } from "./studio";

// Multi-channel campaigns in Content Studio.
//
// A campaign is a light record (goal, title, visual brief, CTA ideas, a
// suggested schedule) in workspace.campaigns. Its content stays where every
// module already reads it: Instagram posts in workspace.posts, e-mails in
// workspace.email.campaigns, marketing copy in workspace.copies. Each item
// only carries `campaignId`. Nothing is stored twice, so Calendar, Social and
// E-mail show campaign items without knowing about campaigns.
//
// Version history: before an item's text changes, its previous text is kept
// in `history` (newest first, at most VERSION_LIMIT).

export type CampaignChannel = "instagram" | "email" | "copy";
export type Campaign = {
  id: string;
  title: string;
  goal: string;
  visualBrief?: string;
  ctas?: string[];
  /** Suggested publishing moments (local "YYYY-MM-DDTHH:mm"); a suggestion, not a schedule. */
  schedule?: { channel: CampaignChannel; date: string }[];
  source: "studio" | "agent";
  createdAt: string;
  updatedAt: string;
};
export type ContentVersion = { at: string; caption?: string; hashtags?: string; subject?: string; preview?: string; body?: string; title?: string };

export const VERSION_LIMIT = 10;
export const CAMPAIGN_CHANNELS: { id: CampaignChannel; label: string }[] = [
  { id: "instagram", label: "Instagram-post" },
  { id: "email", label: "E-mail" },
  { id: "copy", label: "Marketingtekst" },
];

type WithCampaigns = Pick<Workspace, "posts" | "email"> & { copies?: MarketingCopy[]; campaigns?: Campaign[] };

/** All content items of one campaign, read from the modules that own them. */
export function campaignItems(ws: WithCampaigns, campaignId: string) {
  return {
    posts: (ws.posts || []).filter((p) => p.campaignId === campaignId),
    emails: (ws.email?.campaigns || []).filter((c) => c.campaignId === campaignId),
    copies: (ws.copies || []).filter((c) => c.campaignId === campaignId),
  };
}

export function campaignSummary(ws: WithCampaigns, c: Campaign) {
  const items = campaignItems(ws, c.id);
  const all = [...items.posts.map((p) => p.status), ...items.emails.map((e) => e.status), ...items.copies.map((x) => (x.status === "ready" ? "approved" : "draft"))];
  return {
    total: all.length,
    drafts: all.filter((s) => s === "draft").length,
    approved: all.filter((s) => s === "approved").length,
    scheduled: all.filter((s) => s === "scheduled").length,
    // "published"/"sent" in Mavix today comes from the simulation; shown as such by the UI.
    done: all.filter((s) => s === "published" || s === "sent").length,
  };
}

/** Keeps the previous text of an item before it changes (no entry if nothing changed). */
export function withVersion<T extends { history?: ContentVersion[] }>(item: T, previous: Omit<ContentVersion, "at">, next: Partial<T>, at = new Date().toISOString()): T {
  const changed = (Object.keys(previous) as (keyof typeof previous)[]).some((k) => k in next && (next as Record<string, unknown>)[k] !== previous[k]);
  if (!changed) return { ...item, ...next };
  return { ...item, ...next, history: [{ at, ...previous }, ...(item.history || [])].slice(0, VERSION_LIMIT) };
}

const str = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const VERSION_KEYS = ["caption", "hashtags", "subject", "preview", "body", "title"];

export function historyValid(h: unknown) {
  return (
    h === undefined ||
    (Array.isArray(h) &&
      h.length <= VERSION_LIMIT &&
      h.every((v) => v && typeof v === "object" && str((v as ContentVersion).at, 40) && Object.entries(v).every(([k, x]) => k === "at" || (VERSION_KEYS.includes(k) && str(x, 20000)))))
  );
}

export function campaignValid(c: unknown): c is Campaign {
  const v = c as Campaign;
  return (
    !!v &&
    str(v.id, 80) &&
    str(v.title, 160) &&
    str(v.goal, 1000) &&
    (v.visualBrief === undefined || str(v.visualBrief, 2000)) &&
    (v.ctas === undefined || (Array.isArray(v.ctas) && v.ctas.length <= 10 && v.ctas.every((x) => str(x, 200)))) &&
    (v.schedule === undefined || (Array.isArray(v.schedule) && v.schedule.length <= 20 && v.schedule.every((s) => s && ["instagram", "email", "copy"].includes(s.channel) && str(s.date, 30)))) &&
    ["studio", "agent"].includes(v.source) &&
    str(v.createdAt, 40) &&
    str(v.updatedAt, 40)
  );
}

/** Campaign ids referenced by items must exist (no dangling links); history must be well-formed. */
export function campaignLinksValid(ws: { posts?: Post[]; email?: { campaigns?: EmailCampaign[] }; copies?: MarketingCopy[]; campaigns?: Campaign[] }) {
  const ids = new Set((ws.campaigns || []).map((c) => c.id));
  const items: { campaignId?: string; history?: ContentVersion[] }[] = [...(ws.posts || []), ...(ws.email?.campaigns || []), ...(ws.copies || [])];
  return items.every((i) => (i.campaignId === undefined || ids.has(i.campaignId)) && historyValid(i.history));
}

export type CampaignDraftInput = {
  title: string;
  goal: string;
  instagram?: { caption: string; hashtags: string; visual_brief: string } | null;
  email?: { subject: string; preview: string; body: string; cta: string } | null;
  copy?: { title: string; body: string } | null;
  ctas?: string[];
  schedule?: { channel: CampaignChannel; day_offset: number; time: string }[];
};
type ProfileLike = { name?: string; website?: string; address?: string; postalCode?: string; city?: string };

/**
 * Turns a draft (from Content Studio or Mavix Agent) into records: one
 * campaign plus its items, all as drafts. Suggested moments are stored as
 * the items' proposed date; nothing is scheduled or published.
 */
export function buildCampaignRecords(draft: CampaignDraftInput, opts: { source: Campaign["source"]; profile: ProfileLike; now?: Date; id?: () => string }) {
  const now = opts.now || new Date();
  const iso = now.toISOString();
  const id = opts.id || (() => crypto.randomUUID());
  const campaignId = id();
  const when = (channel: CampaignChannel) => {
    const s = (draft.schedule || []).find((x) => x.channel === channel);
    return s ? suggestedDate(now, s.day_offset, s.time) : "";
  };
  const schedule = (draft.schedule || []).map((s) => ({ channel: s.channel, date: suggestedDate(now, s.day_offset, s.time) }));
  const campaign: Campaign = {
    id: campaignId,
    title: draft.title.slice(0, 160) || "Campagne",
    goal: draft.goal.slice(0, 1000),
    visualBrief: draft.instagram?.visual_brief?.slice(0, 2000) || undefined,
    ctas: (draft.ctas || []).slice(0, 10).map((c) => c.slice(0, 200)),
    schedule,
    source: opts.source,
    createdAt: iso,
    updatedAt: iso,
  };
  const post: Post | null = draft.instagram
    ? {
        id: id(),
        prompt: draft.goal.slice(0, 1000),
        caption: draft.instagram.caption,
        hashtags: draft.instagram.hashtags,
        status: "draft",
        date: when("instagram"),
        createdAt: iso,
        updatedAt: iso,
        variant: 0,
        contentType: "Post",
        source: "manual",
        media: [],
        campaignId,
        visualBrief: draft.instagram.visual_brief || undefined,
      }
    : null;
  const p = opts.profile;
  const email: EmailCampaign | null = draft.email
    ? {
        id: id(),
        title: draft.email.subject.slice(0, 120) || campaign.title,
        kind: "Create Campaign",
        prompt: draft.goal.slice(0, 1000),
        subject: draft.email.subject,
        preview: draft.email.preview,
        sender: p.name || "Ons team",
        audience: "Alle contacten",
        body: draft.email.body,
        cta: draft.email.cta,
        ctaUrl: p.website || "",
        hero: "",
        footer: [p.name || "Jouw bedrijfsnaam", p.address, p.postalCode, p.city].filter(Boolean).join(" · "),
        status: "draft",
        date: when("email"),
        createdAt: iso,
        updatedAt: iso,
        source: "manual",
        variant: 0,
        reason: "",
        campaignId,
      }
    : null;
  const copy: MarketingCopy | null = draft.copy
    ? { id: id(), title: draft.copy.title.slice(0, 120) || campaign.title, kind: "overig", prompt: draft.goal.slice(0, 1500), body: draft.copy.body, status: "draft", createdAt: iso, updatedAt: iso, campaignId }
    : null;
  return { campaign, post, email, copy };
}

/** Adds a built campaign and its items to a workspace (new arrays; input untouched). */
export function addCampaign<T extends WithCampaigns>(ws: T, r: ReturnType<typeof buildCampaignRecords>): T {
  return {
    ...ws,
    campaigns: [r.campaign, ...(ws.campaigns || [])],
    posts: r.post ? [r.post, ...(ws.posts || [])] : ws.posts,
    email: r.email ? { settings: ws.email?.settings || structuredClone(defaultEmail), campaigns: [r.email, ...(ws.email?.campaigns || [])] } : ws.email,
    copies: r.copy ? [r.copy, ...(ws.copies || [])] : ws.copies,
  };
}

/** A campaign's suggested moments as concrete dates, starting from `from` (local date). */
export function suggestedDate(from: Date, dayOffset: number, time: string) {
  const d = new Date(from);
  d.setDate(d.getDate() + Math.max(0, Math.min(60, Math.round(dayOffset))));
  const [h, m] = /^\d{2}:\d{2}$/.test(time) ? time.split(":") : ["10", "00"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${h}:${m}`;
}
