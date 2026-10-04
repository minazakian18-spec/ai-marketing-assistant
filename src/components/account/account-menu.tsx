"use client";
import Link from "next/link";
import { usePresence } from "@/components/use-presence";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { accountLinks } from "./account-nav";
export function AccountMenu() {
  const { data, ready, logout } = useWorkspace();
  const [open, setOpen] = useState(false);
  const present = usePresence(open);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    function outside(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      className="account-menu"
      ref={root}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="account-trigger"
        disabled={!ready}
        aria-label="Accountmenu"
        aria-expanded={open}
        aria-controls="account-dropdown"
        onClick={() => setOpen(!open)}
      >
        <span className="avatar small">
          {data.account.photo ? (
            <img src={data.account.photo} alt="" />
          ) : (
            (data.account.firstName[0] || "M").toUpperCase()
          )}
        </span>
        <ChevronDown size={14} />
      </button>
      {present && (
        <div
          className="account-dropdown"
          id="account-dropdown"
          data-state={open ? "open" : "closed"}
          inert={!open}
          aria-hidden={!open}
        >
          <div className="account-menu-heading">
            <strong>
              {[data.account.firstName, data.account.lastName]
                .filter(Boolean)
                .join(" ") || "Mijn account"}
            </strong>
            {data.account.email && <span>{data.account.email}</span>}
          </div>
          <nav aria-label="Account">
            {accountLinks.map(([href, label, Icon]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={path === href ? "page" : undefined}
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}
          </nav>
          <button
            className="logout-button"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            <LogOut size={17} />
            Uitloggen
          </button>
        </div>
      )}
    </div>
  );
}
