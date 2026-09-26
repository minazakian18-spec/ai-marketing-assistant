import Link from "next/link";
import { Brand } from "@/components/brand";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  visualTitle,
  visualBody,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  visualTitle: string;
  visualBody: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mkt-auth">
      <div className="mkt-auth-visual">
        <Link href="/" style={{ marginBottom: 40, display: "inline-block" }}>
          <Brand className="brand-on-dark" />
        </Link>
        <h2>{visualTitle}</h2>
        <p>{visualBody}</p>
      </div>
      <div className="mkt-auth-form-side">
        <div className="mkt-auth-card">
          <Link
            href="/"
            className="mkt-auth-mobile-brand"
            style={{ display: "none", marginBottom: 24 }}
          >
            <Brand />
          </Link>
          <h1>{title}</h1>
          <p>{subtitle}</p>
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}
