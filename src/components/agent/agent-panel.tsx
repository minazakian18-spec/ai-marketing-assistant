"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Maximize2, RotateCcw, X } from "lucide-react";
import { MaviAvatar } from "@/components/mavi";
import { IconButton } from "@/components/ui";
import { AgentComposer } from "@/components/agent-composer";
import { useWorkspace } from "@/components/workspace-provider";
import { agentShortcuts } from "@/lib/agent/engine";
import { useAgent } from "./agent-provider";
import { AgentConversation } from "./agent-conversation";
import { AgentPrompts } from "./agent-prompts";

// Slide-over assistant available on every app page. It sits on top of the
// right edge without blocking the page behind it (no scrim on desktop) and
// closes with Escape, the close button or the top-bar button.
export function AgentPanel() {
  const { messages, state, busy, ask, reset, panelOpen, closePanel } = useAgent();
  const { data } = useWorkspace();
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    const t = window.setTimeout(() => panel.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus(), 60);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) closePanel();
    };
    document.addEventListener("keydown", key);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", key);
    };
  }, [panelOpen, closePanel]);

  const shortcuts = agentShortcuts(data);

  return (
    <>
      {panelOpen && <div className="agent-panel-scrim" onClick={closePanel} aria-hidden="true" />}
      <aside
        id="mavix-agent-panel"
        ref={panel}
        className={"agent-panel" + (panelOpen ? " is-open" : "")}
        role="dialog"
        aria-label="Mavix Agent"
        aria-hidden={!panelOpen}
        inert={!panelOpen}
      >
        <header className="agent-panel-head">
          <MaviAvatar size={30} state={busy ? "thinking" : "idle"} />
          <div>
            <strong>Mavix Agent</strong>
            <span>Werkt met je eigen werkruimtegegevens</span>
          </div>
          {messages.length > 0 && (
            <IconButton label="Nieuw gesprek" onClick={reset}>
              <RotateCcw size={15} />
            </IconButton>
          )}
          <Link href="/agent" className="ui-icon-button" aria-label="Openen als volledige pagina" title="Openen als volledige pagina" onClick={closePanel}>
            <Maximize2 size={15} />
          </Link>
          <IconButton label="Sluiten" onClick={closePanel}>
            <X size={16} />
          </IconButton>
        </header>
        <div className="agent-panel-body">
          {messages.length ? (
            <AgentConversation messages={messages} state={state} size="panel" onNavigate={closePanel} />
          ) : (
            <div className="agent-panel-intro">
              <p className="agent-panel-hello">Waar kan ik je mee helpen?</p>
              {shortcuts.length > 0 && (
                <ul className="agent-shortcuts">
                  {shortcuts.map((s) => (
                    <li key={s.label}>
                      <button type="button" onClick={() => ask(s.prompt)}>
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <AgentPrompts onPick={(p) => ask(p)} limit={4} />
            </div>
          )}
        </div>
        <div className="agent-panel-foot">
          <AgentComposer size="compact" busy={busy} onSubmit={(text, attachments) => ask(text, attachments)} placeholder="Vraag Mavi iets…" />
        </div>
      </aside>
    </>
  );
}
