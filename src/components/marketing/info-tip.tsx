"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

// Small explanation next to a feature name. Opens on hover, keyboard focus or
// tap; closes with Escape, on blur or a tap elsewhere. Screen readers get the
// text through aria-describedby.
export function InfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);
  return (
    <span className="pr-tip" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="pr-tip-btn" aria-label={"Uitleg: " + label} aria-expanded={open} aria-describedby={open ? id : undefined} onClick={() => setOpen(true)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
        <Info size={14} aria-hidden="true" />
      </button>
      <span id={id} role="tooltip" className={"pr-tip-box" + (open ? " is-open" : "")}>
        {text}
      </span>
    </span>
  );
}
