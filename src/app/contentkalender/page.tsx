"use client";
import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Plus, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Artwork, PageHeading, Status } from "@/components/ui";
import { EmailQueue } from "@/components/email/queues";
import { useRouter } from "next/navigation";
import type { Post } from "@/lib/types";
function ScheduleForm({
  post,
  onSave,
}: {
  post: Post;
  onSave: (date: string) => boolean;
}) {
  const [date, setDate] = useState(post.date);
  const [message, setMessage] = useState("");
  return (
    <form
      className="schedule-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (new Date(date).getTime() <= Date.now()) {
          setMessage("Kies een tijdstip in de toekomst.");
          return;
        }
        if (onSave(date)) setMessage("Planning opgeslagen.");
      }}
    >
      <label>
        Datum en tijd
        <input
          aria-label={`Datum en tijd voor ${post.prompt}`}
          type="datetime-local"
          required
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setMessage("");
          }}
        />
      </label>
      <button className="button secondary">
        {post.status === "scheduled" ? "Bijwerken" : "Inplannen"}
      </button>
      <span role="status">{message}</span>
    </form>
  );
}
export default function CalendarPage() {
  const { data, ready, save } = useWorkspace();
  const router = useRouter();
  const [view, setView] = useState("calendar");
  const [filter, setFilter] = useState("all");
  const posts = [...data.posts]
    .filter((p) => filter === "all" || p.status === filter)
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  return (
    <>
      <PageHeading
        eyebrow="VOORUITKIJKEN"
        title="Contentkalender"
        description="Geef je ideeën een plek in de planning."
        action={
          <Link className="button primary" href="/instagram-ai?tab=assist">
            <Plus size={18} />
            Nieuwe content maken
          </Link>
        }
      />
      <div
        className="tabs calendar-view-tabs"
        role="group"
        aria-label="Planningweergave"
      >
        <button
          aria-pressed={view === "calendar"}
          className={view === "calendar" ? "selected" : ""}
          onClick={() => setView("calendar")}
        >
          Kalender
        </button>
        <button
          aria-pressed={view === "automations"}
          className={view === "automations" ? "selected" : ""}
          onClick={() => setView("automations")}
        >
          Automatiseringen
        </button>
      </div>
      {view === "automations" ? (
        <section className="panel automation-placeholder">
          <span className="badge draft">Binnenkort</span>
          <h2>Geef terugkerende ideeën een ritme</h2>
          <p>Hier kun je later regels instellen voor je content.</p>
          <blockquote>
            “Maak iedere vrijdag automatisch een Instagram-concept.”
          </blockquote>
          <p className="field-note">
            Dit is een voorbeeld. Er zijn geen automatiseringen actief.
          </p>
        </section>
      ) : (
        <>
          <div className="calendar-toolbar">
            <div className="tabs" role="group" aria-label="Filter content">
              {[
                ["all", "Alle content"],
                ["scheduled", "Ingepland"],
                ["draft", "Concepten"],
                ["approved", "Goedgekeurd"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  aria-pressed={filter === key}
                  className={filter === key ? "selected" : ""}
                  onClick={() => setFilter(key)}
                >
                  {label}{" "}
                  <span>
                    {
                      data.posts.filter(
                        (p) => key === "all" || p.status === key,
                      ).length
                    }
                  </span>
                </button>
              ))}
            </div>
            <span className="muted calendar-zone">
              Tijden in je lokale tijdzone
            </span>
          </div>
          <section className="panel calendar-panel">
            {!ready ? (
              <p>Kalender laden…</p>
            ) : posts.length ? (
              posts.map((post) => (
                <article className="calendar-post" key={post.id}>
                  <div className="calendar-post-main">
                    <Artwork small variant={post.variant} />
                    <div>
                      <div className="post-title">
                        <h3>{post.prompt}</h3>
                        <Status status={post.status} />
                      </div>
                      <p>
                        {post.status === "scheduled"
                          ? new Date(post.date).toLocaleString("nl-NL", {
                              dateStyle: "long",
                              timeStyle: "short",
                            })
                          : "Nog niet ingepland"}{" "}
                        · Instagram {post.contentType || "Post"}
                      </p>
                      <Link
                        href={`/instagram-ai?post=${post.id}`}
                        className="text-link"
                      >
                        Concept openen <ArrowUpRight size={15} />
                      </Link>
                    </div>
                  </div>
                  {["draft", "rejected", "blocked", "failed"].includes(
                    post.status,
                  ) ? (
                    <p className="schedule-hint">
                      Open dit concept om het te controleren, te bewerken en
                      goed te keuren.
                    </p>
                  ) : post.status === "published" ? (
                    <p className="schedule-hint">Publicatie gesimuleerd.</p>
                  ) : (
                    <ScheduleForm
                      post={post}
                      onSave={(date) =>
                        save({
                          ...data,
                          posts: data.posts.map((p) =>
                            p.id === post.id
                              ? { ...p, date, status: "scheduled" }
                              : p,
                          ),
                        })
                      }
                    />
                  )}
                </article>
              ))
            ) : (
              <div className="empty-state calendar-empty">
                <span className="empty-icon">
                  <CalendarDays size={28} />
                </span>
                <h2>
                  {filter === "all"
                    ? "Je kalender ligt nog open"
                    : "Nog geen content in deze categorie"}
                </h2>
                <p>
                  Maak een concept, keur het goed en kies een publicatiemoment.
                </p>
                <Link
                  href="/instagram-ai?tab=assist"
                  className="button primary"
                >
                  <Plus size={17} />
                  Maak een concept
                </Link>
              </div>
            )}
          </section>
          <div className="email-calendar-section">
            <EmailQueue
              campaigns={data.email?.campaigns || []}
              scheduled={true}
              onEdit={(c) =>
                router.push("/email-ai?campaign=" + encodeURIComponent(c.id))
              }
              onSave={() => false}
              onExamples={() => {}}
            />
          </div>
          <p className="calendar-disclaimer">
            De planning is lokaal. Posts worden niet automatisch op Instagram
            gepubliceerd.
          </p>
        </>
      )}
    </>
  );
}
