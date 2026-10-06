// Inbox types and channel rules shared by server and browser code. No Node
// APIs here (core.ts holds the server-side parsing and crypto).

export type Channel = "gmail" | "instagram" | "messenger" | "whatsapp";
export const CHANNELS: Channel[] = ["gmail", "instagram", "messenger", "whatsapp"];
export type ConversationStatus = "open" | "pending" | "resolved";
export type Direction = "inbound" | "outbound" | "note";
export type DeliveryStatus = "received" | "pending" | "sent" | "delivered" | "read" | "failed";

export type Attachment = {
  kind: "image" | "video" | "audio" | "file";
  name: string;
  mimeType: string;
  size?: number;
  // Provider reference fetched through Mavix' authenticated proxy (Gmail
  // attachment id, WhatsApp media id). Never a token.
  ref?: string;
  // Meta CDN link for Instagram/Messenger media (https only, short-lived).
  url?: string;
};

export type Party = { id: string; name?: string; email?: string; phone?: string; username?: string };

export type Capabilities = {
  label: string;
  // Hours a business may reply freely after the customer's last message.
  window: number | null;
  templates: boolean;
  outboundAttachments: boolean;
  subject: boolean;
  delivery: "provider" | "sent-only";
  live: "webhook" | "polling";
};

// What each channel can really do in Mavix. The UI reads this instead of
// assuming every channel behaves like e-mail.
export const capabilities: Record<Channel, Capabilities> = {
  gmail: { label: "E-mail", window: null, templates: false, outboundAttachments: true, subject: true, delivery: "sent-only", live: "polling" },
  instagram: { label: "Instagram", window: 24, templates: false, outboundAttachments: false, subject: false, delivery: "provider", live: "webhook" },
  messenger: { label: "Messenger", window: 24, templates: false, outboundAttachments: false, subject: false, delivery: "provider", live: "webhook" },
  whatsapp: { label: "WhatsApp", window: 24, templates: true, outboundAttachments: false, subject: false, delivery: "provider", live: "webhook" },
};

export const MAX_TEXT = 20000;
export const CONVERSATION_PAGE = 30;
export const MESSAGE_PAGE = 50;

export const ALLOWED_UPLOADS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_TOTAL = 15 * 1024 * 1024;
export type Upload = { name: string; mimeType: string; data: string /* base64 */ };

export function preview(text: string, attachments: Attachment[] = []): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (line) return line.slice(0, 140);
  if (attachments.length) return attachments.length === 1 ? "Bijlage: " + attachments[0].name : attachments.length + " bijlagen";
  return "";
}

export function windowState(channel: Channel, lastInboundAt: string | null | undefined, now = Date.now()) {
  const hours = capabilities[channel].window;
  if (hours === null) return { applies: false as const, open: true, closesAt: null as string | null };
  if (!lastInboundAt) return { applies: true as const, open: false, closesAt: null };
  const closes = new Date(lastInboundAt).getTime() + hours * 3600_000;
  return { applies: true as const, open: closes > now, closesAt: new Date(closes).toISOString() };
}

export type ConversationView = {
  id: string;
  channel: Channel;
  accountId: string;
  contact: { name: string; handle: string; email?: string; phone?: string };
  contactId: string | null;
  subject: string;
  status: ConversationStatus;
  assignedUserId: string | null;
  lastMessageAt: string;
  lastInboundAt: string | null;
  preview: string;
  lastDirection: Direction;
  unread: number;
  labels: string[];
};

export type MessageView = {
  id: string;
  direction: Direction;
  author: string;
  body: string;
  attachments: (Attachment & { href?: string })[];
  status: DeliveryStatus;
  error: string | null;
  createdAt: string;
  clientId?: string | null;
};

export function displayName(channel: Channel, contact: Party | Record<string, unknown>) {
  const c = contact as Party;
  return c.name || (c.username ? "@" + c.username : "") || c.email || c.phone || (channel === "whatsapp" ? "+" + c.id : "Onbekende klant");
}
