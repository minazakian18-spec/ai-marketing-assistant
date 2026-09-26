"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Brand } from "@/components/brand";

const links = [
  { href: "/#product", label: "Product" },
  { href: "/#oplossingen", label: "Oplossingen" },
  { href: "/#integraties", label: "Integraties" },
  { href: "/pricing", label: "Prijzen" },
  { href: "/#resources", label: "Resources" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="mkt-nav">
      <div className="mkt-nav-inner">
        <Link href="/" aria-label="Mavix home">
          <Brand />
        </Link>
        <nav className="mkt-nav-links" aria-label="Hoofdnavigatie">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mkt-nav-actions">
          <Link href="/login" className="mkt-nav-login">
            Inloggen
          </Link>
          <Link href="/register" className="mkt-btn mkt-btn-primary">
            Gratis starten
          </Link>
          <button
            type="button"
            className="mkt-nav-toggle"
            aria-label={open ? "Menu sluiten" : "Menu openen"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="mkt-mobile-menu" aria-label="Mobiele navigatie">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)}>
            Inloggen
          </Link>
        </nav>
      )}
    </header>
  );
}
