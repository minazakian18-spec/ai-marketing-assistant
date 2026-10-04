"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, FileText } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { Status } from "./ui";
export function DashboardReview() {
  const { data, ready, save } = useWorkspace();
  const [message, setMessage] = useState("");
  const drafts = data.posts.filter((p) => p.status === "draft");
  return (
    <div className="dashboard-review">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>
              Wacht op goedkeuring{" "}
              <span className="badge draft">{ready ? drafts.length : "—"}</span>
            </h2>
            <p>Bekijk je recente concepten en geef ze groen licht.</p>
          </div>
        </div>
        {drafts.length ? (
          drafts.slice(0, 4).map((post) => (
            <div className="review-row" key={post.id}>
              <div>
                <strong>{post.prompt}</strong>
                <p>Instagram · Concept</p>
              </div>
              <div className="review-actions">
                <Link
                  className="button secondary"
                  href={"/social?post=" + post.id}
                >
                  Bekijken
                </Link>
                <button
                  className="button primary"
                  onClick={async () => {
                    if (
                      await save({
                        ...data,
                        posts: data.posts.map((p) =>
                          p.id === post.id ? { ...p, status: "approved" } : p,
                        ),
                      })
                    )
                      setMessage(
                        "Concept goedgekeurd. Je kunt het nu inplannen.",
                      );
                  }}
                >
                  <Check size={16} />
                  Goedkeuren
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <FileText size={25} />
            <h3>Geen concepten om te beoordelen</h3>
            <p>Nieuwe Instagram-concepten verschijnen hier.</p>
          </div>
        )}
        <p role="status" className="review-message">
          {message}
        </p>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Recente activiteit</h2>
            <p>Recent aangemaakte content en de huidige status.</p>
          </div>
        </div>
        {data.posts.length ? (
          [...data.posts]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 4)
            .map((post) => (
              <Link
                className="activity-row"
                href={"/social?post=" + post.id}
                key={post.id}
              >
                <div>
                  <strong>{post.prompt}</strong>
                  <p>
                    Aangemaakt op{" "}
                    {new Date(post.createdAt).toLocaleDateString("nl-NL")}
                  </p>
                </div>
                <Status status={post.status} />
              </Link>
            ))
        ) : (
          <div className="empty-state">
            <p>Je eerste contentactiviteit verschijnt hier.</p>
          </div>
        )}
      </section>
    </div>
  );
}
