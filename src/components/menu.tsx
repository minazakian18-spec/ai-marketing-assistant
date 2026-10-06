"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";

export type MenuItem =
  | { type?: "item"; label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; checked?: boolean; disabled?: boolean }
  | { type: "separator" }
  | { type: "heading"; label: string };

// Small dropdown menu: one trigger, a list of actions. Closes on select,
// outside click and Escape; arrow keys move between items.
export function Menu({
  trigger,
  label,
  items,
  align = "end",
  className = "",
}: {
  trigger: ReactNode;
  label: string;
  items: MenuItem[];
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Consumed here: page-level Escape handlers check defaultPrevented.
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        (root.current?.querySelector("[aria-haspopup]") as HTMLElement | null)?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") || [])];
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(at + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key, true);
    window.setTimeout(() => list.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key, true);
    };
  }, [open]);

  return (
    <div className={"ui-menu " + className} ref={root}>
      <button
        type="button"
        className="ui-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        title={label}
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </button>
      {open && (
        <div className={"ui-menu-list is-" + align} role="menu" id={id} ref={list}>
          {items.map((item, i) => {
            if (item.type === "separator") return <hr key={i} />;
            if (item.type === "heading")
              return (
                <p key={i} className="ui-menu-heading">
                  {item.label}
                </p>
              );
            return (
              <button
                key={i}
                type="button"
                role={item.checked !== undefined ? "menuitemradio" : "menuitem"}
                aria-checked={item.checked}
                className={item.danger ? "is-danger" : ""}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                <span className="ui-menu-icon">{item.checked ? <Check size={14} /> : item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
