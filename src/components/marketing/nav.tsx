"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Sparkle } from "lucide-react";
import { Brand } from "@/components/brand";

const menuLinks = [
  { href: "/#product", label: "Product" },
  { href: "/pricing", label: "Prijzen" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";
  return (
    <header className={"mkt-nav" + (isHome ? " mkt-nav-dark" : "")}>
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
          <Link href="/register" className="mkt-agent-btn">
            <Sparkle size={15} />
            Agent
          </Link>
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
              Gratis starten
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
