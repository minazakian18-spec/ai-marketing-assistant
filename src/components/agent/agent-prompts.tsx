"use client";
import { CalendarDays, ChartNoAxesCombined, Instagram, Mail, PenLine, Star, type LucideIcon } from "lucide-react";
import { AGENT_PROMPTS, type AgentArea } from "@/lib/agent/engine";

const ICONS: Record<AgentArea, LucideIcon> = {
  planning: CalendarDays,
  social: Instagram,
  email: Mail,
  reviews: Star,
  content: PenLine,
  insights: ChartNoAxesCombined,
};

// Example prompts, shown as subtle chips. `limit` keeps small surfaces calm.
export function AgentPrompts({ onPick, limit, disabled }: { onPick: (prompt: string) => void; limit?: number; disabled?: boolean }) {
  return (
    <ul className="agent-prompts" aria-label="Voorbeelden">
      {AGENT_PROMPTS.slice(0, limit).map((p) => {
        const Icon = ICONS[p.area];
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
