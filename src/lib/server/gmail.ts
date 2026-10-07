import { hydrateGmailBody } from "./gmail-mime";
import "server-only";
import { z } from "zod";
import { HttpError } from "./access";
import { gmailConnection } from "./gmail-credentials";
import { gmailRequest } from "./gmail-api";
import {
  buildGmailReply,
  header,
  normalizeGmailThread,
  parseAddress,
  parseAddresses,
  parseGmailMessage,
  type GmailMessage,
  type Upload,
} from "../inbox/core";

const email = z
  .string()
  .max(254)
  .email()
  .regex(/^[^\r\n\x00-\x20<>]+$/);
export const newGmailInput = z
  .object({
    to: email,
    subject: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[^\r\n\x00-\x1f]+$/),
    body: z.string().trim().min(1).max(20000),
  })
  .strict();
export const gmailListInput = z
  .object({
    q: z.string().max(500).optional(),
    pageToken: z.string().max(4096).optional(),
    pageSize: z.coerce.number().int().min(1).max(50).default(25),
  })
  .strict();
const validId = (id: string) => {
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(id))
    throw new HttpError(400, "Ongeldig Gmail-gesprek.");
};
export async function gmailThread(
  workspaceId: string,
  id: string,
  expectedAccount?: string,
) {
  validId(id);
  const c = await gmailConnection(workspaceId);
  if (expectedAccount && c.provider_account_id !== expectedAccount)
    throw new HttpError(
      409,
      "Dit gesprek hoort bij een eerder gekoppeld Gmail-account.",
    );
  const thread = (await gmailRequest(
    workspaceId,
    "/threads/" + encodeURIComponent(id) + "?format=full",
    {},
    c.provider_account_id,
    c.connection_generation,
  )) as { id: string; messages?: GmailMessage[] };
  for (const message of thread.messages || [])
    await hydrateGmailBody(
      workspaceId,
      message,
      c.provider_account_id,
      c.connection_generation,
    );
  return { c, thread };
}
export async function getGmailThread(workspaceId: string, id: string) {
  const { c, thread } = await gmailThread(workspaceId, id);
  return normalizeGmailThread(
    thread,
    c.account_email || c.display_name || "",
    c.provider_account_id,
  );
}
export async function listGmailThreads(
  workspaceId: string,
  input: z.infer<typeof gmailListInput>,
) {
  const c = await gmailConnection(workspaceId);
  const query = new URLSearchParams({
    maxResults: String(input.pageSize),
    q: input.q || "in:inbox",
    ...(input.pageToken ? { pageToken: input.pageToken } : {}),
  });
  const page = await gmailRequest(
    workspaceId,
    "/threads?" + query,
    {},
    c.provider_account_id,
    c.connection_generation,
  );
  const conversations = [];
  const refs = (page.threads || []) as { id: string }[];
  for (let i = 0; i < refs.length; i += 5) {
    const batch = await Promise.all(
      refs.slice(i, i + 5).map(async (ref) => {
        try {
          validId(ref.id);
          const thread = await gmailRequest(
            workspaceId,
            "/threads/" +
              encodeURIComponent(ref.id) +
              "?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc",
            {},
            c.provider_account_id,
            c.connection_generation,
          );
          const normalized = normalizeGmailThread(
            thread,
            c.account_email || c.display_name || "",
            c.provider_account_id,
          );
          const { messages, ...summary } = normalized;
          return {
            ...summary,
            messageCount: thread.messages?.length || messages.length,
          };
        } catch (e) {
          if (e instanceof HttpError && e.status === 404) return null;
          throw e;
        }
      }),
    );
    conversations.push(...batch.filter((c) => c !== null));
  }
  return { conversations, nextPageToken: page.nextPageToken || null };
}
export async function sendNewGmail(
  workspaceId: string,
  input: z.infer<typeof newGmailInput>,
) {
  const valid = newGmailInput.parse(input);
  const c = await gmailConnection(workspaceId);
  const raw = buildGmailReply({ ...valid, reply: false });
  const sent = await gmailRequest(
    workspaceId,
    "/messages/send",
    {
      method: "POST",
      body: JSON.stringify({ raw }),
    },
    c.provider_account_id,
    c.connection_generation,
  );
  const conversationId = await cacheGmailThread(
    workspaceId,
    sent.threadId,
    c.provider_account_id,
    c.connection_generation,
  );
  return {
    id: sent.id,
    threadId: sent.threadId,
    status: "sent",
    inboxSynced: !!conversationId,
    conversationId,
  };
}

// Cache only explicitly sent/replied-to threads, using the existing unified
// Inbox ingestion. A cache failure must never turn an accepted send into a
// retry. Returns the Inbox conversation id, or null when caching failed.
export async function cacheGmailThread(
  workspaceId: string,
  id: string,
  accountId: string,
  generation: string,
): Promise<string | null> {
  try {
    const { c, thread } = await gmailThread(workspaceId, id, accountId);
    if (c.connection_generation !== generation) return null;
    const { ingest } = await import("./inbox");
    let conversationId: string | null = null;
    for (const message of thread.messages || []) {
      if (
        message.labelIds?.some((label) =>
          ["TRASH", "SPAM", "DRAFT"].includes(label),
        )
      )
        continue;
      const parsed = parseGmailMessage(
        message,
        c.account_email || c.display_name || "",
        accountId,
      );
      if (parsed)
        conversationId = (
          await ingest(workspaceId, parsed, {
            unread: message.labelIds?.includes("UNREAD") || false,
            notify: false,
          })
        ).conversationId;
    }
    return conversationId;
  } catch {
    return null;
  }
}
export async function replyGmailThread(
  workspaceId: string,
  id: string,
  body: string,
  expectedAccount?: string,
  attachments?: Upload[],
) {
  if ((!body.trim() && !attachments?.length) || body.length > 20000)
    throw new HttpError(
      400,
      "Schrijf een geldig bericht van maximaal 20.000 tekens.",
    );
  const { c, thread } = await gmailThread(workspaceId, id, expectedAccount);
  const messages = [...(thread.messages || [])]
    .filter((m) => !m.labelIds?.includes("DRAFT"))
    .sort((a, b) => Number(a.internalDate) - Number(b.internalDate));
  const last = messages.at(-1);
  if (!last) throw new HttpError(404, "Dit gesprek bevat geen berichten.");
  const mailbox = (c.account_email || c.display_name || "").toLowerCase();
  const from = parseAddress(header(last.payload, "From")).email;
  const to =
    from === mailbox || last.labelIds?.includes("SENT")
      ? parseAddresses(header(last.payload, "To")).find(
          (a) => a.email !== mailbox,
        )?.email
      : parseAddress(header(last.payload, "Reply-To")).email || from;
  if (!email.safeParse(to).success)
    throw new HttpError(409, "Dit gesprek heeft geen geldig antwoordadres.");
  const inReplyTo = header(last.payload, "Message-ID");
  if (!/^<[^<>\s]+>$/.test(inReplyTo))
    throw new HttpError(
      409,
      "Gmail mist de berichtreferentie voor een antwoord in dit gesprek.",
    );
  const raw = buildGmailReply({
    to: to!,
    subject: header(last.payload, "Subject"),
    body,
    inReplyTo,
    references: header(last.payload, "References"),
    attachments,
  });
  const sent = await gmailRequest(
    workspaceId,
    "/messages/send",
    { method: "POST", body: JSON.stringify({ raw, threadId: id }) },
    c.provider_account_id,
    c.connection_generation,
  );
  return {
    id: sent.id,
    threadId: sent.threadId,
    status: "sent",
    inboxSynced: !!(await cacheGmailThread(
      workspaceId,
      sent.threadId,
      c.provider_account_id,
      c.connection_generation,
    )),
  };
}
