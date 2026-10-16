// What Mavix Agent can really do, in one place. The server builds the model's
// instructions from this registry and the UI shows only suggestions it backs.
// Adding a tool = adding an entry here AND implementing it on the server; an
// entry with status "unavailable" is never offered as working.
//
// kinds:  read   = reads workspace data (server-side, own workspace only)
//         draft  = produces text the user copies or edits; changes nothing
//         write  = changes data (always needs explicit confirmation in the UI;
//                  only saving campaign drafts is enabled)

export type CapabilityKind = "read" | "draft" | "write";
export type Capability = {
  id: string;
  kind: CapabilityKind;
  status: "available" | "unavailable";
  label: string;
  /** Shown to the model and, for unavailable ones, explained to the user. */
  description: string;
  /** In-app place where the user does this themselves. */
  href?: string;
};

// Server tools behind the "read" entries: src/lib/server/agent/tools.ts.
export const CAPABILITIES: Capability[] = [
  { id: "workspace_overview", kind: "read", status: "available", label: "Werkruimte-overzicht", description: "Counts of drafts waiting for approval, scheduled posts and e-mails, Brand Hub completeness and connected integrations (get_integrations)." },
  { id: "brand_context", kind: "read", status: "available", label: "Brand Hub", description: "The business profile, tone of voice, audience, products and calls to action from Brand Hub (get_brand_context).", href: "/brand-hub" },
  { id: "read_schedule", kind: "read", status: "available", label: "Planning", description: "What is planned in the Mavix content calendar for a period (get_schedule).", href: "/calendar" },
  { id: "read_content", kind: "read", status: "available", label: "Bestaande content", description: "Existing Instagram posts, e-mail campaigns and Content Studio texts (list_content).", href: "/studio" },
  { id: "read_media", kind: "read", status: "available", label: "Mediabibliotheek", description: "Search photo and video names and albums in the Media Library (search_media); no image recognition.", href: "/library" },
  { id: "read_reviews", kind: "read", status: "available", label: "Google-reviews", description: "Recent Google reviews, only when Google Business Profile is connected (list_reviews).", href: "/reviews?tab=inbox" },
  { id: "marketing_advice", kind: "draft", status: "available", label: "Marketingadvies en ideeën", description: "Marketing plans, campaign ideas, content calendars as proposals, and ideas to win more customers or reservations, based only on real workspace data." },
  { id: "draft_texts", kind: "draft", status: "available", label: "Teksten schrijven", description: "Draft Instagram captions, Reel concepts and scripts, newsletters, e-mails and review replies in the chat for the user to copy or refine in Content Studio.", href: "/studio" },
  { id: "read_campaigns", kind: "read", status: "available", label: "Campagnes", description: "Content Studio campaigns and the status of their items (get_campaigns).", href: "/studio" },
  { id: "read_inbox_counts", kind: "read", status: "available", label: "Inbox-overzicht", description: "How many conversations have unread messages per channel, only when a messaging channel is connected (get_inbox_overview). Counts only.", href: "/inbox" },
  { id: "read_seo", kind: "read", status: "available", label: "SEO", description: "SEO Intelligence scores and top recommendations of the last website scan (get_seo_summary).", href: "/seo" },
  { id: "save_campaign_drafts", kind: "write", status: "available", label: "Campagne als concepten opslaan", description: "Propose saving a campaign (Instagram post, e-mail, marketing text) as drafts in Content Studio (prepare_campaign_drafts). Only owners and admins; the user must confirm with a button; nothing is scheduled.", href: "/studio" },
  { id: "read_inbox", kind: "read", status: "unavailable", label: "Inbox-berichten lezen", description: "The agent cannot read the contents of customer conversations. Reply suggestions are available inside the Inbox.", href: "/inbox" },
  { id: "read_insights", kind: "read", status: "unavailable", label: "Statistieken", description: "Reach and engagement numbers (Instagram, Google) are not available in Mavix yet.", href: "/inzichten" },
  { id: "files", kind: "read", status: "unavailable", label: "Bestanden", description: "The agent cannot read uploaded files or attachments.", href: "/library" },
  { id: "schedule_or_edit", kind: "write", status: "unavailable", label: "Inplannen of wijzigen", description: "The agent cannot schedule content or change or delete existing items; the user does that in Content Studio, Social or E-mail.", href: "/studio" },
  { id: "publish_or_send", kind: "write", status: "unavailable", label: "Publiceren of versturen", description: "The agent never publishes posts, sends e-mails, messages or review replies, or deletes anything." },
];

export const available = (kind?: CapabilityKind) => CAPABILITIES.filter((c) => c.status === "available" && (!kind || c.kind === kind));

/** Suggestions on the empty state: each one is backed by an available capability. */
export const AGENT_SUGGESTIONS: { prompt: string; capability: string }[] = [
  { prompt: "Maak een Instagram-campagne voor volgende week", capability: "draft_texts" },
  { prompt: "Zet een campagne voor volgende week klaar als concepten", capability: "save_campaign_drafts" },
  { prompt: "Schrijf een nieuwsbrief voor mijn klanten", capability: "draft_texts" },
  { prompt: "Maak een marketingplanning voor de komende maand", capability: "marketing_advice" },
  { prompt: "Geef me ideeën om meer reserveringen te krijgen", capability: "marketing_advice" },
  { prompt: "Wat moet ik deze week als eerste oppakken?", capability: "workspace_overview" },
  { prompt: "Wat staat er morgen gepland?", capability: "read_schedule" },
].filter((s) => CAPABILITIES.some((c) => c.id === s.capability && c.status === "available"));

/** Text block for the model: what it may and may not claim. */
export function capabilityBrief() {
  const line = (c: Capability) => `- ${c.label} (${c.kind}): ${c.description}`;
  return [
    "Available to you:",
    ...available().map(line),
    "NOT available (say so honestly and point to the place in Mavix when the user asks):",
    ...CAPABILITIES.filter((c) => c.status === "unavailable").map(line),
  ].join("\n");
}

/** Deterministic title from the first message: no AI tokens spent. */
export function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim().replace(/^[^\p{L}\p{N}]+/u, "");
  if (!clean) return "Nieuw gesprek";
  const cut = clean.length > 60 ? clean.slice(0, 60).replace(/\s+\S*$/, "") + "…" : clean;
  return cut.charAt(0).toUpperCase() + cut.slice(1);
}
