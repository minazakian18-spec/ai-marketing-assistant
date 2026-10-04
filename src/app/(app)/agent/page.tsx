"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Mavi, MaviAvatar, type MaviState } from "@/components/mavi";
import { useWorkspace } from "@/components/workspace-provider";
import { readiness } from "@/lib/instagram-model";
import type { Workspace } from "@/lib/types";

type Message = {
  role: "user" | "agent";
  text: string;
  action?: { href: string; label: string };
};

const SUGGESTIONS = [
  "Wat moet ik vandaag doen?",
  "Maak een Instagram-post",
  "Schrijf een nieuwsbrief",
  "Plan content voor volgende week",
  "Hoe compleet is mijn Brand Hub?",
];

// Not connected to an AI model yet: requests are routed to the right
// workspace, and questions about the workspace are answered from its real data.
function respond(question: string, data: Workspace): Message {
  const q = question.toLowerCase();
  if (/vandaag|aandacht|openstaand|doen\b|te doen/.test(q)) {
    const drafts =
      data.posts.filter((p) => p.status === "draft").length +
      (data.email?.campaigns || []).filter((c) => c.status === "draft").length;
    const failed = data.posts.filter(
      (p) => p.status === "blocked" || p.status === "failed",
    ).length;
    const parts = [
      drafts
        ? `${drafts} ${drafts === 1 ? "concept wacht" : "concepten wachten"} op goedkeuring`
        : "er wachten geen concepten op goedkeuring",
      failed
        ? `${failed} gepland ${failed === 1 ? "item heeft" : "items hebben"} aandacht nodig`
        : "er zijn geen mislukte items",
    ];
    return {
      role: "agent",
      text: `In je werkruimte: ${parts.join(" en ")}.`,
      action: { href: "/dashboard", label: "Open het dashboard" },
    };
  }
  if (/brand|merk|huisstijl/.test(q)) {
    const r = readiness(data.profile);
    const missing = r.checks.filter((c) => !c.done).map((c) => c.label);
    return {
      role: "agent",
      text:
        `Je Brand Hub is ${r.score}% compleet.` +
        (missing.length ? ` Nog aan te vullen: ${missing.join(", ")}.` : ""),
      action: { href: "/brand-hub", label: "Open Brand Hub" },
    };
  }
  if (/review|beoordel|recensie/.test(q))
    return {
      role: "agent",
      text: "Reviews beheer en beantwoord je in Reviews.",
      action: { href: "/reviews?tab=inbox", label: "Open Reviews" },
    };
  if (/nieuwsbrief|e-?mail|mail|campagne/.test(q))
    return {
      role: "agent",
      text: "Je kunt een e-mail of campagne maken in E-mail.",
      action: { href: "/email?tab=assist", label: "E-mail maken" },
    };
  if (/plan|kalender|agenda|week/.test(q))
    return {
      role: "agent",
      text: "In de kalender zie en verplaats je al je geplande content.",
      action: { href: "/calendar", label: "Open de kalender" },
    };
  if (/seo|zoekmachine|vindbaar/.test(q))
    return {
      role: "agent",
      text: "De SEO-werkruimte is in voorbereiding. Daar komt straks de analyse van je website.",
      action: { href: "/seo", label: "Open SEO" },
    };
  if (/advert|ads|google ads/.test(q))
    return {
      role: "agent",
      text: "Advertenties werken straks via een Google Ads-koppeling.",
      action: { href: "/ads", label: "Open Advertenties" },
    };
  if (/insta|post|social|reel|story|caption/.test(q))
    return {
      role: "agent",
      text: "Je kunt een social post maken in Social.",
      action: { href: "/social?tab=assist", label: "Social post maken" },
    };
  return {
    role: "agent",
    text: "Ik kan je nu naar de juiste werkruimte brengen en vragen over je werkruimte beantwoorden. Probeer bijvoorbeeld een van de suggesties.",
  };
}

function AgentChat() {
  const { data, ready } = useWorkspace();
  const search = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<MaviState>("idle");
  const listRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  function ask(text: string) {
    const q = text.trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setState("thinking");
    window.setTimeout(() => {
      setMessages((m) => [...m, respond(q, data)]);
      setState("done");
    }, 650);
  }

  useEffect(() => {
    const q = search.get("q");
    if (ready && q && !started.current) {
      started.current = true;
      ask(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, search]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, state]);

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  if (!ready) return <p role="status">Mavix Agent laden…</p>;
  return (
    <div className="agent">
      <header className="agent-head">
        <MaviAvatar size={40} state={state === "thinking" ? "thinking" : "idle"} />
        <div>
          <h1>Mavix Agent</h1>
          <p>
            Nog niet verbonden met een AI-model. Mavi brengt je naar de juiste
            werkruimte en beantwoordt vragen over je eigen werkruimte.
          </p>
        </div>
      </header>
      <div className="agent-thread" ref={listRef} aria-live="polite">
        {!messages.length && (
          <div className="agent-empty">
            <Mavi size={44} />
            <h2>Waar kan ik mee helpen?</h2>
            <div className="agent-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={"agent-msg is-" + m.role}>
            {m.role === "agent" && <MaviAvatar size={28} />}
            <div className="agent-bubble">
              <p>{m.text}</p>
              {m.action && (
                <Link className="agent-action" href={m.action.href}>
                  {m.action.label} →
                </Link>
              )}
            </div>
          </div>
        ))}
        {state === "thinking" && (
          <div className="agent-msg is-agent" aria-label="Mavi denkt na">
            <MaviAvatar size={28} state="thinking" />
            <div className="agent-bubble agent-thinking">Bezig…</div>
          </div>
        )}
      </div>
      <form className="agent-input" onSubmit={submit}>
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          placeholder="Vraag of opdracht voor Mavix Agent"
          aria-label="Bericht aan Mavix Agent"
          maxLength={500}
        />
        <button
          type="submit"
          className="button primary"
          aria-label="Versturen"
          disabled={!input.trim()}
        >
          <ArrowUp size={17} />
        </button>
      </form>
    </div>
  );
}

export default function AgentPage() {
  return (
    <Suspense fallback={<p role="status">Mavix Agent laden…</p>}>
      <AgentChat />
    </Suspense>
  );
}
