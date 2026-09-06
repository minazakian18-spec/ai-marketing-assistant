"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  CalendarDays,
  Building2,
  ArrowUpRight,
  PanelLeftClose,
  Menu,
} from "lucide-react";
import { useState, type ReactNode } from "react";
const links = [
  ["/", "Dashboard", LayoutDashboard],
  ["/ai-content", "AI Content", Sparkles],
  ["/contentkalender", "Contentkalender", CalendarDays],
  ["/bedrijfsprofiel", "Bedrijfsprofiel", Building2],
] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <button
        className="mobile-toggle"
        onClick={() => setOpen(!open)}
        aria-label="Navigatie openen of sluiten"
        aria-expanded={open}
      >
        <Menu size={21} /> Marketing AI
      </button>
      {open && (
        <button
          className="scrim"
          aria-label="Navigatie sluiten"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Sparkles size={22} />
          </span>
          Marketing<span className="brand-ai">AI</span>
        </Link>
        <p className="nav-label">WERKRUIMTE</p>
        <nav>
          {links.map(([href, label, Icon]) => (
            <Link
              onClick={() => setOpen(false)}
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
              className={path === href ? "active" : ""}
            >
              <Icon size={19} />
              {label}
              {path === href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="live-dot" /> Jouw creatieve werkruimte
            <p>
              Van eerste idee naar een
              <br />
              sterk verhaal.
            </p>
            <Link href="/ai-content" onClick={() => setOpen(false)}>
              Aan de slag <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="workspace-user">
            <span className="avatar">M</span>
            <div>
              <strong>Mijn werkruimte</strong>
              <p>Lokale MVP</p>
            </div>
            <PanelLeftClose size={17} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <div className="topbar">
          <span>
            Werkruimte <span className="slash">/</span>{" "}
            <strong>
              {links.find(([href]) => href === path)?.[1] || "Marketing AI"}
            </strong>
          </span>
          <div className="topbar-right">
            <span className="local-pill">
              <span className="live-dot" /> Lokaal opgeslagen
            </span>
            <span className="avatar small">M</span>
          </div>
        </div>
        <main>{children}</main>
        <footer>
          Marketing AI <span>Meer ruimte voor jouw ideeën.</span>
          <span className="footer-right">MVP · Geen externe koppelingen</span>
        </footer>
      </div>
    </div>
  );
}
