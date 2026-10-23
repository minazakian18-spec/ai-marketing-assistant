"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  ChevronDown,
  Folder,
  FolderInput,
  FolderPlus,
  Plus,
  Menu as MenuIcon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  ScrollText,
  Search,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import { MaviAvatar, MaviMascot, useMascotState } from "@/components/mavi";
import { Menu, type MenuItem } from "@/components/menu";
import { IconButton } from "@/components/ui";
import { AgentComposer } from "@/components/agent-composer";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { isBrowserDemo } from "@/lib/demo";
import { AGENT_SUGGESTIONS } from "@/lib/agent/capabilities";
import { Markdown } from "./markdown";
import { UpgradeNotice, usePlan } from "@/components/plan-gate";
import { useAgent } from "./agent-provider";

// Mavix Agent workspace: conversation sidebar (folders, pinned, recent,
// older, archive, search) and the conversation itself. Everything is stored
// on the server (/api/agent/*); this component only holds what is on screen.

type Conversation = { id: string; title: string; folder_id: string | null; pinned: boolean; archived: boolean; message_count: number; last_message_at: string };
type FolderRow = { id: string; name: string; instructions?: string | null };
type Proposal = { id: string; summary: string; status: string; href?: string };
type MessageAction = { href?: string; label?: string; tools?: string[]; proposal?: Proposal };
type Message = { id: string; role: "user" | "assistant"; content: string; status: "ok" | "failed"; action: MessageAction | null; created_at: string; pending?: boolean };

// What Mavi looked up for an answer, in plain words.
const TOOL_LABEL: Record<string, string> = {
  get_brand_context: "Brand Hub",
  get_integrations: "Koppelingen",
  get_schedule: "Kalender",
  list_content: "Content",
  get_campaigns: "Campagnes",
  search_media: "Bibliotheek",
  list_reviews: "Reviews",
  get_inbox_overview: "Inbox",
  get_seo_summary: "SEO",
  prepare_campaign_drafts: "Voorstel klaargezet",
};
const PROPOSAL_STATUS: Record<string, string> = {
  done: "Opgeslagen als concepten",
  cancelled: "Geannuleerd",
  expired: "Verlopen",
  failed: "Niet gelukt",
  executing: "Bezig met opslaan…",
};

async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<{ ok: boolean; status: number; body: T & { error?: string } }> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: init?.json !== undefined ? { "Content-Type": "application/json", ...(init?.headers || {}) } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

const DAY = 86_400_000;
const sortRecent = (list: Conversation[]) => [...list].sort((a, b) => (a.last_message_at < b.last_message_at ? 1 : -1));

export function AgentWorkspace() {
  const router = useRouter();
  const search = useSearchParams();
  const { takeHandoff, setActivity } = useAgent();
  const demo = isBrowserDemo();
  const plan = usePlan();

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [more, setMore] = useState(false);
  const [listError, setListError] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [archivedView, setArchivedView] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const [activeId, setActiveId] = useState<string | null>(search.get("c"));
  // Project for a new conversation that does not exist yet: sent with the
  // first message, so the server creates the conversation inside the project.
  const [draftFolder, setDraftFolder] = useState<string | null>(search.get("c") ? null : search.get("project"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [moreMessages, setMoreMessages] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  // Mavi's state: typing in the composer, and the real outcome of the last request.
  const [typing, setTyping] = useState(false);
  const [outcome, setOutcome] = useState<{ result: "ok" | "error"; at: number } | null>(null);
  const mascot = useMascotState({ typing, busy: sending, outcome });
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({ text: "", key: 0 });

  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [renaming, setRenaming] = useState<{ kind: "conversation" | "folder"; id: string; value: string } | null>(null);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState<{ kind: "conversation" | "folder"; id: string; name: string } | null>(null);
  const [instructions, setInstructions] = useState<{ id: string; name: string; value: string } | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);

  const thread = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const handoffDone = useRef(false);

  const active = conversations.find((c) => c.id === activeId) || null;
  // The project shown in the header: the open conversation's, or the one a new conversation will start in.
  const projectId = active ? active.folder_id : activeId ? null : draftFolder;
  const project = projectId ? folders.find((f) => f.id === projectId) || null : null;

  // The mobile drawer closes with Escape.
  useEffect(() => {
    if (!drawer) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [drawer]);

  // ---------- Loading ----------
  const loadList = useCallback(
    async (opts: { append?: boolean; q?: string; archived?: boolean } = {}) => {
      const params = new URLSearchParams();
      if (opts.archived) params.set("archived", "1");
      if (opts.q) params.set("q", opts.q);
      if (opts.append && conversations.length) params.set("before", conversations[conversations.length - 1].last_message_at);
      const r = await api<{ conversations: Conversation[]; folders: FolderRow[]; more: boolean }>("/api/agent/conversations?" + params);
      setLoadingList(false);
      if (!r.ok) {
        setListError(r.body.error || "De gesprekken konden niet worden geladen.");
        return;
      }
      setListError("");
      setFolders(r.body.folders);
      setMore(r.body.more);
      setConversations((prev) => (opts.append ? [...prev, ...r.body.conversations] : r.body.conversations));
    },
    [conversations],
  );

  useEffect(() => {
    if (demo) {
      setConfigured(false);
      setLoadingList(false);
      return;
    }
    void api<{ configured: boolean }>("/api/agent").then((r) => setConfigured(r.ok ? !!r.body.configured : false));
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [demo]);

  // Debounced search across titles and message text.
  useEffect(() => {
    if (demo) return;
    const q = query.trim();
    const t = window.setTimeout(() => {
      setSearching(!!q);
      void loadList({ q, archived: archivedView });
    }, q ? 300 : 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on query/view change
  }, [query, archivedView, demo]);

  const openConversation = useCallback(
    async (id: string | null, folderId: string | null = null) => {
      setActiveId(id);
      setNotice("");
      setDrawer(false);
      // A new conversation can start inside a project; an existing one shows its own project.
      setDraftFolder(id ? null : folderId);
      if (!id && folderId) setOpenFolders((o) => ({ ...o, [folderId]: true }));
      router.replace(id ? "/agent?c=" + id : folderId ? "/agent?project=" + folderId : "/agent", { scroll: false });
      if (!id) {
        setMessages([]);
        setMoreMessages(false);
        return;
      }
      setLoadingThread(true);
      const r = await api<{ messages: Message[]; more: boolean; conversation: Conversation }>("/api/agent/conversations/" + id);
      setLoadingThread(false);
      if (!r.ok) {
        setNotice(r.body.error || "Dit gesprek kon niet worden geopend.");
        setMessages([]);
        return;
      }
      atBottom.current = true;
      setMessages(r.body.messages);
      setMoreMessages(r.body.more);
    },
    [router],
  );

  // A project from the URL that is not (or no longer) one of the user's own:
  // start without a project instead of failing on the first message.
  useEffect(() => {
    if (loadingList || !draftFolder || folders.some((f) => f.id === draftFolder)) return;
    setDraftFolder(null);
    if (!activeId) router.replace("/agent", { scroll: false });
  }, [loadingList, draftFolder, folders, activeId, router]);

  // Conversation from the URL after a reload.
  useEffect(() => {
    const c = search.get("c");
    if (c && !demo) void openConversation(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  async function loadOlder() {
    if (!activeId || !messages.length) return;
    const el = thread.current;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    const r = await api<{ messages: Message[]; more: boolean }>(`/api/agent/conversations/${activeId}?before=${encodeURIComponent(messages[0].created_at)}`);
    if (!r.ok) return setNotice(r.body.error || "Eerdere berichten konden niet worden geladen.");
    atBottom.current = false;
    setMessages((m) => [...r.body.messages, ...m]);
    setMoreMessages(r.body.more);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - before;
    });
  }

  // Follow new messages only when the reader is already at the bottom.
  useEffect(() => {
    const el = thread.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // ---------- Sending ----------
  const upsert = (c: Conversation) => setConversations((list) => sortRecent([c, ...list.filter((x) => x.id !== c.id)]));

  const send = useCallback(
    async (text: string, retry = false) => {
      if (sending) return;
      if (!configured) {
        setNotice(demo ? "Mavix Agent werkt alleen met een echt account. Je vraag staat nog in het invoerveld." : "Mavix Agent is nog niet met een AI-model verbonden. Je vraag staat nog in het invoerveld.");
        if (!retry) setDraft((d) => ({ text, key: d.key + 1 }));
        return;
      }
      setNotice("");
      setSending(true);
      setActivity("thinking");
      atBottom.current = true;
      const tempId = "temp-" + Date.now();
      if (!retry) setMessages((m) => [...m, { id: tempId, role: "user", content: text, status: "ok", action: null, created_at: new Date().toISOString(), pending: true }]);
      const r = await api<{ configured: boolean; conversation?: Conversation; userMessage?: Message | null; reply?: Message }>("/api/agent", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        json: retry ? { retry: true, conversationId: activeId } : { text, conversationId: activeId || undefined, folderId: !activeId && draftFolder ? draftFolder : undefined },
      });
      setSending(false);
      setActivity(r.ok ? "done" : "idle");
      setOutcome({ result: r.ok && r.body.reply?.status !== "failed" && !!r.body.conversation ? "ok" : "error", at: Date.now() });
      if (r.body.configured === false) {
        setConfigured(false);
        setMessages((m) => m.filter((x) => x.id !== tempId));
        setDraft((d) => ({ text, key: d.key + 1 }));
        setNotice("Mavix Agent is nog niet met een AI-model verbonden. Je vraag staat nog in het invoerveld.");
        return;
      }
      if (!r.body.conversation) {
        // Refused before anything was stored (rate limit, access): keep the draft.
        setMessages((m) => m.filter((x) => x.id !== tempId));
        if (!retry) setDraft((d) => ({ text, key: d.key + 1 }));
        setNotice(r.body.error || "Je vraag kon niet worden verstuurd. Probeer het opnieuw.");
        return;
      }
      const conv = r.body.conversation;
      if (!activeId) {
        setActiveId(conv.id);
        setDraftFolder(null);
        if (conv.folder_id) setOpenFolders((o) => ({ ...o, [conv.folder_id as string]: true }));
        router.replace("/agent?c=" + conv.id, { scroll: false });
      }
      upsert(conv);
      setMessages((m) => [...m.filter((x) => x.id !== tempId), ...(r.body.userMessage ? [r.body.userMessage] : []), ...(r.body.reply ? [r.body.reply] : [])]);
    },
    [sending, configured, demo, activeId, draftFolder, router, setActivity],
  );

  // Prompt handed over from the dashboard or the quick panel.
  useEffect(() => {
    if (handoffDone.current || configured === null) return;
    handoffDone.current = true;
    const q = takeHandoff();
    if (!q) return;
    router.replace("/agent", { scroll: false });
    setActiveId(null);
    setDraftFolder(null);
    setMessages([]);
    void send(q);
  }, [configured, takeHandoff, send, router]);

  // ---------- Conversation and folder actions ----------
  async function patchConversation(id: string, patch: Partial<{ title: string; folderId: string | null; pinned: boolean; archived: boolean }>) {
    const r = await api<{ conversation: Conversation }>("/api/agent/conversations/" + id, { method: "PATCH", json: patch });
    if (!r.ok) return setNotice(r.body.error || "Wijzigen is niet gelukt.");
    const c = r.body.conversation;
    if (patch.archived !== undefined && c.archived !== archivedView) {
      setConversations((list) => list.filter((x) => x.id !== id));
      if (activeId === id) void openConversation(null);
    } else setConversations((list) => list.map((x) => (x.id === id ? c : x)));
  }
  async function removeConversation(id: string) {
    const r = await api("/api/agent/conversations/" + id, { method: "DELETE" });
    if (!r.ok) return setNotice(r.body.error || "Verwijderen is niet gelukt.");
    setConversations((list) => list.filter((x) => x.id !== id));
    if (activeId === id) void openConversation(null);
  }
  async function createFolder(name: string) {
    const r = await api<{ folder: FolderRow }>("/api/agent/folders", { method: "POST", json: { name } });
    if (!r.ok) return setNotice(r.body.error || "Het project kon niet worden aangemaakt.");
    setFolders((f) => [...f, r.body.folder].sort((a, b) => a.name.localeCompare(b.name)));
    setOpenFolders((o) => ({ ...o, [r.body.folder.id]: true }));
    // Start working in the new project right away: the next conversation is created inside it.
    await openConversation(null, r.body.folder.id);
    setNotice(`Project “${r.body.folder.name}” is aangemaakt. Je eerste vraag start een gesprek in dit project.`);
  }
  async function renameFolder(id: string, name: string) {
    const r = await api<{ folder: FolderRow }>("/api/agent/folders/" + id, { method: "PATCH", json: { name } });
    if (!r.ok) return setNotice(r.body.error || "Hernoemen is niet gelukt.");
    setFolders((f) => f.map((x) => (x.id === id ? r.body.folder : x)));
  }
  async function removeFolder(id: string) {
    const r = await api("/api/agent/folders/" + id, { method: "DELETE" });
    if (!r.ok) return setNotice(r.body.error || "Het project kon niet worden verwijderd.");
    setFolders((f) => f.filter((x) => x.id !== id));
    setConversations((list) => list.map((c) => (c.folder_id === id ? { ...c, folder_id: null } : c)));
    // A new conversation that was about to start in this project starts without one.
    if (draftFolder === id) void openConversation(null);
  }
  async function saveInstructions(id: string, value: string) {
    const r = await api<{ folder: FolderRow }>("/api/agent/folders/" + id, { method: "PATCH", json: { instructions: value } });
    if (!r.ok) return setNotice(r.body.error || "De instructies konden niet worden opgeslagen.");
    setFolders((f) => f.map((x) => (x.id === id ? r.body.folder : x)));
    setNotice("Projectinstructies opgeslagen. Mavix gebruikt ze in de gesprekken van dit project.");
  }
  // Confirm or cancel a change Mavi proposed. Only this click changes the workspace.
  async function decide(messageId: string, proposal: Proposal, decision: "confirm" | "cancel") {
    if (deciding) return;
    setDeciding(proposal.id);
    const r = await api<{ action: { id: string; status: string; summary: string; result: { href?: string } | null }; message: Message | null }>("/api/agent/actions/" + proposal.id, {
      method: "POST",
      json: { decision },
    });
    setDeciding(null);
    if (!r.ok) return setNotice(r.body.error || "Dit voorstel kon niet worden verwerkt. Probeer het opnieuw.");
    const a = r.body.action;
    setMessages((list) => [
      ...list.map((m) => (m.id === messageId && m.action ? { ...m, action: { ...m.action, proposal: { ...proposal, status: a.status, href: a.result?.href } } } : m)),
      ...(r.body.message ? [r.body.message] : []),
    ]);
    // Open Mavix screens load the workspace again, so the new drafts show up.
    if (a.status === "done") window.dispatchEvent(new Event("mavix:workspace-reload"));
  }
  async function commitRename() {
    if (!renaming) return;
    const value = renaming.value.trim();
    const target = renaming;
    setRenaming(null);
    if (!value) return;
    if (target.kind === "conversation") await patchConversation(target.id, { title: value });
    else await renameFolder(target.id, value);
  }

  // ---------- Sidebar groups ----------
  const groups = useMemo(() => {
    const now = Date.now();
    const pinned = conversations.filter((c) => c.pinned);
    const loose = conversations.filter((c) => !c.pinned && !c.folder_id);
    return {
      pinned,
      byFolder: (id: string) => conversations.filter((c) => c.folder_id === id && !c.pinned),
      recent: loose.filter((c) => now - Date.parse(c.last_message_at) < 7 * DAY),
      older: loose.filter((c) => now - Date.parse(c.last_message_at) >= 7 * DAY),
    };
  }, [conversations]);

  function conversationMenu(c: Conversation): MenuItem[] {
    return [
      { label: "Naam wijzigen", icon: <Pencil size={14} />, onSelect: () => setRenaming({ kind: "conversation", id: c.id, value: c.title }) },
      { label: c.pinned ? "Losmaken" : "Vastzetten", icon: c.pinned ? <PinOff size={14} /> : <Pin size={14} />, onSelect: () => void patchConversation(c.id, { pinned: !c.pinned }) },
      ...(folders.length || c.folder_id
        ? [
            { type: "heading" as const, label: "Verplaats naar project" },
            ...folders.map((f) => ({ label: f.name, icon: <FolderInput size={14} />, checked: c.folder_id === f.id, onSelect: () => void patchConversation(c.id, { folderId: f.id }) })),
            { label: "Geen project", checked: !c.folder_id, onSelect: () => void patchConversation(c.id, { folderId: null }) },
          ]
        : []),
      { type: "separator" as const },
      { label: c.archived ? "Terugzetten" : "Archiveren", icon: c.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />, onSelect: () => void patchConversation(c.id, { archived: !c.archived }) },
      { label: "Verwijderen", icon: <Trash2 size={14} />, danger: true, onSelect: () => setConfirm({ kind: "conversation", id: c.id, name: c.title }) },
    ] as MenuItem[];
  }

  const row = (c: Conversation) =>
    renaming?.kind === "conversation" && renaming.id === c.id ? (
      <li key={c.id}>
        <input
          className="ag-rename"
          autoFocus
          aria-label="Nieuwe naam voor gesprek"
          value={renaming.value}
          maxLength={120}
          onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
          onBlur={() => void commitRename()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commitRename();
            if (e.key === "Escape") setRenaming(null);
          }}
        />
      </li>
    ) : (
      <li key={c.id} className={"ag-conv" + (c.id === activeId ? " is-active" : "")}>
        <button type="button" className="ag-conv-open" aria-current={c.id === activeId ? "page" : undefined} onClick={() => void openConversation(c.id)} title={c.title}>
          {c.pinned && <Pin size={12} aria-hidden="true" className="ag-pin" />}
          <span>{c.title}</span>
        </button>
        <Menu label={"Acties voor " + c.title} className="ag-conv-menu" trigger={<MoreHorizontal size={15} />} items={conversationMenu(c)} />
      </li>
    );

  const section = (title: string, list: Conversation[]) =>
    list.length > 0 && (
      <section className="ag-group" aria-label={title}>
        <h3>{title}</h3>
        <ul>{list.map(row)}</ul>
      </section>
    );

  const empty = !activeId && !messages.length;
  const lastFailed = messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].status === "failed";

  const sidebar: ReactNode = (
    <>
      <div className="ag-side-head">
        <span className="ag-side-title">
          <MaviAvatar size={24} live={false} />
          Mavix Agent
        </span>
        <IconButton label="Zijbalk inklappen" className="ag-collapse" onClick={() => (drawer ? setDrawer(false) : setCollapsed(true))}>
          {drawer ? <X size={16} /> : <PanelLeftClose size={16} />}
        </IconButton>
      </div>
      <button type="button" className="ag-new" onClick={() => void openConversation(null)}>
        <SquarePen size={15} aria-hidden="true" />
        Nieuw gesprek
      </button>
      <label className="ag-search">
        <Search size={14} aria-hidden="true" />
        <span className="sr-only">Zoek in gesprekken</span>
        <input type="search" placeholder="Zoeken in gesprekken" value={query} onChange={(e) => setQuery(e.target.value)} disabled={demo} />
      </label>
      <nav className="ag-list" aria-label="Gesprekken">
        {loadingList ? (
          <div className="ag-skeleton" aria-busy="true" aria-label="Gesprekken laden">
            <span />
            <span />
            <span />
          </div>
        ) : listError ? (
          <p className="ag-muted" role="alert">
            {listError}
          </p>
        ) : searching ? (
          conversations.length ? section("Zoekresultaten", conversations) : <p className="ag-muted">Niets gevonden voor “{query.trim()}”.</p>
        ) : (
          <>
            {!archivedView && section("Vastgezet", groups.pinned)}
            {!archivedView && (
              <section className="ag-group" aria-label="Projecten">
                <div className="ag-group-head">
                  <h3>Projecten</h3>
                  {!demo && (
                    <IconButton label="Nieuw project" onClick={() => setNewFolder("")}>
                      <FolderPlus size={14} />
                    </IconButton>
                  )}
                </div>
                {newFolder !== null && (
                  <input
                    className="ag-rename"
                    autoFocus
                    aria-label="Naam van het nieuwe project"
                    placeholder="Naam van het project"
                    maxLength={60}
                    value={newFolder}
                    onChange={(e) => setNewFolder(e.target.value)}
                    onBlur={() => {
                      if (newFolder.trim()) void createFolder(newFolder.trim());
                      setNewFolder(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setNewFolder(null);
                    }}
                  />
                )}
                {!folders.length && newFolder === null && <p className="ag-muted ag-small">Nog geen projecten. Een project bundelt gesprekken over één campagne of onderwerp.</p>}
                <ul>
                  {folders.map((f) => {
                    const open = openFolders[f.id] ?? false;
                    const items = groups.byFolder(f.id);
                    return (
                      <li key={f.id} className="ag-folder">
                        {renaming?.kind === "folder" && renaming.id === f.id ? (
                          <input
                            className="ag-rename"
                            autoFocus
                            aria-label="Nieuwe naam voor project"
                            value={renaming.value}
                            maxLength={60}
                            onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                            onBlur={() => void commitRename()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void commitRename();
                              if (e.key === "Escape") setRenaming(null);
                            }}
                          />
                        ) : (
                          <div className="ag-folder-row">
                            <button type="button" className="ag-folder-toggle" aria-expanded={open} onClick={() => setOpenFolders((o) => ({ ...o, [f.id]: !open }))}>
                              <ChevronDown size={13} aria-hidden="true" className="ag-chevron" />
                              <Folder size={14} aria-hidden="true" />
                              <span>{f.name}</span>
                              <small>{items.length || ""}</small>
                            </button>
                            <Menu
                              label={"Acties voor project " + f.name}
                              className="ag-conv-menu"
                              trigger={<MoreHorizontal size={15} />}
                              items={[
                                { label: "Nieuw gesprek in dit project", icon: <SquarePen size={14} />, onSelect: () => void openConversation(null, f.id) },
                                { label: "Project hernoemen", icon: <Pencil size={14} />, onSelect: () => setRenaming({ kind: "folder", id: f.id, value: f.name }) },
                                { label: f.instructions ? "Instructies bewerken" : "Instructies toevoegen", icon: <ScrollText size={14} />, onSelect: () => setInstructions({ id: f.id, name: f.name, value: f.instructions || "" }) },
                                { label: "Project verwijderen", icon: <Trash2 size={14} />, danger: true, onSelect: () => setConfirm({ kind: "folder", id: f.id, name: f.name }) },
                              ]}
                            />
                          </div>
                        )}
                        {open && (
                          <>
                            {items.length ? <ul className="ag-folder-items">{items.map(row)}</ul> : <p className="ag-muted ag-small ag-indent">Dit project heeft nog geen gesprekken.</p>}
                            <button
                              type="button"
                              className={"ag-folder-new" + (!activeId && draftFolder === f.id ? " is-active" : "")}
                              aria-current={!activeId && draftFolder === f.id ? "page" : undefined}
                              onClick={() => void openConversation(null, f.id)}
                            >
                              <Plus size={13} aria-hidden="true" />
                              Nieuw gesprek in dit project
                            </button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            {archivedView ? section("Archief", conversations) : section("Afgelopen 7 dagen", groups.recent)}
            {!archivedView && section("Ouder", groups.older)}
            {!conversations.length && !demo && <p className="ag-muted ag-small">{archivedView ? "Het archief is leeg." : "Je gesprekken verschijnen hier."}</p>}
            {more && (
              <button type="button" className="ag-more" onClick={() => void loadList({ append: true, archived: archivedView })}>
                Meer gesprekken laden
              </button>
            )}
          </>
        )}
      </nav>
      {!demo && (
        <button type="button" className="ag-archive-toggle" onClick={() => setArchivedView(!archivedView)} aria-pressed={archivedView}>
          {archivedView ? <ArrowRight size={14} aria-hidden="true" /> : <Archive size={14} aria-hidden="true" />}
          {archivedView ? "Terug naar gesprekken" : "Archief"}
        </button>
      )}
    </>
  );

  return (
    <div className={"ag" + (collapsed ? " is-collapsed" : "") + (drawer ? " has-drawer" : "")}>
      {collapsed ? (
        <div className="ag-rail" aria-label="Mavix Agent">
          <IconButton label="Zijbalk uitklappen" onClick={() => setCollapsed(false)}>
            <PanelLeftOpen size={16} />
          </IconButton>
          <IconButton label="Nieuw gesprek" onClick={() => void openConversation(null)}>
            <SquarePen size={16} />
          </IconButton>
          <IconButton
            label="Zoeken in gesprekken"
            onClick={() => {
              setCollapsed(false);
              window.setTimeout(() => document.querySelector<HTMLInputElement>(".ag-search input")?.focus(), 50);
            }}
          >
            <Search size={16} />
          </IconButton>
        </div>
      ) : (
        <aside className="ag-side">{sidebar}</aside>
      )}
      {drawer && (
        <>
          <div className="ag-scrim" onClick={() => setDrawer(false)} aria-hidden="true" />
          <aside className="ag-side ag-drawer" role="dialog" aria-label="Gesprekken">
            {sidebar}
          </aside>
        </>
      )}

      <section className="ag-main" aria-label="Gesprek">
        <header className="ag-main-head">
          <IconButton label="Gesprekken tonen" className="ag-drawer-btn" onClick={() => setDrawer(true)}>
            <MenuIcon size={17} />
          </IconButton>
          <h1 className="ag-main-title">{active ? active.title : project ? "Nieuw gesprek" : "Mavix Agent"}</h1>
          {project && (
            <span className="ag-project-chip" title={"Project: " + project.name}>
              <Folder size={13} aria-hidden="true" />
              <span>{project.name}</span>
              {!active && (
                <button type="button" aria-label="Gesprek zonder project starten" onClick={() => void openConversation(null)}>
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </span>
          )}
          {active && <Menu label="Acties voor dit gesprek" trigger={<MoreHorizontal size={16} />} items={conversationMenu(active)} />}
        </header>

        <div className="ag-thread" ref={thread} onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}>
          <div className="ag-column">
            {empty ? (
              <div className="ag-empty">
                {project && (
                  <p className="ag-empty-project">
                    <Folder size={14} aria-hidden="true" /> Nieuw gesprek in <strong>{project.name}</strong>
                    {project.instructions ? " · Mavix volgt de instructies van dit project." : ""}
                  </p>
                )}
                <h2>Waar werken we vandaag aan?</h2>
                <p>Mavix is je marketingassistent. Hij kent je Brand Hub en werkruimte, schrijft teksten en plannen, en wijst je de weg in Mavix. Hij publiceert of verstuurt nooit zelf iets.</p>
                <ul className="ag-suggestions" aria-label="Voorbeelden">
                  {AGENT_SUGGESTIONS.map((s) => (
                    <li key={s.prompt}>
                      <button type="button" disabled={sending} onClick={() => void send(s.prompt)}>
                        {s.prompt}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : loadingThread ? (
              <div className="ag-skeleton ag-skeleton-thread" aria-busy="true" aria-label="Gesprek laden">
                <span />
                <span />
                <span />
              </div>
            ) : (
              <div className="ag-messages" aria-live="polite">
                {moreMessages && (
                  <button type="button" className="ag-more" onClick={() => void loadOlder()}>
                    Eerdere berichten laden
                  </button>
                )}
                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className={"ag-msg is-user" + (m.pending ? " is-pending" : "")}>
                      <p>{m.content}</p>
                    </div>
                  ) : (
                    <div key={m.id} className={"ag-msg is-assistant" + (m.status === "failed" ? " is-failed" : "")}>
                      <MaviAvatar size={28} live={false} />
                      <div className="ag-msg-body">
                        {m.status === "failed" ? <p role="alert">{m.content}</p> : <Markdown text={m.content} />}
                        {m.action?.proposal && m.status === "ok" && (
                          <div className="ag-proposal" role="group" aria-label="Voorstel van Mavix">
                            <strong>Voorstel: concepten opslaan</strong>
                            <p>{m.action.proposal.summary}</p>
                            {m.action.proposal.status === "pending" ? (
                              <>
                                <p className="ag-proposal-note">Er wordt niets ingepland, gepubliceerd of verstuurd. Je kunt alles daarna in Content Studio aanpassen.</p>
                                <div className="ag-proposal-actions">
                                  <button type="button" className="button primary" disabled={!!deciding} onClick={() => void decide(m.id, m.action!.proposal!, "confirm")}>
                                    {deciding === m.action.proposal.id ? "Bezig…" : "Opslaan als concepten"}
                                  </button>
                                  <button type="button" className="button secondary" disabled={!!deciding} onClick={() => void decide(m.id, m.action!.proposal!, "cancel")}>
                                    Annuleren
                                  </button>
                                </div>
                              </>
                            ) : (
                              <p className={"ag-proposal-status is-" + m.action.proposal.status} role="status">
                                {PROPOSAL_STATUS[m.action.proposal.status] || m.action.proposal.status}
                                {m.action.proposal.href && (
                                  <Link href={m.action.proposal.href}>
                                    Open in Content Studio <ArrowRight size={13} aria-hidden="true" />
                                  </Link>
                                )}
                              </p>
                            )}
                          </div>
                        )}
                        {m.action?.href && m.status === "ok" && (
                          <Link className="ag-action" href={m.action.href}>
                            {m.action.label}
                            <ArrowRight size={14} aria-hidden="true" />
                          </Link>
                        )}
                        {!!m.action?.tools?.length && m.status === "ok" && (
                          <p className="ag-tools">
                            <span className="sr-only">Opgezocht: </span>
                            {m.action.tools.filter((t) => TOOL_LABEL[t]).map((t) => (
                              <span key={t}>{TOOL_LABEL[t]}</span>
                            ))}
                          </p>
                        )}
                      </div>
                    </div>
                  ),
                )}
                {sending && (
                  <div className="ag-msg is-assistant" aria-label="Mavix schrijft een antwoord">
                    <MaviAvatar size={28} state="thinking" />
                    <div className="ag-msg-body">
                      <div className="ag-typing" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </div>
                      <p className="ag-progress" role="status">
                        Mavix zoekt de gegevens op die nodig zijn en schrijft een antwoord…
                      </p>
                    </div>
                  </div>
                )}
                {lastFailed && !sending && (
                  <button type="button" className="ag-retry" onClick={() => void send("", true)}>
                    <RotateCcw size={14} aria-hidden="true" />
                    Opnieuw proberen
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="ag-composer">
          <div className="ag-column">
            {(notice || configured === false) && (
              <p className="ag-notice" role="status">
                {notice ||
                  (demo
                    ? "In de testmodus kan Mavix Agent geen AI-antwoorden geven. Log in met een echt account."
                    : "Mavix Agent is nog niet met een AI-model verbonden. Je kunt je vraag wel klaarzetten; er wordt niets verstuurd.")}
              </p>
            )}
            {plan && !plan.entitlements.includes("agent") ? (
              <UpgradeNotice entitlement="agent" feature="Mavix Agent">
                De Mavix Agent hoort bij Premium. Je eerdere gesprekken blijven leesbaar; in de andere modules gebruik je AI gewoon binnen je pakket.
              </UpgradeNotice>
            ) : (
              <div className={"ag-composer-wrap" + (!empty ? " has-mascot" : "")}>
                {/* The one mascot placement: small, bottom right on the input, in a conversation. */}
                {!empty && <MaviMascot size={46} state={mascot} className="ag-composer-mascot" />}
                <AgentComposer
                  key={draft.key}
                  size="large"
                  attachments={false}
                  defaultText={draft.text}
                  busy={sending}
                  onSubmit={(text) => void send(text)}
                  onTypingChange={setTyping}
                  placeholder="Vraag Mavix om een plan, tekst of idee"
                />
              </div>
            )}
            <p className="ag-disclaimer">Mavix kan fouten maken. Controleer feiten, prijzen en acties voordat je iets publiceert.</p>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === "folder" ? "Project verwijderen?" : "Gesprek verwijderen?"}
        confirmLabel="Verwijderen"
        danger
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === "folder") void removeFolder(confirm.id);
          else void removeConversation(confirm.id);
          setConfirm(null);
        }}
      >
        {confirm?.kind === "folder"
          ? `Het project “${confirm.name}” wordt verwijderd. De gesprekken erin blijven bewaard, zonder project.`
          : `“${confirm?.name}” en alle berichten erin worden definitief verwijderd. Dit kan niet ongedaan worden gemaakt.`}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!instructions}
        onClose={() => setInstructions(null)}
        title={"Instructies voor " + (instructions?.name || "project")}
        confirmLabel="Opslaan"
        onConfirm={() => {
          if (!instructions) return;
          void saveInstructions(instructions.id, instructions.value);
          setInstructions(null);
        }}
      >
        <label className="ag-instructions">
          <span>Mavix volgt deze instructies in alle gesprekken van dit project, bijvoorbeeld de toon, het onderwerp of wat je wilt vermijden.</span>
          <textarea
            value={instructions?.value || ""}
            maxLength={2000}
            rows={6}
            placeholder="Bijvoorbeeld: dit project gaat over ons zomermenu. Schrijf informeel en noem altijd het terras."
            onChange={(e) => instructions && setInstructions({ ...instructions, value: e.target.value })}
          />
          <small>{(instructions?.value || "").length} / 2000</small>
        </label>
      </ConfirmDialog>
    </div>
  );
}
