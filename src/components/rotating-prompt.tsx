"use client";
import { useEffect, useState } from "react";

const TYPE_MS = 28; // per character
const HOLD_MS = 2600; // full text visible
const OUT_MS = 320; // slide/fade out (matches .rp-out in polish.css)

type Phase = "typing" | "hold" | "out";

// Example prompts that write themselves into an empty input, rest, then slide
// away for the next one. Decorative (aria-hidden); the input keeps its label.
// With reduced motion the examples simply swap without animation.
export function RotatingPrompt({
  prompts,
  hidden,
  onCurrent,
}: {
  prompts: string[];
  hidden: boolean;
  onCurrent?: (prompt: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [chars, setChars] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [reduced, setReduced] = useState(false);
  const text = prompts[index % prompts.length] || "";

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(m.matches);
    sync();
    m.addEventListener("change", sync);
    return () => m.removeEventListener("change", sync);
  }, []);

  useEffect(() => onCurrent?.(text), [text, onCurrent]);

  useEffect(() => {
    if (hidden || prompts.length === 0) return;
    if (reduced) {
      const t = window.setTimeout(() => setIndex((i) => i + 1), 5000);
      return () => window.clearTimeout(t);
    }
    let t: number;
    if (phase === "typing") {
      if (chars < text.length) t = window.setTimeout(() => setChars((c) => c + 1), TYPE_MS);
      else t = window.setTimeout(() => setPhase("hold"), 0);
    } else if (phase === "hold") {
      t = window.setTimeout(() => setPhase("out"), HOLD_MS);
    } else {
      t = window.setTimeout(() => {
        setIndex((i) => i + 1);
        setChars(0);
        setPhase("typing");
      }, OUT_MS);
    }
    return () => window.clearTimeout(t);
  }, [hidden, reduced, phase, chars, text, prompts.length]);

  if (hidden || !text) return null;
  const shown = reduced ? text : text.slice(0, chars);
  return (
    <span className={"rp" + (phase === "out" && !reduced ? " rp-out" : "")} aria-hidden="true">
      {shown}
      {!reduced && phase === "typing" && <span className="rp-caret" />}
    </span>
  );
}
