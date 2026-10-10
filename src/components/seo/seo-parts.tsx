"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, Info as InfoIcon, XCircle } from "lucide-react";

// Small building blocks of the SEO module: score tones, animated score ring,
// explanatory tooltip and copy button.

export type Tone = "good" | "warning" | "critical" | "none";
/** Same bands Google Lighthouse uses: 90-100 good, 50-89 needs work, 0-49 poor. */
export function tone(score: number | null | undefined): Tone {
  if (score === null || score === undefined) return "none";
  return score >= 90 ? "good" : score >= 50 ? "warning" : "critical";
}
export const TONE_LABEL: Record<Tone, string> = { good: "Goed", warning: "Kan beter", critical: "Aandacht nodig", none: "Niet gemeten" };
export function ToneIcon({ t, size = 14 }: { t: Tone; size?: number }) {
  if (t === "good") return <CheckCircle2 size={size} aria-hidden="true" />;
  if (t === "warning") return <AlertTriangle size={size} aria-hidden="true" />;
  if (t === "critical") return <XCircle size={size} aria-hidden="true" />;
  return null;
}

function useCountUp(target: number | null, ms = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export function ScoreRing({ value, size = 120, stroke = 10, caption }: { value: number | null; size?: number; stroke?: number; caption?: string }) {
  const shown = useCountUp(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const t = tone(value);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className={"seo-ring is-" + t} style={{ width: size, height: size }} role="img" aria-label={value === null ? "Niet gemeten" : `${value} van 100, ${TONE_LABEL[t]}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="seo-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        {value !== null && (
          <circle
            className="seo-ring-value"
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={drawn ? c * (1 - value / 100) : c}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <span className="seo-ring-number" style={{ fontSize: Math.round(size * 0.3) }}>
        {value === null ? "—" : shown}
      </span>
      {caption && <span className="seo-ring-caption">{caption}</span>}
    </div>
  );
}

export function ToneBadge({ score }: { score: number | null | undefined }) {
  const t = tone(score);
  return (
    <span className={"seo-tone is-" + t}>
      <ToneIcon t={t} size={12} />
      {TONE_LABEL[t]}
    </span>
  );
}

/** Small "i" button with an explanation that opens on hover, focus or click. */
export function Info({ label = "Uitleg", children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <span className="seo-info" ref={root} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-expanded={open} aria-describedby={open ? id : undefined} onClick={() => setOpen((o) => !o)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
        <InfoIcon size={14} aria-hidden="true" />
      </button>
      {open && (
        <span role="tooltip" id={id} className="seo-info-pop">
          {children}
        </span>
      )}
    </span>
  );
}

export function CopyButton({ text, label = "Kopiëren", small = false }: { text: string; label?: string; small?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={"button secondary seo-copy" + (small ? " is-small" : "")}
      onClick={() =>
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        })
      }
    >
      {done ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      {done ? "Gekopieerd" : label}
    </button>
  );
}

export const dateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
export const pathOf = (url: string) => {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname + u.search) || "/";
  } catch {
    return url;
  }
};
