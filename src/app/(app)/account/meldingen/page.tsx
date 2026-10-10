"use client";
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { notificationChannels } from "@/lib/security";

type Preference = { event_type: string; channel: string; enabled: boolean };
type Notice = { id: string; title: string; body: string; read_at: string | null };

// Grouped by what the notification is about. Billing events are left out:
// Mavix has no payments during the private beta.
const GROUPS: { title: string; description: string; events: [string, string][] }[] = [
  { title: "Inbox en klanten", description: "Nieuwe gesprekken van je gekoppelde kanalen.", events: [["new_conversation", "Nieuw gesprek in de Inbox"]] },
  {
    title: "Content en automatisering",
    description: "Wanneer Mavix iets voor je klaarzet of een planning afloopt.",
    events: [
      ["content_ready", "Content klaar voor goedkeuring"],
      ["content_published", "Content gepubliceerd"],
      ["content_failed", "Publicatie mislukt"],
      ["email_campaign_completed", "E-mailcampagne afgerond"],
    ],
  },
  {
    title: "Reviews",
    description: "Reviews op je Google Bedrijfsprofiel.",
    events: [
      ["new_review", "Nieuwe review"],
      ["negative_review", "Negatieve review"],
      ["review_reply_ready", "Reviewantwoord klaar"],
    ],
  },
  {
    title: "Koppelingen en beveiliging",
    description: "Problemen die je aandacht nodig hebben.",
    events: [
      ["integration_disconnected", "Koppeling verbroken of verlopen"],
      ["security_alert", "Beveiligingsmelding"],
    ],
  },
];
const CHANNEL_LABEL: Record<string, string> = { IN_APP: "In Mavix", EMAIL: "E-mail", SMS: "Sms" };

export default function NotificationsPage() {
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [channels, setChannels] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/notifications", { cache: "no-store" });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.error || "Meldingen konden niet worden geladen.");
    setPreferences(b.preferences);
    setNotices(b.notifications);
    setChannels(b.channels);
    setLoaded(true);
  }, []);
  useEffect(() => {
    load().catch((e) => {
      setMessage(e.message);
      setLoaded(true);
    });
  }, [load]);
  async function update(key: string, body: unknown) {
    setBusy(key);
    setMessage("");
    try {
      const r = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error || "Opslaan is niet gelukt.");
      await load();
      setMessage("Opgeslagen.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Opslaan is niet gelukt.");
    } finally {
      setBusy("");
    }
  }
  // Only channels the server reports as available are shown as switches.
  const usable = notificationChannels.filter((c) => channels[c] === "available" || channels[c] === "configured");
  const unread = notices.filter((n) => !n.read_at).length;
  return (
    <>
      <PageHeading eyebrow="Persoonlijk" title="Meldingen" description="Kies waarover je bericht wilt krijgen en waar." />
      <section className="panel account-panel">
        <div className="section-heading">
          <div>
            <h2>
              <Bell size={18} aria-hidden="true" /> Recente meldingen
            </h2>
            <p>{unread ? `${unread} ongelezen` : "Je bent helemaal bij."}</p>
          </div>
          {unread > 0 && (
            <button type="button" disabled={!!busy} className="button secondary" onClick={() => update("read-all", { action: "read" })}>
              <CheckCheck size={15} /> Alles gelezen
            </button>
          )}
        </div>
        <div className="account-panel-body">
          {!loaded ? (
            <p className="field-note" role="status">
              Laden…
            </p>
          ) : notices.length === 0 ? (
            <p className="field-note">Je hebt nog geen meldingen.</p>
          ) : (
            <ul className="st-notices">
              {notices.map((n) => (
                <li key={n.id} className={n.read_at ? "" : "is-unread"}>
                  <div>
                    <strong>{n.title}</strong>
                    <p>{n.body}</p>
                  </div>
                  {!n.read_at && (
                    <button type="button" disabled={!!busy} className="text-button" onClick={() => update("read-" + n.id, { action: "read", id: n.id })}>
                      Gelezen
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      {GROUPS.map((g) => (
        <section className="panel account-panel" key={g.title}>
          <div className="section-heading">
            <div>
              <h2>{g.title}</h2>
              <p>{g.description}</p>
            </div>
          </div>
          <div className="account-panel-body st-pref-table">
            {g.events.map(([event, label]) => (
              <div className="st-pref-row" key={event}>
                <span className="st-pref-label">{label}</span>
                <span className="st-pref-switches">
                  {usable.map((channel) => {
                    const on = preferences.some((p) => p.event_type === event && p.channel === channel && p.enabled);
                    const key = event + channel;
                    return (
                      <label key={channel} className="st-switch">
                        <input
                          type="checkbox"
                          role="switch"
                          disabled={!!busy}
                          checked={on}
                          onChange={(e) => update(key, { action: "preference", event_type: event, channel, enabled: e.target.checked })}
                        />
                        <span className="st-switch-track" aria-hidden="true" />
                        <span>{CHANNEL_LABEL[channel] || channel}</span>
                      </label>
                    );
                  })}
                  {!usable.length && loaded && <small className="field-note">Nog geen meldingskanalen beschikbaar.</small>}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
      <p role="status" className="st-feedback">
        {message}
      </p>
    </>
  );
}
