"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Inbox, Plug } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { isBrowserDemo } from "@/lib/demo";
import { INBOX_UNREAD_EVENT } from "@/lib/use-inbox-unread";
import { demoDetail, demoInbox } from "@/lib/inbox/demo";
import { capabilities, type Channel, type ConversationStatus, type ConversationView, type MessageView } from "@/lib/inbox/shared";
import { ConversationList, type StatusFilter } from "@/components/inbox/conversation-list";
import { Thread, type Detail, type SendPayload, type Template } from "@/components/inbox/thread";
import { ContextPanel } from "@/components/inbox/context-panel";
import { ChannelIcon } from "@/components/inbox/channel-icon";
import "../../inbox.css";

type ChannelState = { channel: Channel; state: "not_connected" | "connected" | "reconsent" | "reconnect" | "selection" | "error"; account: string };
const STATE_LABEL: Record<ChannelState["state"], string> = {
  not_connected: "Niet gekoppeld",
  connected: "Verbonden",
  reconsent: "Nieuwe toestemming vereist",
  reconnect: "Opnieuw verbinden vereist",
  selection: "Kies een pagina",
  error: "Fout bij koppeling",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init?.body ? { ...init, headers: { "Content-Type": "application/json", ...init.headers } } : init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok && !(d && d.status === "failed")) throw new Error(d.error || "Er ging iets mis. Probeer het opnieuw.");
  return d as T;
}
const uuid = () => crypto.randomUUID();
const byNewest = (a: ConversationView, b: ConversationView) => b.lastMessageAt.localeCompare(a.lastMessageAt) || b.id.localeCompare(a.id);

type Outgoing = { conversationId: string; payload: SendPayload; message: MessageView };

export default function InboxPage() {
  const [demo, setDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [channel, setChannel] = useState<Channel | "">("");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<ChannelState[]>([]);
  const [userId, setUserId] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [view, setView] = useState<"list" | "thread" | "details">("list");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [outbox, setOutbox] = useState<Record<string, Outgoing>>({});
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const filterKey = useRef("");

  useEffect(() => {
    setDemo(isBrowserDemo());
    setReady(true);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const demoList = useMemo(
    () =>
      demoInbox()
        .map((d) => d.conversation)
        .filter((c) => !channel || c.channel === channel)
        .filter((c) => (status === "resolved" ? c.status === "resolved" : status === "unread" ? c.unread > 0 : status === "mine" ? false : c.status !== "resolved"))
        .filter((c) => !debounced || (c.contact.name + " " + c.preview).toLowerCase().includes(debounced.toLowerCase())),
    [channel, status, debounced],
  );

  // First page (replace) or next page (append).
  const loadList = useCallback(
    async (more = false, silent = false) => {
      if (demo) return;
      const key = [channel, status, debounced].join("|");
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({ filter: status });
        if (channel) params.set("channel", channel);
        if (debounced) params.set("q", debounced);
        if (more && cursor) params.set("cursor", cursor);
        const d = await api<{ conversations: ConversationView[]; nextCursor: string | null; channels: ChannelState[]; unread: number; userId: string }>("/api/inbox?" + params);
        if (filterKey.current !== key && more) return;
        filterKey.current = key;
        setChannels(d.channels);
        setUserId(d.userId);
        window.dispatchEvent(new CustomEvent(INBOX_UNREAD_EVENT, { detail: d.unread }));
        setConversations((prev) => {
          if (more) return [...prev, ...d.conversations.filter((c) => !prev.some((p) => p.id === c.id))];
          if (!silent) return d.conversations;
          // Silent refresh keeps extra loaded pages and replaces updated rows.
          const fresh = new Map(d.conversations.map((c) => [c.id, c]));
          const oldest = d.conversations[d.conversations.length - 1]?.lastMessageAt || "";
          const rest = prev.filter((p) => !fresh.has(p.id) && d.nextCursor && p.lastMessageAt < oldest);
          return [...d.conversations, ...rest].sort(byNewest);
        });
        if (more || !silent || !cursor) setCursor(d.nextCursor);
        setError("");
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : "De inbox kon niet worden geladen.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [demo, channel, status, debounced, cursor],
  );

  const loadDetail = useCallback(
    async (id: string, silent = false) => {
      if (demo) {
        setDetail(demoDetail(id));
        return;
      }
      try {
        const d = await api<Detail>("/api/inbox/" + id);
        setDetail((prev) => {
          if (!silent || !prev || prev.conversation.id !== id) return d;
          // Keep older pages the user already loaded.
          const first = d.messages[0]?.createdAt || "";
          const older = prev.messages.filter((m) => m.createdAt < first && !d.messages.some((x) => x.id === m.id));
          return { ...d, messages: [...older, ...d.messages], hasMore: older.length ? prev.hasMore : d.hasMore };
        });
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
        // Drop optimistic copies the server now has.
        setOutbox((prev) => {
          const next = { ...prev };
          for (const [k, o] of Object.entries(prev))
            if (o.conversationId === id && d.messages.some((m) => m.clientId === k && m.status !== "pending")) delete next[k];
          return next;
        });
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : "Het gesprek kon niet worden geladen.");
      }
    },
    [demo],
  );

  useEffect(() => {
    if (!ready || demo) {
      setLoading(false);
      return;
    }
    void loadList(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, demo, channel, status, debounced]);

  // Live updates: refresh every 15 s while visible (Instagram/Messenger/
  // WhatsApp arrive by webhook); Gmail is polled about once a minute.
  const gmailReady = channels.some((c) => c.channel === "gmail" && c.state === "connected");
  useEffect(() => {
    if (!ready || demo) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void loadList(false, true);
      if (selected) void loadDetail(selected, true);
    };
    const timer = window.setInterval(tick, 15000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [ready, demo, loadList, loadDetail, selected]);
  useEffect(() => {
    if (!ready || demo || !gmailReady) return;
    const sync = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/inbox/sync", { method: "POST" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.imported > 0) void loadList(false, true);
        })
        .catch(() => {});
    };
    sync();
    const timer = window.setInterval(sync, 60000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, demo, gmailReady]);

  function select(id: string) {
    setSelected(id);
    setView("thread");
    setTemplates(null);
    if (detail?.conversation.id !== id) setDetail(null);
    void loadDetail(id);
  }

  // Escape: details -> thread -> list (mobile flow).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (e.target as HTMLElement)?.closest?.("select")) return;
      setView((v) => (v === "details" ? "thread" : v === "thread" ? "list" : v));
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  async function deliver(clientId: string, o: Outgoing) {
    setOutbox((prev) => ({ ...prev, [clientId]: { ...o, message: { ...o.message, status: "pending", error: null } } }));
    try {
      const r = await api<{ status: string; error?: string }>(`/api/inbox/${o.conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ clientId, ...o.payload }),
      });
      if (r.status === "failed") throw new Error(r.error || "Versturen is niet gelukt.");
      setOutbox((prev) => (prev[clientId] ? { ...prev, [clientId]: { ...prev[clientId], message: { ...prev[clientId].message, status: "sent" } } } : prev));
    } catch (e) {
      setOutbox((prev) => ({
        ...prev,
        [clientId]: { ...o, message: { ...o.message, status: "failed", error: e instanceof Error ? e.message : "Versturen is niet gelukt." } },
      }));
    }
    await loadDetail(o.conversationId, true);
    void loadList(false, true);
  }

  function send(payload: SendPayload) {
    if (!detail || demo) return;
    const clientId = uuid();
    const body = payload.template ? "Template: " + payload.template.name : payload.body;
    const o: Outgoing = {
      conversationId: detail.conversation.id,
      payload,
      message: {
        id: "tmp-" + clientId,
        clientId,
        direction: "outbound",
        author: "Jij",
        body,
        attachments: (payload.attachments || []).map((a) => ({ kind: "file", name: a.name, mimeType: a.mimeType })),
        status: "pending",
        error: null,
        createdAt: new Date().toISOString(),
      },
    };
    void deliver(clientId, o);
  }

  async function note(body: string) {
    if (!detail || demo) return;
    try {
      await api(`/api/inbox/${detail.conversation.id}/notes`, { method: "POST", body: JSON.stringify({ clientId: uuid(), body }) });
      await loadDetail(detail.conversation.id, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "De notitie kon niet worden opgeslagen.");
    }
  }

  async function update(patch: { status?: ConversationStatus; assignedUserId?: string | null; unread?: boolean }) {
    if (!detail || demo) return;
    const id = detail.conversation.id;
    const before = detail;
    setDetail({
      ...detail,
      conversation: {
        ...detail.conversation,
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.assignedUserId !== undefined ? { assignedUserId: patch.assignedUserId } : {}),
      },
    });
    try {
      await api("/api/inbox/" + id, { method: "PATCH", body: JSON.stringify(patch) });
      if (patch.unread) {
        setSelected(null);
        setDetail(null);
        setView("list");
      }
      void loadList(false, true);
    } catch (e) {
      setDetail(before);
      setError(e instanceof Error ? e.message : "De wijziging kon niet worden opgeslagen.");
    }
  }

  async function ai(action: "reply" | "summary") {
    if (!detail || demo) return null;
    const d = await api<{ text: string }>(`/api/inbox/${detail.conversation.id}/ai`, { method: "POST", body: JSON.stringify({ action }) });
    return d.text;
  }

  async function older() {
    if (!detail || demo || !detail.messages.length) return;
    try {
      const d = await api<Detail>(`/api/inbox/${detail.conversation.id}?before=${encodeURIComponent(detail.messages[0].createdAt)}`);
      setDetail((prev) => (prev ? { ...prev, messages: [...d.messages.filter((m) => !prev.messages.some((p) => p.id === m.id)), ...prev.messages], hasMore: d.hasMore } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Oudere berichten konden niet worden geladen.");
    }
  }

  const loadTemplates = useCallback(() => {
    setTemplates([]);
    api<{ templates: Template[] }>("/api/inbox/templates")
      .then((d) => setTemplates(d.templates))
      .catch((e) => {
        setTemplates([]);
        setError(e instanceof Error ? e.message : "Templates konden niet worden geladen.");
      });
  }, []);

  // Server messages plus optimistic ones the server does not have yet.
  const shown: Detail | null = useMemo(() => {
    if (!detail) return null;
    const pending = Object.entries(outbox)
      .filter(([k, o]) => o.conversationId === detail.conversation.id && !detail.messages.some((m) => m.clientId === k && m.status !== "pending"))
      .map(([, o]) => o.message);
    const merged = detail.messages.filter((m) => !pending.some((p) => p.clientId && p.clientId === m.clientId));
    return { ...detail, messages: [...merged, ...pending] };
  }, [detail, outbox]);

  const list = demo ? demoList : conversations;
  const connected = channels.filter((c) => c.state !== "not_connected");
  const problems = channels.filter((c) => c.state !== "connected" && c.state !== "not_connected");
  const nothingConnected = !demo && !loading && channels.length > 0 && connected.length === 0;

  return (
    <div className="ib" data-view={view}>
      <PageHeading eyebrow="Werkruimte" title="Inbox" description="Al je klantgesprekken op één plek." />
      {demo && (
        <p className="ib-demo-banner" role="note">
          Demo: dit zijn voorbeeldgesprekken. Koppel echte kanalen in je eigen werkruimte om echte berichten te zien.
        </p>
      )}
      {problems.map((p) => (
        <p key={p.channel} className="ib-problem" role="status">
          <ChannelIcon channel={p.channel} label /> {STATE_LABEL[p.state]}
          {p.state === "reconsent" && p.channel === "gmail" && " — Mavix heeft leestoegang tot Gmail nodig om e-mails in de Inbox te tonen."}{" "}
          <Link href="/account/integraties">Naar Integraties</Link>
        </p>
      ))}
      {error && (
        <p className="ib-error ib-page-error" role="alert">
          {error}
        </p>
      )}

      {nothingConnected ? (
        <div className="panel ib-empty-panel">
          <div className="ws-empty">
            <span className="ws-empty-icon">
              <Inbox size={22} />
            </span>
            <h2>Nog geen kanalen gekoppeld</h2>
            <p>Verbind je communicatiekanalen om gesprekken hier samen te brengen.</p>
            <ul className="inbox-channels">
              {channels.map((c) => (
                <li key={c.channel}>
                  <ChannelIcon channel={c.channel} label />
                  <span>{STATE_LABEL[c.state]}</span>
                </li>
              ))}
            </ul>
            <Link className="button secondary" href="/account/integraties">
              <Plug size={15} />
              Naar Integraties
            </Link>
          </div>
        </div>
      ) : (
        <div className="ib-layout panel">
          <ConversationList
            conversations={list}
            selectedId={selected}
            channel={channel}
            status={status}
            query={query}
            loading={loading}
            hasMore={!demo && !!cursor}
            onChannel={setChannel}
            onStatus={setStatus}
            onQuery={setQuery}
            onSelect={select}
            onMore={() => void loadList(true)}
          />
          {shown ? (
            <Thread
              detail={shown}
              demo={demo}
              draft={drafts[shown.conversation.id] || ""}
              onDraft={(v) => setDrafts((d) => ({ ...d, [shown.conversation.id]: v }))}
              onSend={send}
              onNote={(b) => void note(b)}
              onRetry={(clientId) => outbox[clientId] && void deliver(clientId, outbox[clientId])}
              canRetry={(clientId) => !!outbox[clientId]}
              onOlder={() => void older()}
              onBack={() => setView("list")}
              onDetails={() => setView("details")}
              onSuggest={() => ai("reply")}
              templates={templates}
              onLoadTemplates={loadTemplates}
            />
          ) : (
            <section className="ib-thread ib-thread-empty">
              <div className="ws-empty">
                <span className="ws-empty-icon">
                  <Inbox size={22} />
                </span>
                <h2>{selected ? "Gesprek laden…" : list.length ? "Kies een gesprek" : "Nog geen gesprekken"}</h2>
                <p>
                  {list.length || selected
                    ? "Selecteer links een gesprek om het te lezen en te beantwoorden."
                    : "Zodra klanten je via " +
                      (connected.length ? connected.map((c) => capabilities[c.channel].label).join(", ") : "je gekoppelde kanalen") +
                      " een bericht sturen, verschijnen de gesprekken hier."}
                </p>
              </div>
            </section>
          )}
          <ContextPanel
            detail={shown}
            demo={demo}
            userId={userId}
            onClose={() => setView("thread")}
            onUpdate={(p) => void update(p)}
            onSummary={() => ai("summary")}
          />
        </div>
      )}
    </div>
  );
}
