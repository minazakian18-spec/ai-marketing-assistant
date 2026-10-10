import { Check, CircleAlert, Loader2, Circle } from "lucide-react";

// One save status, used everywhere work is saved. "Opgeslagen" is only shown
// after the server confirmed the save (callers pass "saved" from a resolved
// save()).
export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
const TEXT: Record<Exclude<SaveStatus, "idle">, string> = {
  dirty: "Niet opgeslagen",
  saving: "Opslaan…",
  saved: "Opgeslagen",
  error: "Opslaan mislukt",
};

export function SaveIndicator({ status, className = "" }: { status: SaveStatus; className?: string }) {
  if (status === "idle") return <span className={"save-indicator " + className} aria-live="polite" />;
  const Icon = status === "saving" ? Loader2 : status === "saved" ? Check : status === "error" ? CircleAlert : Circle;
  return (
    <span className={`save-indicator is-${status} ${className}`} role="status" aria-live="polite">
      <Icon size={13} aria-hidden="true" />
      {TEXT[status]}
    </span>
  );
}
