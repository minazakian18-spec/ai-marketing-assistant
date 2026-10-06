import { capabilities, windowState, type Capabilities, type Channel, type ConversationView, type MessageView } from "./shared";

// Clearly labelled example conversations for TEST MODE ONLY (demo cookie).
// Real workspaces never load these; nothing is sent to any channel.
const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60000).toISOString();
let n = 0;
const msg = (direction: MessageView["direction"], author: string, body: string, minutesAgo: number, status?: MessageView["status"]): MessageView => ({
  id: "demo-m" + ++n,
  direction,
  author,
  body,
  attachments: [],
  status: status || (direction === "inbound" ? "received" : "read"),
  error: null,
  createdAt: at(minutesAgo),
});

type DemoThread = { conversation: ConversationView; messages: MessageView[] };

function thread(id: string, channel: Channel, name: string, handle: string, messages: MessageView[], extra: Partial<ConversationView> = {}): DemoThread {
  const last = messages[messages.length - 1];
  const lastIn = [...messages].reverse().find((m) => m.direction === "inbound");
  return {
    conversation: {
      id,
      channel,
      accountId: "demo",
      contact: { name, handle, email: channel === "gmail" ? handle : undefined, phone: channel === "whatsapp" ? handle : undefined },
      contactId: null,
      subject: "",
      status: "open",
      assignedUserId: null,
      lastMessageAt: last.createdAt,
      lastInboundAt: lastIn?.createdAt || null,
      preview: last.body.replace(/\s+/g, " ").slice(0, 140),
      lastDirection: last.direction,
      unread: 0,
      labels: [],
      ...extra,
    },
    messages,
  };
}

export function demoThreads(): DemoThread[] {
  n = 0;
  return [
    thread(
      "demo-1",
      "whatsapp",
      "Sanne de Vries",
      "+31 6 1234 5678",
      [
        msg("inbound", "Sanne de Vries", "Hoi! Hebben jullie zaterdagavond nog plek voor 4 personen?", 26),
        msg("outbound", "Jij", "Hoi Sanne, zaterdag om 19:00 of 20:30 kan nog. Welke tijd past jullie het best?", 21),
        msg("inbound", "Sanne de Vries", "19:00 graag!", 6),
        msg("inbound", "Sanne de Vries", "Kan er ook een kinderstoel bij?", 5),
      ],
      { unread: 2, labels: ["Reservering"] },
    ),
    thread(
      "demo-2",
      "instagram",
      "Lisa Bakker",
      "@lisa.eet.mee",
      [
        msg("inbound", "Lisa Bakker", "Jullie nieuwe lunchkaart ziet er geweldig uit 😍 Is de pasta ook vegan te bestellen?", 75),
      ],
      { unread: 1 },
    ),
    thread(
      "demo-3",
      "gmail",
      "Mark Jansen",
      "mark.jansen@example.com",
      [
        msg("inbound", "Mark Jansen", "Goedemiddag,\n\nWij willen op 14 november met 18 collega's komen eten. Kunnen jullie een groepsmenu en een offerte sturen?\n\nMet vriendelijke groet,\nMark Jansen", 60 * 5),
        msg("note", "Jij", "Grote zaal checken bij Tom, offerte voor vrijdag.", 60 * 4),
        msg("outbound", "Jij", "Beste Mark,\n\nDank voor je aanvraag! Je ontvangt uiterlijk vrijdag een voorstel voor het groepsmenu.\n\nHartelijke groet,\nHet team", 60 * 4 - 20, "sent"),
      ],
      { subject: "Groepsdiner 14 november", status: "pending", labels: ["Offerte"] },
    ),
    thread(
      "demo-4",
      "messenger",
      "Peter Smit",
      "Facebook",
      [
        msg("inbound", "Peter Smit", "Zijn jullie op maandag open?", 60 * 26),
        msg("outbound", "Jij", "Hoi Peter, op maandag zijn we gesloten. Dinsdag t/m zondag vanaf 12:00 ben je welkom!", 60 * 25),
        msg("inbound", "Peter Smit", "Top, dank je!", 60 * 25 - 10),
      ],
      { status: "resolved" },
    ),
    thread(
      "demo-5",
      "whatsapp",
      "Yasmin El Amrani",
      "+31 6 8765 4321",
      [msg("inbound", "Yasmin El Amrani", "Kan ik een cadeaubon van €50 bij jullie kopen?", 60 * 50)],
    ),
  ];
}

export const DEMO_MEMBERS = [{ userId: "demo-user", name: "Jij" }];

export function demoDetail(t: DemoThread) {
  return {
    conversation: t.conversation,
    messages: t.messages,
    hasMore: false,
    window: windowState(t.conversation.channel, t.conversation.lastInboundAt),
    capabilities: capabilities[t.conversation.channel] as Capabilities,
    contact: null,
    members: DEMO_MEMBERS,
  };
}
