"use client";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCheck,
  Clock,
  Download,
  FileText,
  MailOpen,
  MoreHorizontal,
  PanelRight,
  Paperclip,
  RotateCcw,
  StickyNote,
  UserPlus,
  Wand2,
  X,
} from "lucide-react";
import { Mavi } from "@/components/mavi";
import { Menu } from "@/components/menu";
import { IconButton } from "@/components/ui";
import {
  ALLOWED_UPLOADS,
  MAX_UPLOAD_BYTES,
  type Capabilities,
  type ConversationStatus,
  type ConversationView,
  type MessageView,
  type Upload,
} from "@/lib/inbox/shared";
import { ChannelIcon } from "./channel-icon";
import { ContactAvatar } from "./conversation-list";
import { dayKey, dayLabel, messageTime, windowLabel } from "./format";

export type Detail = {
  conversation: ConversationView;
  messages: MessageView[];
  hasMore: boolean;
  window: { applies: boolean; open: boolean; closesAt: string | null };
  capabilities: Capabilities;
  contact: null | { id: string; name: string; email: string; phone: string; company: string; status: string };
  members: { userId: string; name: string }[];
};
export type Template = { name: string; language: string; body: string; variables: number };
export type SendPayload = {
  body: string;
  attachments?: Upload[];
  template?: { name: string; language: string; variables: string[] };
};
export type ConversationPatch = { status?: ConversationStatus; assignedUserId?: string | null; unread?: boolean; labels?: string[] };
export type RewriteStyle = "professional" | "friendly" | "formal" | "shorter" | "longer";
const REWRITE: [RewriteStyle, string][] = [
  ["professional", "Professioneler"],
  ["friendly", "Vriendelijker"],
  ["formal", "Formeler (u)"],
  ["shorter", "Korter"],
  ["longer", "Uitgebreider"],
];

const STATUS_TEXT = { open: "Open", pending: "In afwachting", resolved: "Afgehandeld" } as const;
const STATUS_ICON = {
  pending: [Clock, "Wordt verstuurd"],
  sent: [Check, "Verzonden"],
  delivered: [CheckCheck, "Afgeleverd"],
  read: [CheckCheck, "Gelezen"],
  failed: [AlertCircle, "Niet verzonden"],
  received: [Check, "Ontvangen"],
} as const;

function Attachments({ m }: { m: MessageView }) {
  if (!m.attachments.length) return null;
  return (
    <ul className="ib-attachments">
      {m.attachments.map((a, i) => (
        <li key={i}>
          {a.kind === "image" && a.href ? (
            <a href={a.href} target="_blank" rel="noreferrer noopener" className="ib-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.href} alt={a.name || "Afbeelding"} loading="lazy" referrerPolicy="no-referrer" />
            </a>
          ) : (
            <a href={a.href} target="_blank" rel="noreferrer noopener" className="ib-file" aria-disabled={!a.href}>
              {a.href ? <Download size={14} aria-hidden="true" /> : <FileText size={14} aria-hidden="true" />}
              {a.name || "Bijlage"}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

const readFile = (file: File) =>
  new Promise<Upload>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ name: file.name, mimeType: file.type, data: String(r.result).split(",")[1] || "" });
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(file);
  });

export function Thread({
  detail,
  userId,
  draft,
  onDraft,
  onSend,
  onNote,
  onRetry,
  canRetry,
  onOlder,
  onBack,
  onDetails,
  detailsOpen = false,
  onUpdate,
  onSuggest,
  onRewrite,
  templates,
  onLoadTemplates,
}: {
  detail: Detail;
  userId: string;
  draft: string;
  onDraft: (v: string) => void;
  onSend: (p: SendPayload) => void;
  onNote: (body: string) => void;
  onRetry: (clientId: string) => void;
  canRetry: (clientId: string) => boolean;
  onOlder: () => void;
  onBack: () => void;
  onDetails: () => void;
  detailsOpen?: boolean;
  onUpdate: (patch: ConversationPatch) => void;
  onSuggest: () => Promise<string | null>;
  /** Rewrites the current draft (tone/length); the result is a draft again. */
  onRewrite: (draft: string, style: RewriteStyle) => Promise<string | null>;
  templates: Template[] | null;
  onLoadTemplates: () => void;
}) {
  const { conversation: c, capabilities: caps, window: win } = detail;
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [files, setFiles] = useState<Upload[]>([]);
  const [notice, setNotice] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState(false);
  // The text before the last Mavi change, for "Ongedaan maken".
  const [undo, setUndo] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [vars, setVars] = useState<string[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastId = detail.messages[detail.messages.length - 1]?.id;

  useEffect(() => {
    setMode("reply");
    setFiles([]);
    setNotice("");
    setSuggested(false);
    setUndo(null);
    setTemplate(null);
  }, [c.id]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [c.id, lastId]);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [draft]);

  const closed = win.applies && !win.open;
  const noteMode = mode === "note";
  const blocked = !noteMode && closed && !caps.templates;
  const useTemplate = !noteMode && closed && caps.templates;

  useEffect(() => {
    if (useTemplate && templates === null) onLoadTemplates();
  }, [useTemplate, templates, onLoadTemplates]);

  function submit() {
    if (noteMode) {
      if (!draft.trim()) return;
      onNote(draft);
      onDraft("");
      return;
    }
    if (useTemplate) {
      if (!template || vars.length !== template.variables || vars.some((v) => !v.trim())) return;
      onSend({ body: "", template: { name: template.name, language: template.language, variables: vars } });
      setTemplate(null);
      return;
    }
    if (blocked || (!draft.trim() && !files.length)) return;
    onSend({ body: draft, attachments: files.length ? files : undefined });
    onDraft("");
    setFiles([]);
    setSuggested(false);
    setUndo(null);
  }

  function keyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  async function addFiles(list: FileList | null) {
    setNotice("");
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!ALLOWED_UPLOADS[f.type]) {
        setNotice("Dit bestandstype kan niet worden verstuurd.");
        continue;
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        setNotice("Een bijlage mag maximaal 10 MB zijn.");
        continue;
      }
      if (next.length >= 5) {
        setNotice("Je kunt maximaal 5 bijlagen versturen.");
        break;
      }
      next.push(await readFile(f));
    }
    setFiles(next);
  }

  async function suggest() {
    setSuggesting(true);
    setNotice("");
    try {
      const text = await onSuggest();
      if (text) {
        setUndo(draft);
        onDraft(text);
        setMode("reply");
        setSuggested(true);
        window.setTimeout(() => input.current?.focus(), 0);
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Mavi kon geen voorstel maken.");
    } finally {
      setSuggesting(false);
    }
  }

  async function rewrite(style: RewriteStyle) {
    if (!draft.trim()) return;
    setSuggesting(true);
    setNotice("");
    try {
      const text = await onRewrite(draft, style);
      if (text) {
        setUndo(draft);
        onDraft(text);
        setSuggested(true);
        window.setTimeout(() => input.current?.focus(), 0);
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Mavi kon de tekst niet aanpassen.");
    } finally {
      setSuggesting(false);
    }
  }

  const assignee = detail.members.find((m) => m.userId === c.assignedUserId);
  const resolved = c.status === "resolved";

  return (
    <section className="ib-thread" aria-label={"Gesprek met " + c.contact.name}>
      <header className="ib-thread-head">
        <IconButton label="Terug naar gesprekken" className="ib-back" onClick={onBack}>
          <ArrowLeft size={17} />
        </IconButton>
        <ContactAvatar name={c.contact.name} channel={c.channel} size={36} />
        <div className="ib-thread-title">
          <h2>
            {c.contact.name}
            <span className={"ib-state is-" + c.status}>{STATUS_TEXT[c.status]}</span>
          </h2>
          <p>
            <ChannelIcon channel={c.channel} size={12} label />
            {c.contact.handle && c.contact.handle !== c.contact.name && <span>{c.contact.handle}</span>}
            {c.subject && <span className="ib-subject">{c.subject}</span>}
            {assignee && <span className="ib-assignee">· {assignee.userId === userId ? "Toegewezen aan jou" : assignee.name}</span>}
          </p>
        </div>
        <div className="ib-thread-actions">
          <Menu
            label="Toewijzen"
            trigger={<UserPlus size={16} />}
            items={[
              { type: "heading", label: "Toewijzen aan" },
              { label: "Niemand", checked: !c.assignedUserId, onSelect: () => onUpdate({ assignedUserId: null }) },
              ...detail.members.map((m) => ({
                label: m.userId === userId ? m.name + " (ik)" : m.name,
                checked: c.assignedUserId === m.userId,
                onSelect: () => onUpdate({ assignedUserId: m.userId }),
              })),
            ]}
          />
          <IconButton
            label={resolved ? "Heropenen" : "Afhandelen en archiveren"}
            onClick={() => onUpdate({ status: resolved ? "open" : "resolved" })}
          >
            {resolved ? <ArchiveRestore size={16} /> : <Archive size={16} />}
          </IconButton>
          <Menu
            label="Meer acties"
            trigger={<MoreHorizontal size={16} />}
            items={[
              { type: "heading", label: "Status" },
              { label: "Open", checked: c.status === "open", onSelect: () => onUpdate({ status: "open" }) },
              { label: "In afwachting", checked: c.status === "pending", onSelect: () => onUpdate({ status: "pending" }) },
              { label: "Afgehandeld", checked: c.status === "resolved", onSelect: () => onUpdate({ status: "resolved" }) },
              { type: "separator" },
              { label: "Markeren als ongelezen", icon: <MailOpen size={15} />, onSelect: () => onUpdate({ unread: true }) },
            ]}
          />
          <IconButton label={detailsOpen ? "Klantgegevens verbergen" : "Klantgegevens tonen"} active={detailsOpen} className="ib-details-btn" onClick={onDetails}>
            <PanelRight size={16} />
          </IconButton>
        </div>
      </header>

      <div className="ib-messages" ref={scroller}>
        {detail.hasMore && (
          <button type="button" className="ib-older" onClick={onOlder}>
            Oudere berichten laden
          </button>
        )}
        {detail.messages.map((m, i) => {
          const icon = m.direction === "outbound" ? STATUS_ICON[m.status] : null;
          const StatusGlyph = icon?.[0];
          const prev = detail.messages[i - 1];
          const next = detail.messages[i + 1];
          const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
          // Consecutive messages from the same side within 5 minutes form a group.
          const joins = (a?: MessageView, b?: MessageView) => !!a && !!b && a.direction === b.direction && a.direction !== "note" && dayKey(a.createdAt) === dayKey(b.createdAt) && Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) < 300000;
          const lastOfGroup = !joins(m, next);
          return (
            <Fragment key={m.id}>
            {newDay && (
              <div className="ib-day" role="separator">
                <span>{dayLabel(m.createdAt)}</span>
              </div>
            )}
            <article className={"ib-msg ib-msg-" + m.direction + (m.status === "failed" ? " is-failed" : "") + (joins(prev, m) && !newDay ? " is-grouped" : "")}>
              {m.direction === "note" && (
                <p className="ib-note-label">
                  <StickyNote size={12} aria-hidden="true" /> Interne notitie
                </p>
              )}
              {m.body && <p className="ib-msg-body">{m.body}</p>}
              <Attachments m={m} />
              {(lastOfGroup || m.status === "failed") && (<footer>
                {m.direction !== "inbound" && <span>{m.author}</span>}
                <time dateTime={m.createdAt}>{messageTime(m.createdAt)}</time>
                {icon && StatusGlyph && (
                  <span className={"ib-status ib-status-" + m.status} title={icon[1]}>
                    <StatusGlyph size={12} aria-hidden="true" />
                    <span className="sr-only">{icon[1]}</span>
                  </span>
                )}
              </footer>)}
              {m.status === "failed" && (
                <p className="ib-msg-error" role="alert">
                  {m.error || "Versturen is niet gelukt."}
                  {m.clientId && canRetry(m.clientId) && (
                    <button type="button" onClick={() => onRetry(m.clientId!)}>
                      <RotateCcw size={12} aria-hidden="true" /> Opnieuw
                    </button>
                  )}
                </p>
              )}
            </article>
            </Fragment>
          );
        })}
        {!detail.messages.length && <p className="ib-list-empty">Nog geen berichten in dit gesprek.</p>}
      </div>

      <div className={"ib-composer" + (noteMode ? " is-note" : "")}>
        <div className="ib-composer-tabs" role="tablist" aria-label="Soort bericht">
          <button type="button" role="tab" aria-selected={!noteMode} onClick={() => setMode("reply")}>
            Bericht
          </button>
          <button type="button" role="tab" aria-selected={noteMode} onClick={() => setMode("note")}>
            Interne notitie
          </button>
          {!noteMode && win.applies && win.open && windowLabel(win.closesAt) && (
            <span className="ib-window" title="Binnen dit venster kun je vrij antwoorden">
              Antwoordvenster: {windowLabel(win.closesAt)}
            </span>
          )}
        </div>

        {!noteMode && closed && !caps.templates && (
          <p className="ib-banner">
            Het 24-uursvenster van {caps.label} is gesloten. Je kunt weer antwoorden zodra de klant opnieuw een bericht stuurt.
          </p>
        )}
        {suggested && !noteMode && (
          <p className="ib-ai-note">
            Voorstel van Mavi. Controleer en pas het aan; er wordt niets verstuurd tot jij op Versturen drukt.
            {undo !== null && (
              <button
                type="button"
                onClick={() => {
                  onDraft(undo);
                  setUndo(null);
                  setSuggested(false);
                }}
              >
                Ongedaan maken
              </button>
            )}
          </p>
        )}
        {notice && (
          <p className="ib-error" role="alert">
            {notice}
          </p>
        )}

        {useTemplate ? (
          <div className="ib-templates">
            <p className="ib-banner">Het 24-uursvenster is gesloten. Stuur een goedgekeurde WhatsApp-template.</p>
            {templates === null ? (
              <p className="ib-muted">Templates laden…</p>
            ) : templates.length === 0 ? (
              <p className="ib-muted">Er zijn geen goedgekeurde templates zonder media-header. Maak er een aan in WhatsApp Manager.</p>
            ) : (
              <>
                <label className="ib-field">
                  <span>Template</span>
                  <select
                    value={template ? template.name + "|" + template.language : ""}
                    onChange={(e) => {
                      const t = templates.find((x) => x.name + "|" + x.language === e.target.value) || null;
                      setTemplate(t);
                      setVars(t ? Array(t.variables).fill("") : []);
                    }}
                  >
                    <option value="">Kies een template</option>
                    {templates.map((t) => (
                      <option key={t.name + t.language} value={t.name + "|" + t.language}>
                        {t.name} ({t.language})
                      </option>
                    ))}
                  </select>
                </label>
                {template && <p className="ib-template-body">{template.body}</p>}
                {vars.map((v, i) => (
                  <label key={i} className="ib-field">
                    <span>{`Variabele {{${i + 1}}}`}</span>
                    <input value={v} maxLength={1000} onChange={(e) => setVars(vars.map((x, j) => (j === i ? e.target.value : x)))} />
                  </label>
                ))}
                <button type="button" className="button primary" onClick={submit} disabled={!template || vars.some((v) => !v.trim())}>
                  Template versturen
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="ib-compose-box">
            {files.length > 0 && (
              <ul className="ib-files">
                {files.map((f, i) => (
                  <li key={i}>
                    <FileText size={13} aria-hidden="true" />
                    {f.name}
                    <button type="button" aria-label={"Verwijder " + f.name} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="sr-only" htmlFor="ib-input">
              {noteMode ? "Interne notitie" : "Bericht"}
            </label>
            <textarea
              id="ib-input"
              ref={input}
              rows={2}
              value={draft}
              disabled={blocked}
              maxLength={noteMode ? 5000 : caps.subject ? 20000 : 4000}
              placeholder={noteMode ? "Notitie voor je team — de klant ziet dit niet" : "Bericht schrijven…"}
              onChange={(e) => onDraft(e.target.value)}
              onKeyDown={keyDown}
            />
            <div className="ib-compose-bar">
              <div className="ib-compose-tools">
                {!noteMode && caps.outboundAttachments && (
                  <>
                    <IconButton label="Bijlage toevoegen" onClick={() => fileInput.current?.click()}>
                      <Paperclip size={16} />
                    </IconButton>
                    <input
                      ref={fileInput}
                      type="file"
                      multiple
                      hidden
                      accept={Object.keys(ALLOWED_UPLOADS).join(",")}
                      onChange={(e) => {
                        void addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </>
                )}
                {!noteMode && (
                  <IconButton label="Antwoord laten voorstellen door Mavi" onClick={() => void suggest()} disabled={suggesting || blocked}>
                    <Mavi size={16} state={suggesting ? "thinking" : "idle"} />
                  </IconButton>
                )}
                {!noteMode && (
                  <Menu
                    label="Tekst aanpassen met Mavi"
                    className="ib-rewrite-menu"
                    trigger={<Wand2 size={16} />}
                    align="start"
                    items={[
                      { type: "heading", label: draft.trim() ? "Mavi past je tekst aan" : "Schrijf eerst een tekst" },
                      ...REWRITE.map(([style, label]) => ({
                        label,
                        disabled: !draft.trim() || suggesting || blocked,
                        onSelect: () => void rewrite(style),
                      })),
                    ]}
                  />
                )}
                <span className="ib-compose-hint">Enter om te versturen · Shift+Enter nieuwe regel</span>
              </div>
              <button
                type="button"
                className="composer-send"
                onClick={submit}
                aria-label={noteMode ? "Notitie opslaan" : "Versturen"}
                disabled={noteMode ? !draft.trim() : blocked || (!draft.trim() && !files.length)}
              >
                {noteMode ? <StickyNote size={16} /> : <ArrowUp size={17} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
