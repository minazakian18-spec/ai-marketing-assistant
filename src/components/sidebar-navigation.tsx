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
import { useInboxUnread } from "@/lib/use-inbox-unread";

function Item({
  item,
  path,
  onNavigate,
  badge = 0,
}: {
  item: NavItem;
  path: string;
  onNavigate: () => void;
  badge?: number;
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
      {badge > 0 && (
        <span className="nav-badge" aria-label={badge + " ongelezen gesprekken"}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

export function SidebarNavigation({ onNavigate }: { onNavigate: () => void }) {
  const path = navigationPath(usePathname());
  const unread = useInboxUnread();
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
            <Item
              key={item.href}
              item={item}
              path={path}
              onNavigate={onNavigate}
              badge={item.href === "/inbox" ? unread : 0}
            />
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
