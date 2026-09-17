"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading } from "@/components/ui";
const preferences = [
  [
    "approval",
    "Content wacht op goedkeuring",
    "Als een concept klaarstaat voor jouw beoordeling.",
  ],
  ["scheduled", "Geplande post", "Als er een post op de planning staat."],
  [
    "campaign",
    "E-mailcampagne klaar",
    "Als een campagne klaarstaat om te bekijken.",
  ],
  ["billing", "Facturatie", "Updates over je abonnement en facturen."],
  [
    "updates",
    "Productupdates",
    "Nieuwe mogelijkheden en verbeteringen in Mavix.",
  ],
] as const;
export default function NotificationsPage() {
  const { data, save } = useWorkspace();
  const [message, setMessage] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="OP JOUW MANIER"
        title="Meldingen"
        description="Kies welke updates je wilt ontvangen."
      />
      <section className="panel account-panel">
        <div className="section-heading">
          <div>
            <h2>Jouw voorkeuren</h2>
            <p>Wijzigingen worden direct lokaal opgeslagen.</p>
          </div>
        </div>
        {preferences.map(([key, label, description]) => (
          <div className="notification-row" key={key}>
            <div>
              <h3 id={"notification-" + key}>{label}</h3>
              <p id={"description-" + key}>{description}</p>
            </div>
            <button
              type="button"
              className="notification-toggle"
              role="switch"
              aria-checked={data.notifications[key]}
              aria-labelledby={"notification-" + key}
              aria-describedby={"description-" + key}
              onClick={() => {
                if (
                  save({
                    ...data,
                    notifications: {
                      ...data.notifications,
                      [key]: !data.notifications[key],
                    },
                  })
                )
                  setMessage(
                    label +
                      ": " +
                      (data.notifications[key]
                        ? "uitgeschakeld"
                        : "ingeschakeld") +
                      ".",
                  );
              }}
            >
              <span />
            </button>
          </div>
        ))}
      </section>
      <p className="field-note">
        Er worden in deze MVP nog geen echte meldingen of e-mails verstuurd.
      </p>
      <p role="status" className="success-message">
        {message}
      </p>
    </>
  );
}
