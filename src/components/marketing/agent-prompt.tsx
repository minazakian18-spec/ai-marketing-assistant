"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Sparkle } from "lucide-react";

const PLACEHOLDER = "Beantwoord mijn laatste review…";

export function AgentPrompt() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/register?prompt=${encodeURIComponent(q)}` : "/register");
  }

  return (
    <form className="mkt-agent-prompt" onSubmit={handleSubmit}>
      <Sparkle size={18} className="mkt-agent-prompt-icon" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={PLACEHOLDER}
        aria-label="Vertel Mavix wat je wilt automatiseren"
      />
      <button type="submit" aria-label="Start met Mavix">
        <ArrowRight size={18} />
      </button>
    </form>
  );
}
