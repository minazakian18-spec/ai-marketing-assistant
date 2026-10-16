"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Zap } from "lucide-react";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { isBrowserDemo } from "@/lib/demo";
import { WORKFLOWS, type WorkflowStatus } from "@/lib/automation";
import "./automation.css";

// What really runs, per module: preference vs. explicit permission,
// requirements, approvals waiting, last run and failures (GET /api/automation).
// Automatic workflows only start after an explicit confirmation here.

const STATE: Record<WorkflowStatus["state"], string> = {
  off: "Uit",
  preference_only: "Alleen voorkeur",
  waiting: "Wacht op koppeling",
  running: "Actief",
  not_available: "Nog niet beschikbaar",
};

export function AutomationPanel({ module }: { module: "social" | "email" | "reviews" }) {
  const demo = isBrowserDemo();
  const [list, setList] = useState<WorkflowStatus[] | null>(null);
  const [role, setRole] = useState("MEMBER");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<WorkflowStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (demo) return;
    fetch("/api/automation", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "De automatiseringen konden niet worden geladen.");
        setList(d.workflows);
        setRole(d.role);
      })
      .catch((e) => setError((e as Error).message));
  }, [demo]);

  async function toggle(w: WorkflowStatus) {
    setConfirm(null);
    setBusy(true);
    setError("");
    const r = await fetch("/api/automation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workflow: w.id, enabled: !w.configured, confirm: true }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(d.error || "Wijzigen is niet gelukt.");
    setList(d.workflows);
  }

  const mine = (list || []).filter((w) => w.module === module);
  return (
    <section className="au-panel" aria-labelledby={"au-" + module}>
      <h2 id={"au-" + module}>
        <Zap size={16} aria-hidden="true" /> Wat draait er echt?
      </h2>
      <p className="au-intro">Je instellingen hieronder zijn voorkeuren. Mavix handelt alleen zelfstandig als je dat hier uitdrukkelijk toestaat en de koppeling het toelaat.</p>
      {demo ? (
        <ul className="au-list">
          {WORKFLOWS.filter((w) => w.module === module).map((w) => (
            <li key={w.id} className="au-item">
              <div className="au-item-head">
                <strong>{w.label}</strong>
                <span className="au-state is-off">Testmodus</span>
              </div>
              <p>{w.description}</p>
            </li>
          ))}
        </ul>
      ) : error && !list ? (
        <p className="cs-error" role="alert">
          {error}
        </p>
      ) : !list ? (
        <p role="status" className="au-intro">
          Status laden…
        </p>
      ) : (
        <ul className="au-list">
          {mine.map((w) => (
            <li key={w.id} className="au-item">
              <div className="au-item-head">
                <strong>{w.label}</strong>
                <span className={"au-state is-" + w.state}>{STATE[w.state]}</span>
              </div>
              <p>{w.description}</p>
              <p className="au-explain">{w.explanation}</p>
              <ul className="au-reqs" aria-label="Voorwaarden">
                {w.requirements.map((r) => (
                  <li key={r.label} className={r.met ? "is-met" : ""}>
                    {r.met ? <CheckCircle2 size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
                    {r.label}
                    <span className="sr-only">{r.met ? " (in orde)" : " (nog niet)"}</span>
                  </li>
                ))}
              </ul>
              <p className="au-meta">
                {w.pendingApprovals > 0 && <span>{w.pendingApprovals} wachten op goedkeuring</span>}
                <span>{w.lastRun ? `Laatst: ${new Date(w.lastRun.at).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" })} · ${w.lastRun.status === "ok" ? "gelukt" : w.lastRun.status === "failed" ? "mislukt" : "overgeslagen"}${w.lastRun.detail ? " · " + w.lastRun.detail : ""}` : "Nog niet uitgevoerd"}</span>
                {w.recentFailures > 0 && <span className="au-fail">{w.recentFailures} mislukt in de afgelopen 7 dagen</span>}
              </p>
              {w.permission && w.runnable && (role === "OWNER" || role === "ADMIN") && (
                <button type="button" className={"button " + (w.configured ? "secondary" : "primary")} disabled={busy} onClick={() => setConfirm(w)}>
                  {w.configured ? "Toestemming intrekken" : "Toestemming geven"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && list && (
        <p className="cs-error" role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.configured ? "Toestemming intrekken?" : "Mavix toestemming geven?"}
        confirmLabel={confirm?.configured ? "Intrekken" : "Toestemming geven"}
        onConfirm={() => confirm && void toggle(confirm)}
      >
        {confirm?.configured
          ? "Mavix doet dit daarna niet meer zelfstandig. Je kunt alles nog steeds met de hand doen."
          : `${confirm?.label}: ${confirm?.description} Alleen goedgekeurde items worden meegenomen, en elke actie wordt vastgelegd. Je kunt dit altijd weer uitzetten.`}
      </ConfirmDialog>
    </section>
  );
}
