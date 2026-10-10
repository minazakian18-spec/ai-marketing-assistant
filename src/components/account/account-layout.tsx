"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { accountGroups } from "./account-nav";
import { useWorkspace } from "@/components/workspace-provider";

// Settings shell: grouped navigation on the left (a scrollable row on
// phones) and the selected settings page on the right.
export function AccountLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { ready, logout } = useWorkspace();
  return (
    <div className="account-settings st">
      <nav className="st-nav" aria-label="Instellingen">
        {accountGroups.map((g) => (
          <div key={g.label} className="st-group">
            <p className="st-group-label">{g.label}</p>
            {g.links.map(([href, label, description, Icon]) => (
              <Link key={href} href={href} className="st-link" aria-current={path === href ? "page" : undefined}>
                <span className="st-link-icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <span className="st-link-text">
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </Link>
            ))}
          </div>
        ))}
        <button type="button" className="st-logout" onClick={logout} disabled={!ready}>
          <LogOut size={15} aria-hidden="true" />
          Uitloggen
        </button>
      </nav>
      <div className="st-content" key={path}>
        {ready ? children : <p role="status">Instellingen laden…</p>}
      </div>
    </div>
  );
}
