import { hydrateGmailBody } from "./gmail-mime";
import { randomUUID } from "node:crypto";
import { gmailRequest as gmail, GmailHistoryExpired } from "./gmail-api";
import { gmailConnection as activeGmailConnection } from "./gmail-credentials";
import { replyGmailThread } from "./gmail";
import "server-only";
import { adminClient } from "./supabase";
import { HttpError } from "./access";
import {
  metaConnection,
  metaProfile,
  sendMetaText,
  sendWhatsAppTemplate,
  whatsappMedia,
  type MetaProvider,
} from "./meta";
import {
  capabilities,
  cleanText,
  CONVERSATION_PAGE,
  displayName,
  eventKey,
  matchContact,
  MESSAGE_PAGE,
  nextStatus,
  parseGmailMessage,
  parseMetaMessaging,
  parseWhatsApp,
  preview,
  shouldImportGmail,
  validateUploads,
  windowState,
  type Attachment,
  type Channel,
  type ConversationView,
  type DeliveryStatus,
  type GmailMessage,
  type MessageView,
  type NormalizedMessage,
  type StatusUpdate,
  type Upload,
} from "../inbox/core";
import { wantsNotification } from "../security";

// Mavix Inbox storage and provider orchestration. Message content is never
// written to server logs; only event names and status codes are.

export const GMAIL_READ_SCOPE =
  "https://www.googleapis.com/auth/gmail.readonly";
const db = () => adminClient();
const log = (event: string, extra: Record<string, string | number> = {}) =>
  console.info(JSON.stringify({ event, ...extra }));

type ConversationRow = {
  id: string;
  workspace_id: string;
  provider: Channel;
  provider_account_id: string;
  provider_thread_id: string;
  external_contact: Record<string, string>;
  contact_id: string | null;
  subject: string;
  status: "open" | "pending" | "resolved";
  assigned_user_id: string | null;
  last_message_at: string;
  last_inbound_at: string | null;
  last_message_preview: string;
  last_message_direction: "inbound" | "outbound" | "note";
  unread_count: number;
  labels: string[];
};
type MessageRow = {
  id: string;
  conversation_id: string;
  provider: Channel;
  provider_message_id: string | null;
  client_message_id: string | null;
  direction: "inbound" | "outbound" | "note";
  sender: Record<string, string>;
  author_user_id: string | null;
  body: string;
  attachments: Attachment[];
  delivery_status: DeliveryStatus;
  error: string | null;
  metadata: Record<string, string>;
  provider_created_at: string;
};
const CONVERSATION_COLUMNS =
  "id,workspace_id,provider,provider_account_id,provider_thread_id,external_contact,contact_id,subject,status,assigned_user_id,last_message_at,last_inbound_at,last_message_preview,last_message_direction,unread_count,labels";
const MESSAGE_COLUMNS =
  "id,conversation_id,provider,provider_message_id,client_message_id,direction,sender,author_user_id,body,attachments,delivery_status,error,metadata,provider_created_at";

export function toConversationView(r: ConversationRow): ConversationView {
  const c = r.external_contact || {};
  return {
    id: r.id,
    channel: r.provider,
    accountId: r.provider_account_id,
    contact: {
      name: displayName(r.provider, { id: r.provider_thread_id, ...c }),
      handle: c.username ? "@" + c.username : c.email || c.phone || "",
      email: c.email,
      phone: c.phone,
    },
    contactId: r.contact_id,
    subject: r.subject,
    status: r.status,
    assignedUserId: r.assigned_user_id,
    lastMessageAt: r.last_message_at,
    lastInboundAt: r.last_inbound_at,
    preview: r.last_message_preview,
    lastDirection: r.last_message_direction,
    unread: r.unread_count,
    labels: r.labels || [],
  };
}

function toMessageView(
  r: MessageRow,
  names: Map<string, string>,
  contactName: string,
): MessageView {
  return {
    id: r.id,
    direction: r.direction,
    author:
      r.direction === "inbound"
        ? r.sender?.name || contactName
        : (r.author_user_id && names.get(r.author_user_id)) ||
          (r.direction === "note"
            ? "Teamlid"
            : "Verstuurd via " + capabilities[r.provider].label),
    body: r.body,
    attachments: (r.attachments || []).map((a, i) => ({
      ...a,
      href: a.ref ? `/api/inbox/attachments/${r.id}/${i}` : a.url,
    })),
    status: r.delivery_status,
    error: r.error,
    createdAt: r.provider_created_at,
    clientId: r.client_message_id,
  };
}

// ---------------------------------------------------------------- Channels

export type ChannelState = {
  channel: Channel;
  state:
    | "not_connected"
    | "connected"
    | "reconsent"
    | "reconnect"
    | "selection"
    | "error";
  account: string;
};

export async function channelStates(
  workspaceId: string,
): Promise<ChannelState[]> {
  const { data, error } = await db()
    .from("integration_connections")
    .select("provider,status,scopes,display_name,provider_account_id")
    .eq("workspace_id", workspaceId)
    .in("provider", ["gmail", "instagram", "messenger", "whatsapp"]);
  if (error) throw error;
  return (["gmail", "instagram", "messenger", "whatsapp"] as Channel[]).map(
    (channel) => {
      const c = data?.find((d) => d.provider === channel);
      if (!c || c.status === "disconnected")
        return { channel, state: "not_connected", account: "" };
      const account = c.display_name || "";
      if (c.status === "reconnect_required")
        return { channel, state: "reconnect", account };
      if (c.status === "selection_required")
        return { channel, state: "selection", account };
      if (c.status === "permission_missing")
        return { channel, state: "reconsent", account };
      if (channel === "gmail" && !(c.scopes || []).includes(GMAIL_READ_SCOPE))
        return { channel, state: "reconsent", account };
      if (c.status !== "connected") return { channel, state: "error", account };
      return { channel, state: "connected", account };
    },
  );
}

// ---------------------------------------------------------------- Ingest

async function workspaceContacts(workspaceId: string) {
  const { data } = await db()
    .from("business_profiles")
    .select("data")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const contacts = (data?.data as { contacts?: unknown })?.contacts;
  return Array.isArray(contacts)
    ? (contacts as {
        id: string;
        email?: string;
        phone?: string;
        source?: string;
      }[])
    : [];
}

async function notifyNewConversation(
  workspaceId: string,
  conversationId: string,
  channel: Channel,
  name: string,
) {
  const event = "new_conversation";
  const { data: prefs } = await db()
    .from("notification_preferences")
    .select("user_id,event_type,channel,enabled")
    .eq("workspace_id", workspaceId)
    .eq("event_type", event)
    .eq("channel", "IN_APP")
    .eq("enabled", true);
  const users = [
    ...new Set(
      (prefs || [])
        .filter((p) => wantsNotification([p], event, "IN_APP"))
        .map((p) => p.user_id),
    ),
  ];
  if (!users.length) return;
  await db()
    .from("notifications")
    .insert(
      users.map((recipient_id) => ({
        workspace_id: workspaceId,
        recipient_id,
        event_type: event,
        title: "Nieuw gesprek via " + capabilities[channel].label,
        body: "Van " + name.slice(0, 120),
        related_entity_type: "inbox_conversation",
        related_entity_id: conversationId,
      })),
    );
}

const searchText = (
  contact: Record<string, string | undefined>,
  subject: string,
  last: string,
) =>
  [contact.name, contact.username, contact.email, contact.phone, subject, last]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export async function ingest(
  workspaceId: string,
  m: NormalizedMessage,
  opts: { unread: boolean; notify: boolean },
): Promise<{ conversationId: string; created: boolean; duplicate: boolean }> {
  const key = {
    workspace_id: workspaceId,
    provider: m.channel,
    provider_account_id: m.accountId,
    provider_thread_id: m.threadId,
  };
  const contact: Record<string, string> = {};
  for (const [k, v] of Object.entries(m.customer))
    if (v && k !== "id") contact[k] = String(v).slice(0, 320);
  let created = false;
  let { data: conv } = await db()
    .from("inbox_conversations")
    .select(CONVERSATION_COLUMNS)
    .match(key)
    .maybeSingle();
  if (!conv) {
    const msgPreview = preview(m.text, m.attachments);
    const { data, error } = await db()
      .from("inbox_conversations")
      .upsert(
        {
          ...key,
          external_contact: contact,
          subject: m.subject || "",
          last_message_at: m.createdAt,
          last_message_preview: msgPreview,
          last_message_direction: m.direction,
          search_text: searchText(contact, m.subject || "", msgPreview),
        },
        {
          onConflict:
            "workspace_id,provider,provider_account_id,provider_thread_id",
          ignoreDuplicates: true,
        },
      )
      .select(CONVERSATION_COLUMNS);
    if (error) throw error;
    created = !!data?.length;
    conv =
      data?.[0] ||
      (
        await db()
          .from("inbox_conversations")
          .select(CONVERSATION_COLUMNS)
          .match(key)
          .single()
      ).data;
    if (!conv) throw new Error("conversation_upsert_failed");
  }
  const row = conv as ConversationRow;

  const { error: insertError } = await db()
    .from("inbox_messages")
    .insert({
      workspace_id: workspaceId,
      conversation_id: row.id,
      provider: m.channel,
      provider_account_id: m.accountId,
      provider_message_id: m.messageId,
      direction: m.direction,
      sender: Object.fromEntries(Object.entries(m.from).filter(([, v]) => v)),
      body: m.text,
      attachments: m.attachments,
      delivery_status: m.direction === "inbound" ? "received" : "sent",
      metadata: m.metadata || {},
      provider_created_at: m.createdAt,
    });
  if (insertError) {
    if (insertError.code === "23505")
      return { conversationId: row.id, created: false, duplicate: true };
    throw insertError;
  }

  // Enrich new conversations: better contact details (Meta profile), exact
  // contact match, Gmail subject.
  const patch: Record<string, unknown> = {};
  let merged = { ...(row.external_contact || {}), ...contact };
  if (
    created &&
    (m.channel === "instagram" || m.channel === "messenger") &&
    m.direction === "inbound"
  ) {
    const profile = await metaProfile(workspaceId, m.channel, m.threadId);
    if (profile.name || profile.username) {
      merged = {
        ...merged,
        ...Object.fromEntries(Object.entries(profile).filter(([, v]) => v)),
      } as Record<string, string>;
      patch.external_contact = merged;
    }
  } else if (!row.external_contact?.name && contact.name)
    patch.external_contact = merged;
  if (!row.contact_id) {
    const hit = matchContact(await workspaceContacts(workspaceId), {
      email: merged.email,
      phone: merged.phone,
    });
    if (hit) patch.contact_id = hit.id;
  }
  if (!row.subject && m.subject) patch.subject = m.subject;
  if (Object.keys(patch).length)
    await db().from("inbox_conversations").update(patch).eq("id", row.id);

  const msgPreview = preview(m.text, m.attachments);
  await db().rpc("inbox_touch_conversation", {
    p_id: row.id,
    p_at: m.createdAt,
    p_preview: msgPreview,
    p_direction: m.direction,
    p_search: searchText(merged, row.subject || m.subject || "", msgPreview),
    p_unread: opts.unread && m.direction === "inbound",
  });
  if (created && opts.notify && m.direction === "inbound")
    await notifyNewConversation(
      workspaceId,
      row.id,
      m.channel,
      displayName(m.channel, merged as never),
    ).catch(() => {});
  return { conversationId: row.id, created, duplicate: false };
}

export async function applyStatus(workspaceId: string, u: StatusUpdate) {
  if (u.messageId) {
    const { data: msg } = await db()
      .from("inbox_messages")
      .select("id,delivery_status")
      .eq("workspace_id", workspaceId)
      .eq("provider", u.channel)
      .eq("provider_account_id", u.accountId)
      .eq("provider_message_id", u.messageId)
      .maybeSingle();
    if (!msg) return;
    const status = nextStatus(msg.delivery_status as DeliveryStatus, u.status);
    if (status !== msg.delivery_status)
      await db()
        .from("inbox_messages")
        .update({
          delivery_status: status,
          ...(status === "failed"
            ? { error: u.error || "Niet afgeleverd." }
            : {}),
        })
        .eq("id", msg.id);
    return;
  }
  if (u.threadId && u.watermark) {
    const { data: conv } = await db()
      .from("inbox_conversations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("provider", u.channel)
      .eq("provider_account_id", u.accountId)
      .eq("provider_thread_id", u.threadId)
      .maybeSingle();
    if (!conv) return;
    const from = u.status === "read" ? ["sent", "delivered"] : ["sent"];
    await db()
      .from("inbox_messages")
      .update({ delivery_status: u.status })
      .eq("conversation_id", conv.id)
      .eq("direction", "outbound")
      .in("delivery_status", from)
      .lte("provider_created_at", u.watermark);
  }
}

// ---------------------------------------------------------------- Webhooks

async function workspacesFor(provider: MetaProvider, accountId: string) {
  const { data } = await db()
    .from("integration_connections")
    .select("workspace_id")
    .eq("provider", provider)
    .eq("provider_account_id", accountId)
    .in("status", ["connected", "permission_missing"]);
  const ids = (data || []).map((d) => d.workspace_id as string);
  // A WhatsApp number or Instagram account belongs to exactly one workspace
  // (unique indexes). Should an older duplicate still exist, deliver to nobody
  // rather than leak a customer's messages into another workspace.
  if ((provider === "whatsapp" || provider === "instagram") && ids.length > 1) {
    log("inbox_webhook_ambiguous_account", { provider, workspaces: ids.length });
    return [];
  }
  return ids;
}

async function firstDelivery(
  key: string,
  provider: string,
  workspaceId: string,
) {
  const { error } = await db()
    .from("inbox_webhook_events")
    .insert({ event_key: key, provider, workspace_id: workspaceId });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

// Process a verified Meta webhook body (Instagram, Messenger or WhatsApp).
export async function processMetaWebhook(payload: unknown) {
  const object = (payload as { object?: string })?.object;
  const provider: MetaProvider | null =
    object === "instagram"
      ? "instagram"
      : object === "page"
        ? "messenger"
        : object === "whatsapp_business_account"
          ? "whatsapp"
          : null;
  if (!provider) return;
  const { messages, statuses } =
    provider === "whatsapp"
      ? parseWhatsApp(payload)
      : parseMetaMessaging(payload, provider);
  const cache = new Map<string, string[]>();
  const targets = async (accountId: string) => {
    if (!cache.has(accountId))
      cache.set(accountId, await workspacesFor(provider, accountId));
    return cache.get(accountId)!;
  };
  let processed = 0;
  for (const m of messages)
    for (const ws of await targets(m.accountId)) {
      if (
        !(await firstDelivery(
          eventKey(provider, m.accountId, "msg", m.messageId, ws),
          provider,
          ws,
        ))
      )
        continue;
      try {
        await ingest(ws, m, {
          unread: m.direction === "inbound",
          notify: true,
        });
        processed++;
      } catch (e) {
        await db()
          .from("inbox_webhook_events")
          .delete()
          .eq(
            "event_key",
            eventKey(provider, m.accountId, "msg", m.messageId, ws),
          );
        throw e;
      }
    }
  for (const s of statuses)
    for (const ws of await targets(s.accountId))
      if (
        await firstDelivery(
          eventKey(
            provider,
            s.accountId,
            "status",
            s.messageId || s.threadId || "",
            s.status,
            s.watermark || "",
            ws,
          ),
          provider,
          ws,
        )
      )
        await applyStatus(ws, s);
  log("inbox_webhook_processed", {
    provider,
    messages: processed,
    statuses: statuses.length,
  });
  // Occasional pruning of old idempotency keys.
  if (Math.random() < 0.02)
    await db()
      .from("inbox_webhook_events")
      .delete()
      .lt("received_at", new Date(Date.now() - 30 * 86400000).toISOString());
}

// ---------------------------------------------------------------- Gmail

async function gmailConnection(workspaceId: string) {
  const { data: c } = await db()
    .from("integration_connections")
    .select(
      "id,status,scopes,provider_account_id,display_name,connection_generation",
    )
    .eq("workspace_id", workspaceId)
    .eq("provider", "gmail")
    .maybeSingle();
  if (
    !c ||
    c.status !== "connected" ||
    !(c.scopes || []).includes(GMAIL_READ_SCOPE) ||
    !c.provider_account_id
  )
    return null;
  return c as {
    id: string;
    provider_account_id: string;
    display_name: string;
    connection_generation: string;
  };
}

async function knownThreads(
  workspaceId: string,
  accountId: string,
  threadIds: string[],
) {
  if (!threadIds.length) return new Set<string>();
  const { data } = await db()
    .from("inbox_conversations")
    .select("provider_thread_id")
    .eq("workspace_id", workspaceId)
    .eq("provider", "gmail")
    .eq("provider_account_id", accountId)
    .in("provider_thread_id", threadIds);
  return new Set((data || []).map((d) => d.provider_thread_id as string));
}

async function storedIds(
  workspaceId: string,
  accountId: string,
  ids: string[],
) {
  if (!ids.length) return new Set<string>();
  const { data } = await db()
    .from("inbox_messages")
    .select("provider_message_id")
    .eq("workspace_id", workspaceId)
    .eq("provider", "gmail")
    .eq("provider_account_id", accountId)
    .in("provider_message_id", ids);
  return new Set((data || []).map((d) => d.provider_message_id as string));
}

async function importGmail(
  workspaceId: string,
  account: {
    provider_account_id: string;
    display_name: string;
    connection_generation: string;
  },
  refs: { id: string; threadId: string; labelIds?: string[] }[],
  initial: boolean,
  heartbeat: () => Promise<void>,
) {
  const accountId = account.provider_account_id;
  const fresh = refs.filter(
    (r, i) => refs.findIndex((x) => x.id === r.id) === i,
  );
  const stored = await storedIds(
    workspaceId,
    accountId,
    fresh.map((r) => r.id),
  );
  const todo = fresh.filter((r) => !stored.has(r.id));
  let imported = 0;
  for (let i = 0; i < todo.length; i += 5) {
    await heartbeat();
    const active = await activeGmailConnection(workspaceId);
    if (
      active.provider_account_id !== accountId ||
      active.connection_generation !== account.connection_generation
    )
      throw new HttpError(409, "De Gmail-koppeling is gewijzigd.");
    const batch = todo.slice(i, i + 5);
    const known = await knownThreads(
      workspaceId,
      accountId,
      batch.map((r) => r.threadId),
    );
    const full = await Promise.all(
      batch.map((r) =>
        r.labelIds && !shouldImportGmail(r.labelIds, known.has(r.threadId))
          ? null
          : (
              gmail(
                workspaceId,
                `/messages/${encodeURIComponent(r.id)}?format=full`,
                {},
                accountId,
                account.connection_generation,
              ) as Promise<GmailMessage>
            ).catch((e) =>
              e instanceof HttpError && e.status === 404
                ? null
                : Promise.reject(e),
            ),
      ),
    );
    for (const msg of full) {
      if (
        !msg ||
        !shouldImportGmail(msg.labelIds, known.has(msg.threadId || ""))
      )
        continue;
      await hydrateGmailBody(
        workspaceId,
        msg,
        accountId,
        account.connection_generation,
      );
      const parsed = parseGmailMessage(msg, account.display_name, accountId);
      if (!parsed) continue;
      const unread = (msg.labelIds || []).includes("UNREAD");
      const result = await ingest(workspaceId, parsed, {
        unread,
        notify: !initial,
      });
      if (!result.duplicate) {
        imported++;
        known.add(parsed.threadId);
      }
    }
  }
  return imported;
}

// Gmail is polled (History API), not pushed: Mavix does not claim real-time
// e-mail. Called by the inbox page roughly once a minute and throttled here.
export async function syncGmail(workspaceId: string, force = false) {
  const account = await gmailConnection(workspaceId);
  if (!account) return { status: "not_ready" as const, imported: 0 };
  const request = (path: string) =>
    gmail(
      workspaceId,
      path,
      {},
      account.provider_account_id,
      account.connection_generation,
    );
  const stateKey = {
    workspace_id: workspaceId,
    provider: "gmail",
    provider_account_id: account.provider_account_id,
  };
  const { data: state } = await db()
    .from("inbox_sync_state")
    .select("cursor,last_synced_at")
    .match(stateKey)
    .maybeSingle();
  if (
    !force &&
    state?.last_synced_at &&
    Date.now() - new Date(state.last_synced_at).getTime() < 25000
  )
    return {
      status: "recent" as const,
      imported: 0,
      lastSyncedAt: state.last_synced_at,
    };
  const owner = randomUUID();
  const { data: claimed, error: claimError } = await db().rpc(
    "claim_gmail_sync",
    {
      p_workspace: workspaceId,
      p_account: account.provider_account_id,
      p_generation: account.connection_generation,
      p_owner: owner,
    },
  );
  if (claimError)
    throw new HttpError(
      503,
      "Gmail-synchronisatie vereist de nieuwste databasemigratie.",
    );
  if (!claimed) return { status: "busy" as const, imported: 0 };
  const heartbeat = async () => {
    const { data, error } = await db()
      .from("inbox_sync_state")
      .update({ lease_until: new Date(Date.now() + 120000).toISOString() })
      .match(stateKey)
      .eq("lease_owner", owner)
      .select("workspace_id");
    if (error || !data?.length)
      throw new HttpError(
        409,
        "De Gmail-synchronisatie is overgenomen. Probeer opnieuw.",
      );
  };
  let imported = 0;
  let cursor: string | null = null;
  try {
    const { data: locked, error } = await db()
      .from("inbox_sync_state")
      .select("cursor")
      .match(stateKey)
      .eq("lease_owner", owner)
      .single();
    if (error || !locked)
      throw new HttpError(
        503,
        "De Gmail-synchronisatie kon niet worden geladen.",
      );
    cursor = locked.cursor || null;
    if (cursor) {
      try {
        const saved = cursor.startsWith("{")
          ? (JSON.parse(cursor) as { start: string; page: string })
          : { start: cursor, page: "" };
        let page = saved.page;
        const refs: { id: string; threadId: string; labelIds?: string[] }[] =
          [];
        let latest = cursor;
        for (let i = 0; i < 1; i++) {
          const q = new URLSearchParams({
            startHistoryId: saved.start,
            historyTypes: "messageAdded",
            maxResults: "100",
            ...(page ? { pageToken: page } : {}),
          });
          const h = await request("/history?" + q);
          for (const item of h.history || [])
            for (const added of item.messagesAdded || [])
              if (added.message?.id) refs.push(added.message);
          latest = h.historyId || latest;
          page = h.nextPageToken || "";
          if (!page) break;
        }
        imported = await importGmail(
          workspaceId,
          account,
          refs,
          false,
          heartbeat,
        );
        cursor = page ? JSON.stringify({ start: saved.start, page }) : latest;
      } catch (e) {
        if (!(e instanceof GmailHistoryExpired)) throw e;
        cursor = null; // History older than Gmail keeps: start over below.
      }
    }
    if (!cursor) {
      const profile = await request("/profile");
      const refs: { id: string; threadId: string }[] = [];
      let page = "";
      for (let i = 0; i < 2; i++) {
        const q = new URLSearchParams({
          q: "in:inbox newer_than:30d -category:promotions -category:social -category:forums",
          maxResults: "50",
          ...(page ? { pageToken: page } : {}),
        });
        const list = await request("/messages?" + q);
        refs.push(...(list.messages || []));
        page = list.nextPageToken || "";
        if (!page) break;
      }
      imported = await importGmail(workspaceId, account, refs, true, heartbeat);
      cursor = String(profile.historyId);
    }
    const current = await activeGmailConnection(workspaceId);
    if (current.connection_generation !== account.connection_generation)
      throw new HttpError(409, "De Gmail-koppeling is gewijzigd.");
    const { data: saved, error: saveError } = await db()
      .from("inbox_sync_state")
      .update({
        cursor,
        last_synced_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .match(stateKey)
      .eq("lease_owner", owner)
      .select("workspace_id");
    if (saveError || !saved?.length)
      throw new HttpError(
        503,
        "De Gmail-synchronisatie kon niet worden opgeslagen.",
      );
    await db()
      .from("integration_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", account.id);
    log("inbox_gmail_synced", { imported });
    return {
      status: "synced" as const,
      imported,
      lastSyncedAt: new Date().toISOString(),
    };
  } catch (e) {
    await db()
      .from("inbox_sync_state")
      .update({
        last_error: e instanceof HttpError ? e.message : "sync_failed",
        updated_at: new Date().toISOString(),
      })
      .match(stateKey)
      .eq("lease_owner", owner);
    throw e;
  } finally {
    await db()
      .from("inbox_sync_state")
      .update({ lease_owner: null, lease_until: null })
      .match(stateKey)
      .eq("lease_owner", owner);
  }
}

// "Meer laden" for Gmail: imports the next page of older customer mail
// (Gmail nextPageToken), never the whole mailbox. The page token lives in the
// connection's metadata, which is reset on every (re)connect. Shares the sync
// lease so it never overlaps a regular sync.
const BACKFILL_QUERY = "in:inbox -category:promotions -category:social -category:forums";
type BackfillState = { pageToken?: string; done?: boolean };

export async function backfillGmail(workspaceId: string) {
  const account = await gmailConnection(workspaceId);
  if (!account) throw new HttpError(409, "Verbind eerst Gmail.");
  const full = await activeGmailConnection(workspaceId);
  const metadata = (full.metadata || {}) as { backfill?: BackfillState };
  if (metadata.backfill?.done) return { status: "done" as const, imported: 0, done: true };
  const stateKey = {
    workspace_id: workspaceId,
    provider: "gmail",
    provider_account_id: account.provider_account_id,
  };
  const owner = randomUUID();
  const { data: claimed, error: claimError } = await db().rpc("claim_gmail_sync", {
    p_workspace: workspaceId,
    p_account: account.provider_account_id,
    p_generation: account.connection_generation,
    p_owner: owner,
  });
  if (claimError)
    throw new HttpError(503, "Gmail-synchronisatie vereist de nieuwste databasemigratie.");
  if (!claimed) return { status: "busy" as const, imported: 0, done: false };
  const heartbeat = async () => {
    const { data, error } = await db()
      .from("inbox_sync_state")
      .update({ lease_until: new Date(Date.now() + 120000).toISOString() })
      .match(stateKey)
      .eq("lease_owner", owner)
      .select("workspace_id");
    if (error || !data?.length)
      throw new HttpError(409, "De Gmail-synchronisatie is overgenomen. Probeer opnieuw.");
  };
  try {
    let pageToken = metadata.backfill?.pageToken || "";
    let imported = 0;
    let done = false;
    // Skip pages that are already in the Inbox (the first sync covered the
    // last 30 days), but never fetch more than 3 pages per click.
    for (let i = 0; i < 3 && !imported && !done; i++) {
      const q = new URLSearchParams({
        q: BACKFILL_QUERY,
        maxResults: "50",
        ...(pageToken ? { pageToken } : {}),
      });
      const list = await gmail(
        workspaceId,
        "/messages?" + q,
        {},
        account.provider_account_id,
        account.connection_generation,
      );
      imported += await importGmail(workspaceId, account, list.messages || [], true, heartbeat);
      pageToken = typeof list.nextPageToken === "string" ? list.nextPageToken : "";
      done = !pageToken;
    }
    const { error } = await db()
      .from("integration_connections")
      .update({ metadata: { ...metadata, backfill: { pageToken, done } } })
      .eq("id", account.id)
      .eq("connection_generation", account.connection_generation);
    if (error) throw new HttpError(503, "De voortgang kon niet worden opgeslagen.");
    log("inbox_gmail_backfill", { imported });
    return { status: "synced" as const, imported, done };
  } finally {
    await db()
      .from("inbox_sync_state")
      .update({ lease_owner: null, lease_until: null })
      .match(stateKey)
      .eq("lease_owner", owner);
  }
}

// ---------------------------------------------------------------- Queries

export type ListParams = {
  channel?: Channel;
  filter?: "open" | "unread" | "mine" | "resolved";
  q?: string;
  cursor?: string;
  /** Newest first (default) or oldest first. */
  sort?: "newest" | "oldest";
};

const like = (q: string) => "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";

// Cached Gmail conversations are only shown for the mailbox that is linked
// right now. After a disconnect (account cleared) or a switch to another
// Google account, older cached mail disappears from the Inbox.
export async function visibleGmailAccount(workspaceId: string) {
  const { data } = await db()
    .from("integration_connections")
    .select("provider_account_id,status")
    .eq("workspace_id", workspaceId)
    .eq("provider", "gmail")
    .maybeSingle();
  const id = data?.status !== "disconnected" ? data?.provider_account_id : null;
  return typeof id === "string" && /^[\w.-]{1,128}$/.test(id) ? id : null;
}
const gmailScope = (account: string) =>
  `provider.neq.gmail,provider_account_id.eq."${account}"`;

export async function listConversations(
  workspaceId: string,
  userId: string,
  p: ListParams,
) {
  const gmailAccount = await visibleGmailAccount(workspaceId);
  if (p.channel === "gmail" && !gmailAccount)
    return { conversations: [], nextCursor: null };
  const asc = p.sort === "oldest";
  let query = db()
    .from("inbox_conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("last_message_at", { ascending: asc })
    .order("id", { ascending: asc })
    .limit(CONVERSATION_PAGE + 1);
  if (p.channel) query = query.eq("provider", p.channel);
  if (p.channel === "gmail") query = query.eq("provider_account_id", gmailAccount!);
  else if (!gmailAccount) query = query.neq("provider", "gmail");
  if (p.filter === "unread") query = query.gt("unread_count", 0);
  else if (p.filter === "mine")
    query = query.eq("assigned_user_id", userId).neq("status", "resolved");
  else if (p.filter === "resolved") query = query.eq("status", "resolved");
  else query = query.neq("status", "resolved");
  // Combined OR-conditions (one PostgREST `or` parameter): Gmail account
  // scope for the "all channels" view and the pagination cursor.
  const conditions: string[] = [];
  if (!p.channel && gmailAccount) conditions.push(`or(${gmailScope(gmailAccount)})`);
  if (p.cursor) {
    const [at, id] = p.cursor.split("|");
    if (!at || isNaN(Date.parse(at)) || !/^[0-9a-f-]{36}$/.test(id || ""))
      throw new HttpError(400, "Ongeldige pagina.");
    const iso = new Date(at).toISOString();
    const op = asc ? "gt" : "lt";
    conditions.push(
      `or(last_message_at.${op}."${iso}",and(last_message_at.eq."${iso}",id.${op}.${id}))`,
    );
  }
  if (conditions.length === 1) query = query.or(conditions[0].slice(3, -1));
  else if (conditions.length > 1) query = query.or(`and(${conditions.join(",")})`);
  const q = (p.q || "").trim().slice(0, 100);
  if (q) {
    // Server-side search: contact/subject/preview, plus message bodies.
    const { data: hits } = await db()
      .from("inbox_messages")
      .select("conversation_id")
      .eq("workspace_id", workspaceId)
      .neq("direction", "note")
      .ilike("body", like(q))
      .order("provider_created_at", { ascending: false })
      .limit(200);
    const { data: byMeta } = await db()
      .from("inbox_conversations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("search_text", like(q.toLowerCase()))
      .limit(200);
    const ids = [
      ...new Set([
        ...(hits || []).map((h) => h.conversation_id),
        ...(byMeta || []).map((h) => h.id),
      ]),
    ].slice(0, 200);
    if (!ids.length) return { conversations: [], nextCursor: null };
    query = query.in("id", ids);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data || []) as ConversationRow[];
  const page = rows.slice(0, CONVERSATION_PAGE);
  const last = page[page.length - 1];
  return {
    conversations: page.map(toConversationView),
    nextCursor:
      rows.length > CONVERSATION_PAGE && last
        ? last.last_message_at + "|" + last.id
        : null,
  };
}

// Conversations with unread messages per channel (for the channel rail).
// Gmail counts only the mailbox that is linked right now.
export async function unreadByChannel(workspaceId: string): Promise<Record<Channel, number>> {
  const gmailAccount = await visibleGmailAccount(workspaceId);
  const channels: Channel[] = ["gmail", "instagram", "messenger", "whatsapp"];
  const counts = await Promise.all(
    channels.map(async (channel) => {
      if (channel === "gmail" && !gmailAccount) return 0;
      let query = db()
        .from("inbox_conversations")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("provider", channel)
        .gt("unread_count", 0);
      if (channel === "gmail") query = query.eq("provider_account_id", gmailAccount!);
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    }),
  );
  return Object.fromEntries(channels.map((c, i) => [c, counts[i]])) as Record<Channel, number>;
}

export async function unreadCount(workspaceId: string) {
  const gmailAccount = await visibleGmailAccount(workspaceId);
  let query = db()
    .from("inbox_conversations")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gt("unread_count", 0);
  query = gmailAccount ? query.or(gmailScope(gmailAccount)) : query.neq("provider", "gmail");
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function conversationRow(workspaceId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id))
    throw new HttpError(404, "Gesprek niet gevonden.");
  const { data } = await db()
    .from("inbox_conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new HttpError(404, "Gesprek niet gevonden.");
  if (
    data.provider === "gmail" &&
    data.provider_account_id !== (await visibleGmailAccount(workspaceId))
  )
    throw new HttpError(404, "Gesprek niet gevonden.");
  return data as ConversationRow;
}

async function memberNames(workspaceId: string) {
  const { data: members } = await db()
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  const ids = (members || []).map((m) => m.user_id as string);
  const { data: profiles } = ids.length
    ? await db().from("profiles").select("id,full_name").in("id", ids)
    : { data: [] };
  return new Map(
    (profiles || []).map((p) => [
      p.id as string,
      (p.full_name as string) || "Teamlid",
    ]),
  );
}

export async function getConversation(
  workspaceId: string,
  id: string,
  before?: string,
) {
  const row = await conversationRow(workspaceId, id);
  let q = db()
    .from("inbox_messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", row.id)
    .order("provider_created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(MESSAGE_PAGE + 1);
  if (before) {
    if (isNaN(Date.parse(before)))
      throw new HttpError(400, "Ongeldige pagina.");
    q = q.lt("provider_created_at", new Date(before).toISOString());
  }
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data || []) as MessageRow[];
  const names = await memberNames(workspaceId);
  const view = toConversationView(row);
  const messages = rows
    .slice(0, MESSAGE_PAGE)
    .reverse()
    .map((r) => toMessageView(r, names, view.contact.name));
  if (!before && row.unread_count > 0) {
    await db()
      .from("inbox_conversations")
      .update({ unread_count: 0 })
      .eq("id", row.id);
    view.unread = 0;
  }
  let contact = null;
  if (row.contact_id) {
    const found = (await workspaceContacts(workspaceId)).find(
      (c) => c.id === row.contact_id,
    ) as Record<string, string> | undefined;
    if (found)
      contact = {
        id: found.id,
        name:
          [found.firstName, found.lastName].filter(Boolean).join(" ") ||
          found.email,
        email: found.email || "",
        phone: found.phone || "",
        company: found.company || "",
        status: found.status || "",
      };
  }
  const members = [...names.entries()].map(([userId, name]) => ({
    userId,
    name,
  }));
  return {
    conversation: view,
    messages,
    hasMore: rows.length > MESSAGE_PAGE,
    window: windowState(row.provider, row.last_inbound_at),
    capabilities: capabilities[row.provider],
    contact,
    members,
  };
}

// ---------------------------------------------------------------- Actions

export type SendInput = {
  clientId: string;
  body: string;
  attachments?: Upload[];
  template?: { name: string; language: string; variables: string[] };
};

export async function sendReply(
  ctx: { workspaceId: string; userId: string },
  id: string,
  input: SendInput,
) {
  const row = await conversationRow(ctx.workspaceId, id);
  const caps = capabilities[row.provider];
  const body = cleanText(
    input.body,
    row.provider === "gmail"
      ? 20000
      : row.provider === "whatsapp"
        ? 4096
        : 1000,
  );
  const attachments = input.attachments || [];
  if (attachments.length && !caps.outboundAttachments)
    throw new HttpError(
      400,
      "Bijlagen versturen kan nog niet via " + caps.label + ".",
    );
  if (attachments.length) {
    const problem = validateUploads(attachments);
    if (problem) throw new HttpError(400, problem);
  }
  if (input.template && !caps.templates)
    throw new HttpError(
      400,
      "Templates zijn alleen beschikbaar voor WhatsApp.",
    );
  if (!input.template && !body.trim() && !attachments.length)
    throw new HttpError(400, "Schrijf eerst een bericht.");
  const win = windowState(row.provider, row.last_inbound_at);
  if (win.applies && !win.open && !input.template)
    throw new HttpError(
      409,
      row.provider === "whatsapp"
        ? "Het 24-uursvenster is gesloten. Stuur een goedgekeurde template."
        : "Het 24-uursvenster is gesloten. Je kunt pas weer antwoorden als de klant opnieuw een bericht stuurt.",
    );
  const text = input.template
    ? `Template: ${input.template.name}` +
      (input.template.variables.length
        ? " (" + input.template.variables.join(", ") + ")"
        : "")
    : body;

  // Idempotent by client id: a retry re-sends the same row.
  const { data: existing } = await db()
    .from("inbox_messages")
    .select(MESSAGE_COLUMNS)
    .eq("workspace_id", ctx.workspaceId)
    .eq("client_message_id", input.clientId)
    .maybeSingle();
  let messageId: string;
  if (existing) {
    if ((existing as MessageRow).conversation_id !== row.id)
      throw new HttpError(409, "Ongeldige aanvraag.");
    if ((existing as MessageRow).delivery_status !== "failed")
      return {
        messageId: existing.id as string,
        status: existing.delivery_status as DeliveryStatus,
      };
    messageId = existing.id as string;
    await db()
      .from("inbox_messages")
      .update({ delivery_status: "pending", error: null })
      .eq("id", messageId);
  } else {
    const { data, error } = await db()
      .from("inbox_messages")
      .insert({
        workspace_id: ctx.workspaceId,
        conversation_id: row.id,
        provider: row.provider,
        provider_account_id: row.provider_account_id,
        client_message_id: input.clientId,
        direction: "outbound",
        author_user_id: ctx.userId,
        body: text,
        attachments: attachments.map((a) => ({
          kind: a.mimeType.startsWith("image/") ? "image" : "file",
          name: a.name,
          mimeType: a.mimeType,
          size: Buffer.byteLength(a.data, "base64"),
        })),
        delivery_status: "pending",
        metadata: input.template ? { template: input.template.name } : {},
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505")
        return { messageId: "", status: "pending" as DeliveryStatus };
      throw error;
    }
    messageId = data.id;
  }

  try {
    let providerId: string;
    if (row.provider === "gmail") {
      const sent = await replyGmailThread(
        ctx.workspaceId,
        row.provider_thread_id,
        body,
        row.provider_account_id,
        attachments,
      );
      providerId = String(sent.id);
    } else if (input.template) {
      providerId = await sendWhatsAppTemplate(
        ctx.workspaceId,
        row.provider_thread_id,
        input.template,
      );
    } else {
      providerId = await sendMetaText(
        ctx.workspaceId,
        row.provider as MetaProvider,
        row.provider_thread_id,
        body,
      );
    }
    const now = new Date().toISOString();
    let { error } = await db()
      .from("inbox_messages")
      .update({
        provider_message_id: providerId,
        delivery_status: "sent",
        error: null,
        provider_created_at: now,
      })
      .eq("id", messageId);
    if (error?.code === "23505") {
      // The provider's echo webhook/sync arrived first; keep our row (author,
      // client id) and drop the anonymous echo copy.
      await db()
        .from("inbox_messages")
        .delete()
        .eq("workspace_id", ctx.workspaceId)
        .eq("provider", row.provider)
        .eq("provider_account_id", row.provider_account_id)
        .eq("provider_message_id", providerId)
        .is("client_message_id", null);
      ({ error } = await db()
        .from("inbox_messages")
        .update({
          provider_message_id: providerId,
          delivery_status: "sent",
          error: null,
          provider_created_at: now,
        })
        .eq("id", messageId));
    }
    if (error) throw error;
    await db().rpc("inbox_touch_conversation", {
      p_id: row.id,
      p_at: now,
      p_preview: preview(
        text,
        attachments.map((a) => ({
          kind: "file",
          name: a.name,
          mimeType: a.mimeType,
        })),
      ),
      p_direction: "outbound",
      p_search: searchText(
        row.external_contact || {},
        row.subject,
        preview(text),
      ),
      p_unread: false,
    });
    log("inbox_message_sent", { provider: row.provider });
    return { messageId, status: "sent" as DeliveryStatus };
  } catch (e) {
    const message =
      e instanceof HttpError ? e.message : "Versturen is niet gelukt.";
    await db()
      .from("inbox_messages")
      .update({ delivery_status: "failed", error: message })
      .eq("id", messageId);
    log("inbox_message_failed", {
      provider: row.provider,
      code: e instanceof HttpError ? e.status : 500,
    });
    return { messageId, status: "failed" as DeliveryStatus, error: message };
  }
}

export async function addNote(
  ctx: { workspaceId: string; userId: string },
  id: string,
  body: string,
  clientId: string,
) {
  const row = await conversationRow(ctx.workspaceId, id);
  const text = cleanText(body, 5000).trim();
  if (!text) throw new HttpError(400, "Schrijf eerst een notitie.");
  const { data, error } = await db()
    .from("inbox_messages")
    .insert({
      workspace_id: ctx.workspaceId,
      conversation_id: row.id,
      provider: row.provider,
      provider_account_id: row.provider_account_id,
      client_message_id: clientId,
      direction: "note",
      author_user_id: ctx.userId,
      body: text,
      delivery_status: "sent",
    })
    .select("id")
    .single();
  if (error?.code === "23505") return { messageId: "" };
  if (error) throw error;
  return { messageId: data.id as string };
}

export async function updateConversation(
  workspaceId: string,
  id: string,
  patch: {
    status?: "open" | "pending" | "resolved";
    assignedUserId?: string | null;
    unread?: boolean;
    labels?: string[];
  },
) {
  const row = await conversationRow(workspaceId, id);
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.status) update.status = patch.status;
  if (patch.labels)
    update.labels = [
      ...new Set(patch.labels.map((l) => l.trim()).filter(Boolean)),
    ].slice(0, 10);
  if (patch.unread !== undefined)
    update.unread_count = patch.unread ? Math.max(1, row.unread_count) : 0;
  if (patch.assignedUserId !== undefined) {
    if (patch.assignedUserId) {
      const { data: member } = await db()
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", patch.assignedUserId)
        .maybeSingle();
      if (!member)
        throw new HttpError(400, "Dit teamlid hoort niet bij deze werkruimte.");
    }
    update.assigned_user_id = patch.assignedUserId;
  }
  const { error } = await db()
    .from("inbox_conversations")
    .update(update)
    .eq("id", row.id);
  if (error) throw error;
}

// Attachment proxy: Gmail attachments and WhatsApp media need the stored
// token, so the browser fetches them through Mavix.
export async function attachment(
  workspaceId: string,
  messageId: string,
  index: number,
) {
  if (
    !/^[0-9a-f-]{36}$/.test(messageId) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 50
  )
    throw new HttpError(404, "Bijlage niet gevonden.");
  const { data: msg } = await db()
    .from("inbox_messages")
    .select("provider,provider_account_id,provider_message_id,attachments")
    .eq("workspace_id", workspaceId)
    .eq("id", messageId)
    .maybeSingle();
  const a = (msg?.attachments as Attachment[] | undefined)?.[index];
  if (!msg || !a?.ref) throw new HttpError(404, "Bijlage niet gevonden.");
  if (msg.provider === "gmail") {
    if (!/^[\w-]{1,1000}$/.test(a.ref) || !msg.provider_message_id)
      throw new HttpError(404, "Bijlage niet gevonden.");
    const d = await gmail(
      workspaceId,
      `/messages/${encodeURIComponent(msg.provider_message_id)}/attachments/${encodeURIComponent(a.ref)}`,
      {},
      msg.provider_account_id,
    );
    return {
      data: Buffer.from(String(d.data || ""), "base64url"),
      mimeType: a.mimeType || "application/octet-stream",
      name: a.name,
    };
  }
  if (msg.provider === "whatsapp") {
    const media = await whatsappMedia(workspaceId, a.ref);
    return { ...media, name: a.name };
  }
  throw new HttpError(404, "Bijlage niet gevonden.");
}

// Conversation context for Mavi (AI): recent customer/business messages
// only, no internal notes.
export async function conversationForAi(workspaceId: string, id: string) {
  const row = await conversationRow(workspaceId, id);
  const { data } = await db()
    .from("inbox_messages")
    .select("direction,body,attachments,provider_created_at")
    .eq("conversation_id", row.id)
    .neq("direction", "note")
    .order("provider_created_at", { ascending: false })
    .limit(30);
  const { data: profile } = await db()
    .from("business_profiles")
    .select("data")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return {
    channel: row.provider,
    subject: row.subject,
    customerName: toConversationView(row).contact.name,
    messages: (data || []).reverse().map((m) => ({
      from:
        m.direction === "inbound"
          ? ("customer" as const)
          : ("business" as const),
      text: String(m.body || "").slice(0, 2000),
      attachments: ((m.attachments as Attachment[]) || []).map((a) => a.name),
      at: m.provider_created_at as string,
    })),
    profile: ((profile?.data as { profile?: unknown })?.profile ||
      {}) as Record<string, unknown>,
  };
}

export async function metaConnected(
  workspaceId: string,
  provider: MetaProvider,
) {
  try {
    await metaConnection(workspaceId, provider);
    return true;
  } catch {
    return false;
  }
}
