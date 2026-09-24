import {
  LayoutDashboard,
  Instagram,
  Mail,
  CalendarDays,
  Users,
  ChartNoAxesCombined,
  Palette,
  Star,
  Images,
} from "lucide-react";
export const navigationGroups = [
  {
    label: "OVERZICHT",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "CONTENT",
    items: [
      { href: "/instagram-ai", label: "Instagram AI", icon: Instagram },
      { href: "/email-ai", label: "Email AI", icon: Mail },
      { href: "/review-ai", label: "Review AI", icon: Star },
    ],
  },
  {
    label: "PLANNING",
    items: [
      {
        href: "/contentkalender",
        label: "Contentkalender",
        icon: CalendarDays,
      },
    ],
  },
  {
    label: "KLANTEN & RESULTATEN",
    items: [
      { href: "/contacten", label: "Contacten", icon: Users },
      { href: "/inzichten", label: "Inzichten", icon: ChartNoAxesCombined },
    ],
  },
  {
    label: "MERK",
    items: [
      { href: "/brand-hub", label: "Brand Hub", icon: Palette },
      { href: "/library", label: "Library", icon: Images },
    ],
  },
];
export function navigationPath(path: string) {
  return path === "/ai-content"
    ? "/instagram-ai"
    : path === "/bedrijfsprofiel"
      ? "/brand-hub"
      : path;
}
