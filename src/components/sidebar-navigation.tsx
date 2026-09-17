"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { navigationGroups, navigationPath } from "@/lib/navigation";
import { workspaceView } from "@/lib/workspace-navigation";
import { useWorkspace } from "@/components/workspace-provider";
const key = "mavix.sidebar.open-section.v1";
const sections = [
  ["overview", "Overzicht"],
  ["assist", "Assist"],
  ["auto", "Auto Create"],
  ["full", "Full Autopilot"],
] as const;
export function SidebarNavigation({ onNavigate }: { onNavigate: () => void }) {
  const path = navigationPath(usePathname());
  const search = useSearchParams();
  const { data } = useWorkspace();
  const [expanded, setExpanded] = useState<string | null>(null);
  const initialized = useRef(false);
  const previous = useRef(path + search.toString());
  const channel =
    path === "/instagram-ai" || path === "/email-ai" ? path : null;
  const mode =
    path === "/email-ai" ? data.email?.settings.mode : data.instagram?.mode;
  const view = workspaceView(
    search.get("tab"),
    !!(search.get("post") || search.get("campaign")),
    mode || "assist",
  );
  const change = (value: string | null) => {
    setExpanded(value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Navigation works without persistence. */
    }
  };
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      try {
        const raw = localStorage.getItem(key);
        const saved = raw === null ? channel : JSON.parse(raw);
        setExpanded(
          saved === "/instagram-ai" || saved === "/email-ai" ? saved : null,
        );
      } catch {
        setExpanded(channel);
      }
    } else if (previous.current !== path + search.toString() && channel)
      change(channel);
    previous.current = path + search.toString();
  }, [path, search, channel]);
  return (
    <nav className="grouped-navigation" aria-label="Hoofdnavigatie">
      {navigationGroups.map((group) => (
        <section
          className="navigation-group"
          aria-label={group.label}
          key={group.label}
        >
          <h2 className="nav-label">{group.label}</h2>
          {group.items.map(({ href, label, icon: Icon }) => {
            const ai = href === "/instagram-ai" || href === "/email-ai";
            const active = path === href;
            const open = expanded === href;
            const id = href.slice(1) + "-submenu";
            return (
              <div key={href}>
                <div className={"sidebar-item " + (active ? "is-active" : "")}>
                  <Link
                    href={ai ? href + "?tab=overview" : href}
                    aria-current={active && !ai ? "page" : undefined}
                    onClick={() => {
                      if (ai) change(href);
                      onNavigate();
                    }}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </Link>
                  {ai && (
                    <button
                      aria-label={label + (open ? " inklappen" : " uitklappen")}
                      aria-expanded={open}
                      aria-controls={id}
                      onClick={() => change(open ? null : href)}
                    >
                      <ChevronDown
                        size={16}
                        className={open ? "rotated" : ""}
                      />
                    </button>
                  )}
                </div>
                {ai && (
                  <div
                    id={id}
                    className={"sidebar-submenu " + (open ? "expanded" : "")}
                    inert={!open}
                  >
                    <div>
                      {sections.map(([tab, title]) => (
                        <Link
                          key={tab}
                          href={href + "?tab=" + tab}
                          aria-current={
                            active && view === tab ? "page" : undefined
                          }
                          onClick={onNavigate}
                        >
                          {title}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </nav>
  );
}
