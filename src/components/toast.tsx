"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Info, X } from "lucide-react";
export function Toast({
  message,
  onClose,
  tone = "success",
}: {
  message: string;
  onClose: () => void;
  tone?: "success" | "info";
}) {
  const [paused, setPaused] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(
      onClose,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160,
    );
    return () => window.clearTimeout(timer);
  }, [closing, onClose]);
  useEffect(() => {
    if (paused || closing) return;
    const timer = window.setTimeout(() => setClosing(true), 4000);
    return () => window.clearTimeout(timer);
  }, [message, paused, closing]);
  return (
    <div
      className="mavix-toast"
      data-state={closing ? "closed" : "open"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      {tone === "info" ? <Info size={20} aria-hidden="true" /> : <CheckCircle2 size={20} aria-hidden="true" />}
      <span role="status" aria-live="polite" aria-atomic="true">
        {message}
      </span>
      <button aria-label="Melding sluiten" onClick={() => setClosing(true)}>
        <X size={16} />
      </button>
    </div>
  );
}
