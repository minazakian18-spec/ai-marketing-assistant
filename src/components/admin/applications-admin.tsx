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
  demo_scheduled_at?: string | null;
  demo_note?: string | null;
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
  const [plan, setPlan] = useState<{ at: string; note: string }>({ at: "", note: "" });
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

  // datetime-local works in local time; the server stores an ISO moment.
  const localValue = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  async function schedule(app: Application, clear = false) {
    if (!clear && !plan.at) return setError("Kies een datum en tijd voor de demo.");
    setBusy(app.id);
    setError("");
    const r = await fetch("/api/admin/applications/demo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: app.id, demoAt: clear ? null : new Date(plan.at).toISOString(), demoNote: clear ? "" : plan.note }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) setError(body.error || "De demo kon niet worden opgeslagen.");
    await load();
    setBusy("");
  }
  function toggle(a: Application) {
    setOpen(open === a.id ? null : a.id);
    setPlan({ at: localValue(a.demo_scheduled_at), note: a.demo_note || "" });
  }

  if (rows === null) return <div className="admin-skeleton" aria-busy="true" aria-label="Aanvragen laden" />;
  const upcoming = rows.filter((r) => r.demo_scheduled_at && new Date(r.demo_scheduled_at).getTime() > Date.now() - 3600000 && !r.demo_completed_at).sort((a, b) => a.demo_scheduled_at!.localeCompare(b.demo_scheduled_at!));
  const waiting = rows.filter((r) => ["demo_requested", "application_pending", "payment_confirmed"].includes(r.status)).length;
  return (
    <section className="ui-card admin-card">
      <header className="admin-card-head">
        <h2>Demo&apos;s en aanvragen</h2>
        {waiting > 0 && <Badge tone="warn">{waiting} vraagt actie</Badge>}
      </header>
      {upcoming.length > 0 && (
        <ul className="adm-demos" aria-label="Geplande demo&apos;s">
          {upcoming.map((a) => (
            <li key={a.id}>
              <span className="adm-demo-date">
                <strong>{new Date(a.demo_scheduled_at!).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</strong>
                <small>{new Date(a.demo_scheduled_at!).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}</small>
              </span>
              <span>
                <strong>{a.company}</strong>
                <small>
                  {a.name}
                  {a.demo_note ? " · " + a.demo_note : ""}
                </small>
              </span>
              <button type="button" className="button secondary" onClick={() => toggle(a)}>
                Openen
              </button>
            </li>
          ))}
        </ul>
      )}
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
                  {a.demo_scheduled_at && !a.demo_completed_at && <small className="admin-sub">Demo: {date(a.demo_scheduled_at)}</small>}
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
                  <button type="button" className="button secondary" onClick={() => toggle(a)} aria-expanded={open === a.id}>
                    {open === a.id ? "Sluiten" : "Details en demo"}
                  </button>
                </span>
              </div>
              {open === a.id && (
                <div className="admin-app-detail">
                  {!a.demo_completed_at && (
                    <form
                      className="adm-demo-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void schedule(a);
                      }}
                    >
                      <h3>Demo plannen</h3>
                      <label>
                        Datum en tijd
                        <input type="datetime-local" value={plan.at} onChange={(e) => setPlan({ ...plan, at: e.target.value })} required />
                      </label>
                      <label>
                        Notitie (bijvoorbeeld videolink of adres)
                        <input value={plan.note} maxLength={1000} onChange={(e) => setPlan({ ...plan, note: e.target.value })} placeholder="https://meet.google.com/…" />
                      </label>
                      <span className="adm-demo-actions">
                        <button type="submit" className="button primary" disabled={busy === a.id}>
                          {a.demo_scheduled_at ? "Demo verzetten" : "Demo inplannen"}
                        </button>
                        {a.demo_scheduled_at && (
                          <button type="button" className="button secondary" disabled={busy === a.id} onClick={() => void schedule(a, true)}>
                            Afspraak verwijderen
                          </button>
                        )}
                      </span>
                    </form>
                  )}
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
                        {e.to_status === "email" || e.to_status === "demo_scheduled" ? e.note : `${e.from_status ? STATUS_LABEL[e.from_status as ApplicationStatus] + " → " : ""}${STATUS_LABEL[e.to_status as ApplicationStatus] || e.to_status}${e.note ? " · " + e.note : ""}`}
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
