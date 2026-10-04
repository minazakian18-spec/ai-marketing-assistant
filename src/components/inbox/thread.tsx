"use client";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  Download,
  FileText,
  Info,
  Paperclip,
  RotateCcw,
  Send,
  StickyNote,
  X,
} from "lucide-react";
import { Mavi } from "@/components/mavi";
import {
  ALLOWED_UPLOADS,
  MAX_UPLOAD_BYTES,
  type Capabilities,
  type ConversationView,
  type MessageView,
  type Upload,
} from "@/lib/inbox/shared";
import { ChannelIcon } from "./channel-icon";
import { messageTime, windowLabel } from "./format";

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

function StatusIcon({ m }: { m: MessageView }) {
  if (m.direction === "inbound" || m.direction === "note") return null;
  const map = {
    pending: [Clock, "Wordt verstuurd"],
    sent: [Check, "Verzonden"],
    delivered: [CheckCheck, "Afgeleverd"],
    read: [CheckCheck, "Gelezen"],
    failed: [AlertCircle, "Niet verzonden"],
    received: [Check, "Ontvangen"],
  } as const;
  const [Icon, label] = map[m.status];
  return (
    <span className={"ib-status ib-status-" + m.status} title={label}>
      <Icon size={13} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

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
          ) : a.href ? (
            <a href={a.href} target="_blank" rel="noreferrer noopener" className="ib-file">
              <Download size={14} aria-hidden="true" />
              {a.name || "Bijlage"}
            </a>
          ) : (
            <span className="ib-file">
              <FileText size={14} aria-hidden="true" />
              {a.name || "Bijlage"}
            </span>
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
  demo,
  draft,
  onDraft,
  onSend,
  onNote,
  onRetry,
  canRetry,
  onOlder,
  onBack,
  onDetails,
  onSuggest,
  templates,
  onLoadTemplates,
}: {
  detail: Detail;
  demo: boolean;
  draft: string;
  onDraft: (v: string) => void;
  onSend: (p: SendPayload) => void;
  onNote: (body: string) => void;
  onRetry: (clientId: string) => void;
  canRetry: (clientId: string) => boolean;
  onOlder: () => void;
  onBack: () => void;
  onDetails: () => void;
  onSuggest: () => Promise<string | null>;
  templates: Template[] | null;
  onLoadTemplates: () => void;
}) {
  const { conversation: c, capabilities: caps, window: win } = detail;
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [files, setFiles] = useState<Upload[]>([]);
  const [fileError, setFileError] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState(false);
  const [aiError, setAiError] = useState("");
  const [template, setTemplate] = useState<Template | null>(null);
  const [vars, setVars] = useState<string[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const lastId = detail.messages[detail.messages.length - 1]?.id;

  useEffect(() => {
    setMode("reply");
    setFiles([]);
    setFileError("");
    setSuggested(false);
    setAiError("");
    setTemplate(null);
  }, [c.id]);

  // Keep the newest message in view when a conversation opens or grows.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [c.id, lastId]);

  const closed = win.applies && !win.open;
  const noteMode = mode === "note";
  const blocked = demo || (!noteMode && closed && !caps.templates);
  const useTemplate = !noteMode && closed && caps.templates;

  useEffect(() => {
    if (useTemplate && templates === null) onLoadTemplates();
  }, [useTemplate, templates, onLoadTemplates]);

  function submit() {
    if (demo) return;
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
  }

  function keyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  async function addFiles(list: FileList | null) {
    setFileError("");
    if (!list) return;
    const next: Upload[] = [...files];
    for (const f of Array.from(list)) {
      if (!ALLOWED_UPLOADS[f.type]) {
        setFileError("Dit bestandstype kan niet worden verstuurd.");
        continue;
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        setFileError("Een bijlage mag maximaal 10 MB zijn.");
        continue;
      }
      if (next.length >= 5) {
        setFileError("Je kunt maximaal 5 bijlagen versturen.");
        break;
      }
      next.push(await readFile(f));
    }
    setFiles(next);
  }

  async function suggest() {
    setSuggesting(true);
    setAiError("");
    try {
      const text = await onSuggest();
      if (text) {
        onDraft(text);
        setMode("reply");
        setSuggested(true);
        window.setTimeout(() => input.current?.focus(), 0);
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Mavi kon geen voorstel maken.");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <section className="ib-thread" aria-label={"Gesprek met " + c.contact.name}>
      <header className="ib-thread-head">
        <button type="button" className="ib-icon ib-back" onClick={onBack} aria-label="Terug naar gesprekken">
          <ArrowLeft size={18} />
        </button>
        <div className="ib-thread-title">
          <h2>{c.contact.name}</h2>
          <p>
            <ChannelIcon channel={c.channel} label />
            {c.subject && <span className="ib-subject">· {c.subject}</span>}
          </p>
        </div>
        <button type="button" className="ib-icon ib-details-btn" onClick={onDetails} aria-label="Klantgegevens tonen">
          <Info size={18} />
        </button>
      </header>

      <div className="ib-messages" ref={scroller}>
        {detail.hasMore && (
          <button type="button" className="ib-older" onClick={onOlder}>
            Oudere berichten laden
          </button>
        )}
        {detail.messages.map((m) => (
          <article key={m.id} className={"ib-msg ib-msg-" + m.direction + (m.status === "failed" ? " is-failed" : "")}>
            <header>
              {m.direction === "note" && <StickyNote size={12} aria-hidden="true" />}
              <span>{m.direction === "note" ? "Interne notitie · " + m.author : m.author}</span>
              <time dateTime={m.createdAt}>{messageTime(m.createdAt)}</time>
              <StatusIcon m={m} />
            </header>
            {m.body && <p className="ib-msg-body">{m.body}</p>}
            <Attachments m={m} />
            {m.status === "failed" && (
              <p className="ib-msg-error" role="alert">
                {m.error || "Versturen is niet gelukt."}
                {m.clientId && canRetry(m.clientId) && (
                  <button type="button" onClick={() => onRetry(m.clientId!)}>
                    <RotateCcw size={12} aria-hidden="true" /> Opnieuw proberen
                  </button>
                )}
              </p>
            )}
          </article>
        ))}
        {!detail.messages.length && <p className="ib-list-empty">Nog geen berichten in dit gesprek.</p>}
      </div>

      <div className={"ib-composer" + (noteMode ? " is-note" : "")}>
        <div className="ib-composer-tabs" role="tablist" aria-label="Soort bericht">
          <button type="button" role="tab" aria-selected={!noteMode} onClick={() => setMode("reply")}>
            Antwoord
          </button>
          <button type="button" role="tab" aria-selected={noteMode} onClick={() => setMode("note")}>
            Interne notitie
          </button>
          {!noteMode && !useTemplate && (
            <button type="button" className="ib-mavi" onClick={() => void suggest()} disabled={demo || suggesting || blocked}>
              <Mavi size={16} state={suggesting ? "thinking" : "idle"} />
              {suggesting ? "Mavi denkt na…" : "Mavi antwoord voorstellen"}
            </button>
          )}
        </div>

        {demo && <p className="ib-banner">Demo: versturen is uitgeschakeld voor voorbeeldgesprekken.</p>}
        {!demo && !noteMode && closed && !caps.templates && (
          <p className="ib-banner">
            Het 24-uursvenster van {caps.label} is gesloten. Je kunt weer antwoorden zodra de klant opnieuw een bericht stuurt.
          </p>
        )}
        {!demo && !noteMode && win.applies && win.open && windowLabel(win.closesAt) && (
          <p className="ib-window">Antwoordvenster open: {windowLabel(win.closesAt)}</p>
        )}
        {suggested && !noteMode && (
          <p className="ib-ai-note" role="status">
            Voorstel van Mavi — controleer en pas aan voordat je verstuurt. Er wordt niets automatisch verzonden.
          </p>
        )}
        {aiError && <p className="ib-error" role="alert">{aiError}</p>}

        {useTemplate && !demo ? (
          <div className="ib-templates">
            <p className="ib-banner">Het 24-uursvenster is gesloten. Kies een goedgekeurde WhatsApp-template.</p>
            {templates === null ? (
              <p className="ib-list-empty">Templates laden…</p>
            ) : templates.length === 0 ? (
              <p className="ib-list-empty">Er zijn geen goedgekeurde templates zonder media-header. Maak er een aan in WhatsApp Manager.</p>
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
                  <Send size={15} /> Template versturen
                </button>
              </>
            )}
          </div>
        ) : (
          <>
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
            {fileError && <p className="ib-error" role="alert">{fileError}</p>}
            <div className="ib-compose-row">
              <label className="sr-only" htmlFor="ib-input">
                {noteMode ? "Interne notitie" : "Antwoord"}
              </label>
              <textarea
                id="ib-input"
                ref={input}
                rows={3}
                value={draft}
                disabled={blocked && !noteMode}
                maxLength={noteMode ? 5000 : caps.subject ? 20000 : 4000}
                placeholder={noteMode ? "Notitie voor je team (de klant ziet dit niet)" : "Schrijf een antwoord… (Enter = versturen, Shift+Enter = nieuwe regel)"}
                onChange={(e) => {
                  onDraft(e.target.value);
                }}
                onKeyDown={keyDown}
              />
              <div className="ib-compose-actions">
                {!noteMode && caps.outboundAttachments && !demo && (
                  <label className="ib-icon" title="Bijlage toevoegen">
                    <Paperclip size={17} aria-hidden="true" />
                    <span className="sr-only">Bijlage toevoegen</span>
                    <input
                      type="file"
                      multiple
                      hidden
                      accept={Object.keys(ALLOWED_UPLOADS).join(",")}
                      onChange={(e) => {
                        void addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
                <button
                  type="button"
                  className="button primary"
                  onClick={submit}
                  disabled={demo || (noteMode ? !draft.trim() : blocked || (!draft.trim() && !files.length))}
                >
                  {noteMode ? <StickyNote size={15} /> : <Send size={15} />}
                  {noteMode ? "Notitie opslaan" : "Versturen"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
