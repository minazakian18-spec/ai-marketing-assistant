"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { MaviAvatar } from "@/components/mavi";
import { useWorkspace } from "@/components/workspace-provider";
import { AgentComposer } from "@/components/agent-composer";
import { useAgent } from "@/components/agent/agent-provider";
import { AgentConversation } from "@/components/agent/agent-conversation";
import { AgentPrompts } from "@/components/agent/agent-prompts";
import { agentShortcuts } from "@/lib/agent/engine";

// The full Mavix Agent: the same conversation as the top-bar panel, with
// room for longer work. Centered identity when empty, conversation and a
// pinned composer once you start.
function AgentPageInner() {
  const { data, ready } = useWorkspace();
  const { messages, state, busy, ask, reset } = useAgent();
  const search = useSearchParams();
  const started = useRef(false);

  useEffect(() => {
    const q = search.get("q");
    if (ready && q && !started.current) {
      started.current = true;
      ask(q);
      window.history.replaceState(null, "", "/agent");
    }
  }, [ready, search, ask]);

  if (!ready) return <p role="status">Mavix Agent laden…</p>;
  const shortcuts = agentShortcuts(data);
  const composer = (
    <AgentComposer size="large" busy={busy} onSubmit={(text, attachments) => ask(text, attachments)} placeholder="Vraag of opdracht voor Mavix Agent" />
  );

  if (!messages.length)
    return (
      <div className="agent-page is-empty">
        <div className="agent-page-intro">
          <MaviAvatar size={56} />
          <h1>Mavix Agent</h1>
          <p>Je marketingassistent voor content, e-mail, social, reviews en planning. Werkt met de gegevens uit je eigen werkruimte.</p>
        </div>
        {composer}
        {shortcuts.length > 0 && (
          <section className="agent-page-section" aria-labelledby="agent-for-you">
            <h2 id="agent-for-you">Voor jou</h2>
            <ul className="agent-shortcuts">
              {shortcuts.map((s) => (
                <li key={s.label}>
                  <button type="button" onClick={() => ask(s.prompt)}>
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="agent-page-section" aria-labelledby="agent-examples">
          <h2 id="agent-examples">Probeer bijvoorbeeld</h2>
          <AgentPrompts onPick={(p) => ask(p)} />
        </section>
        <p className="agent-page-note">Mavix Agent is nog niet met een AI-model verbonden en kan nu vooral vragen over je werkruimte beantwoorden en je naar de juiste plek brengen.</p>
      </div>
    );

  return (
    <div className="agent-page">
      <header className="agent-page-bar">
        <MaviAvatar size={30} state={busy ? "thinking" : "idle"} />
        <h1>Mavix Agent</h1>
        <button type="button" className="button secondary" onClick={reset} disabled={busy}>
          <RotateCcw size={14} />
          Nieuw gesprek
        </button>
      </header>
      <div className="agent-page-thread">
        <AgentConversation messages={messages} state={state} />
      </div>
      <div className="agent-page-composer">{composer}</div>
    </div>
  );
}

export default function AgentPage() {
  return (
    <Suspense fallback={<p role="status">Mavix Agent laden…</p>}>
      <AgentPageInner />
    </Suspense>
  );
}
