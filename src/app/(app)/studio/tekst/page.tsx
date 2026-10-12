"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Copy, Eye, PenLine, RefreshCw, Undo2, Wand2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { SaveIndicator, type SaveStatus } from "@/components/save-indicator";
import { Mavi } from "@/components/mavi";
import { Menu } from "@/components/menu";
import { Markdown } from "@/components/agent/markdown";
import { CONTENT_EDIT_LABELS, editContentText, generateCopyText, type ContentEditAction } from "@/lib/api-client";
import { COPY_KINDS, type CopyKind, type MarketingCopy } from "@/lib/studio";
import "../../../studio.css";
import "../../../agent.css";

// Marketing copy editor (website, ad, flyer, product text). Stored in
// workspace.copies; autosaves after a pause, with undo for every AI change.
const AUTOSAVE_MS = 1500;

function CopyEditor() {
  const { data, save, saveState, ready } = useWorkspace();
  const router = useRouter();
  const search = useSearchParams();
  const existing = (data.copies || []).find((c) => c.id === search.get("id"));
  const [copy, setCopy] = useState<MarketingCopy | null>(existing || null);
  const [title, setTitle] = useState(existing?.title || "");
  const [kind, setKind] = useState<CopyKind>((existing?.kind || (COPY_KINDS.find((k) => k.id === search.get("kind"))?.id ?? "website")) as CopyKind);
  const [prompt, setPrompt] = useState(existing?.prompt || search.get("brief")?.slice(0, 1500) || "");
  const [body, setBody] = useState(existing?.body || "");
  const [status, setStatus] = useState<SaveStatus>(existing ? "saved" : "idle");
  const [busy, setBusy] = useState<"" | "generate" | "edit">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const started = useRef(false);

  const dirty = !!copy && (body !== copy.body || title !== copy.title || kind !== copy.kind);
  const shown: SaveStatus = dirty && status !== "saving" ? "dirty" : status;

  const persist = useCallback(
    async (next: MarketingCopy) => {
      setStatus("saving");
      const list = data.copies || [];
      const ok = await save({ ...data, copies: list.some((c) => c.id === next.id) ? list.map((c) => (c.id === next.id ? next : c)) : [next, ...list] }, "Tekst opgeslagen");
      setStatus(ok ? "saved" : "error");
      if (ok) {
        setCopy(next);
        if (search.get("id") !== next.id) router.replace("/studio/tekst?id=" + next.id, { scroll: false });
      }
      return ok;
    },
    [data, save, router, search],
  );
  const current = useCallback(
    (over: Partial<MarketingCopy> = {}): MarketingCopy => {
      const now = new Date().toISOString();
      return {
        id: copy?.id || crypto.randomUUID(),
        title: (title || prompt).trim().slice(0, 120) || "Marketingtekst",
        kind,
        prompt: prompt.trim(),
        body,
        status: copy?.status || "draft",
        createdAt: copy?.createdAt || now,
        updatedAt: now,
        ...over,
      };
    },
    [copy, title, prompt, kind, body],
  );

  useEffect(() => {
    if (!dirty || busy) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (saveState !== "saving") void persist(current({ status: "draft" }));
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer.current);
  }, [dirty, busy, body, title, kind, persist, current, saveState]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function generate() {
    if (!prompt.trim()) return setError("Beschrijf eerst welke tekst je nodig hebt.");
    setError("");
    setMessage("");
    setBusy("generate");
    try {
      const text = await generateCopyText(kind, prompt.trim());
      if (body) setHistory((h) => [...h.slice(-9), body]);
      setBody(text);
      setAlternatives([]);
      const next = current({ body: text, title: title || prompt.trim().slice(0, 120) });
      setTitle(next.title);
      await persist(next);
      setMessage("Tekst gemaakt en opgeslagen. Pas hem gerust aan.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Genereren is niet gelukt. Probeer het opnieuw.");
    } finally {
      setBusy("");
    }
  }
  function startManual() {
    const next = current({ body: "" });
    setCopy({ ...next, body: "" });
    setTitle(next.title);
    setMessage("Schrijf je tekst. Mavix slaat hem automatisch op.");
    window.setTimeout(() => document.getElementById("cp-body")?.focus(), 50);
  }
  useEffect(() => {
    if (!ready || started.current || existing) return;
    started.current = true;
    const start = search.get("start");
    // Drop brief/start from the URL so a reload never creates a second text.
    window.history.replaceState(window.history.state, "", "/studio/tekst");
    if (start === "manual") startManual();
    else if (start === "ai" && prompt.trim()) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, after the workspace loaded
  }, [ready]);

  async function edit(action: ContentEditAction) {
    if (!body.trim()) return;
    setError("");
    setMessage("");
    setBusy("edit");
    try {
      const results = await editContentText(action, body, "copy");
      if (action === "alternatives" || action === "headline") setAlternatives(results);
      else if (results[0]) {
        setHistory((h) => [...h.slice(-9), body]);
        setBody(results[0]);
        setMessage("Mavix AI heeft je tekst aangepast. Controleer het resultaat.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aanpassen is niet gelukt. Je tekst is niet gewijzigd.");
    } finally {
      setBusy("");
    }
  }

  if (!ready) return <p role="status">Laden…</p>;
  if (search.get("id") && !existing && !copy)
    return (
      <div className="st2">
        <p role="alert">Deze tekst is niet gevonden.</p>
        <Link href="/studio">Terug naar Content Studio</Link>
      </div>
    );

  return (
    <div className="st2">
      <Link href="/studio" className="st2-back">
        <ArrowLeft size={15} aria-hidden="true" /> Content Studio
      </Link>
      <div className="cs-studio">
        <div className="cs-toolbar">
          <div className="cs-toolbar-title">
            <h2>{copy ? "Marketingtekst" : "Nieuwe marketingtekst"}</h2>
            {copy?.status === "ready" && <span className="st2-status is-approved">Klaar</span>}
            <SaveIndicator status={shown} />
          </div>
          <div className="cs-view-switch" role="tablist" aria-label="Weergave">
            <button type="button" role="tab" aria-selected={view === "edit"} onClick={() => setView("edit")}>
              <PenLine size={14} aria-hidden="true" /> Bewerken
            </button>
            <button type="button" role="tab" aria-selected={view === "preview"} onClick={() => setView("preview")}>
              <Eye size={14} aria-hidden="true" /> Voorbeeld
            </button>
          </div>
          {copy && (
            <div className="cs-toolbar-actions">
              <button
                type="button"
                className="button secondary"
                disabled={!body.trim()}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(body);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1600);
                  } catch {
                    setError("Kopiëren is niet gelukt. Selecteer de tekst handmatig.");
                  }
                }}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                <span>{copied ? "Gekopieerd" : "Kopiëren"}</span>
              </button>
              <button
                type="button"
                className="button primary"
                disabled={!body.trim() || status === "saving"}
                onClick={async () => {
                  if (await persist(current({ status: copy.status === "ready" ? "draft" : "ready" }))) setMessage(copy.status === "ready" ? "Weer als concept gemarkeerd." : "Gemarkeerd als klaar.");
                }}
              >
                <Check size={15} />
                <span>{copy.status === "ready" ? "Terug naar concept" : "Markeer als klaar"}</span>
              </button>
            </div>
          )}
        </div>

        <div className="cs-grid cs-grid-two" data-view={view}>
          <section className="cs-editor" aria-label="Editor">
            <div className="cs-field-row">
              <label className="cs-field">
                <span>Soort tekst</span>
                <select value={kind} onChange={(e) => setKind(e.target.value as CopyKind)}>
                  {COPY_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cs-field">
                <span>Titel (voor jezelf)</span>
                <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. Over ons — website" />
              </label>
            </div>
            <form
              className="cs-brief"
              onSubmit={(e) => {
                e.preventDefault();
                void generate();
              }}
            >
              <label htmlFor="cp-prompt">Welke tekst heb je nodig?</label>
              <textarea id="cp-prompt" rows={copy ? 2 : 3} maxLength={1500} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Bijvoorbeeld: een korte over-ons-tekst voor de website, warm en persoonlijk" />
              <div className="cs-brief-bar">
                <small>{COPY_KINDS.find((k) => k.id === kind)?.hint}</small>
                {!copy && (
                  <button type="button" className="button secondary" disabled={!!busy} onClick={startManual}>
                    <PenLine size={15} /> Zelf schrijven
                  </button>
                )}
                <button className="button primary" disabled={!!busy || !prompt.trim()} aria-busy={busy === "generate"}>
                  {busy === "generate" ? <Mavi size={16} state="thinking" tone="brand" live /> : copy ? <RefreshCw size={15} /> : <Wand2 size={15} />}
                  {busy === "generate" ? "Bezig…" : copy ? "Opnieuw maken" : "Maak met Mavix AI"}
                </button>
              </div>
            </form>
            {copy ? (
              <div className="cs-result">
                <div className="cs-ai-bar" role="toolbar" aria-label="Tekst aanpassen met Mavix AI">
                  {CONTENT_EDIT_LABELS.slice(0, 3).map(([action, label]) => (
                    <button key={action} type="button" className="cs-chip" disabled={!!busy || !body.trim()} onClick={() => void edit(action)}>
                      {label}
                    </button>
                  ))}
                  <Menu
                    label="Meer AI-acties"
                    align="start"
                    trigger={
                      <span className="cs-chip cs-chip-more">
                        <Wand2 size={13} aria-hidden="true" /> Meer
                      </span>
                    }
                    items={CONTENT_EDIT_LABELS.slice(3).map(([action, label]) => ({ label, disabled: !!busy || !body.trim(), onSelect: () => void edit(action) }))}
                  />
                  {busy === "edit" && (
                    <span className="cs-ai-busy" role="status">
                      <Mavi size={14} state="thinking" tone="brand" live /> Mavix AI past je tekst aan…
                    </span>
                  )}
                  {history.length > 0 && busy !== "edit" && (
                    <button
                      type="button"
                      className="cs-undo"
                      onClick={() => {
                        setBody(history[history.length - 1]);
                        setHistory((h) => h.slice(0, -1));
                      }}
                    >
                      <Undo2 size={13} aria-hidden="true" /> Ongedaan maken
                    </button>
                  )}
                </div>
                <label className="cs-label" htmlFor="cp-body">
                  Tekst <small>{body.length} tekens</small>
                </label>
                <textarea id="cp-body" className="cs-caption" rows={14} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} />
                {alternatives.length > 0 && (
                  <div className="cs-alternatives">
                    <p>Kies een alternatief (je huidige tekst kun je terughalen met Ongedaan maken):</p>
                    {alternatives.map((alt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setHistory((h) => [...h.slice(-9), body]);
                          setBody(alt);
                          setAlternatives([]);
                        }}
                      >
                        {alt}
                      </button>
                    ))}
                    <button type="button" className="cs-undo" onClick={() => setAlternatives([])}>
                      Sluiten
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="cs-empty">
                <Mavi size={44} tone="brand" live />
                <h3>Beschrijf de tekst die je nodig hebt</h3>
                <p>Mavix gebruikt je Brand Hub en verzint geen prijzen, acties of claims. Of schrijf de tekst zelf.</p>
              </div>
            )}
            {(message || error) && (
              <p role={error ? "alert" : "status"} className={error ? "cs-error" : "cs-message"}>
                {error || message}
              </p>
            )}
          </section>
          <aside className="cs-preview" aria-label="Voorbeeld">
            <p className="cs-preview-label">Voorbeeld</p>
            <article className="cp-paper">{body.trim() ? <Markdown text={body} /> : <p className="ig-phone-muted">Je tekst verschijnt hier.</p>}</article>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Laden…</p>}>
      <CopyEditor />
    </Suspense>
  );
}
