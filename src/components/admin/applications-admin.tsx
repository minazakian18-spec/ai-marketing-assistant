"use client";
import { PLAN_IDS, PLANS } from "@/lib/plans";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui";
import { ACTION_LABEL, PAYMENT_LABEL, STATUS_LABEL, allowedActions, type AdminAction, type ApplicationStatus, type PaymentStatus } from "@/lib/applications";

// Demo requests and account applications for Mavix staff. Shows only the
// actions the server will accept (src/lib/applications.ts); the server checks
// them again, so a modified request cannot skip a step.

type Event = { from_status: string | null; to_status: string; note: string | null; created_at: string };
type Application = {
  id: string;
  status: ApplicationStatus;
  payment_status: PaymentStatus;
  demo_completed_at: string | null;
  name: string;
  email: string;
  company: string;
  phone: string | null;
  website: string | null;
  industry: string | null;
  plan: string | null;
  message: string | null;
  preferred_time: string | null;
  rejection_reason: string | null;
  created_at: string;
  events: Event[];
};

const TONE: Record<ApplicationStatus, "warn" | "success" | "neutral" | "accent"> = {
  demo_requested: "accent",
  demo_completed: "accent",
  application_pending: "warn",
  awaiting_payment: "warn",
  payment_confirmed: "accent",
  active: "success",
  rejected: "neutral",
  suspended: "neutral",
};
const PLAN: Record<string, string> = Object.fromEntries(PLAN_IDS.map((id) => [id, PLANS[id].name]));
const date = (iso: string) => new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const CONFIRM: Partial<Record<AdminAction, string>> = {
  approve: "Aanvraag goedkeuren? De klant krijgt (als e-mail is ingesteld) een bericht om een account aan te maken.",
  confirm_payment_manually: "Bevestig je dat de betaling buiten Mavix is ontvangen? Dit wordt vastgelegd.",
  waive_payment: "Deze klant zonder online betaling verder laten gaan (pilot of handmatige factuur)? Dit wordt vastgelegd.",
  activate: "Account activeren? De werkruimte van deze klant krijgt toegang tot Mavix.",
  suspend: "Toegang van deze klant pauzeren?",
};

export function ApplicationsAdmin() {
  const [rows, setRows] = useState<Application[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/applications", { cache: "no-store" });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(r.status === 403 ? "" : body.error || "Aanvragen konden niet worden geladen.");
      setRows([]);
      return;
    }
    setRows(body.applications);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(app: Application, action: AdminAction) {
    let reason: string | undefined;
    if (action === "reject") {
      const r = window.prompt("Reden van afwijzing (optioneel, wordt naar de klant gestuurd):", "");
      if (r === null) return;
      reason = r.trim() || undefined;
    } else if (CONFIRM[action] && !window.confirm(CONFIRM[action])) return;
    setBusy(app.id);
    setError("");
    const r = await fetch("/api/admin/applications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: app.id, action, reason }) });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) setError(body.error || "Opslaan is niet gelukt.");
    await load();
    setBusy("");
  }

  if (rows === null) return <div className="admin-skeleton" aria-busy="true" aria-label="Aanvragen laden" />;
  const waiting = rows.filter((r) => ["demo_requested", "application_pending", "payment_confirmed"].includes(r.status)).length;
  return (
    <section className="ui-card admin-card">
      <header className="admin-card-head">
        <h2>Demo&apos;s en aanvragen</h2>
        {waiting > 0 && <Badge tone="warn">{waiting} vraagt actie</Badge>}
      </header>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!rows.length ? (
        <p className="admin-empty">Nog geen demo-aanvragen of accountaanvragen.</p>
      ) : (
        <div className="admin-table" role="table" aria-label="Aanvragen">
          <div className="admin-row admin-row-head" role="row">
            <span role="columnheader">Aanvrager</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Pakket en betaling</span>
            <span role="columnheader">Acties</span>
          </div>
          {rows.map((a) => (
            <div key={a.id} className="admin-app">
              <div className="admin-row" role="row">
                <span role="cell" className="admin-name">
                  <strong>{a.company}</strong>
                  <small>
                    {a.name} · {a.email} · {date(a.created_at)}
                  </small>
                </span>
                <span role="cell">
                  <Badge tone={TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                  {a.demo_completed_at && a.status === "application_pending" && <small className="admin-sub">Demo gehouden</small>}
                </span>
                <span role="cell" className="admin-name">
                  <strong>{a.plan ? PLAN[a.plan] : "Geen pakket gekozen"}</strong>
                  <small>Betaling: {PAYMENT_LABEL[a.payment_status]}</small>
                </span>
                <span role="cell" className="admin-actions">
                  {allowedActions(a).map((action) => (
                    <button
                      key={action}
                      type="button"
                      className={"button" + (action === "reject" || action === "suspend" ? " secondary" : "")}
                      disabled={busy === a.id}
                      onClick={() => void act(a, action)}
                    >
                      {ACTION_LABEL[action]}
                    </button>
                  ))}
                  <button type="button" className="button secondary" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>
                    {open === a.id ? "Sluiten" : "Details"}
                  </button>
                </span>
              </div>
              {open === a.id && (
                <div className="admin-app-detail">
                  <dl>
                    {a.phone && (
                      <>
                        <dt>Telefoon</dt>
                        <dd>{a.phone}</dd>
                      </>
                    )}
                    {a.website && (
                      <>
                        <dt>Website</dt>
                        <dd>{a.website}</dd>
                      </>
                    )}
                    {a.industry && (
                      <>
                        <dt>Branche</dt>
                        <dd>{a.industry}</dd>
                      </>
                    )}
                    {a.preferred_time && (
                      <>
                        <dt>Voorkeur demo</dt>
                        <dd>{a.preferred_time}</dd>
                      </>
                    )}
                    {a.message && (
                      <>
                        <dt>Toelichting</dt>
                        <dd>{a.message}</dd>
                      </>
                    )}
                    {a.rejection_reason && (
                      <>
                        <dt>Reden afwijzing</dt>
                        <dd>{a.rejection_reason}</dd>
                      </>
                    )}
                  </dl>
                  <h3>Geschiedenis</h3>
                  <ol className="admin-history">
                    {a.events.map((e, i) => (
                      <li key={i}>
                        <time>{date(e.created_at)}</time>{" "}
                        {e.to_status === "email" ? e.note : `${e.from_status ? STATUS_LABEL[e.from_status as ApplicationStatus] + " → " : ""}${STATUS_LABEL[e.to_status as ApplicationStatus] || e.to_status}${e.note ? " · " + e.note : ""}`}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
