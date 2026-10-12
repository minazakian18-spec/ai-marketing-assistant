// What Mavix Agent can really do, in one place. The server builds the model's
// instructions from this registry and the UI shows only suggestions it backs.
// Adding a tool = adding an entry here AND implementing it on the server; an
// entry with status "unavailable" is never offered as working.
//
// kinds:  read   = reads workspace data (server-side, own workspace only)
//         draft  = produces text the user copies or edits; changes nothing
//         write  = changes data, publishes or sends (always needs explicit
//                  confirmation in the UI; none are enabled yet)

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

export const CAPABILITIES: Capability[] = [
  { id: "workspace_overview", kind: "read", status: "available", label: "Werkruimte-overzicht", description: "Counts of drafts waiting for approval, scheduled posts and e-mails, Brand Hub completeness and which integrations are connected." },
  { id: "brand_context", kind: "read", status: "available", label: "Brand Hub", description: "The business profile, tone of voice, audience, products and calls to action from Brand Hub.", href: "/brand-hub" },
  { id: "marketing_advice", kind: "draft", status: "available", label: "Marketingadvies en ideeën", description: "Marketing plans, campaign ideas, content calendars as text, and ideas to win more customers or reservations, based only on Brand Hub facts." },
  { id: "draft_texts", kind: "draft", status: "available", label: "Teksten schrijven", description: "Draft Instagram captions, newsletters, e-mails and review replies as text in the chat for the user to copy or refine in Content Studio.", href: "/studio" },
  { id: "read_reviews", kind: "read", status: "unavailable", label: "Reviews lezen", description: "Reading Google reviews is not connected to the agent. The user can answer reviews in Reviews.", href: "/reviews?tab=inbox" },
  { id: "read_inbox", kind: "read", status: "unavailable", label: "Inbox lezen", description: "The agent cannot read customer conversations. Reply suggestions are available inside the Inbox.", href: "/inbox" },
  { id: "read_insights", kind: "read", status: "unavailable", label: "Statistieken", description: "Reach and engagement numbers are not available to the agent.", href: "/inzichten" },
  { id: "save_drafts", kind: "write", status: "unavailable", label: "Concepten opslaan", description: "The agent cannot save drafts into Content Studio or the calendar yet; the user does that in Content Studio.", href: "/studio" },
  { id: "publish_or_send", kind: "write", status: "unavailable", label: "Publiceren of versturen", description: "The agent never publishes posts, sends e-mails or messages, or deletes anything." },
];

export const available = (kind?: CapabilityKind) => CAPABILITIES.filter((c) => c.status === "available" && (!kind || c.kind === kind));

/** Suggestions on the empty state: each one is backed by an available capability. */
export const AGENT_SUGGESTIONS: { prompt: string; capability: string }[] = [
  { prompt: "Maak een Instagram-campagne voor volgende week", capability: "draft_texts" },
  { prompt: "Schrijf een nieuwsbrief voor mijn klanten", capability: "draft_texts" },
  { prompt: "Maak een marketingplanning voor de komende maand", capability: "marketing_advice" },
  { prompt: "Geef me ideeën om meer reserveringen te krijgen", capability: "marketing_advice" },
  { prompt: "Wat moet ik deze week als eerste oppakken?", capability: "workspace_overview" },
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
