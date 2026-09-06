"use client";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  FileText,
  CheckCheck,
  Plus,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Artwork, PageHeading, Status } from "@/components/ui";
export default function Dashboard() {
  const { data, ready } = useWorkspace();
  const scheduled = data.posts.filter((p) => p.status === "scheduled");
  return (
    <>
      <PageHeading
        eyebrow="JOUW OVERZICHT"
        title={`Welkom terug${data.profile.name ? `, ${data.profile.name}` : ""} 👋`}
        description="Een frisse blik op je content. En ruimte voor je volgende idee."
        action={
          <Link className="button primary" href="/ai-content">
            <Plus size={18} />
            Nieuwe content maken
          </Link>
        }
      />
      <section className="stats-grid">
        {[
          [
            CalendarDays,
            "Geplande posts",
            scheduled.length,
            "Klaar voor de kalender",
          ],
          [
            FileText,
            "Concepten",
            data.posts.filter((p) => p.status === "draft").length,
            "Ideeën in ontwikkeling",
          ],
          [
            CheckCheck,
            "Goedgekeurd",
            data.posts.filter((p) => p.status === "approved").length,
            "Klaar om in te plannen",
          ],
        ].map(([Icon, label, value, sub]) => {
          const I = Icon as typeof CalendarDays;
          return (
            <div className="stat-card" key={String(label)}>
              <div className="stat-label">
                {String(label)}
                <span className="stat-icon">
                  <I size={20} />
                </span>
              </div>
              <strong>{ready ? String(value) : "—"}</strong>
              <p>{String(sub)}</p>
            </div>
          );
        })}
      </section>
      <section className="creative-banner">
        <div>
          <span className="banner-kicker">
            <Sparkles size={16} /> VAN IDEE NAAR CONTENT
          </span>
          <h2>
            Je volgende goede post
            <br />
            begint met één idee.
          </h2>
          <p>Vertel wat je wilt delen. Wij helpen je op weg.</p>
          <Link className="button white" href="/ai-content">
            Maak je eerste versie <ArrowRight size={17} />
          </Link>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="floating-tag">✦ Een beetje inspiratie</div>
          <div className="mini-post">
            <div className="mini-top">
              <span />
              jouw merk <span>•••</span>
            </div>
            <Artwork />
            <div className="mini-bottom">
              ♡ &nbsp; ◇ &nbsp; ↗ <span>✧</span>
            </div>
          </div>
          <span className="banner-spark">✳</span>
        </div>
      </section>
      <div className="dashboard-lower">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Recente content</h2>
              <p>Je laatste ideeën, op één plek.</p>
            </div>
            <Link href="/contentkalender" className="text-link">
              Alles bekijken <ArrowUpRight size={16} />
            </Link>
          </div>
          {data.posts.length ? (
            <div className="recent-list">
              {data.posts.slice(0, 4).map((post) => (
                <Link
                  href={`/ai-content?post=${post.id}`}
                  key={post.id}
                  className="recent-row"
                >
                  <Artwork small variant={post.variant} />
                  <div>
                    <strong>{post.prompt}</strong>
                    <p>
                      Instagram ·{" "}
                      {new Date(post.createdAt).toLocaleDateString("nl-NL")}
                    </p>
                  </div>
                  <Status status={post.status} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">
                <FileText size={25} />
              </span>
              <h3>Hier begint jouw contentverhaal</h3>
              <p>Maak je eerste concept. Je vindt het daarna hier terug.</p>
              <Link href="/ai-content" className="text-link">
                Nieuwe content maken <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </section>
        <section className="panel next-up">
          <div className="section-heading">
            <div>
              <h2>Op de planning</h2>
              <p>Een blik vooruit.</p>
            </div>
            <CalendarDays size={20} />
          </div>
          {scheduled.length ? (
            [...scheduled]
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(0, 3)
              .map((p) => (
                <div className="planned-item" key={p.id}>
                  <span>
                    {new Date(p.date).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <strong>{p.prompt}</strong>
                </div>
              ))
          ) : (
            <div className="empty-plan">
              <CalendarDays size={30} />
              <h3>Alle ruimte voor iets moois</h3>
              <p>Je hebt nog geen posts ingepland.</p>
            </div>
          )}
          <Link className="button secondary full" href="/contentkalender">
            Open contentkalender <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </>
  );
}
