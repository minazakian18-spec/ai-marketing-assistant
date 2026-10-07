import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Post } from "@/lib/types";

// Shared workspace building blocks (styles in workspace.css). Flat, 1px
// bordered, neutral; purple only for active states and primary actions.

export function Card({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section className={"ui-card " + className} aria-label={label}>
      {children}
    </section>
  );
}

export function SectionHeader({
  title,
  icon,
  count,
  action,
  description,
}: {
  title: string;
  icon?: ReactNode;
  count?: number;
  action?: ReactNode;
  description?: string;
}) {
  return (
    <header className={"ui-section-header" + (description ? " has-description" : "")}>
      <div className="ui-section-title">
        <h2>
          {icon && <span className="ui-section-icon">{icon}</span>}
          {title}
          {count !== undefined && <span className="ui-count">{count}</span>}
        </h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty">
      {icon && <span className="ui-empty-icon">{icon}</span>}
      <div>
        {title && <strong>{title}</strong>}
        {children && <p>{children}</p>}
        {action}
      </div>
    </div>
  );
}

export function IconButton({
  label,
  active,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={"ui-icon-button " + className}
      aria-label={label}
      title={label}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warn" | "success";
}) {
  return <span className={"ui-badge ui-badge-" + tone}>{children}</span>;
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Status({ status }: { status: Post["status"] }) {
  const labels = {
    draft: "Concept",
    approved: "Goedgekeurd",
    scheduled: "Ingepland",
    rejected: "Afgewezen",
    blocked: "Geblokkeerd",
    failed: "Mislukt",
    published: "Demo gepubliceerd",
  };
  return (
    <span
      key={status}
      data-status={status}
      className={`badge ${status === "published" ? "approved" : status === "rejected" || status === "blocked" || status === "failed" ? "draft" : status}`}
    >
      {labels[status]}
    </span>
  );
}
export function Artwork({
  small = false,
  variant = 0,
}: {
  small?: boolean;
  variant?: number;
}) {
  return (
    <div
      role="img"
      aria-label="Placeholder afbeelding voor Instagram-post"
      className={`artwork art-${variant % 3} ${small ? "art-small" : ""}`}
    >
      <span className="art-orbit" />
      <span className="art-label">JOUW MERK. JOUW VERHAAL.</span>
      <strong>
        Maak er iets
        <br />
        <i>moois</i> van.
      </strong>
      <span className="art-bottom">
        Een nieuw moment om te inspireren. <span>↗</span>
      </span>
    </div>
  );
}
