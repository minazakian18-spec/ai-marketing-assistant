"use client";
import { CalendarDays, Instagram, Lightbulb, ListChecks, Mail, type LucideIcon } from "lucide-react";
import { AGENT_SUGGESTIONS } from "@/lib/agent/capabilities";

// Example prompts, only ones the agent can really handle (capability registry).
const ICONS: LucideIcon[] = [Instagram, Mail, CalendarDays, Lightbulb, ListChecks];

export function AgentPrompts({ onPick, limit, disabled }: { onPick: (prompt: string) => void; limit?: number; disabled?: boolean }) {
  return (
    <ul className="agent-prompts" aria-label="Voorbeelden">
      {AGENT_SUGGESTIONS.slice(0, limit).map((p, i) => {
        const Icon = ICONS[i % ICONS.length];
        return (
          <li key={p.prompt}>
            <button type="button" onClick={() => onPick(p.prompt)} disabled={disabled}>
              <Icon size={14} aria-hidden="true" />
              {p.prompt}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
