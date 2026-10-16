import "server-only";
import { adminClient } from "./supabase";
import { HttpError } from "./access";
import { readiness } from "../instagram-model";
import { emptyWorkspace } from "../storage";
import type { Profile } from "../types";

// Mavix Agent persistence (migration 202610130001). Every function takes the
// owner from the server-side session (workspace() result), never from the
// browser, and filters on BOTH workspace_id and user_id: conversations are
// private to their creator. Writes use the service role after that check.

export type Owner = { workspaceId: string; userId: string };
const db = () => adminClient();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PAGE = 40;

const notReady = (e: { code?: string } | null) => !!e && ["42P01", "PGRST205", "42703"].includes(e.code || "");
function check(error: { code?: string; message?: string } | null, what = "De gesprekken konden niet worden geladen.") {
  if (!error) return;
  if (notReady(error)) {
    console.error(JSON.stringify({ event: "agent_not_provisioned" }));
    throw new HttpError(503, "Gesprekken bewaren wordt nog ingericht. Probeer het later opnieuw.");
  }
  console.error(JSON.stringify({ event: "agent_db_error", code: error.code || "error" }));
  throw new HttpError(503, what);
}
const id = (value: string, label = "gesprek") => {
  if (!UUID.test(value)) throw new HttpError(404, `Dit ${label} bestaat niet.`);
  return value;
};

export type ConversationRow = { id: string; title: string; folder_id: string | null; pinned: boolean; archived: boolean; message_count: number; last_message_at: string; created_at: string };
const CONV_COLUMNS = "id,title,folder_id,pinned,archived,message_count,last_message_at,created_at";

export async function listConversations(o: Owner, opts: { archived?: boolean; before?: string | null; q?: string | null } = {}) {
  const q = (opts.q || "").trim().slice(0, 80);
  if (q) return searchConversations(o, q);
  let query = db()
    .from("agent_conversations")
    .select(CONV_COLUMNS)
    .eq("workspace_id", o.workspaceId)
    .eq("user_id", o.userId)
    .eq("archived", !!opts.archived)
    .order("last_message_at", { ascending: false })
    .limit(PAGE + 1);
  if (opts.before) query = query.lt("last_message_at", opts.before);
  const { data, error } = await query;
  check(error);
  const rows = (data || []) as ConversationRow[];
  return { conversations: rows.slice(0, PAGE), more: rows.length > PAGE };
}

// Titles and message text. Patterns are escaped; results stay within the
// caller's own conversations.
async function searchConversations(o: Owner, q: string) {
  const like = "%" + q.replace(/[\\%_]/g, (m) => "\\" + m) + "%";
  const [titles, messages] = await Promise.all([
    db().from("agent_conversations").select(CONV_COLUMNS).eq("workspace_id", o.workspaceId).eq("user_id", o.userId).ilike("title", like).order("last_message_at", { ascending: false }).limit(PAGE),
    db().from("agent_messages").select("conversation_id").eq("workspace_id", o.workspaceId).eq("user_id", o.userId).ilike("content", like).order("created_at", { ascending: false }).limit(200),
  ]);
  check(titles.error || messages.error);
  const found = new Map((titles.data || []).map((c) => [c.id as string, c as ConversationRow]));
  const extra = [...new Set((messages.data || []).map((m) => m.conversation_id as string))].filter((cid) => !found.has(cid)).slice(0, PAGE);
  if (extra.length) {
    const { data, error } = await db().from("agent_conversations").select(CONV_COLUMNS).eq("workspace_id", o.workspaceId).eq("user_id", o.userId).in("id", extra);
    check(error);
    for (const c of data || []) found.set(c.id as string, c as ConversationRow);
  }
  const conversations = [...found.values()].sort((a, b) => (a.last_message_at < b.last_message_at ? 1 : -1)).slice(0, PAGE);
  return { conversations, more: false };
}

export async function getConversation(o: Owner, conversationId: string) {
  const { data, error } = await db()
    .from("agent_conversations")
    .select(CONV_COLUMNS)
    .eq("id", id(conversationId))
    .eq("workspace_id", o.workspaceId)
    .eq("user_id", o.userId)
    .maybeSingle();
  check(error);
  // Another user's or workspace's conversation looks exactly like a missing one.
  if (!data) throw new HttpError(404, "Dit gesprek bestaat niet.");
  return data as ConversationRow;
}

export async function createConversation(o: Owner, title: string) {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("agent_conversations")
    .insert({ workspace_id: o.workspaceId, user_id: o.userId, title: title.slice(0, 120) || "Nieuw gesprek", folder_id: null, pinned: false, archived: false, message_count: 0, created_at: now, updated_at: now, last_message_at: now })
    .select(CONV_COLUMNS)
    .single();
  check(error, "Het gesprek kon niet worden aangemaakt.");
  return data as ConversationRow;
}

export async function updateConversation(o: Owner, conversationId: string, patch: { title?: string; folderId?: string | null; pinned?: boolean; archived?: boolean }) {
  await getConversation(o, conversationId);
  const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) values.title = patch.title.trim().slice(0, 120) || "Nieuw gesprek";
  if (patch.pinned !== undefined) values.pinned = patch.pinned;
  if (patch.archived !== undefined) values.archived = patch.archived;
  if (patch.folderId !== undefined) {
    if (patch.folderId) await getFolder(o, patch.folderId); // only into the caller's own folder
    values.folder_id = patch.folderId;
  }
  const { data, error } = await db().from("agent_conversations").update(values).eq("id", conversationId).eq("workspace_id", o.workspaceId).eq("user_id", o.userId).select(CONV_COLUMNS).single();
  check(error, "Het gesprek kon niet worden bijgewerkt.");
  return data as ConversationRow;
}

/** Deletes the conversation and its messages (user-confirmed in the UI). */
export async function deleteConversation(o: Owner, conversationId: string) {
  await getConversation(o, conversationId);
  const { error: msgError } = await db().from("agent_messages").delete().eq("conversation_id", conversationId).eq("workspace_id", o.workspaceId).eq("user_id", o.userId);
  check(msgError, "Het gesprek kon niet worden verwijderd.");
  const { error } = await db().from("agent_conversations").delete().eq("id", conversationId).eq("workspace_id", o.workspaceId).eq("user_id", o.userId);
  check(error, "Het gesprek kon niet worden verwijderd.");
}

/** Extra data shown with an answer: a link, the tools used, a proposal awaiting confirmation. All optional (older messages only have href/label). */
export type MessageAction = { href?: string; label?: string; tools?: string[]; proposal?: { id: string; summary: string; status: string; href?: string } };
export type MessageRow = { id: string; role: "user" | "assistant"; content: string; status: "ok" | "failed"; model: string | null; action: MessageAction | null; created_at: string };
const MSG_COLUMNS = "id,role,content,status,model,action,created_at";

/** Newest page of messages (chronological), with a cursor for older ones. */
export async function listMessages(o: Owner, conversationId: string, before?: string | null) {
  await getConversation(o, conversationId);
  let query = db().from("agent_messages").select(MSG_COLUMNS).eq("conversation_id", conversationId).eq("workspace_id", o.workspaceId).eq("user_id", o.userId).order("created_at", { ascending: false }).limit(PAGE + 1);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  check(error);
  const rows = (data || []) as MessageRow[];
  return { messages: rows.slice(0, PAGE).reverse(), more: rows.length > PAGE };
}

// Strictly increasing timestamps, so a question and its answer never tie.
let lastStamp = 0;
const stamp = () => {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return new Date(lastStamp).toISOString();
};

export async function addMessage(o: Owner, conversationId: string, m: { role: "user" | "assistant"; content: string; status?: "ok" | "failed"; model?: string | null; action?: MessageAction | null }) {
  const now = stamp();
  const { data, error } = await db()
    .from("agent_messages")
    .insert({ conversation_id: conversationId, workspace_id: o.workspaceId, user_id: o.userId, role: m.role, content: m.content.slice(0, 20000), status: m.status || "ok", model: m.model || null, action: m.action || null, created_at: now })
    .select(MSG_COLUMNS)
    .single();
  check(error, "Het bericht kon niet worden opgeslagen.");
  const conv = await getConversation(o, conversationId);
  await db().from("agent_conversations").update({ last_message_at: now, updated_at: now, message_count: conv.message_count + 1 }).eq("id", conversationId).eq("workspace_id", o.workspaceId).eq("user_id", o.userId);
  return data as MessageRow;
}

/** Updates the proposal status shown on an answer (after confirm/cancel). */
export async function setProposalStatus(o: Owner, messageId: string, proposal: NonNullable<MessageAction["proposal"]>) {
  const { data } = await db().from("agent_messages").select("action").eq("id", messageId).eq("workspace_id", o.workspaceId).eq("user_id", o.userId).maybeSingle();
  if (!data) return;
  await db()
    .from("agent_messages")
    .update({ action: { ...((data.action as MessageAction) || {}), proposal } })
    .eq("id", messageId)
    .eq("workspace_id", o.workspaceId)
    .eq("user_id", o.userId);
}

// ---------- Folders ----------
export type FolderRow = { id: string; name: string; created_at: string; instructions?: string | null };
const missingColumn = (e: { code?: string } | null) => e?.code === "42703" || e?.code === "PGRST204";
export async function listFolders(o: Owner) {
  const query = (cols: string) => db().from("agent_folders").select(cols).eq("workspace_id", o.workspaceId).eq("user_id", o.userId).order("name").limit(200);
  let { data, error } = await query("id,name,created_at,instructions");
  // Before migration 202610170001 the instructions column does not exist yet.
  if (missingColumn(error)) ({ data, error } = await query("id,name,created_at"));
  check(error);
  return (data || []) as unknown as FolderRow[];
}

/** Project instructions for the agent context; empty when not set or not provisioned. */
export async function folderInstructions(o: Owner, folderId: string | null) {
  if (!folderId) return null;
  const { data, error } = await db().from("agent_folders").select("name,instructions").eq("id", folderId).eq("workspace_id", o.workspaceId).eq("user_id", o.userId).maybeSingle();
  if (error || !data) return null;
  return { name: String(data.name), instructions: String(data.instructions || "") };
}

export async function setFolderInstructions(o: Owner, folderId: string, instructions: string) {
  await getFolder(o, folderId);
  const { data, error } = await db()
    .from("agent_folders")
    .update({ instructions: instructions.trim().slice(0, 2000) || null, updated_at: new Date().toISOString() })
    .eq("id", folderId)
    .eq("workspace_id", o.workspaceId)
    .eq("user_id", o.userId)
    .select("id,name,created_at,instructions")
    .single();
  if (missingColumn(error)) throw new HttpError(503, "Projectinstructies worden nog ingericht. Probeer het later opnieuw.");
  check(error, "De instructies konden niet worden opgeslagen.");
  return data as FolderRow;
}
export async function getFolder(o: Owner, folderId: string) {
  const { data, error } = await db().from("agent_folders").select("id,name,created_at").eq("id", id(folderId, "project")).eq("workspace_id", o.workspaceId).eq("user_id", o.userId).maybeSingle();
  check(error);
  if (!data) throw new HttpError(404, "Dit project bestaat niet.");
  return data as FolderRow;
}
export async function createFolder(o: Owner, name: string) {
  const { count, error: countError } = await db().from("agent_folders").select("id", { count: "exact", head: true }).eq("workspace_id", o.workspaceId).eq("user_id", o.userId);
  check(countError);
  if ((count || 0) >= 100) throw new HttpError(400, "Je kunt maximaal 100 projecten maken.");
  const now = new Date().toISOString();
  const { data, error } = await db().from("agent_folders").insert({ workspace_id: o.workspaceId, user_id: o.userId, name: name.trim().slice(0, 60), created_at: now, updated_at: now }).select("id,name,created_at").single();
  check(error, "Het project kon niet worden aangemaakt.");
  return data as FolderRow;
}
export async function renameFolder(o: Owner, folderId: string, name: string) {
  await getFolder(o, folderId);
  const { data, error } = await db().from("agent_folders").update({ name: name.trim().slice(0, 60), updated_at: new Date().toISOString() }).eq("id", folderId).eq("workspace_id", o.workspaceId).eq("user_id", o.userId).select("id,name,created_at").single();
  check(error, "Het project kon niet worden hernoemd.");
  return data as FolderRow;
}
/** Removes the folder only; its conversations move to "no folder". */
export async function deleteFolder(o: Owner, folderId: string) {
  await getFolder(o, folderId);
  const { error: moveError } = await db().from("agent_conversations").update({ folder_id: null }).eq("folder_id", folderId).eq("workspace_id", o.workspaceId).eq("user_id", o.userId);
  check(moveError, "Het project kon niet worden verwijderd.");
  const { error } = await db().from("agent_folders").delete().eq("id", folderId).eq("workspace_id", o.workspaceId).eq("user_id", o.userId);
  check(error, "Het project kon niet worden verwijderd.");
}

// ---------- Business context for the model (server-side, own workspace) ----------
export async function workspaceContext(workspaceId: string) {
  const [{ data: bp, error }, { data: conns }] = await Promise.all([
    db().from("business_profiles").select("data").eq("workspace_id", workspaceId).maybeSingle(),
    db().from("integration_connections").select("provider,status").eq("workspace_id", workspaceId),
  ]);
  if (error) throw new HttpError(503, "Je werkruimte kon niet worden geladen.");
  const w = (bp?.data || {}) as { profile?: Record<string, unknown>; posts?: { status: string }[]; email?: { campaigns?: { status: string }[] } };
  const posts = w.posts || [];
  const campaigns = w.email?.campaigns || [];
  return {
    profile: w.profile || {},
    state: {
      brand_hub_complete_percent: readiness({ ...emptyWorkspace.profile, ...(w.profile || {}) } as Profile).score,
      drafts_waiting_for_approval: posts.filter((p) => p.status === "draft").length + campaigns.filter((c) => c.status === "draft").length,
      scheduled_posts: posts.filter((p) => p.status === "scheduled").length,
      scheduled_emails: campaigns.filter((c) => c.status === "scheduled").length,
      connected_integrations: (conns || []).filter((c) => c.status === "connected").map((c) => c.provider as string),
    },
  };
}
