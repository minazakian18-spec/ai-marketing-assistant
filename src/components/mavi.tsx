// Mavi: the Mavix assistant mark. Built from the four shapes of the Mavix "M"
// logo (same paths), rendered in a single accent colour so it reads at small
// sizes and can be animated per state without a mascot or sparkle icon.
export type MaviState = "idle" | "thinking" | "creating" | "done";

export function Mavi({
  size = 20,
  state = "idle",
  label,
  className = "",
}: {
  size?: number;
  state?: MaviState;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      className={`mavi mavi-${state} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path
        className="mavi-s1"
        d="M3 15a4 4 0 0 1 1.8-3.3l2.7-1.8L13 17v12.5a4 4 0 0 1-1.8 3.3l-5.1 3.4A2 2 0 0 1 3 34.5V15Z"
      />
      <path
        className="mavi-s2"
        d="m17 14.4 6-3.9a2 2 0 0 1 3.1 1.7V30l-11-8.3v-3.9a4 4 0 0 1 1.9-3.4Z"
      />
      <path
        className="mavi-s3"
        d="M4.5 11.8 6.8 10a3 3 0 0 1 3.6.1l13.8 11a5 5 0 0 1 1.9 3.9v8.4a3 3 0 0 1-4.8 2.4L5 22.8a5.3 5.3 0 0 1-2-4.1v-3a5 5 0 0 1 1.5-3.9Z"
      />
      <path
        className="mavi-s4"
        d="m30.5 6.4 5.4-3.5A2 2 0 0 1 39 4.6v24.7a4 4 0 0 1-1.8 3.3l-5.1 3.5a2 2 0 0 1-3.1-1.7V9.7a4 4 0 0 1 1.5-3.3Z"
      />
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
}: {
  size?: number;
  state?: MaviState;
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={"mavi-identity " + className}>
      <MaviAvatar size={size} state={state} />
      <div>
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </div>
    </div>
  );
}

// Mavi on a soft tile, used as the chat/agent avatar.
export function MaviAvatar({ size = 32, state = "idle" }: { size?: number; state?: MaviState }) {
  return (
    <span className={`mavi-avatar mavi-avatar-${state}`} style={{ width: size, height: size }}>
      <Mavi size={Math.round(size * 0.58)} state={state} />
    </span>
  );
}
