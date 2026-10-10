"use client";
import Link from "next/link";
import { Instagram, Mail } from "lucide-react";
import { EmptyState } from "@/components/ui";
import type { Workspace } from "@/lib/types";

// Saved marketing drafts (Instagram posts and e-mail campaigns that are not
// approved, scheduled or sent yet). They stay where they are stored; this view
// only lists them and opens them in their own editor.

export type Draft = { id: string; channel: "instagram" | "email"; title: string; text: string; date: string; href: string; image?: string };

export function workspaceDrafts(w: Workspace): Draft[] {
  const posts: Draft[] = w.posts
    .filter((p) => p.status === "draft")
    .map((p) => ({
      id: "post-" + p.id,
      channel: "instagram",
      title: p.contentType || "Instagram-post",
      text: (p.caption || p.prompt || "").slice(0, 200),
      date: p.createdAt || p.date,
      href: "/social?tab=assist&post=" + encodeURIComponent(p.id),
      image: p.media?.[0],
    }));
  const mails: Draft[] = (w.email?.campaigns || [])
    .filter((c) => c.status === "draft")
    .map((c) => ({
      id: "mail-" + c.id,
      channel: "email",
      title: c.subject || c.title || "E-mailcampagne",
      text: (c.preview || c.body || "").replace(/<[^>]+>/g, " ").slice(0, 200),
      date: c.createdAt || c.date,
      href: "/email?tab=create&campaign=" + encodeURIComponent(c.id),
    }));
  return [...posts, ...mails].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export function Drafts({ drafts, query }: { drafts: Draft[]; query: string }) {
  const q = query.trim().toLowerCase();
  const shown = drafts.filter((d) => !q || (d.title + " " + d.text).toLowerCase().includes(q));
  if (!shown.length)
    return (
      <div className="lb-empty">
        <EmptyState icon={<Mail size={18} />} title={q ? "Geen concepten gevonden" : "Nog geen concepten"}>
          {q ? "Probeer een andere zoekterm." : "Concepten die je in Social of E-mail opslaat, verschijnen hier."}
        </EmptyState>
      </div>
    );
  return (
    <ul className="lb-drafts">
      {shown.map((d) => (
        <li key={d.id}>
          <Link href={d.href} className="lb-draft">
            <span className={"lb-draft-icon is-" + d.channel} aria-hidden="true">
              {d.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.image} alt="" />
              ) : d.channel === "instagram" ? (
                <Instagram size={16} />
              ) : (
                <Mail size={16} />
              )}
            </span>
            <span className="lb-draft-main">
              <strong>{d.title}</strong>
              <span>{d.text || "Nog geen tekst"}</span>
            </span>
            <span className="lb-draft-meta">
              {d.channel === "instagram" ? "Social" : "E-mail"}
              {d.date && <small>{new Date(d.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</small>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
