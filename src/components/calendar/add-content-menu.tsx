"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, ChevronDown, Instagram, Mail, Film, ImagePlus } from "lucide-react";
import { usePresence } from "@/components/use-presence";
// Instagram Post/Story/Reel each map to an existing ContentType (see
// instagram-model.ts) via the "type" query param, which create.tsx already
// reads. "Campagne" is not a separate creation surface: it's an e-mail kind
// (see the CHANNELS comment in contentkalender/page.tsx), so it isn't listed
// here as a distinct destination.
const instagramOptions = [
  ["Post", "Instagram post", Instagram],
  ["Story", "Instagram story", ImagePlus],
  ["Reel", "Instagram reel", Film],
] as const;
export function AddContentMenu({
  date,
  label = "Content plannen",
  compact = false,
}: {
  date?: string;
  label?: string;
  compact?: boolean;
}) {
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
  const suffix = date ? "&date=" + encodeURIComponent(date) : "";
  return (
    <div
      className={"cal-add-menu" + (compact ? " cal-add-menu-compact" : "")}
      ref={root}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={compact ? "cal-day-add" : "button primary"}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={compact ? "Content plannen op " + date : label}
        onClick={() => setOpen(!open)}
      >
        {compact ? (
          "+"
        ) : (
          <>
            <Plus size={17} />
            {label}
            <ChevronDown size={14} />
          </>
        )}
      </button>
      {present && (
        <nav
          data-state={open ? "open" : "closed"}
          inert={!open}
          aria-hidden={!open}
          className="cal-add-options"
          aria-label="Nieuwe content"
        >
          {instagramOptions.map(([type, label, Icon]) => (
            <Link
              key={type}
              href={
                "/instagram-ai?tab=assist" +
                suffix +
                "&type=" +
                encodeURIComponent(type)
              }
              onClick={() => setOpen(false)}
            >
              <Icon size={16} /> {label}
            </Link>
          ))}
          <Link
            href={"/email-ai?tab=assist" + suffix}
            onClick={() => setOpen(false)}
          >
            <Mail size={16} /> E-mail maken
          </Link>
        </nav>
      )}
    </div>
  );
}
