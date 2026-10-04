"use client";
import Link from "next/link";
import { usePresence } from "@/components/use-presence";
import { useEffect, useRef, useState } from "react";
import { Plus, ChevronDown, Instagram, Mail } from "lucide-react";
export function NewContentMenu() {
  const [open, setOpen] = useState(false);
  const present = usePresence(open);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function click(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", click);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div
      className="new-content-menu"
      ref={root}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="button primary"
        aria-expanded={open}
        aria-controls="new-content-options"
        onClick={() => setOpen(!open)}
      >
        <Plus size={17} />
        Nieuwe content maken
        <ChevronDown size={14} />
      </button>
      {present && (
        <nav
          id="new-content-options"
          data-state={open ? "open" : "closed"}
          inert={!open}
          aria-hidden={!open}
          className="new-content-options"
          aria-label="Nieuwe content"
        >
          {[
            ["/social?tab=assist", "Instagram content", Instagram],
            ["/email?tab=assist", "E-mail maken", Mail],
          ].map(([href, label, Icon]) => {
            const I = Icon as typeof Plus;
            return (
              <Link
                key={String(href)}
                href={String(href)}
                onClick={() => setOpen(false)}
              >
                <I size={17} />
                {String(label)}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
