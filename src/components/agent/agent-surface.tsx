"use client";
import { MaviAvatar } from "@/components/mavi";
import { AgentComposer } from "@/components/agent-composer";
import { useAgent } from "./agent-provider";
import { AgentPrompts } from "./agent-prompts";

// Examples that write themselves into the empty input (Tab takes one over).
const SUGGESTIONS = [
  "Hallo Mavix, plan content voor volgende week",
  "Maak een Instagram-post voor dit weekend",
  "Schrijf een nieuwsbrief voor mijn klanten",
  "Help me reviews beantwoorden",
  "Geef mij mijn volgende marketingstap",
];

function greeting(hour: number) {
  if (hour < 6) return "Goedenacht";
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

// The dashboard's Agent: a focused assistant surface rather than a search
// bar. Asking here continues in the global Agent panel.
export function AgentSurface({ name }: { name?: string }) {
  const { ask, openPanel, busy } = useAgent();
  const send = (text: string, attachments: Parameters<typeof ask>[1] = []) => {
    ask(text, attachments);
    openPanel();
  };
  const hello = greeting(new Date().getHours());
  return (
    <section className="agent-surface" aria-labelledby="agent-surface-title">
      <div className="agent-surface-head">
        <MaviAvatar size={48} state={busy ? "thinking" : "idle"} />
        <div>
          <p className="agent-surface-eyebrow">
            <span className="agent-surface-dot" aria-hidden="true" />
            Mavix Agent
          </p>
          <h1 id="agent-surface-title">
            {hello}
            {name ? `, ${name}` : ""}. Waar werken we vandaag aan?
          </h1>
          <p>Vertel wat je wilt bereiken. Mavi denkt mee en zet je direct op de juiste plek aan het werk.</p>
        </div>
      </div>
      <AgentComposer
        size="large"
        busy={busy}
        onSubmit={(text, attachments) => send(text, attachments)}
        placeholder="Vraag Mavi iets of geef een opdracht"
        suggestions={SUGGESTIONS}
      />
      <div className="agent-surface-starters">
        <span>Of begin met</span>
        <AgentPrompts onPick={(p) => send(p)} limit={4} disabled={busy} />
      </div>
    </section>
  );
}
