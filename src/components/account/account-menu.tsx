"use client";
import Link from "next/link";
import { usePresence } from "@/components/use-presence";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Sparkles, UserRound } from "lucide-react";
import { ThemeSwatches } from "./theme-picker";
import { useWorkspace } from "@/components/workspace-provider";
import { accountLinks } from "./account-nav";

// Profile button mark: the uploaded photo when there is one, otherwise a
// clean person icon (never a letter placeholder).
function ProfileMark({ photo, large = false }: { photo?: string; large?: boolean }) {
  return (
    <span className={"account-avatar" + (large ? " is-large" : "")} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
      {photo ? <img src={photo} alt="" /> : <UserRound size={large ? 18 : 17} strokeWidth={1.75} />}
    </span>
  );
}
export function AccountMenu() {
  const { data, ready, logout } = useWorkspace();
  const [open, setOpen] = useState(false);
  const present = usePresence(open);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  // AI credits of this period (owners and admins; others simply see no bar).
  const [credits, setCredits] = useState<{ total: number; used: number; remaining: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    void fetch("/api/ai-usage", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCredits(d?.credits ?? null))
      .catch(() => setCredits(null));
  }, [open]);
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
        <ProfileMark photo={data.account.photo} />
        <ChevronDown size={14} aria-hidden="true" />
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
            <ProfileMark photo={data.account.photo} large />
            <strong>
              {[data.account.firstName, data.account.lastName]
                .filter(Boolean)
                .join(" ") || "Mijn account"}
            </strong>
            {data.account.email && <span>{data.account.email}</span>}
          </div>
          {credits && (
            <Link href="/account/ai" className="menu-credits" onClick={() => setOpen(false)}>
              <span className="menu-credits-head">
                <Sparkles size={15} aria-hidden="true" /> AI-tegoed
                <strong>
                  {credits.remaining} / {credits.total}
                </strong>
              </span>
              <span className="menu-credits-bar" aria-hidden="true">
                <i style={{ width: (credits.total ? Math.min(100, (credits.remaining / credits.total) * 100) : 0) + "%" }} />
              </span>
              <small>credits over deze periode</small>
            </Link>
          )}
          <div className="menu-theme">
            <span>Thema</span>
            <ThemeSwatches />
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
