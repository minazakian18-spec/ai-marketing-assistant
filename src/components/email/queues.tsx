"use client";
import { useState } from "react";
import Link from "next/link";
import { Mail, CalendarDays } from "lucide-react";
import { campaignError, type EmailCampaign } from "@/lib/email-model";
import { recipients } from "@/lib/contact-data";
import { EmailStatus } from "./shared";
export function EmailQueue({
  campaigns,
  scheduled,
  onEdit,
  onSave,
  onExamples,
}: {
  campaigns: EmailCampaign[];
  scheduled: boolean;
  onEdit: (c: EmailCampaign) => void;
  onSave: (c: EmailCampaign) => boolean;
  onExamples: () => void;
}) {
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("review");
  const items = campaigns
    .filter((c) =>
      scheduled
        ? ["scheduled", "sent"].includes(c.status)
        : filter === "review"
          ? ["draft", "blocked"].includes(c.status)
          : c.status === filter,
    )
    .sort((a, b) =>
      (a.date || a.createdAt).localeCompare(b.date || b.createdAt),
    );
  function approve(c: EmailCampaign) {
    const error = campaignError(c);
    if (error) {
      setMessage(error);
      return;
    }
    const future = c.date && new Date(c.date).getTime() > Date.now();
    if (
      onSave({
        ...c,
        status: future ? "scheduled" : "approved",
        date: future ? c.date : "",
        reason: "",
      })
    )
      setMessage(
        future
          ? "Campagne goedgekeurd en lokaal ingepland."
          : "Campagne goedgekeurd. Open de editor om een verzendtijd te kiezen.",
      );
  }
  return (
    <section>
      <div className="ig-section-title">
        <div>
          <h2>{scheduled ? "Geplande e-mails" : "Wacht op goedkeuring"}</h2>
          <p className="field-note">
            {scheduled
              ? "Jouw verzendplanning, overzichtelijk op één plek."
              : "Controleer de boodschap en doelgroep voordat je verdergaat."}
          </p>
        </div>
        {scheduled ? (
          <Link className="button secondary" href="/contentkalender">
            Open volledige contentkalender
          </Link>
        ) : (
          <button className="button secondary" onClick={onExamples}>
            Voorbeeldcampagnes toevoegen
          </button>
        )}
      </div>
      {!scheduled && (
        <div
          className="email-queue-filters"
          role="group"
          aria-label="Campagnestatus"
        >
          {[
            ["review", "Te beoordelen"],
            ["approved", "Goedgekeurd"],
            ["rejected", "Afgewezen"],
          ].map(([key, label]) => (
            <button
              className="button secondary"
              key={key}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <p role="status" className="ig-feedback">
        {message}
      </p>
      {!items.length ? (
        <div className="panel ig-empty">
          <Mail size={30} />
          <h2>
            {scheduled ? "Je planning ligt nog open" : "Alles is bijgewerkt"}
          </h2>
          <p>
            {scheduled
              ? "Keur een campagne goed en kies een verzendtijd."
              : "Er staan geen campagnes in deze categorie."}
          </p>
          <Link className="button primary" href="/email-ai?tab=assist">
            E-mail maken
          </Link>
        </div>
      ) : scheduled ? (
        <div className="panel">
          {items.map((c) => (
            <article className="ig-scheduled-row" key={c.id}>
              <span className="email-envelope-icon">
                <Mail size={22} />
              </span>
              <div className="ig-scheduled-copy">
                <h3>{c.title}</h3>
                <small>
                  {c.audience} ·{" "}
                  {c.source === "autopilot" ? "Mavix AI" : "Handmatig"}
                </small>
              </div>
              <time dateTime={c.date}>
                {new Date(c.date).toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "short",
                })}
                <span>
                  {new Date(c.date).toLocaleTimeString("nl-NL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </time>
              <EmailStatus status={c.status} />
              <button className="button secondary" onClick={() => onEdit(c)}>
                Bekijken
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="ig-approval-grid">
          {items.map((c) => (
            <article className="panel email-approval-card" key={c.id}>
              <div className="email-approval-header">
                <Mail size={22} />
                <span>{c.kind.replace("Create ", "")}</span>
                <small>
                  {c.source === "autopilot" ? "Mavix AI" : "Handmatig"}
                </small>
              </div>
              <div className="email-approval-body">
                <EmailStatus status={c.status} />
                <h3>{c.title}</h3>
                <p className="email-queue-subject">{c.subject}</p>
                <p className="field-note">
                  {c.audience} · {recipients(c.audience).length} ontvangers
                </p>
                <p className="ig-caption-excerpt">{c.preview}</p>
                <p className="field-note">
                  <CalendarDays size={13} />{" "}
                  {c.date
                    ? new Date(c.date).toLocaleString("nl-NL", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Verzendtijd nog te kiezen"}
                </p>
                {c.reason && <p className="field-note">{c.reason}</p>}
                <div className="ig-queue-actions">
                  {c.status !== "rejected" && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        if (onSave({ ...c, status: "rejected", date: "" }))
                          setMessage("Campagne afgewezen.");
                      }}
                    >
                      Afwijzen
                    </button>
                  )}
                  <button
                    className="button secondary"
                    onClick={() => onEdit(c)}
                  >
                    Bewerken
                  </button>
                  {["draft", "blocked"].includes(c.status) && (
                    <button
                      className="button primary"
                      onClick={() => approve(c)}
                    >
                      Goedkeuren
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="field-note ig-bottom-note">
        Planning en statussen zijn lokaal. Er worden geen e-mails verzonden.
      </p>
    </section>
  );
}
