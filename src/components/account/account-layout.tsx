"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { accountLinks } from "./account-nav";
import { useWorkspace } from "@/components/workspace-provider";
export function AccountLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { ready, logout } = useWorkspace();
  return (
    <div className="account-settings">
      <nav className="account-tabs" aria-label="Accountinstellingen">
        {accountLinks.map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
      {ready ? children : <p role="status">Account laden…</p>}
      <div className="account-footer">
        <button className="logout-button" onClick={logout} disabled={!ready}>
          <LogOut size={17} />
          Uitloggen
        </button>
      </div>
    </div>
  );
}
