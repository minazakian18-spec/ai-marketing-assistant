"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isActive,
  navigationGroups,
  navigationPath,
  systemNavigation,
  type NavItem,
} from "@/lib/navigation";

function Item({
  item,
  path,
  onNavigate,
}: {
  item: NavItem;
  path: string;
  onNavigate: () => void;
}) {
  const active = isActive(item.href, path);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={"nav-item" + (active ? " is-active" : "")}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <Icon size={17} />
      <span>{item.label}</span>
    </Link>
  );
}

export function SidebarNavigation({ onNavigate }: { onNavigate: () => void }) {
  const path = navigationPath(usePathname());
  return (
    <nav className="side-nav" aria-label="Hoofdnavigatie">
      {navigationGroups.map((group, i) => (
        <section
          className="side-nav-group"
          aria-label={group.label || "Overzicht"}
          key={group.label || i}
        >
          {group.label && <h2 className="side-nav-label">{group.label}</h2>}
          {group.items.map((item) => (
            <Item key={item.href} item={item} path={path} onNavigate={onNavigate} />
          ))}
        </section>
      ))}
    </nav>
  );
}

export function SystemNavigation({ onNavigate }: { onNavigate: () => void }) {
  const path = navigationPath(usePathname());
  return (
    <nav className="side-nav side-nav-system" aria-label="Systeem">
      {systemNavigation.map((item) => (
        <Item key={item.href} item={item} path={path} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}
