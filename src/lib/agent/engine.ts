// Mavix Agent engine: turns a user request into a reply. This is the single
// place to connect a real AI model later. Today it answers from the
// workspace's own data and routes to the right part of Mavix; it never
// claims to have done work it cannot do.
//
// To connect real AI: replace `runAgent` with a call to a server route
// (e.g. POST /api/agent) that uses src/lib/server/ai.ts (Claude via the
// Anthropic SDK, key stays server-side). Keep the same AgentRequest /
// AgentReply shapes so the provider and every UI surface keep working.
import { readiness } from "../instagram-model";
import type { Workspace } from "../types";

export type AgentAction = { href: string; label: string };
export type AgentAttachmentInfo = { name: string; kind: "image" | "file"; preview?: string };
export type AgentMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
  action?: AgentAction;
  attachments?: AgentAttachmentInfo[];
};
export type AgentRequest = { text: string; attachments: AgentAttachmentInfo[]; page?: string };
export type AgentReply = { text: string; action?: AgentAction };

export type AgentArea = "content" | "email" | "social" | "reviews" | "planning" | "insights";
// Example prompts per area, used as suggestions in every Agent surface.
export const AGENT_PROMPTS: { area: AgentArea; label: string; prompt: string }[] = [
  { area: "planning", label: "Planning", prompt: "Wat moet ik vandaag doen?" },
  { area: "social", label: "Social", prompt: "Maak een Instagram-post voor dit weekend" },
  { area: "email", label: "E-mail", prompt: "Schrijf een nieuwsbrief voor mijn klanten" },
  { area: "reviews", label: "Reviews", prompt: "Help me reviews te beantwoorden" },
  { area: "content", label: "Content", prompt: "Plan content voor volgende week" },
  { area: "insights", label: "Inzichten", prompt: "Hoe compleet is mijn Brand Hub?" },
];

function respond(question: string, data: Workspace): AgentReply {
  const q = question.toLowerCase();
  if (/vandaag|aandacht|openstaand|doen\b|te doen/.test(q)) {
    const drafts =
      data.posts.filter((p) => p.status === "draft").length + (data.email?.campaigns || []).filter((c) => c.status === "draft").length;
    const failed = data.posts.filter((p) => p.status === "blocked" || p.status === "failed").length;
    const parts = [
      drafts ? `${drafts} ${drafts === 1 ? "concept wacht" : "concepten wachten"} op goedkeuring` : "er wachten geen concepten op goedkeuring",
      failed ? `${failed} gepland ${failed === 1 ? "item heeft" : "items hebben"} aandacht nodig` : "er zijn geen mislukte items",
    ];
    return { text: `In je werkruimte: ${parts.join(" en ")}.`, action: { href: "/dashboard", label: "Open het dashboard" } };
  }
  if (/brand|merk|huisstijl/.test(q)) {
    const r = readiness(data.profile);
    const missing = r.checks.filter((c) => !c.done).map((c) => c.label);
    return {
      text: `Je Brand Hub is ${r.score}% compleet.` + (missing.length ? ` Nog aan te vullen: ${missing.join(", ")}.` : ""),
      action: { href: "/brand-hub", label: "Open Brand Hub" },
    };
  }
  if (/review|beoordel|recensie/.test(q))
    return { text: "Reviews beheer en beantwoord je in Reviews.", action: { href: "/reviews?tab=inbox", label: "Open Reviews" } };
  if (/nieuwsbrief|e-?mail|mail|campagne/.test(q))
    return { text: "Je kunt een e-mail of campagne maken in E-mail.", action: { href: "/email?tab=assist", label: "E-mail maken" } };
  if (/plan|kalender|agenda|week/.test(q))
    return { text: "In de kalender zie en verplaats je al je geplande content.", action: { href: "/calendar", label: "Open de kalender" } };
  if (/inbox|bericht|whatsapp|klantvraag/.test(q))
    return { text: "Klantgesprekken uit al je kanalen staan in de Inbox.", action: { href: "/inbox", label: "Open de Inbox" } };
  if (/seo|zoekmachine|vindbaar/.test(q))
    return { text: "De SEO-werkruimte is in voorbereiding. Daar komt straks de analyse van je website.", action: { href: "/seo", label: "Open SEO" } };
  if (/advert|ads|google ads/.test(q))
    return { text: "Advertenties werken straks via een Google Ads-koppeling.", action: { href: "/ads", label: "Open Advertenties" } };
  if (/insta|post|social|reel|story|caption/.test(q))
    return { text: "Je kunt een social post maken in Social.", action: { href: "/social?tab=assist", label: "Social post maken" } };
  if (/inzicht|resultat|prestatie|cijfers|analyse/.test(q))
    return { text: "Resultaten van je content en campagnes vind je in Inzichten.", action: { href: "/inzichten", label: "Open Inzichten" } };
  return {
    text: "Ik kan je nu naar de juiste plek in Mavix brengen en vragen over je eigen werkruimte beantwoorden. Probeer bijvoorbeeld een van de suggesties.",
  };
}

export async function runAgent(request: AgentRequest, data: Workspace): Promise<AgentReply> {
  await new Promise((r) => setTimeout(r, 500));
  // Mavi cannot read files until an AI model is connected; say so instead
  // of pretending to have analysed them.
  const note = request.attachments.length
    ? `Ik heb ${request.attachments.length === 1 ? "je bijlage" : request.attachments.length + " bijlagen"} ontvangen (${request.attachments
        .map((a) => a.name)
        .join(", ")}). Bestanden lezen kan ik nog niet: Mavix Agent is nog niet met een AI-model verbonden.`
    : "";
  const reply = request.text ? respond(request.text, data) : { text: "" };
  return { ...reply, text: [note, reply.text].filter(Boolean).join(" ") };
}

// Business-aware shortcuts from the workspace's real state.
export function agentShortcuts(data: Workspace): { label: string; prompt: string }[] {
  const out: { label: string; prompt: string }[] = [];
  const drafts = data.posts.filter((p) => p.status === "draft").length + (data.email?.campaigns || []).filter((c) => c.status === "draft").length;
  if (drafts) out.push({ label: `${drafts} ${drafts === 1 ? "concept wacht" : "concepten wachten"} op goedkeuring`, prompt: "Wat moet ik vandaag doen?" });
  const score = readiness(data.profile).score;
  if (score < 100) out.push({ label: `Brand Hub ${score}% compleet`, prompt: "Hoe compleet is mijn Brand Hub?" });
  const scheduled = data.posts.filter((p) => p.status === "scheduled").length;
  if (!scheduled) out.push({ label: "Nog niets ingepland", prompt: "Plan content voor volgende week" });
  return out.slice(0, 3);
}
