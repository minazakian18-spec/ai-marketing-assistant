import type { ComponentType } from "react";
import {
  LayoutDashboard,
  PenLine,
  Inbox,
  CalendarDays,
  Share2,
  Mail,
  Star,
  Megaphone,
  Search,
  Users,
  ChartNoAxesCombined,
  Palette,
  Images,
  Plug,
  Settings,
} from "lucide-react";
import { Mavi } from "@/components/mavi";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
};
export type NavGroup = { label?: string; items: NavItem[] };

export const navigationGroups: NavGroup[] = [
  {
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Werkruimte",
    items: [
      { href: "/agent", label: "Mavix Agent", icon: Mavi },
      { href: "/studio", label: "Content Studio", icon: PenLine },
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/calendar", label: "Kalender", icon: CalendarDays },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/social", label: "Social", icon: Share2 },
      { href: "/email", label: "E-mail", icon: Mail },
      { href: "/reviews", label: "Reviews", icon: Star },
      { href: "/ads", label: "Advertenties", icon: Megaphone },
      { href: "/seo", label: "SEO", icon: Search },
    ],
  },
  {
    label: "Groei",
    items: [
      { href: "/contacten", label: "Contacten", icon: Users },
      { href: "/inzichten", label: "Inzichten", icon: ChartNoAxesCombined },
    ],
  },
  {
    label: "Merk",
    items: [
      { href: "/brand-hub", label: "Brand Hub", icon: Palette },
      { href: "/library", label: "Bibliotheek", icon: Images },
    ],
  },
];

export const systemNavigation: NavItem[] = [
  { href: "/account/integraties", label: "Integraties", icon: Plug },
  { href: "/account", label: "Instellingen", icon: Settings },
];

const aliases: Record<string, string> = {
  "/bedrijfsprofiel": "/brand-hub",
  "/ai-content": "/social",
  "/instagram-ai": "/social",
  "/email-ai": "/email",
  "/review-ai": "/reviews",
  "/contentkalender": "/calendar",
};

export function navigationPath(path: string) {
  return aliases[path] || path;
}

// Exact match or a nested route, except that the Integraties settings page
// belongs to its own system item rather than to "Instellingen" (/account).
export function isActive(href: string, path: string) {
  if (href === "/account" && path.startsWith("/account/integraties")) return false;
  return path === href || path.startsWith(href + "/");
}
