"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Film, ImagePlus, Instagram, Mail } from "lucide-react";
import { PLAN_OPTIONS, planningHref, type PlanKind, type PlanSlot } from "@/lib/calendar/planning";

export const PLAN_ICONS: Record<PlanKind, typeof Mail> = {
  event: CalendarPlus,
  "instagram-post": Instagram,
  email: Mail,
  "instagram-story": ImagePlus,
  "instagram-reel": Film,
};

// Compact "Wat wil je plannen?" menu shown where an empty slot was clicked.
export function PlanMenu({
  slot,
  label,
  at,
  onAppointment,
  onClose,
}: {
  slot: PlanSlot;
  label: string;
  at: { x: number; y: number };
  onAppointment: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(at);

  // Keep the menu inside the viewport.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      x: Math.max(12, Math.min(at.x, window.innerWidth - width - 12)),
      y: Math.max(12, Math.min(at.y, window.innerHeight - height - 12)),
    });
  }, [at]);

  useEffect(() => {
    box.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const items = Array.from(box.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") || []);
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  function choose(kind: PlanKind) {
    if (kind === "event") return onAppointment();
    const href = planningHref(kind, slot);
    if (href) router.push(href);
  }

  return (
    <>
      <div className="plan-scrim" onClick={onClose} aria-hidden="true" />
      <div ref={box} className="plan-menu" role="menu" aria-label="Wat wil je plannen?" style={{ left: pos.x, top: pos.y }}>
        <p className="plan-head">
          <strong>Wat wil je plannen?</strong>
          <span>{label}</span>
        </p>
        {(["appointment", "marketing"] as const).map((group) => (
          <div key={group} role="group" aria-label={group === "marketing" ? "Marketing" : "Afspraak"}>
            {group === "marketing" && <p className="plan-group">Marketing</p>}
            {PLAN_OPTIONS.filter((o) => o.group === group).map((o) => {
              const Icon = PLAN_ICONS[o.kind];
              return (
                <button key={o.kind} type="button" role="menuitem" className="plan-item" disabled={o.soon} onClick={() => choose(o.kind)}>
                  <Icon size={15} aria-hidden="true" />
                  <span>
                    {o.label}
                    {o.detail && <small>{o.detail}</small>}
                  </span>
                  {o.soon && <em>Binnenkort</em>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
