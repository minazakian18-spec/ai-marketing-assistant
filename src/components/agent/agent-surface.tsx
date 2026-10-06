"use client";
import { MaviAvatar } from "@/components/mavi";
import { AgentComposer } from "@/components/agent-composer";
import { useAgent } from "./agent-provider";
import { AgentPrompts } from "./agent-prompts";

// The dashboard's Agent: a focused assistant surface rather than a search
// bar. Asking here continues in the global Agent panel.
export function AgentSurface({ name }: { name?: string }) {
  const { ask, openPanel, busy } = useAgent();
  const send = (text: string, attachments: Parameters<typeof ask>[1] = []) => {
    ask(text, attachments);
    openPanel();
  };
  return (
    <section className="agent-surface" aria-labelledby="agent-surface-title">
      <div className="agent-surface-head">
        <MaviAvatar size={48} state={busy ? "thinking" : "idle"} />
        <div>
          <h1 id="agent-surface-title">{name ? `Hallo, ${name}!` : "Hallo!"} Hoe kan ik je vandaag helpen?</h1>
          <p>Jouw AI-marketingassistent die met je meedenkt, content creëert en je helpt groeien.</p>
        </div>
      </div>
      <AgentComposer size="large" busy={busy} onSubmit={(text, attachments) => send(text, attachments)} placeholder="Vraag Mavi iets, bijvoorbeeld: plan content voor volgende week" />
      <AgentPrompts onPick={(p) => send(p)} limit={4} disabled={busy} />
    </section>
  );
}
