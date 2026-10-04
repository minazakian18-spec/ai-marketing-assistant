"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Sparkle } from "lucide-react";
import { Brand } from "@/components/brand";
import { AgentDrawer } from "./agent-drawer";

const menuLinks = [
  { href: "/#product", label: "Product" },
  { href: "/pricing", label: "Prijzen" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";
  const closeAgent = useCallback(() => setAgentOpen(false), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const className =
    "mkt-nav" +
    (isHome ? " mkt-nav-home" : "") +
    (isHome && !scrolled && !open ? " mkt-nav-dark" : "") +
    (scrolled ? " mkt-nav-scrolled" : "");

  return (
    <>
      <header className={className}>
        <div className="mkt-nav-inner">
          <Link href="/" aria-label="Mavix home">
            <Brand />
          </Link>
          <nav className="mkt-nav-links" aria-label="Navigatie">
            {menuLinks.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mkt-nav-actions">
            <Link href="/login" className="mkt-nav-login-link">
              Inloggen
            </Link>
            <button
              type="button"
              className="mkt-agent-btn"
              aria-haspopup="dialog"
              aria-expanded={agentOpen}
              onClick={() => {
                setOpen(false);
                setAgentOpen(true);
              }}
            >
              <Sparkle size={15} />
              Agent
            </button>
            <button
              type="button"
              className="mkt-nav-toggle"
              aria-label={open ? "Menu sluiten" : "Menu openen"}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="mkt-mobile-menu" aria-label="Navigatie">
            {menuLinks.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <div className="mkt-mobile-menu-auth">
              <Link href="/login" onClick={() => setOpen(false)}>
                Inloggen
              </Link>
              <Link
                href="/register"
                className="mkt-btn mkt-btn-primary"
                onClick={() => setOpen(false)}
              >
                Get started
              </Link>
            </div>
          </nav>
        )}
      </header>
      <AgentDrawer open={agentOpen} onClose={closeAgent} />
    </>
  );
}
