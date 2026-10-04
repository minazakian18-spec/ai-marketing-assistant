import { capabilities, windowState, type Capabilities, type ConversationView, type MessageView } from "./shared";

// Clearly labelled example conversations for demo mode only. Real
// workspaces never see these; sending is disabled in demo mode.
const ago = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();

type Demo = { conversation: ConversationView; messages: MessageView[] };

function msg(id: string, direction: MessageView["direction"], author: string, body: string, minutes: number, status: MessageView["status"] = direction === "inbound" ? "received" : "read"): MessageView {
  return { id, direction, author, body, attachments: [], status, error: null, createdAt: ago(minutes) };
}

export function demoInbox(): Demo[] {
  return [
    {
      conversation: {
        id: "demo-1",
        channel: "whatsapp",
        accountId: "demo",
        contact: { name: "Sanne (voorbeeld)", handle: "+31 6 00000000" },
        contactId: null,
        subject: "",
        status: "open",
        assignedUserId: null,
        lastMessageAt: ago(4),
        lastInboundAt: ago(4),
        preview: "Kan ik zaterdag nog langskomen voor een afspraak?",
        lastDirection: "inbound",
        unread: 1,
        demo: true,
      },
      messages: [
        msg("d1a", "inbound", "Sanne (voorbeeld)", "Hoi! Ik zag jullie nieuwe actie op Instagram.", 12),
        msg("d1b", "outbound", "Jij", "Hoi Sanne, leuk dat je reageert! Waarmee kunnen we je helpen?", 9),
        msg("d1c", "inbound", "Sanne (voorbeeld)", "Kan ik zaterdag nog langskomen voor een afspraak?", 4),
      ],
    },
    {
      conversation: {
        id: "demo-2",
        channel: "gmail",
        accountId: "demo",
        contact: { name: "Mark Jansen (voorbeeld)", handle: "mark@voorbeeld.nl", email: "mark@voorbeeld.nl" },
        contactId: null,
        subject: "Offerte aanvraag",
        status: "pending",
        assignedUserId: null,
        lastMessageAt: ago(95),
        lastInboundAt: ago(180),
        preview: "Bedankt, ik kijk ernaar en kom erop terug.",
        lastDirection: "outbound",
        unread: 0,
        demo: true,
      },
      messages: [
        msg("d2a", "inbound", "Mark Jansen (voorbeeld)", "Goedemiddag,\n\nKunnen jullie een offerte sturen voor 20 personen op 12 november?\n\nMet vriendelijke groet,\nMark", 180),
        msg("d2b", "note", "Jij", "Check eerst de beschikbaarheid van de grote zaal.", 120, "sent"),
        msg("d2c", "outbound", "Jij", "Beste Mark,\n\nDank voor je aanvraag. Je ontvangt morgen een offerte.\n\nGroet,\nHet team", 95, "sent"),
      ],
    },
    {
      conversation: {
        id: "demo-3",
        channel: "instagram",
        accountId: "demo",
        contact: { name: "@lisa.voorbeeld", handle: "@lisa.voorbeeld" },
        contactId: null,
        subject: "",
        status: "open",
        assignedUserId: null,
        lastMessageAt: ago(60 * 30),
        lastInboundAt: ago(60 * 30),
        preview: "Verzenden jullie ook naar België?",
        lastDirection: "inbound",
        unread: 0,
        demo: true,
      },
      messages: [msg("d3a", "inbound", "@lisa.voorbeeld", "Verzenden jullie ook naar België?", 60 * 30)],
    },
  ];
}

export function demoDetail(id: string) {
  const d = demoInbox().find((x) => x.conversation.id === id);
  if (!d) return null;
  return {
    conversation: d.conversation,
    messages: d.messages,
    hasMore: false,
    window: windowState(d.conversation.channel, d.conversation.lastInboundAt),
    capabilities: capabilities[d.conversation.channel] as Capabilities,
    contact: null,
    members: [],
  };
}
