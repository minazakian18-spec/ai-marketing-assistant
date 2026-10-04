"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Send, Sparkles, X } from "lucide-react";

type Message = { role: "agent" | "user"; text: string; link?: { href: string; label: string } };

const SUGGESTIONS = [
  "Wat kost Mavix?",
  "Hoe werkt Review AI?",
  "Kan Mavix helpen met Instagram?",
  "Hoe begin ik?",
];

const WELCOME: Message = {
  role: "agent",
  text: "Hoi! Ik ben de Mavix Agent. Waarmee kan ik je vandaag helpen?",
};

// Frontend demo: answers are matched locally on keywords, no AI backend.
function reply(question: string): Message {
  const q = question.toLowerCase();
  if (/prij|kost|pakket|abonnement|betal/.test(q))
    return {
      role: "agent",
      text: "Mavix heeft drie pakketten: Starter, Growth en Autopilot. Alle pakketten zijn maandelijks opzegbaar.",
      link: { href: "/pricing", label: "Bekijk alle pakketten" },
    };
  if (/review|google|beoordel/.test(q))
    return {
      role: "agent",
      text: "Review AI leest je nieuwe Google-reviews en stelt een persoonlijke reactie voor in de toon van jouw merk. Jij keurt goed, past aan of laat Mavix automatisch reageren.",
    };
  if (/insta|social|post/.test(q))
    return {
      role: "agent",
      text: "Ja. Mavix maakt captions, hashtags en beeldconcepten die passen bij je merk, en zet ze in je contentkalender zodat je ze kunt goedkeuren en plannen.",
    };
  if (/begin|start|account|aanmeld|registr/.test(q))
    return {
      role: "agent",
      text: "Maak een account aan, vul je merkgegevens in de Brand Hub in en koppel je kanalen. Daarna kan Mavix direct content voor je voorbereiden.",
      link: { href: "/register", label: "Get started" },
    };
  if (/mail|nieuwsbrief|campagne/.test(q))
    return {
      role: "agent",
      text: "Met Email AI maak je campagnes en nieuwsbrieven, en verstuur je ze via je eigen gekoppelde Gmail-account.",
    };
  return {
    role: "agent",
    text: "Goede vraag! In deze demo kan ik vooral vragen beantwoorden over prijzen, Review AI, Instagram, e-mail en hoe je begint.",
  };
}

export function AgentDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(0);
  const typing = pending > 0;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => inputRef.current?.focus(), 200);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, typing]);

  function ask(text: string) {
    const q = text.trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setPending((p) => p + 1);
    window.setTimeout(() => {
      setMessages((m) => [...m, reply(q)]);
      setPending((p) => p - 1);
    }, 700);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  return (
    <>
      <div
        className={"mkt-agent-scrim" + (open ? " open" : "")}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={"mkt-agent-drawer" + (open ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-label="Mavix Agent"
        inert={!open}
      >
        <header className="mkt-agent-head">
          <span className="mkt-agent-avatar">
            <Sparkles size={16} />
          </span>
          <div>
            <strong>Mavix Agent</strong>
            <span>Demo · voorbeeldantwoorden</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Agent sluiten">
            <X size={18} />
          </button>
        </header>
        <div className="mkt-agent-messages" ref={listRef} aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={"mkt-agent-msg " + m.role}>
              <p>{m.text}</p>
              {m.link && (
                <Link href={m.link.href} onClick={onClose}>
                  {m.link.label} →
                </Link>
              )}
            </div>
          ))}
          {typing && (
            <div className="mkt-agent-msg agent mkt-agent-typing" aria-label="Agent typt">
              <span />
              <span />
              <span />
            </div>
          )}
          {messages.length === 1 && (
            <div className="mkt-agent-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <form className="mkt-agent-input" onSubmit={submit}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Stel je vraag…"
            aria-label="Stel je vraag aan de Mavix Agent"
            maxLength={300}
          />
          <button type="submit" aria-label="Versturen" disabled={!input.trim()}>
            <Send size={16} />
          </button>
        </form>
      </aside>
    </>
  );
}
