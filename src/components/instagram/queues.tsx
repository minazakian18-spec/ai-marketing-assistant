"use client";
import Link from "next/link";
import { Check, X, Pencil, CalendarDays } from "lucide-react";
import type { Post } from "@/lib/types";
import { Status } from "@/components/ui";
import { PostVisual } from "./shared";
export function ApprovalQueue({
  posts,
  onChange,
  onEdit,
  onExamples,
}: {
  posts: Post[];
  onChange: (p: Post) => void;
  onEdit: (p: Post) => void;
  onExamples: () => void;
}) {
  const drafts = posts.filter((p) => p.status === "draft");
  return (
    <section>
      <div className="ig-section-title">
        <div>
          <h2>Wacht op goedkeuring</h2>
          <p>Auto Create-concepten komen hier terecht. Jij houdt de regie.</p>
        </div>
        <span className="badge draft">{drafts.length} concepten</span>
      </div>
      {drafts.length ? (
        <div className="ig-approval-grid">
          {drafts.map((post) => (
            <article className="panel ig-approval-card" key={post.id}>
              <PostVisual post={post} />
              <div>
                <span className="badge scheduled">
                  {post.contentType || "Post"} ·{" "}
                  {post.source === "autopilot" ? "Mavix AI" : "Handmatig"}
                </span>
                <h3>{post.prompt}</h3>
                <p className="ig-caption-excerpt">{post.caption}</p>
                {post.failureReason && (
                  <p className="field-error">{post.failureReason}</p>
                )}
                <p className="field-note">
                  <CalendarDays size={14} />
                  {post.date
                    ? new Date(post.date).toLocaleString("nl-NL", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Nog geen datum gekozen"}
                </p>
                <div className="ig-queue-actions">
                  <button
                    className="button secondary"
                    onClick={() =>
                      onChange({ ...post, status: "rejected", date: "" })
                    }
                  >
                    <X size={14} />
                    Afwijzen
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => onEdit(post)}
                  >
                    <Pencil size={14} />
                    Bewerken
                  </button>
                  <button
                    className="button primary"
                    onClick={() =>
                      onChange({
                        ...post,
                        status:
                          post.date && new Date(post.date) > new Date()
                            ? "scheduled"
                            : "approved",
                        date:
                          post.date && new Date(post.date) > new Date()
                            ? post.date
                            : "",
                      })
                    }
                  >
                    <Check size={14} />
                    Goedkeuren
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel ig-empty">
          <Check size={28} />
          <h2>Alles is bijgewerkt</h2>
          <p>
            Maak een concept in Create of simuleer een week met Auto Create.
          </p>
          <button className="button secondary" onClick={onExamples}>
            Voorbeeldcontent toevoegen
          </button>
        </div>
      )}
    </section>
  );
}
export function ScheduledContent({
  posts,
  onEdit,
  onExamples,
}: {
  posts: Post[];
  onEdit: (p: Post) => void;
  onExamples: () => void;
}) {
  const items = posts
    .filter((p) =>
      ["scheduled", "blocked", "failed", "published"].includes(p.status),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section>
      <div className="ig-section-title">
        <div>
          <h2>Geplande content</h2>
          <p>Je planning en publicatiestatus, overzichtelijk bij elkaar.</p>
        </div>
        <Link className="text-link" href="/contentkalender">
          Open volledige contentkalender →
        </Link>
      </div>
      <div className="panel">
        {items.length ? (
          items.map((post) => (
            <article className="ig-scheduled-row" key={post.id}>
              <PostVisual post={post} small />
              <div className="ig-scheduled-copy">
                <small>
                  {post.contentType || "Post"} ·{" "}
                  {post.source === "autopilot" ? "Mavix AI" : "Handmatig"}
                </small>
                <h3>{post.prompt}</h3>
                {post.failureReason && (
                  <p className="field-error">{post.failureReason}</p>
                )}
              </div>
              <time dateTime={post.date}>
                {post.date
                  ? new Date(post.date).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "short",
                    })
                  : "Geen datum"}
                <span>
                  {post.date
                    ? new Date(post.date).toLocaleTimeString("nl-NL", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </span>
              </time>
              <Status status={post.status} />
              <button className="button secondary" onClick={() => onEdit(post)}>
                Bekijken
              </button>
            </article>
          ))
        ) : (
          <div className="ig-empty">
            <CalendarDays size={28} />
            <h2>Alle ruimte voor je volgende post</h2>
            <p>
              Plan goedgekeurde content in of probeer de lokale voorbeeldset.
            </p>
            <button className="button secondary" onClick={onExamples}>
              Voorbeeldcontent toevoegen
            </button>
          </div>
        )}
      </div>
      <p className="field-note ig-bottom-note">
        Geplande content wordt in dit prototype niet echt gepubliceerd. Er is
        geen verbinding met Instagram.
      </p>
    </section>
  );
}
