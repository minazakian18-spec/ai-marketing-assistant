"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { isBrowserDemo } from "@/lib/demo";
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

// "Beheer" only for Mavix staff: the server decides (platform_admins), the
// link stays hidden until it has confirmed. /beheer and /api/admin/* keep
// refusing everyone else on their own.
const ADMIN_ITEM: NavItem = { href: "/beheer", label: "Beheer", icon: ShieldCheck };
function usePlatformAdmin() {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (isBrowserDemo()) return;
    let live = true;
    fetch("/api/admin/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { admin: false }))
      .then((d) => live && setAdmin(d.admin === true))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return admin;
}

export function SystemNavigation({ onNavigate }: { onNavigate: () => void }) {
  const path = navigationPath(usePathname());
  const admin = usePlatformAdmin();
  const items = admin ? systemNavigation.flatMap((item) => (item.href === "/account" ? [ADMIN_ITEM, item] : [item])) : systemNavigation;
  return (
    <nav className="side-nav side-nav-system" aria-label="Systeem">
      {items.map((item) => (
        <Item key={item.href} item={item} path={path} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}
