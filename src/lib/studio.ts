import type { Post, Workspace } from "./types";
import type { EmailCampaign } from "./email-model";
import type { ContentVersion } from "./campaigns";

// Content Studio: one overview over the content records the rest of Mavix
// already uses. Instagram posts (workspace.posts) and e-mail campaigns
// (workspace.email.campaigns) are the same records the calendar, approval
// queues and autopilot read; marketing copy (workspace.copies) is the one
// content type that only lives in Content Studio. Nothing is duplicated.

export type MarketingCopy = {
  id: string;
  title: string;
  kind: CopyKind;
  prompt: string;
  body: string;
  status: "draft" | "ready";
  createdAt: string;
  updatedAt: string;
  /** Content Studio campaign this text belongs to (src/lib/campaigns.ts). */
  campaignId?: string;
  /** Previous texts, newest first. */
  history?: ContentVersion[];
};
export type CopyKind = "website" | "advertentie" | "flyer" | "productomschrijving" | "overig";
export const COPY_KINDS: { id: CopyKind; label: string; hint: string }[] = [
  { id: "website", label: "Websitetekst", hint: "Een pagina, sectie of over-ons-tekst" },
  { id: "advertentie", label: "Advertentietekst", hint: "Korte kop en tekst voor een advertentie" },
  { id: "flyer", label: "Flyer of poster", hint: "Kop, korte tekst en actie" },
  { id: "productomschrijving", label: "Productomschrijving", hint: "Voor menukaart, webshop of website" },
  { id: "overig", label: "Andere tekst", hint: "Alles wat je zelf beschrijft" },
];

export type StudioChannel = "instagram" | "reel" | "email" | "copy";
export const CHANNELS: { id: StudioChannel; label: string; description: string; available: boolean; note?: string }[] = [
  { id: "instagram", label: "Instagram-post", description: "Caption, hashtags en een foto uit je Bibliotheek.", available: true },
  { id: "email", label: "E-mail of nieuwsbrief", description: "Onderwerp, voorbeeldtekst en de inhoud van je mail.", available: true },
  { id: "copy", label: "Marketingtekst", description: "Voor je website, een advertentie, flyer of productomschrijving.", available: true },
  { id: "reel", label: "Instagram Reel", description: "Korte verticale video met caption.", available: false, note: "Binnenkort: Mavix maakt en plaatst nog geen video's." },
];

export type StudioStatus = "draft" | "approved" | "scheduled" | "published" | "failed" | "other";
export type StudioItem = {
  id: string;
  channel: Exclude<StudioChannel, "reel">;
  title: string;
  preview: string;
  status: StudioStatus;
  statusLabel: string;
  updatedAt: string;
  date: string;
  href: string;
  image?: string;
};

const POST_STATUS: Record<Post["status"], [StudioStatus, string]> = {
  draft: ["draft", "Concept"],
  approved: ["approved", "Goedgekeurd"],
  scheduled: ["scheduled", "Ingepland"],
  published: ["published", "Gepubliceerd"],
  failed: ["failed", "Mislukt"],
  blocked: ["failed", "Geblokkeerd"],
  rejected: ["other", "Afgewezen"],
};
const EMAIL_STATUS: Record<EmailCampaign["status"], [StudioStatus, string]> = {
  draft: ["draft", "Concept"],
  approved: ["approved", "Goedgekeurd"],
  scheduled: ["scheduled", "Ingepland"],
  sent: ["published", "Verzonden"],
  blocked: ["failed", "Geblokkeerd"],
  rejected: ["other", "Afgewezen"],
};

const clip = (s: string, n = 140) =>
  (s || "")
    .replace(/^\s*(#{1,6}|[-*•]|\d+[.)])\s+/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);

export function studioItems(data: Pick<Workspace, "posts" | "email"> & { copies?: MarketingCopy[] }): StudioItem[] {
  const posts: StudioItem[] = (data.posts || []).map((p) => {
    const [status, statusLabel] = POST_STATUS[p.status] || ["other", p.status];
    return {
      id: p.id,
      channel: "instagram",
      title: clip(p.prompt || p.caption, 80) || "Instagram-post",
      preview: clip(p.caption),
      status,
      statusLabel,
      updatedAt: p.updatedAt || p.createdAt,
      date: p.date || "",
      href: "/social?tab=assist&post=" + encodeURIComponent(p.id),
      image: p.media?.[0],
    };
  });
  const mails: StudioItem[] = (data.email?.campaigns || []).map((c) => {
    const [status, statusLabel] = EMAIL_STATUS[c.status] || ["other", c.status];
    return {
      id: c.id,
      channel: "email",
      title: clip(c.subject || c.title, 80) || "E-mail",
      preview: clip(c.preview || c.body),
      status,
      statusLabel,
      updatedAt: c.updatedAt || c.createdAt,
      date: c.date || "",
      href: "/email?tab=assist&campaign=" + encodeURIComponent(c.id),
    };
  });
  const copies: StudioItem[] = (data.copies || []).map((c) => ({
    id: c.id,
    channel: "copy",
    title: clip(c.title, 80) || "Marketingtekst",
    preview: clip(c.body),
    status: c.status === "ready" ? "approved" : "draft",
    statusLabel: c.status === "ready" ? "Klaar" : "Concept",
    updatedAt: c.updatedAt || c.createdAt,
    date: "",
    href: "/studio/tekst?id=" + encodeURIComponent(c.id),
  }));
  return [...posts, ...mails, ...copies].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function studioCounts(items: StudioItem[]) {
  const n = (s: StudioStatus) => items.filter((i) => i.status === s).length;
  return { draft: n("draft"), approved: n("approved"), scheduled: n("scheduled"), published: n("published"), failed: n("failed") };
}

/** Brand Hub fields that make AI drafts noticeably better. Never blocks creating. */
export function brandGaps(profile: Workspace["profile"]) {
  const gaps: { label: string; href: string }[] = [];
  if (!profile.name?.trim()) gaps.push({ label: "Bedrijfsnaam", href: "/brand-hub" });
  if (!profile.description?.trim()) gaps.push({ label: "Omschrijving van je bedrijf", href: "/brand-hub" });
  if (!profile.audience?.trim()) gaps.push({ label: "Doelgroep", href: "/brand-hub" });
  if (!profile.productList?.length && !profile.products?.trim()) gaps.push({ label: "Producten of diensten", href: "/brand-hub" });
  if (!profile.strategy?.tonePreset && !profile.voice?.trim()) gaps.push({ label: "Tone of voice", href: "/brand-hub" });
  return gaps;
}

export function copyValid(c: unknown): c is MarketingCopy {
  const v = c as MarketingCopy;
  return (
    !!v &&
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    typeof v.body === "string" &&
    v.body.length <= 20000 &&
    ["draft", "ready"].includes(v.status) &&
    COPY_KINDS.some((k) => k.id === v.kind)
  );
}
