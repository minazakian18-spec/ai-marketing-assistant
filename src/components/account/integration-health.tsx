"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Plug } from "lucide-react";
import { isBrowserDemo } from "@/lib/demo";
import type { Health } from "@/lib/integration-health";

// One line per provider: the real state, who has to act, and one next step.
const ICON: Record<Health["status"], typeof Clock> = { connected: CheckCircle2, limited: AlertTriangle, action: AlertTriangle, reconnect: AlertTriangle, waiting: Clock, not_configured: Clock, coming_soon: Clock, not_connected: Plug };
const ATTENTION: Health["status"][] = ["limited", "action", "reconnect"];

export function IntegrationHealth() {
  const [list, setList] = useState<Health[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (isBrowserDemo()) return;
    fetch("/api/integrations/health", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "De status kon niet worden geladen.");
        setList(d.health);
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  if (isBrowserDemo()) return null;
  if (error) return <p className="int-hint" role="alert">{error}</p>;
  if (!list) return null;
  const attention = list.filter((h) => ATTENTION.includes(h.status));
  return (
    <section className="ih" aria-labelledby="ih-title">
      <h2 id="ih-title">Status van je koppelingen</h2>
      <p className="ih-sub">{attention.length ? `${attention.length} ${attention.length === 1 ? "koppeling vraagt" : "koppelingen vragen"} jouw aandacht.` : "Alles wat gekoppeld is, werkt."}</p>
      <ul className="ih-list">
        {list.map((h) => {
          const Icon = ICON[h.status];
          return (
            <li key={h.provider} className={"ih-item is-" + h.state + " st-" + h.status}>
              <Icon size={16} aria-hidden="true" />
              <div>
                <strong>
                  {h.label} <em className={"ih-status st-" + h.status}>{h.statusLabel}</em>
                </strong>
                <span>{h.summary}</span>
                {h.actor === "mavix" && <small>Dit regelt Mavix; jij hoeft niets te doen.</small>}
                {h.extras.length > 0 && (
                  <small>
                    {h.extras.map((x) => `${x.label}: ${x.granted ? "toegestaan" : "nog niet (" + x.note + ")"}`).join(" · ")}
                  </small>
                )}
                {h.lastSyncedAt && <small>Laatst bijgewerkt: {new Date(h.lastSyncedAt).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" })}</small>}
              </div>
              {h.next && h.state !== "not_connected" && (
                <Link className="button secondary" href={h.next.href}>
                  {h.next.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
