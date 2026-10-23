"use client";
import { useEffect, useId, useState } from "react";

// Mavi: the Mavix assistant mark. Built from the four shapes of the Mavix "M"
// logo (same paths). Two looks: a single accent colour for small UI icons, and
// "brand" with the logo's own gradients for the assistant itself.
//
// `live` gives the character its calm presence (CSS only, see mavi.css):
// idle floats a few pixels with an occasional tilt, thinking breathes,
// creating (responding) lifts the rising stroke, done settles back. All motion
// stops under prefers-reduced-motion.
export type MaviState = "idle" | "thinking" | "creating" | "done";

const PATHS = [
  "M3 15a4 4 0 0 1 1.8-3.3l2.7-1.8L13 17v12.5a4 4 0 0 1-1.8 3.3l-5.1 3.4A2 2 0 0 1 3 34.5V15Z",
  "m17 14.4 6-3.9a2 2 0 0 1 3.1 1.7V30l-11-8.3v-3.9a4 4 0 0 1 1.9-3.4Z",
  "M4.5 11.8 6.8 10a3 3 0 0 1 3.6.1l13.8 11a5 5 0 0 1 1.9 3.9v8.4a3 3 0 0 1-4.8 2.4L5 22.8a5.3 5.3 0 0 1-2-4.1v-3a5 5 0 0 1 1.5-3.9Z",
  "m30.5 6.4 5.4-3.5A2 2 0 0 1 39 4.6v24.7a4 4 0 0 1-1.8 3.3l-5.1 3.5a2 2 0 0 1-3.1-1.7V9.7a4 4 0 0 1 1.5-3.3Z",
];
// Same stops as public/mavix-mark.svg.
const GRADIENTS: [string, number, number, number, number, [number, string][]][] = [
  ["a", 4, 12, 14, 37, [[0, "#38249C"], [1, "#7752EF"]]],
  ["b", 22, 11, 19, 31, [[0, "#A786FF"], [1, "#6B45DB"]]],
  ["c", 7, 10, 24, 35, [[0, "#9165FA"], [0.58, "#5D3AD1"], [1, "#4330AD"]]],
  ["d", 34, 2, 30, 37, [[0, "#AF88FF"], [1, "#4C35C5"]]],
];

export function Mavi({
  size = 20,
  state = "idle",
  label,
  className = "",
  tone = "accent",
  live = false,
}: {
  size?: number;
  state?: MaviState;
  label?: string;
  className?: string;
  tone?: "accent" | "brand";
  live?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const brand = tone === "brand";
  return (
    <svg
      className={`mavi mavi-${state}${brand ? " mavi-brand" : ""}${live ? " mavi-live" : ""} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {brand && (
        <defs>
          {GRADIENTS.map(([key, x1, y1, x2, y2, stops]) => (
            <linearGradient key={key} id={id + key} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits="userSpaceOnUse">
              {stops.map(([offset, color]) => (
                <stop key={offset} offset={offset} stopColor={color} />
              ))}
            </linearGradient>
          ))}
        </defs>
      )}
      <g className="mavi-body">
        {PATHS.map((d, i) => (
          <path key={i} className={"mavi-s" + (i + 1)} d={d} fill={brand ? `url(#${id}${"abcd"[i]})` : undefined} />
        ))}
      </g>
    </svg>
  );
}

// Mavi with its name and a short status line. Reusable wherever the
// assistant introduces itself: dashboard, chat header, onboarding,
// notifications, empty states and automations.
export function MaviIdentity({
  size = 40,
  state = "idle",
  title = "Mavix",
  subtitle,
  className = "",
  live = true,
}: {
  size?: number;
  state?: MaviState;
  title?: string;
  subtitle?: string;
  className?: string;
  live?: boolean;
}) {
  return (
    <div className={"mavi-identity " + className}>
      <MaviAvatar size={size} state={state} live={live} />
      <div>
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </div>
    </div>
  );
}

// Mavi as a character: the Mavix "M" turned into a soft, dimensional figure
// (V-notch on top and two feet below are the logo's M), with eyes, small arms
// and one floating spark. Shown above the AI composer. The state always comes
// from the real application: idle, typing (the user writes), thinking (a
// request is running), done (a reply arrived) or error (it failed). CSS only,
// see motion.css "Mavi mascot"; still under prefers-reduced-motion.
export type MascotState = "idle" | "typing" | "thinking" | "done" | "error";

const MASCOT_LABEL: Record<MascotState, string> = {
  idle: "Mavix",
  typing: "Mavix luistert",
  thinking: "Mavix denkt na",
  done: "Mavix is klaar",
  error: "Mavix kon het niet afronden",
};

export function MaviMascot({ size = 72, state = "idle", className = "" }: { size?: number; state?: MascotState; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className={`mavi-mascot is-${state} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label={MASCOT_LABEL[state]}
      focusable="false"
    >
      <defs>
        <linearGradient id={id + "body"} x1="18" y1="14" x2="62" y2="68" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#b79cff" />
          <stop offset="0.45" stopColor="#7c4dff" />
          <stop offset="1" stopColor="#4a23b8" />
        </linearGradient>
        <radialGradient id={id + "shade"} cx="0.32" cy="0.28" r="0.85">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#1e0b5c" stopOpacity="0.28" />
        </radialGradient>
        <linearGradient id={id + "arm"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5cff" />
          <stop offset="1" stopColor="#5a2fd0" />
        </linearGradient>
      </defs>
      <ellipse className="mm-shadow" cx="40" cy="74" rx="17" ry="2.6" />
      <g className="mm-figure">
        <path className="mm-arm mm-arm-l" d="M16 46 Q9 49 8 55" stroke={`url(#${id}arm)`} />
        <path className="mm-arm mm-arm-r" d="M64 46 Q71 49 72 55" stroke={`url(#${id}arm)`} />
        <path
          className="mm-body"
          fill={`url(#${id}body)`}
          d="M14 31Q14 16 26 16Q31 16 34 20L40 28L46 20Q49 16 54 16Q66 16 66 31V58Q66 66 58 66H47Q45.5 59 40 59Q34.5 59 33 66H22Q14 66 14 58Z"
        />
        <path
          className="mm-gloss"
          fill={`url(#${id}shade)`}
          d="M14 31Q14 16 26 16Q31 16 34 20L40 28L46 20Q49 16 54 16Q66 16 66 31V58Q66 66 58 66H47Q45.5 59 40 59Q34.5 59 33 66H22Q14 66 14 58Z"
        />
        <ellipse className="mm-highlight" cx="24" cy="24" rx="5.5" ry="3" transform="rotate(-28 24 24)" />
        <g className="mm-face">
          <g className="mm-eyes">
            <g className="mm-eye">
              <ellipse cx="32" cy="40" rx="4.3" ry="5.2" fill="#fff" />
              <circle className="mm-pupil" cx="32.4" cy="40.6" r="2.4" fill="#1d1040" />
              <circle cx="33.4" cy="39.3" r="0.8" fill="#fff" />
            </g>
            <g className="mm-eye">
              <ellipse cx="48" cy="40" rx="4.3" ry="5.2" fill="#fff" />
              <circle className="mm-pupil" cx="48.4" cy="40.6" r="2.4" fill="#1d1040" />
              <circle cx="49.4" cy="39.3" r="0.8" fill="#fff" />
            </g>
          </g>
          {/* Happy closed eyes, only shown when a reply arrived. */}
          <g className="mm-happy" fill="none" stroke="#1d1040" strokeWidth="2" strokeLinecap="round">
            <path d="M28.2 41Q32 36.6 35.8 41" />
            <path d="M44.2 41Q48 36.6 51.8 41" />
          </g>
          <ellipse className="mm-cheek" cx="26.5" cy="48" rx="3" ry="1.8" />
          <ellipse className="mm-cheek" cx="53.5" cy="48" rx="3" ry="1.8" />
          <path className="mm-mouth mm-smile" d="M36.5 49Q40 52.4 43.5 49" />
          <path className="mm-mouth mm-flat" d="M37.5 50.5H42.5" />
          <path className="mm-mouth mm-sad" d="M36.8 51.4Q40 48.6 43.2 51.4" />
        </g>
      </g>
      <path className="mm-spark mm-spark-1" d="M69 10l1.4 3.6 3.6 1.4-3.6 1.4L69 20l-1.4-3.6-3.6-1.4 3.6-1.4Z" />
      <g className="mm-dots" aria-hidden="true">
        <circle cx="62" cy="12" r="2" />
        <circle cx="68.5" cy="8" r="2" />
        <circle cx="75" cy="4.5" r="2" />
      </g>
    </svg>
  );
}

/**
 * The mascot state from real application state. "done" and "error" are shown
 * only right after a request actually finished; afterwards Mavi returns to
 * idle, or to typing if the user is already writing again.
 */
export function useMascotState({ typing, busy, outcome }: { typing: boolean; busy: boolean; outcome: { result: "ok" | "error"; at: number } | null }): MascotState {
  const [recent, setRecent] = useState<"done" | "error" | null>(null);
  useEffect(() => {
    if (!outcome) return;
    setRecent(outcome.result === "ok" ? "done" : "error");
    const t = setTimeout(() => setRecent(null), outcome.result === "ok" ? 1600 : 4000);
    return () => clearTimeout(t);
  }, [outcome]);
  if (busy) return "thinking";
  if (typing) return "typing";
  return recent || "idle";
}

// Mavi on a soft tile, used as the chat/agent avatar. Live by default: this is
// where the character appears as the assistant.
export function MaviAvatar({ size = 32, state = "idle", live = true }: { size?: number; state?: MaviState; live?: boolean }) {
  return (
    <span className={`mavi-avatar mavi-avatar-${state}`} style={{ width: size, height: size }}>
      <Mavi size={Math.round(size * 0.62)} state={state} tone="brand" live={live} />
    </span>
  );
}
