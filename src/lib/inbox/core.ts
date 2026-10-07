// Pure Mavix Inbox logic: provider payload normalisation, webhook signature
// checks, the messaging window, contact matching and Gmail message building.
// No I/O and no server-only imports, so it can be unit-tested with mocked
// provider payloads (tests/inbox.test.mjs).
//
// Everything a customer sends is untrusted input: it is stored and shown as
// plain text only, never rendered as HTML and never followed as instructions.
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  ALLOWED_UPLOADS,
  capabilities,
  MAX_TEXT,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_TOTAL,
  preview,
  type Attachment,
  type Channel,
  type DeliveryStatus,
  type Party,
  type Upload,
} from "./shared.ts";
export * from "./shared.ts";
export type NormalizedMessage = {
  channel: Channel;
  accountId: string;
  threadId: string;
  messageId: string;
  direction: "inbound" | "outbound";
  // The customer this conversation is with (sender for inbound, recipient
  // for outbound/echo messages).
  customer: Party;
  from: Party;
  text: string;
  attachments: Attachment[];
  createdAt: string;
  subject?: string;
  metadata?: Record<string, string>;
};

export type StatusUpdate = {
  channel: Channel;
  accountId: string;
  status: Exclude<DeliveryStatus, "received" | "pending">;
  at: string;
  messageId?: string;
  // Messenger reports reads/deliveries as a watermark for a whole thread.
  threadId?: string;
  watermark?: string;
  error?: string;
};

// Strip control characters (keep newlines/tabs) and cap the length.
export function cleanText(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, max);
}

export const eventKey = (...parts: string[]) =>
  createHash("sha256").update(parts.join("\u0000")).digest("hex");

const isoFromMs = (ms: unknown) => {
  const n = Number(ms);
  return Number.isFinite(n) && n > 0 && n <= 8640000000000000
    ? new Date(n).toISOString()
    : new Date().toISOString();
};

function kindOf(mime: string, hint?: string): Attachment["kind"] {
  const t = (hint || mime || "").toLowerCase();
  if (t.startsWith("image") || t === "sticker") return "image";
  if (t.startsWith("video")) return "video";
  if (t.startsWith("audio") || t === "voice") return "audio";
  return "file";
}

const safeHttps = (u: unknown) => {
  if (typeof u !== "string") return undefined;
  try {
    return new URL(u).protocol === "https:" ? u : undefined;
  } catch {
    return undefined;
  }
};

// ---------------------------------------------------------------- Meta webhooks

// X-Hub-Signature-256: "sha256=" + HMAC-SHA256(raw body, app secret).
export function verifyMetaSignature(
  raw: string | Uint8Array,
  header: string | null,
  secret: string,
): boolean {
  if (!header || !secret || !header.startsWith("sha256=")) return false;
  const given = Buffer.from(header.slice(7), "hex");
  const expected = createHmac("sha256", secret).update(raw).digest();
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// GET verification handshake: returns the challenge to echo, or null.
export function verifyChallenge(
  params: URLSearchParams,
  verifyToken: string,
): string | null {
  const token = params.get("hub.verify_token") || "";
  const a = Buffer.from(token),
    b = Buffer.from(verifyToken);
  if (
    !verifyToken ||
    params.get("hub.mode") !== "subscribe" ||
    a.length !== b.length ||
    !timingSafeEqual(a, b)
  )
    return null;
  const challenge = params.get("hub.challenge") || "";
  return /^[\w.-]{1,200}$/.test(challenge) ? challenge : null;
}

type MetaAttachment = {
  type?: string;
  payload?: { url?: string; title?: string };
};
type MetaMessaging = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    is_unsupported?: boolean;
    attachments?: MetaAttachment[];
    reply_to?: { mid?: string };
  };
  delivery?: { mids?: string[]; watermark?: number };
  read?: { mid?: string; watermark?: number };
};

// Instagram (object "instagram") and Messenger (object "page") share the
// entry[].messaging[] shape. entry.id is the IG professional account id or
// the Facebook Page id the connection is stored under.
export function parseMetaMessaging(
  payload: unknown,
  channel: "instagram" | "messenger",
) {
  const messages: NormalizedMessage[] = [];
  const statuses: StatusUpdate[] = [];
  const body = payload as {
    object?: string;
    entry?: { id?: string; time?: number; messaging?: MetaMessaging[] }[];
  };
  if (
    body?.object !== (channel === "instagram" ? "instagram" : "page") ||
    !Array.isArray(body.entry)
  )
    return { messages, statuses };
  for (const entry of body.entry) {
    const accountId = String(entry?.id || "");
    if (!accountId || !Array.isArray(entry.messaging)) continue;
    for (const m of entry.messaging) {
      const sender = String(m?.sender?.id || ""),
        recipient = String(m?.recipient?.id || "");
      if (!sender || !recipient) continue;
      const at = isoFromMs(m.timestamp);
      if (m.message?.mid) {
        if (m.message.is_deleted) continue;
        const echo = !!m.message.is_echo;
        const customerId = echo ? recipient : sender;
        // Instagram echoes can carry the business' own id as sender; skip
        // anything that is not between the account and a customer.
        if (customerId === accountId) continue;
        const attachments: Attachment[] = (m.message.attachments || [])
          .filter((a) => a && a.type !== "fallback" && a.type !== "template")
          .map((a, i) => ({
            kind: kindOf(
              "",
              a.type === "ig_reel" || a.type === "reel" ? "video" : a.type,
            ),
            name: a.payload?.title || (a.type || "bijlage") + "-" + (i + 1),
            mimeType: "",
            url: safeHttps(a.payload?.url),
          }));
        const text =
          m.message.is_unsupported && !m.message.text
            ? "[Dit berichttype wordt niet ondersteund]"
            : cleanText(m.message.text);
        if (!text && !attachments.length) continue;
        messages.push({
          channel,
          accountId,
          threadId: customerId,
          messageId: m.message.mid,
          direction: echo ? "outbound" : "inbound",
          customer: { id: customerId },
          from: { id: sender },
          text,
          attachments,
          createdAt: at,
        });
      } else if (m.delivery) {
        for (const mid of m.delivery.mids || [])
          statuses.push({
            channel,
            accountId,
            status: "delivered",
            at,
            messageId: mid,
          });
        if (!m.delivery.mids?.length && m.delivery.watermark)
          statuses.push({
            channel,
            accountId,
            status: "delivered",
            at,
            threadId: sender,
            watermark: isoFromMs(m.delivery.watermark),
          });
      } else if (m.read) {
        if (m.read.mid)
          statuses.push({
            channel,
            accountId,
            status: "read",
            at,
            messageId: m.read.mid,
            threadId: sender,
          });
        else if (m.read.watermark)
          statuses.push({
            channel,
            accountId,
            status: "read",
            at,
            threadId: sender,
            watermark: isoFromMs(m.read.watermark),
          });
      }
    }
  }
  return { messages, statuses };
}

type WaMedia = {
  id?: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
};
type WaMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: WaMedia;
  video?: WaMedia;
  audio?: WaMedia;
  document?: WaMedia;
  sticker?: WaMedia;
  voice?: WaMedia;
  button?: { text?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
  location?: {
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
  };
  reaction?: { emoji?: string };
  contacts?: unknown[];
};
type WaStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: { code?: number; title?: string }[];
};

// WhatsApp Cloud API: object "whatsapp_business_account", messages and
// statuses under entry[].changes[].value; metadata.phone_number_id is the
// connected business number.
export function parseWhatsApp(payload: unknown) {
  const messages: NormalizedMessage[] = [];
  const statuses: StatusUpdate[] = [];
  const body = payload as {
    object?: string;
    entry?: {
      changes?: { field?: string; value?: Record<string, unknown> }[];
    }[];
  };
  if (
    body?.object !== "whatsapp_business_account" ||
    !Array.isArray(body.entry)
  )
    return { messages, statuses };
  for (const entry of body.entry)
    for (const change of entry?.changes || []) {
      if (change?.field !== "messages" || !change.value) continue;
      const value = change.value as {
        metadata?: { phone_number_id?: string };
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: WaMessage[];
        statuses?: WaStatus[];
      };
      const accountId = String(value.metadata?.phone_number_id || "");
      if (!accountId) continue;
      const names = new Map(
        (value.contacts || []).map((c) => [
          String(c.wa_id || ""),
          cleanText(c.profile?.name, 200),
        ]),
      );
      for (const m of value.messages || []) {
        const from = String(m.from || "");
        if (!m.id || !/^\d{6,20}$/.test(from)) continue;
        const type = m.type || "";
        const media = (m as Record<string, unknown>)[type] as
          WaMedia | undefined;
        const attachments: Attachment[] = [];
        let text = "";
        if (type === "text") text = cleanText(m.text?.body);
        else if (
          ["image", "video", "audio", "document", "sticker", "voice"].includes(
            type,
          ) &&
          media?.id
        ) {
          attachments.push({
            kind: kindOf(media.mime_type || "", type),
            name:
              cleanText(media.filename, 200) ||
              type +
                (media.mime_type
                  ? "." + media.mime_type.split("/")[1]?.split(";")[0]
                  : ""),
            mimeType: media.mime_type || "",
            ref: String(media.id),
          });
          text = cleanText(media.caption);
        } else if (type === "button") text = cleanText(m.button?.text);
        else if (type === "interactive")
          text = cleanText(
            m.interactive?.button_reply?.title ||
              m.interactive?.list_reply?.title,
          );
        else if (type === "location" && m.location)
          text =
            "Locatie gedeeld: " +
            [m.location.name, m.location.address]
              .filter(Boolean)
              .map((v) => cleanText(v, 300))
              .join(", ") +
            ` (${Number(m.location.latitude)}, ${Number(m.location.longitude)})`;
        else if (type === "reaction") continue;
        else text = "[Dit berichttype wordt niet ondersteund]";
        const name = names.get(from) || undefined;
        messages.push({
          channel: "whatsapp",
          accountId,
          threadId: from,
          messageId: m.id,
          direction: "inbound",
          customer: { id: from, name, phone: "+" + from },
          from: { id: from, name, phone: "+" + from },
          text,
          attachments,
          createdAt: isoFromMs(Number(m.timestamp) * 1000),
        });
      }
      for (const s of value.statuses || []) {
        if (
          !s.id ||
          !["sent", "delivered", "read", "failed"].includes(s.status || "")
        )
          continue;
        statuses.push({
          channel: "whatsapp",
          accountId,
          status: s.status as StatusUpdate["status"],
          at: isoFromMs(Number(s.timestamp) * 1000),
          messageId: s.id,
          threadId: s.recipient_id,
          error:
            s.status === "failed"
              ? whatsappErrorText(s.errors?.[0]?.code)
              : undefined,
        });
      }
    }
  return { messages, statuses };
}

function whatsappErrorText(code?: number) {
  if (code === 131047)
    return "Het 24-uursvenster is gesloten. Gebruik een goedgekeurde template.";
  if (code === 131026)
    return "Het bericht kon niet worden afgeleverd bij dit nummer.";
  if (code === 131051) return "Dit berichttype wordt niet ondersteund.";
  if (code === 130472)
    return "Het nummer neemt deel aan een experiment van WhatsApp; het bericht is niet afgeleverd.";
  return "WhatsApp kon het bericht niet afleveren.";
}

// Delivery statuses only move forward; a late "delivered" never overwrites
// "read", and "failed" only replaces states before delivery.
const RANK: Record<DeliveryStatus, number> = {
  received: 0,
  pending: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  failed: 2.5,
};
export function nextStatus(
  current: DeliveryStatus,
  incoming: DeliveryStatus,
): DeliveryStatus {
  if (incoming === "failed")
    return current === "pending" || current === "sent" ? "failed" : current;
  if (current === "failed" && incoming === "sent") return current;
  return RANK[incoming] > RANK[current] ? incoming : current;
}

// ---------------------------------------------------------------- Meta errors

export type ProviderError = {
  status: number;
  message: string;
  connection?: "reconnect_required" | "permission_missing";
  retryable: boolean;
};

export function mapMetaError(
  httpStatus: number,
  error: { code?: number; error_subcode?: number } | undefined,
  channel: Channel,
): ProviderError {
  const code = error?.code,
    sub = error?.error_subcode;
  if (code === 190 || httpStatus === 401)
    return {
      status: 409,
      message: "De koppeling is verlopen. Verbind het kanaal opnieuw.",
      connection: "reconnect_required",
      retryable: false,
    };
  if (
    sub === 2018278 ||
    sub === 2534022 ||
    code === 131047 ||
    code === 1545041 ||
    sub === 1545041
  )
    return {
      status: 409,
      message:
        channel === "whatsapp"
          ? "Het 24-uursvenster is gesloten. Gebruik een goedgekeurde template."
          : "Het 24-uursvenster is gesloten. De klant moet eerst opnieuw een bericht sturen.",
      retryable: false,
    };
  if (
    code === 10 ||
    code === 200 ||
    code === 3 ||
    (code !== undefined && code >= 200 && code < 300)
  )
    return {
      status: 403,
      message:
        "Mavix heeft geen toestemming meer om berichten te versturen. Geef opnieuw toestemming.",
      connection: "permission_missing",
      retryable: false,
    };
  if (
    code === 4 ||
    code === 17 ||
    code === 32 ||
    code === 613 ||
    code === 80007 ||
    code === 130429 ||
    code === 131056 ||
    httpStatus === 429
  )
    return {
      status: 429,
      message:
        "Het kanaal verstuurt even te veel berichten. Probeer het zo opnieuw.",
      retryable: true,
    };
  if (code === 551 || sub === 1545041)
    return {
      status: 409,
      message: "Deze persoon is niet bereikbaar via dit kanaal.",
      retryable: false,
    };
  if (code === 131026)
    return {
      status: 409,
      message: "Het bericht kon niet worden afgeleverd bij dit nummer.",
      retryable: false,
    };
  if (httpStatus >= 500)
    return {
      status: 502,
      message: "Het kanaal is tijdelijk niet bereikbaar. Probeer het opnieuw.",
      retryable: true,
    };
  return {
    status: 502,
    message: "Het kanaal kon het bericht niet versturen.",
    retryable: false,
  };
}

// ---------------------------------------------------------------- Contacts

export const normalizeEmail = (e?: string | null) =>
  (e || "").trim().toLowerCase();
// Digits in international form. Dutch national numbers (06…, 020…) are
// rewritten to 31…, as Mavix contacts are Dutch-first; anything else must
// already include its country code to match.
export function normalizePhone(p?: string | null) {
  const raw = (p || "").trim();
  if (!raw) return "";
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "31" + d.slice(1);
  d = d.replace(/\D/g, "");
  return d.length >= 8 && d.length <= 15 ? d : "";
}

type ContactLike = {
  id: string;
  email?: string;
  phone?: string;
  source?: string;
  firstName?: string;
  lastName?: string;
};

// Exact matches only (normalised e-mail or phone). Example contacts are
// ignored, and an ambiguous match (two contacts) links nothing.
export function matchContact<T extends ContactLike>(
  contacts: T[],
  who: { email?: string; phone?: string },
): T | null {
  const email = normalizeEmail(who.email),
    phone = normalizePhone(who.phone);
  if (!email && !phone) return null;
  const hits = contacts.filter(
    (c) =>
      c.source !== "sample" &&
      ((email && normalizeEmail(c.email) === email) ||
        (phone && normalizePhone(c.phone) === phone)),
  );
  return hits.length === 1 ? hits[0] : null;
}

// ---------------------------------------------------------------- Gmail

type GmailHeader = { name?: string; value?: string };
export type GmailPart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
};
export type GmailMessage = {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart;
};

export function parseAddress(value?: string): { name?: string; email: string } {
  const v = (value || "").trim();
  const m = v.match(/^\s*"?([^"<]*?)"?\s*<([^<>\s]+@[^<>\s]+)>\s*$/);
  if (m) return { name: m[1].trim() || undefined, email: m[2].toLowerCase() };
  const bare = v.match(/[^\s<>,;"]+@[^\s<>,;"]+/);
  return { email: bare ? bare[0].toLowerCase() : "" };
}

export function header(part: GmailPart | undefined, name: string) {
  return (
    part?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
      ?.value || ""
  );
}

function decodeBody(data: string, charset: string) {
  const bytes = Buffer.from(data, "base64url");
  try {
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return bytes.toString("utf8");
  }
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  euro: "€",
  eacute: "é",
  euml: "ë",
  iuml: "ï",
  ouml: "ö",
  uuml: "ü",
  agrave: "à",
  egrave: "è",
};
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head|title)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) => {
      if (e[0] === "#") {
        const n =
          e[1] === "x" || e[1] === "X"
            ? parseInt(e.slice(2), 16)
            : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000
          ? String.fromCodePoint(n)
          : "";
      }
      return ENTITIES[e.toLowerCase()] ?? all;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Cut the quoted history most clients append under a reply.
export function stripQuoted(text: string): string {
  const lines = text.split("\n");
  const cut = lines.findIndex(
    (l, i) =>
      /^\s*(On|Op|Am|Le)\s.+\s(wrote|schreef|schrieb|écrit)(\s.*)?:\s*$/i.test(
        l,
      ) ||
      (/^\s*(On|Op)\s.+$/i.test(l) &&
        /(wrote|schreef)\s*:\s*$/i.test(lines[i + 1] || "")) ||
      /^-{2,}\s*(Original Message|Oorspronkelijk bericht|Forwarded message)/i.test(
        l,
      ) ||
      /^_{5,}$/.test(l.trim()) ||
      (/^(From|Van):\s.+/.test(l) &&
        /^(Sent|Verzonden|Date|Datum):\s/.test(lines[i + 1] || "")),
  );
  const kept = (cut > 0 ? lines.slice(0, cut) : lines).filter(
    (l, i, all) =>
      !(
        l.startsWith(">") &&
        all.slice(i).every((x) => x.startsWith(">") || !x.trim())
      ),
  );
  return kept.join("\n").trim() || text.trim();
}

function walk(
  part: GmailPart | undefined,
  visit: (p: GmailPart) => void,
  depth = 0,
) {
  if (!part || depth > 30) return;
  visit(part);
  for (const p of part.parts || []) walk(p, visit, depth + 1);
}

export function parseGmailMessage(
  msg: GmailMessage,
  mailbox: string,
  accountId: string,
  fullBody = false,
): NormalizedMessage | null {
  if (!msg.id || !msg.threadId || !msg.payload) return null;
  const p = msg.payload;
  const from = parseAddress(header(p, "From"));
  const to = parseAddresses(header(p, "To"))[0] || { email: "" };
  const outbound =
    (msg.labelIds || []).includes("SENT") ||
    (!!mailbox && from.email === normalizeEmail(mailbox));
  let plain = "",
    html = "";
  const attachments: Attachment[] = [];
  walk(p, (part) => {
    const mime = (part.mimeType || "").toLowerCase();
    const disposition = header(part, "Content-Disposition").toLowerCase();
    const charset = (
      header(part, "Content-Type").match(/charset="?([\w-]+)"?/i)?.[1] ||
      "utf-8"
    ).toLowerCase();
    if (part.filename && (part.body?.attachmentId || part.body?.data)) {
      attachments.push({
        kind: kindOf(mime),
        name: cleanText(part.filename, 200),
        mimeType: mime,
        size: part.body.size,
        ref: part.body.attachmentId,
      });
      return;
    }
    if (disposition.startsWith("attachment") || !part.body?.data) return;
    if (mime === "text/plain" && !plain)
      plain = decodeBody(part.body.data, charset);
    else if (mime === "text/html" && !html)
      html = decodeBody(part.body.data, charset);
  });
  const content = plain || htmlToText(html) || msg.snippet || "";
  const text = cleanText(
    fullBody ? content : stripQuoted(content),
    fullBody ? 200000 : MAX_TEXT,
  );
  const customer = outbound ? to : from;
  if (!customer.email) return null;
  return {
    channel: "gmail",
    accountId,
    threadId: msg.threadId,
    messageId: msg.id,
    direction: outbound ? "outbound" : "inbound",
    customer: {
      id: customer.email,
      email: customer.email,
      name: customer.name,
    },
    from: { id: from.email, email: from.email, name: from.name },
    text,
    attachments,
    createdAt: isoFromMs(msg.internalDate),
    subject: cleanText(header(p, "Subject"), 500),
    metadata: {
      rfcMessageId: header(p, "Message-ID").slice(0, 998),
      references: header(p, "References").slice(0, 4000),
      replyTo: parseAddress(header(p, "Reply-To")).email,
    },
  };
}

// Split only outside quoted display names and angle addresses.
export function parseAddresses(value: string) {
  return (value.match(/(?:"(?:[^"\\]|\\.)*"|<[^>]*>|[^,])+/g) || [])
    .map(parseAddress)
    .filter((a) => a.email)
    .slice(0, 100);
}

export function normalizeGmailThread(
  thread: { id?: string; messages?: GmailMessage[] },
  mailbox: string,
  accountId: string,
) {
  const messages = (thread.messages || [])
    .map((message) => {
      const parsed = parseGmailMessage(message, mailbox, accountId, true);
      if (!parsed) return null;
      return {
        id: parsed.messageId,
        threadId: parsed.threadId,
        channel: "gmail" as const,
        sender: parsed.from,
        recipients: parseAddresses(header(message.payload, "To")),
        cc: parseAddresses(header(message.payload, "Cc")),
        subject: parsed.subject || "",
        timestamp: parsed.createdAt,
        body: parsed.text,
        direction: parsed.direction,
        attachments: parsed.attachments.map((a) => ({
          filename: a.name,
          mimeType: a.mimeType,
          size: a.size,
          attachmentId: a.ref,
        })),
        labels: message.labelIds || [],
      };
    })
    .filter((m) => m !== null)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const latest = messages.at(-1);
  const participants = [
    ...new Map(
      messages
        .flatMap((m) => [m.sender, ...m.recipients, ...m.cc])
        .map((p) => [p.email, p]),
    ).values(),
  ];
  return {
    id: thread.id || latest?.threadId || "",
    channel: "gmail" as const,
    subject: messages[0]?.subject || "",
    participants,
    sender: latest?.sender || null,
    preview: preview(latest?.body || ""),
    latestTimestamp: latest?.timestamp || null,
    unread: messages.some((m) => m.labels.includes("UNREAD")),
    messageCount: messages.length,
    labels: [...new Set(messages.flatMap((m) => m.labels))],
    messages,
  };
}

// Customer conversations only: inbox mail outside the promotions/social
// tabs. Sent mail is only imported into threads Mavix already shows.
export function shouldImportGmail(labels: string[] = [], threadKnown: boolean) {
  if (labels.some((l) => ["SPAM", "TRASH", "DRAFT", "CHAT"].includes(l)))
    return false;
  if (labels.includes("SENT") && !labels.includes("INBOX")) return threadKnown;
  if (!labels.includes("INBOX")) return threadKnown;
  return !labels.some((l) =>
    ["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_FORUMS"].includes(l),
  );
}

const headerSafe = (v: string) => v.replace(/[\r\n]+/g, " ").trim();
const encodeWord = (v: string) =>
  /^[\x20-\x7e]*$/.test(v)
    ? v
    : "=?UTF-8?B?" + Buffer.from(v, "utf8").toString("base64") + "?=";

export function validateUploads(uploads: Upload[]): string | null {
  let total = 0;
  for (const u of uploads) {
    if (!ALLOWED_UPLOADS[u.mimeType])
      return "Dit bestandstype kan niet worden verstuurd.";
    const size = Buffer.byteLength(u.data, "base64");
    if (size > MAX_UPLOAD_BYTES) return "Een bijlage mag maximaal 10 MB zijn.";
    total += size;
  }
  if (total > MAX_UPLOAD_TOTAL)
    return "Bijlagen mogen samen maximaal 15 MB zijn.";
  if (uploads.length > 5) return "Je kunt maximaal 5 bijlagen versturen.";
  return null;
}

// RFC 2822 reply in the same Gmail thread (threadId on send + In-Reply-To /
// References), base64url for the Gmail API `raw` field. Header values are
// stripped of newlines to prevent header injection.
export function buildGmailReply(input: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  attachments?: Upload[];
  boundary?: string;
  reply?: boolean;
}) {
  const subject = headerSafe(input.subject || "");
  const headers = [
    `To: ${headerSafe(input.to)}`,
    `Subject: ${encodeWord(input.reply === false || /^re:/i.test(subject) ? subject : "Re: " + subject)}`,
    "MIME-Version: 1.0",
  ];
  const ref = headerSafe(input.inReplyTo || "");
  if (/^<[^<>\s]+>$/.test(ref)) {
    headers.push(`In-Reply-To: ${ref}`);
    const refs = headerSafe(input.references || "")
      .split(/\s+/)
      .filter((r) => /^<[^<>\s]+>$/.test(r))
      .slice(-20);
    headers.push(
      `References: ${[...refs.filter((r) => r !== ref), ref].join(" ")}`,
    );
  }
  const text = Buffer.from(input.body, "utf8")
    .toString("base64")
    .replace(/.{76}/g, "$&\r\n");
  if (!input.attachments?.length) {
    headers.push(
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
    );
    return Buffer.from([...headers, "", text].join("\r\n"), "utf8").toString(
      "base64url",
    );
  }
  const boundary = input.boundary || "mavix_" + randomBytes(12).toString("hex");
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    text,
  ];
  for (const a of input.attachments) {
    const name =
      headerSafe(a.name).replace(/["\\]/g, "_").slice(0, 150) || "bijlage";
    const encoded = encodeURIComponent(name);
    parts.push(
      `--${boundary}`,
      `Content-Type: ${a.mimeType}; name="${name.replace(/[^\x20-\x7e]/g, "_")}"`,
      `Content-Disposition: attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encoded}`,
      "Content-Transfer-Encoding: base64",
      "",
      a.data.replace(/\s+/g, "").replace(/.{76}/g, "$&\r\n"),
    );
  }
  parts.push(`--${boundary}--`, "");
  return Buffer.from([...headers, "", ...parts].join("\r\n"), "utf8").toString(
    "base64url",
  );
}
