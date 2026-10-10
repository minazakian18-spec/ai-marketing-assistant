"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessagesSquare, PenLine, Plug } from "lucide-react";
import { NewEmailDialog } from "@/components/inbox/new-email";

import { BrandIcon } from "@/components/brand-icon";
import { isBrowserDemo } from "@/lib/demo";
import { INBOX_UNREAD_EVENT } from "@/lib/use-inbox-unread";
import { capabilities, type Channel, type ConversationView, type MessageView } from "@/lib/inbox/shared";
import { ConversationList, type StatusFilter } from "@/components/inbox/conversation-list";
import { CHANNEL_NAME, ChannelRail, type ChannelState, type SortOrder } from "@/components/inbox/channel-rail";
import { Thread, type ConversationPatch, type Detail, type RewriteStyle, type SendPayload, type Template } from "@/components/inbox/thread";
import { ContextPanel } from "@/components/inbox/context-panel";
import { DEMO_MEMBERS, demoDetail, demoThreads } from "@/lib/inbox/demo";
import "../../inbox.css";

const PROBLEM: Partial<Record<ChannelState["state"], string>> = {
  reconsent: "heeft nieuwe toestemming nodig",
  reconnect: "moet opnieuw worden verbonden",
  selection: "wacht op een paginakeuze",
  error: "geeft een fout",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init?.body ? { ...init, headers: { "Content-Type": "application/json", ...init.headers } } : init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok && !(d && d.status === "failed")) throw new Error(d.error || "Er ging iets mis. Probeer het opnieuw.");
  return d as T;
}
const uuid = () => crypto.randomUUID();
const CONNECT_TEXT: Record<Channel, string> = {
  instagram: "Koppel je professionele Instagram-account om Direct-berichten hier te ontvangen en te beantwoorden.",
  whatsapp: "Koppel je WhatsApp Business-nummer om klantberichten hier te ontvangen en te beantwoorden.",
  gmail: "Koppel Gmail om klantmails in Mavix te lezen en te beantwoorden.",
  messenger: "Koppel je Facebook-pagina om Messenger-berichten hier te ontvangen en te beantwoorden.",
};
const byNewest = (a: ConversationView, b: ConversationView) => b.lastMessageAt.localeCompare(a.lastMessageAt) || b.id.localeCompare(a.id);
const byOldest = (a: ConversationView, b: ConversationView) => -byNewest(a, b);

type Outgoing = { conversationId: string; payload: SendPayload; message: MessageView };

export default function InboxPage() {
  const [demo, setDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [channel, setChannel] = useState<Channel | "">("");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [unreadByChannel, setUnreadByChannel] = useState<Partial<Record<Channel, number>>>({});
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<ChannelState[] | null>(null);
  const [userId, setUserId] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [view, setView] = useState<"list" | "thread" | "details">("list");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [outbox, setOutbox] = useState<Record<string, Outgoing>>({});
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const filterKey = useRef("");
  // Test mode only: labelled example threads, changed locally, never sent.
  const [demoData, setDemoData] = useState<ReturnType<typeof demoThreads>>([]);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [composing, setComposing] = useState(false);
  const [notice, setNotice] = useState("");
  // Older Gmail (beyond the stored list): imported page by page on request.
  const [gmailOlder, setGmailOlder] = useState<{ busy: boolean; done: boolean }>({ busy: false, done: false });

  useEffect(() => {
    setDemo(isBrowserDemo());
    setReady(true);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const loadList = useCallback(
    async (more = false, silent = false) => {
      if (demo) return;
      const key = [channel, status, debounced, sort].join("|");
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({ filter: status, sort });
        if (channel) params.set("channel", channel);
        if (debounced) params.set("q", debounced);
        if (more && cursor) params.set("cursor", cursor);
        const d = await api<{
          conversations: ConversationView[];
          nextCursor: string | null;
          channels: ChannelState[];
          unread: number;
          unreadByChannel: Record<Channel, number>;
          userId: string;
        }>("/api/inbox?" + params);
        if (filterKey.current !== key && more) return;
        filterKey.current = key;
        setChannels(d.channels);
        setUserId(d.userId);
        setUnreadTotal(d.unread);
        setUnreadByChannel(d.unreadByChannel || {});
        window.dispatchEvent(new CustomEvent(INBOX_UNREAD_EVENT, { detail: d.unread }));
        setConversations((prev) => {
          if (more) return [...prev, ...d.conversations.filter((c) => !prev.some((p) => p.id === c.id))];
          if (!silent) return d.conversations;
          const fresh = new Map(d.conversations.map((c) => [c.id, c]));
          const oldest = d.conversations[d.conversations.length - 1]?.lastMessageAt || "";
          const rest = prev.filter((p) => !fresh.has(p.id) && d.nextCursor && p.lastMessageAt < oldest);
          return [...d.conversations, ...rest].sort(sort === "oldest" ? byOldest : byNewest);
        });
        if (more || !silent || !cursor) setCursor(d.nextCursor);
        setError("");
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : "De inbox kon niet worden geladen.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [demo, channel, status, debounced, cursor, sort],
  );

  const loadDetail = useCallback(async (id: string, silent = false) => {
    if (isBrowserDemo()) {
      setDemoData((all) => {
        const next = all.map((t) => (t.conversation.id === id ? { ...t, conversation: { ...t.conversation, unread: 0 } } : t));
        const t = next.find((x) => x.conversation.id === id);
        if (t) setDetail(demoDetail(t));
        return next;
      });
      return;
    }
    try {
      const d = await api<Detail>("/api/inbox/" + id);
      setDetail((prev) => {
        if (!silent || !prev || prev.conversation.id !== id) return d;
        const first = d.messages[0]?.createdAt || "";
        const older = prev.messages.filter((m) => m.createdAt < first && !d.messages.some((x) => x.id === m.id));
        return { ...d, messages: [...older, ...d.messages], hasMore: older.length ? prev.hasMore : d.hasMore };
      });
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
      setOutbox((prev) => {
        const next = { ...prev };
        for (const [k, o] of Object.entries(prev))
          if (o.conversationId === id && d.messages.some((m) => m.clientId === k && m.status !== "pending")) delete next[k];
        return next;
      });
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Het gesprek kon niet worden geladen.");
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (demo) {
      setDemoData((d) => (d.length ? d : demoThreads()));
      setChannels((["whatsapp", "instagram", "messenger", "gmail"] as Channel[]).map((c) => ({ channel: c, state: "connected", account: "Voorbeeld" })));
      setUserId(DEMO_MEMBERS[0].userId);
      setLoading(false);
      return;
    }
    void loadList(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, demo, channel, status, debounced, sort]);

  // Live updates: refresh every 15 s while visible; Gmail is polled about
  // once a minute (Instagram/Messenger/WhatsApp arrive via webhooks).
  const gmailReady = !!channels?.some((c) => c.channel === "gmail" && c.state === "connected");
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
    // Polling, not real-time: on open, every minute while visible and when the
    // window regains focus. The server throttles (25 s) and serialises syncs.
    const sync = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/inbox/sync", { method: "POST" })
        .then(async (r) => {
          const d = await r.json().catch(() => null);
          // A revoked/expired connection changes the channel state: refresh it.
          if (!r.ok) return void loadList(false, true);
          if (d?.imported > 0) void loadList(false, true);
        })
        .catch(() => {});
    };
    sync();
    const timer = window.setInterval(sync, 60000);
    window.addEventListener("focus", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, demo, gmailReady]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(t);
  }, [notice]);

  async function loadOlderGmail() {
    setGmailOlder({ busy: true, done: false });
    try {
      const d = await api<{ imported: number; done: boolean; status: string }>("/api/inbox/gmail/backfill", { method: "POST", body: "{}" });
      setGmailOlder({ busy: false, done: d.done });
      if (d.status === "busy") setNotice("Gmail wordt al bijgewerkt. Probeer het zo opnieuw.");
      else if (!d.imported) setNotice(d.done ? "Alle oudere klantmails staan in je Inbox." : "Geen oudere klantmails gevonden op deze pagina.");
      // Imported mail lands after the current end of the list; the regular
      // "Meer laden" (stored cursor) then pages through it.
      await loadList(false, true);
    } catch (e) {
      setGmailOlder({ busy: false, done: false });
      setError(e instanceof Error ? e.message : "Oudere e-mails konden niet worden geladen.");
    }
  }

  function select(id: string) {
    setSelected(id);
    setView("thread");
    setTemplates(null);
    if (detail?.conversation.id !== id) setDetail(null);
    void loadDetail(id);
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || (e.target as HTMLElement)?.closest?.("select,[role=menu]")) return;
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

  // Test mode: apply a change to the local example thread and its detail.
  function demoApply(id: string, fn: (t: ReturnType<typeof demoThreads>[number]) => ReturnType<typeof demoThreads>[number]) {
    setDemoData((all) => {
      const next = all.map((t) => (t.conversation.id === id ? fn(t) : t));
      const t = next.find((x) => x.conversation.id === id);
      if (t) setDetail(demoDetail(t));
      return next;
    });
  }
  function demoMessage(direction: "outbound" | "note", body: string): MessageView {
    return { id: "demo-" + uuid(), direction, author: "Jij", body, attachments: [], status: "sent", error: null, createdAt: new Date().toISOString() };
  }

  function send(payload: SendPayload) {
    if (!detail) return;
    if (demo) {
      const m = demoMessage("outbound", payload.template ? "Template: " + payload.template.name : payload.body);
      return demoApply(detail.conversation.id, (t) => ({
        messages: [...t.messages, m],
        conversation: { ...t.conversation, lastMessageAt: m.createdAt, preview: m.body.slice(0, 140), lastDirection: "outbound" },
      }));
    }
    const clientId = uuid();
    void deliver(clientId, {
      conversationId: detail.conversation.id,
      payload,
      message: {
        id: "tmp-" + clientId,
        clientId,
        direction: "outbound",
        author: "Jij",
        body: payload.template ? "Template: " + payload.template.name : payload.body,
        attachments: (payload.attachments || []).map((a) => ({ kind: "file", name: a.name, mimeType: a.mimeType })),
        status: "pending",
        error: null,
        createdAt: new Date().toISOString(),
      },
    });
  }

  async function note(body: string) {
    if (!detail) return;
    if (demo) return demoApply(detail.conversation.id, (t) => ({ ...t, messages: [...t.messages, demoMessage("note", body)] }));
    try {
      await api(`/api/inbox/${detail.conversation.id}/notes`, { method: "POST", body: JSON.stringify({ clientId: uuid(), body }) });
      await loadDetail(detail.conversation.id, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "De notitie kon niet worden opgeslagen.");
    }
  }

  async function update(patch: ConversationPatch) {
    if (!detail) return;
    if (demo) {
      demoApply(detail.conversation.id, (t) => ({
        ...t,
        conversation: {
          ...t.conversation,
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.labels ? { labels: patch.labels } : {}),
          ...(patch.assignedUserId !== undefined ? { assignedUserId: patch.assignedUserId } : {}),
          ...(patch.unread ? { unread: 1 } : {}),
        },
      }));
      if (patch.unread) {
        setSelected(null);
        setDetail(null);
        setView("list");
      }
      return;
    }
    const id = detail.conversation.id;
    const before = detail;
    setDetail({
      ...detail,
      conversation: {
        ...detail.conversation,
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.labels ? { labels: patch.labels } : {}),
        ...(patch.assignedUserId !== undefined ? { assignedUserId: patch.assignedUserId } : {}),
      },
    });
    try {
      await api("/api/inbox/" + id, { method: "PATCH", body: JSON.stringify(patch) });
      if (patch.unread || (patch.status === "resolved" && status !== "resolved")) {
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
    if (!detail) return null;
    if (demo) throw new Error("Mavi-voorstellen werken alleen met een echt account.");
    const d = await api<{ text: string }>(`/api/inbox/${detail.conversation.id}/ai`, { method: "POST", body: JSON.stringify({ action }) });
    return d.text;
  }

  async function rewrite(draft: string, style: RewriteStyle) {
    if (!detail) return null;
    if (demo) throw new Error("Mavi-voorstellen werken alleen met een echt account.");
    const d = await api<{ text: string }>(`/api/inbox/${detail.conversation.id}/ai`, { method: "POST", body: JSON.stringify({ action: "rewrite", draft, style }) });
    return d.text;
  }

  async function older() {
    if (!detail || !detail.messages.length) return;
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

  const shown: Detail | null = useMemo(() => {
    if (!detail) return null;
    const pending = Object.entries(outbox)
      .filter(([k, o]) => o.conversationId === detail.conversation.id && !detail.messages.some((m) => m.clientId === k && m.status !== "pending"))
      .map(([, o]) => o.message);
    const merged = detail.messages.filter((m) => !pending.some((p) => p.clientId && p.clientId === m.clientId));
    return { ...detail, messages: [...merged, ...pending] };
  }, [detail, outbox]);

  // In test mode the list is derived locally from the example threads.
  const demoList = useMemo(() => {
    const q = debounced.toLowerCase();
    return demoData
      .map((t) => t.conversation)
      .filter((c) => !channel || c.channel === channel)
      .filter((c) => (status === "resolved" ? c.status === "resolved" : status === "unread" ? c.unread > 0 : status === "mine" ? c.assignedUserId === userId : c.status !== "resolved"))
      .filter((c) => !q || (c.contact.name + " " + c.preview + " " + c.subject).toLowerCase().includes(q))
      .sort(sort === "oldest" ? byOldest : byNewest);
  }, [demoData, channel, status, debounced, userId, sort]);
  const demoUnread = useMemo(() => {
    const out: Partial<Record<Channel, number>> = {};
    for (const t of demoData) if (t.conversation.unread > 0) out[t.conversation.channel] = (out[t.conversation.channel] || 0) + 1;
    return out;
  }, [demoData]);
  const list = demo ? demoList : conversations;
  const unread = demo ? demoData.filter((t) => t.conversation.unread > 0).length : unreadTotal;
  function toggleDetails() {
    if (window.matchMedia("(min-width: 1201px)").matches) setDetailsOpen((o) => !o);
    else setView((v) => (v === "details" ? "thread" : "details"));
  }

  const linked = (channels || []).filter((c) => c.state !== "not_connected");
  const problems = linked.filter((c) => PROBLEM[c.state]);
  const nothingLinked = !demo && channels !== null && linked.length === 0;
  const gmail = channels?.find((c) => c.channel === "gmail");
  const gmailConnected = gmail?.state === "connected";
  // Empty states of the conversation list: per channel a connect or repair
  // prompt, so every channel can be opened from the rail.
  const current = channel ? channels?.find((c) => c.channel === channel) : undefined;
  const listEmpty = demo ? undefined : channel === "" ? (
    nothingLinked ? (
      <div className="ib-list-connect">
        <div className="ib-empty-brands" aria-hidden="true">
          {(["instagram", "whatsapp", "gmail", "messenger"] as Channel[]).map((c) => (
            <BrandIcon key={c} brand={c} size={20} />
          ))}
        </div>
        <p>Koppel Instagram, WhatsApp, Gmail of Messenger om je klantgesprekken hier te ontvangen en te beantwoorden.</p>
        <Link className="button primary" href="/account/integraties">
          <Plug size={15} />
          Kanaal koppelen
        </Link>
      </div>
    ) : undefined
  ) : !current || current.state === "not_connected" ? (
    <div className="ib-list-connect">
      <BrandIcon brand={channel} size={22} />
      <p>{CONNECT_TEXT[channel]}</p>
      <Link className="button primary" href="/account/integraties">
        Koppel {CHANNEL_NAME[channel]}
      </Link>
    </div>
  ) : current.state !== "connected" ? (
    <div className="ib-list-connect">
      <BrandIcon brand={channel} size={22} />
      <p>
        {channel === "gmail" && current.state === "reconnect"
          ? "Je Gmail-koppeling is verlopen. Bestaande e-mails blijven zichtbaar, nieuwe komen pas binnen na opnieuw koppelen."
          : `${CHANNEL_NAME[channel]} ${PROBLEM[current.state]}.`}
      </p>
      <Link className="button primary" href="/account/integraties">
        {current.state === "selection" ? "Keuze maken" : "Opnieuw koppelen"}
      </Link>
    </div>
  ) : debounced ? undefined : (
    <p className="ib-list-empty">Nog geen gesprekken via {CHANNEL_NAME[channel]}. Nieuwe berichten verschijnen hier automatisch.</p>
  );
  return (
    <div className="ib" data-view={view} data-details={detailsOpen ? "open" : "closed"}>
      <header className="ib-head">
        <div>
          <h1>Inbox</h1>
          <p>Al je klantgesprekken op één plek.</p>
        </div>
        {!demo && gmailConnected && (
          <button type="button" className="button primary ib-new-mail" onClick={() => setComposing(true)}>
            <PenLine size={15} aria-hidden="true" />
            Nieuwe e-mail
          </button>
        )}
      </header>
      {demo && <p className="ib-demo">Testmodus: dit zijn voorbeeldgesprekken. Berichten worden niet echt verstuurd.</p>}
      {problems.map((p) => (
        <p key={p.channel} className="ib-problem" role="status">
          <BrandIcon brand={p.channel} size={14} />
          {p.channel === "gmail" && p.state === "reconnect"
            ? "Je Gmail-koppeling is verlopen. Bestaande e-mails blijven zichtbaar, nieuwe komen pas binnen na opnieuw koppelen."
            : `${capabilities[p.channel].label} ${PROBLEM[p.state]}.`}
          <Link href="/account/integraties">{p.channel === "gmail" ? "Opnieuw koppelen" : "Oplossen"}</Link>
        </p>
      ))}
      {notice && (
        <p className="ib-notice" role="status">
          {notice}
          <button type="button" onClick={() => setNotice("")} aria-label="Melding sluiten">
            ×
          </button>
        </p>
      )}
      {error && (
        <p className="ib-error ib-page-error" role="alert">
          {error}
        </p>
      )}

      <div className="ib-layout ui-card">
        <ChannelRail
          channels={channels}
          unreadByChannel={demo ? demoUnread : unreadByChannel}
          unreadTotal={unread}
          channel={channel}
          status={status}
          sort={sort}
          onChannel={(c) => {
            setChannel(c);
            setView("list");
          }}
          onStatus={setStatus}
          onSort={setSort}
        />
        <ConversationList
          conversations={list}
          unread={channel ? (demo ? demoUnread : unreadByChannel)[channel] || 0 : unread}
          selectedId={selected}
          channel={channel}
          status={status}
          sort={sort}
          query={query}
          loading={loading}
          hasMore={!demo && !!cursor}
          onChannel={setChannel}
          onStatus={setStatus}
          onSort={setSort}
          onQuery={setQuery}
          onSelect={select}
          onMore={() => void loadList(true)}
          empty={listEmpty}
          extraMore={
            !demo && gmailConnected && !gmailOlder.done && !debounced && status !== "resolved" && sort === "newest" && (channel === "" || channel === "gmail")
              ? { label: "Oudere e-mails laden", busy: gmailOlder.busy, onClick: () => void loadOlderGmail() }
              : null
          }
        />
        {shown ? (
          <Thread
            key={shown.conversation.id}
            detail={shown}
            userId={userId}
            draft={drafts[shown.conversation.id] || ""}
            onDraft={(v) => setDrafts((d) => ({ ...d, [shown.conversation.id]: v }))}
            onSend={send}
            onNote={(b) => void note(b)}
            onRetry={(clientId) => outbox[clientId] && void deliver(clientId, outbox[clientId])}
            canRetry={(clientId) => !!outbox[clientId]}
            onOlder={() => void older()}
            onBack={() => setView("list")}
            onDetails={toggleDetails}
            detailsOpen={detailsOpen}
            onUpdate={(p) => void update(p)}
            onSuggest={() => ai("reply")}
            onRewrite={rewrite}
            templates={templates}
            onLoadTemplates={loadTemplates}
          />
        ) : (
          <section className="ib-thread ib-thread-empty">
            <MessagesSquare size={22} aria-hidden="true" />
            <p>{selected ? "Gesprek laden…" : list.length ? "Kies een gesprek om het te lezen." : "Nog geen gesprekken. Nieuwe berichten verschijnen hier automatisch."}</p>
          </section>
        )}
        <ContextPanel detail={shown} onClose={toggleDetails} onUpdate={(p) => void update(p)} onSummary={() => ai("summary")} />
      </div>      {composing && (
        <NewEmailDialog
          from={gmail?.account || ""}
          onClose={() => setComposing(false)}
          onSent={(conversationId) => {
            setComposing(false);
            setNotice("E-mail verstuurd via Gmail.");
            void loadList(false, true).then(() => conversationId && select(conversationId));
          }}
        />
      )}
    </div>
  );
}
