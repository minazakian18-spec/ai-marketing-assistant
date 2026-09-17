import type { ReactNode } from "react";
import type { Post } from "@/lib/types";
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
