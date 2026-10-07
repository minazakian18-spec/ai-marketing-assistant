"use client";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { usePathname } from "next/navigation";
import { Menu, UserRound, X } from "lucide-react";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { AccountMenu } from "@/components/account/account-menu";
import { accountLinks } from "@/components/account/account-nav";
import { useWorkspace } from "@/components/workspace-provider";
import { AgentProvider } from "@/components/agent/agent-provider";
import { AgentLauncher } from "@/components/agent/agent-launcher";
import { AgentPanel } from "@/components/agent/agent-panel";
import {
  navigationGroups,
  navigationPath,
  systemNavigation,
} from "@/lib/navigation";
import {
  SidebarNavigation,
  SystemNavigation,
} from "@/components/sidebar-navigation";
const links = [
  ...navigationGroups.flatMap((group) => group.items),
  ...systemNavigation,
];
export function AppShell({ children }: { children: ReactNode }) {
  const path = navigationPath(usePathname());
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const drawer = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 650px)");
    const update = () => {
      setMobile(media.matches);
      if (!media.matches) setOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function keys(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab") {
        const items = Array.from(
          drawer.current?.querySelectorAll<HTMLElement>(
            "a[href],button:not([disabled])",
          ) || [],
        );
        const visible = items.filter(
          (item) => !item.closest("[inert]") && item.getClientRects().length,
        );
        const first = visible[0],
          last = visible[visible.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keys);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keys);
      toggle.current?.focus();
    };
  }, [open, mobile]);
  const { signedOut, resume, data } = useWorkspace();
  const fullName = [data.account.firstName, data.account.lastName]
    .filter(Boolean)
    .join(" ");
  if (signedOut)
    return (
      <div className="signed-out-page">
        <section className="panel">
          <Brand />
          <h1>Je bent uitgelogd</h1>
          <p>Je lokale gegevens zijn bewaard in deze browser.</p>
          <p className="muted">
            Dit is een demo zonder echte accountbeveiliging.
          </p>
          <button className="button primary" onClick={resume}>
            Terug naar mijn werkruimte
          </button>
        </section>
      </div>
    );
  return (
    <AgentProvider>
    <div className="app-shell">
      <button
        ref={toggle}
        className="mobile-toggle"
        aria-controls="main-sidebar"
        onClick={() => setOpen(!open)}
        aria-label="Navigatie openen of sluiten"
        aria-expanded={open}
      >
        <Menu size={21} /> <Brand />
      </button>
      {open && (
        <button
          className="scrim"
          aria-label="Navigatie sluiten"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="main-sidebar"
        ref={drawer}
        inert={mobile && !open}
        className={`sidebar ${open ? "open" : ""}`}
      >
        <button
          className="sidebar-close"
          aria-label="Navigatie sluiten"
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
        <Link href="/dashboard" className="brand">
          <Brand />
        </Link>
        <SidebarNavigation onNavigate={() => setOpen(false)} />
        <div className="sidebar-bottom">
          <SystemNavigation onNavigate={() => setOpen(false)} />
          <Link
            href="/account"
            className="sidebar-user"
            onClick={() => setOpen(false)}
          >
            <span className="sidebar-user-avatar" aria-hidden="true">
              {data.account.photo ? <img src={data.account.photo} alt="" /> : <UserRound size={16} strokeWidth={1.75} />}
            </span>
            <span className="sidebar-user-text">
              <strong>{fullName || "Mijn account"}</strong>
              {data.account.email && <small>{data.account.email}</small>}
            </span>
          </Link>
        </div>
      </aside>
      <div className="main-shell" inert={mobile && open}>
        <div className="topbar">
          <span>
            Werkruimte <span className="slash">/</span>{" "}
            <strong>
              {links.find((item) => item.href === path)?.label ||
                accountLinks.find(([href]) => href === path)?.[1] ||
                "Mavix"}
            </strong>
          </span>
          <div className="topbar-right">
            <AgentLauncher />
            <AccountMenu />
          </div>
        </div>
        <main>
          <div className="page-content-enter" key={path}>
            {children}
          </div>
        </main>
      </div>
      <AgentPanel />
    </div>
    </AgentProvider>
  );
}
