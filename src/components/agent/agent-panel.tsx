"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Maximize2, X } from "lucide-react";
import { MaviAvatar } from "@/components/mavi";
import { IconButton } from "@/components/ui";
import { AgentComposer } from "@/components/agent-composer";
import { AGENT_SUGGESTIONS } from "@/lib/agent/capabilities";
import { useAgent } from "./agent-provider";

// Quick-ask slide-over on every app page. It does not keep a separate chat:
// a question opens the persistent Mavix Agent workspace and continues there.
export function AgentPanel() {
  const { ask, panelOpen, closePanel } = useAgent();
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
          <MaviAvatar size={30} />
          <div>
            <strong>Mavix Agent</strong>
            <span>Je gesprekken worden bewaard in Mavix Agent</span>
          </div>
          <Link href="/agent" className="ui-icon-button" aria-label="Mavix Agent openen" title="Mavix Agent openen" onClick={closePanel}>
            <Maximize2 size={15} />
          </Link>
          <IconButton label="Sluiten" onClick={closePanel}>
            <X size={16} />
          </IconButton>
        </header>
        <div className="agent-panel-body">
          <div className="agent-panel-intro">
            <p className="agent-panel-hello">Waar kan ik je mee helpen?</p>
            <ul className="agent-prompts" aria-label="Voorbeelden">
              {AGENT_SUGGESTIONS.slice(0, 4).map((s) => (
                <li key={s.prompt}>
                  <button type="button" onClick={() => ask(s.prompt)}>
                    {s.prompt}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="agent-panel-foot">
          <AgentComposer size="compact" attachments={false} onSubmit={(text) => ask(text)} placeholder="Vraag Mavix iets" />
        </div>
      </aside>
    </>
  );
}
