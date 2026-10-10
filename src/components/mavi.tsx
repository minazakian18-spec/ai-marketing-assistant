import { useId } from "react";

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
  title = "Mavi",
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

// Mavi on a soft tile, used as the chat/agent avatar. Live by default: this is
// where the character appears as the assistant.
export function MaviAvatar({ size = 32, state = "idle", live = true }: { size?: number; state?: MaviState; live?: boolean }) {
  return (
    <span className={`mavi-avatar mavi-avatar-${state}`} style={{ width: size, height: size }}>
      <Mavi size={Math.round(size * 0.62)} state={state} tone="brand" live={live} />
    </span>
  );
}
