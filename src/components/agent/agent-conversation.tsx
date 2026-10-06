"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, FileText } from "lucide-react";
import { MaviAvatar, type MaviState } from "@/components/mavi";
import type { AgentMessage } from "@/lib/agent/engine";

// The message list used by the panel and the /agent page.
export function AgentConversation({
  messages,
  state,
  size = "page",
  onNavigate,
}: {
  messages: AgentMessage[];
  state: MaviState;
  size?: "page" | "panel";
  onNavigate?: () => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, state]);

  return (
    <div className={"agent-convo is-" + size} aria-live="polite">
      {messages.map((m) => (
        <div key={m.id} className={"agent-turn is-" + m.role}>
          {m.role === "agent" && <MaviAvatar size={size === "panel" ? 26 : 30} />}
          <div className="agent-turn-body">
            {m.attachments && m.attachments.length > 0 && (
              <ul className="agent-files">
                {m.attachments.map((a, i) => (
                  <li key={i}>
                    {a.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.preview} alt={a.name} />
                    ) : (
                      <FileText size={14} aria-hidden="true" />
                    )}
                    <span>{a.name}</span>
                  </li>
                ))}
              </ul>
            )}
            {m.text && <p>{m.text}</p>}
            {m.action && (
              <Link className="agent-turn-action" href={m.action.href} onClick={onNavigate}>
                {m.action.label}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      ))}
      {state === "thinking" && (
        <div className="agent-turn is-agent" aria-label="Mavi denkt na">
          <MaviAvatar size={size === "panel" ? 26 : 30} state="thinking" />
          <div className="agent-turn-body agent-typing" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}
