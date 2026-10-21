"use client";
import { useState } from "react";
import { MaviMascot, useMascotState } from "@/components/mavi";
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

// The dashboard's Agent: the primary entry point. Asking here opens the
// persistent Mavix Agent workspace with this prompt as the first message.
export function AgentSurface({ name }: { name?: string }) {
  const { ask, busy } = useAgent();
  const send = (text: string) => ask(text);
  const hello = greeting(new Date().getHours());
  const [typing, setTyping] = useState(false);
  // The dashboard hands the question to the Agent workspace, so there is no
  // reply here: Mavi listens while you type and thinks while it hands over.
  const mascot = useMascotState({ typing, busy, outcome: null });
  return (
    <section className="agent-surface" aria-labelledby="agent-surface-title">
      <div className="agent-surface-head">
        <MaviMascot size={76} state={mascot} className="agent-surface-mascot" />
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
        attachments={false}
        onSubmit={(text) => send(text)}
        onTypingChange={setTyping}
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
