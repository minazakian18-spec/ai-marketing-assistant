"use client";
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from "react";
import { ArrowUp, FileText, Globe, ImagePlus, Paperclip, Telescope, X } from "lucide-react";
import { IconButton } from "@/components/ui";
import type { AgentAttachment } from "@/lib/agent-handoff";
import { RotatingPrompt } from "@/components/rotating-prompt";
import { GlowBorder } from "@/components/glow-border";

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const FILE_TYPES =
  ".pdf,.txt,.csv,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/png,image/jpeg,image/webp,image/gif";

export type ComposerTools = {
  // Only shown when the Agent can really do it; off until an AI model with
  // these tools is connected.
  webSearch?: boolean;
  deepResearch?: boolean;
};

let seq = 0;
const toAttachment = (file: File): AgentAttachment => {
  const image = file.type.startsWith("image/");
  return { id: "att-" + ++seq, file, kind: image ? "image" : "file", preview: image ? URL.createObjectURL(file) : undefined };
};

// The Mavix Agent input: text, files and images (picker, drag & drop or
// paste), Enter to send and Shift+Enter for a new line.
export function AgentComposer({
  onSubmit,
  placeholder = "Vraag Mavi iets of geef een opdracht…",
  size = "large",
  busy = false,
  autoFocus = false,
  tools = {},
  suggestions,
  defaultText = "",
  attachments = true,
  onTypingChange,
}: {
  onSubmit: (text: string, attachments: AgentAttachment[], options: { webSearch: boolean; deepResearch: boolean }) => void;
  placeholder?: string;
  size?: "large" | "compact";
  busy?: boolean;
  autoFocus?: boolean;
  tools?: ComposerTools;
  /** Example prompts that animate in the empty input; Tab takes the current one. */
  suggestions?: string[];
  /** Starting text (e.g. a prompt handed over from the dashboard). */
  defaultText?: string;
  /** File and image upload; off where the receiver cannot process files. */
  attachments?: boolean;
  /** Reports whether the user has typed something (e.g. for Mavi's attention). */
  onTypingChange?: (typing: boolean) => void;
}) {
  const [text, setText] = useState(defaultText);
  const [suggestion, setSuggestion] = useState("");
  const rotating = !!suggestions?.length;
  const [files, setFiles] = useState<AgentAttachment[]>([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // The travelling border light only runs while the composer is on screen.
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = formRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // The border light glides only while there is something to send or a real
  // request is running; otherwise the composer shows its calm border.
  const hasContent = !!text.trim() || files.length > 0;
  const glowing = hasContent || busy;
  const typing = !!text.trim();
  useEffect(() => {
    onTypingChange?.(typing);
  }, [typing, onTypingChange]);
  const filePicker = useRef<HTMLInputElement>(null);
  const imagePicker = useRef<HTMLInputElement>(null);
  const latest = useRef<AgentAttachment[]>([]);
  useEffect(() => {
    latest.current = files;
  }, [files]);
  // Previews still in the composer are released when it unmounts; submitted
  // attachments belong to the receiver from then on.
  useEffect(() => () => latest.current.forEach((f) => f.preview && URL.revokeObjectURL(f.preview)), []);

  // Grow with the text up to a limit.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, size === "large" ? 240 : 160) + "px";
  }, [text, size]);

  function add(list: FileList | File[] | null) {
    if (!list) return;
    setError("");
    const next = [...files];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        setError("Je kunt maximaal " + MAX_FILES + " bestanden toevoegen.");
        break;
      }
      if (file.size > MAX_BYTES) {
        setError(file.name + " is groter dan 10 MB.");
        continue;
      }
      next.push(toAttachment(file));
    }
    setFiles(next);
  }

  function remove(id: string) {
    const f = files.find((x) => x.id === id);
    if (f?.preview) URL.revokeObjectURL(f.preview);
    setFiles(files.filter((x) => x.id !== id));
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (busy || (!text.trim() && !files.length)) return;
    onSubmit(text.trim(), files, { webSearch, deepResearch });
    setText("");
    setFiles([]);
    setError("");
  }

  const drag = (e: DragEvent, on: boolean) => {
    if (!attachments || !e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDragging(on);
  };
  const paste = (e: ClipboardEvent) => {
    if (!attachments) return;
    const pasted = Array.from(e.clipboardData.files);
    if (pasted.length) {
      e.preventDefault();
      add(pasted);
    }
  };

  return (
    <form
      ref={formRef}
      className={"composer composer-" + size + (dragging ? " is-dragging" : "")}
      data-busy={busy || undefined}
      data-glow={glowing || undefined}
      data-paused={!inView || undefined}
      onSubmit={submit}
      onDragOver={(e) => drag(e, true)}
      onDragEnter={(e) => drag(e, true)}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        drag(e, false);
        if (attachments) add(e.dataTransfer.files);
      }}
    >
      <GlowBorder />
      {files.length > 0 && (
        <ul className="composer-files" aria-label="Bijlagen">
          {files.map((f) => (
            <li key={f.id} className={"composer-file is-" + f.kind}>
              {f.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.preview} alt="" />
              ) : (
                <FileText size={15} aria-hidden="true" />
              )}
              <span>{f.file.name}</span>
              <button type="button" onClick={() => remove(f.id)} aria-label={"Verwijder " + f.file.name}>
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="sr-only" htmlFor={"composer-" + size}>
        Bericht aan Mavi
      </label>
      <div className="composer-field">
        <textarea
          id={"composer-" + size}
          ref={area}
          rows={size === "large" ? 2 : 1}
          value={text}
          maxLength={2000}
          autoFocus={autoFocus}
          placeholder={rotating ? "" : placeholder}
          onChange={(e) => setText(e.target.value)}
          onPaste={paste}
          onKeyDown={(e) => {
            if (e.key === "Tab" && !e.shiftKey && rotating && !text && suggestion) {
              e.preventDefault();
              setText(suggestion);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {rotating && <RotatingPrompt prompts={suggestions!} hidden={!!text || files.length > 0} onCurrent={setSuggestion} />}
      </div>
      {error && (
        <p className="composer-error" role="alert">
          {error}
        </p>
      )}
      <div className="composer-bar">
        <div className="composer-tools">
          {attachments && (
            <>
              <IconButton label="Bestand toevoegen" onClick={() => filePicker.current?.click()}>
                <Paperclip size={17} />
              </IconButton>
              <IconButton label="Afbeelding toevoegen" onClick={() => imagePicker.current?.click()}>
                <ImagePlus size={17} />
              </IconButton>
            </>
          )}
          {tools.webSearch && (
            <IconButton label="Web zoeken" active={webSearch} onClick={() => setWebSearch(!webSearch)}>
              <Globe size={17} />
            </IconButton>
          )}
          {tools.deepResearch && (
            <IconButton label="Diepgaand onderzoek" active={deepResearch} onClick={() => setDeepResearch(!deepResearch)}>
              <Telescope size={17} />
            </IconButton>
          )}
          {size === "large" && (
            <span className="composer-hint">
              {rotating && !text ? (
                <>
                  <kbd>Tab</kbd> neemt het voorbeeld over{attachments ? " · sleep of plak bestanden" : ""}
                </>
              ) : (
                attachments ? "Sleep bestanden hierheen of plak een afbeelding" : "Enter om te versturen · Shift+Enter voor een nieuwe regel"
              )}
            </span>
          )}
        </div>
        <button type="submit" className="composer-send" aria-label="Versturen" disabled={busy || (!text.trim() && !files.length)}>
          <ArrowUp size={17} />
        </button>
      </div>
      <input
        ref={filePicker}
        type="file"
        multiple
        hidden
        accept={FILE_TYPES}
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={imagePicker}
        type="file"
        multiple
        hidden
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      {dragging && <div className="composer-drop">Laat los om toe te voegen</div>}
    </form>
  );
}

