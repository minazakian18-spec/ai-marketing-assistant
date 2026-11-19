"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Loader2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import type { ReviewAutoReplySettings } from "@/lib/review-model";
import type { WorkflowStatus } from "@/lib/automation";

// Automatic replies on real Google reviews. One switch, explained plainly:
// positive reviews (from the chosen number of stars) get a reply in the
// owner's tone; 1-3 stars, complaints and sensitive topics always wait for
// the owner. The switch is the server-side permission (automation_permissions,
// confirmed here); the rules are the review settings in the workspace.

type Run = { at: string; status: "ok" | "failed" | "skipped"; detail?: string };
const WORKFLOW = "review_auto_reply";

export function ReviewAutoReplyLive({ settings, onChange }: { settings: ReviewAutoReplySettings; onChange: (s: ReviewAutoReplySettings) => Promise<void> | void }) {
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [role, setRole] = useState("MEMBER");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  async function load() {
    const r = await fetch("/api/automation", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "De status kon niet worden geladen.");
    setStatus((d.workflows as WorkflowStatus[]).find((w) => w.id === WORKFLOW) || null);
    setRole(d.role);
  }
  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, []);

  async function toggle() {
    setConfirm(false);
    setBusy(true);
    setError("");
    const r = await fetch("/api/automation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workflow: WORKFLOW, enabled: !status?.configured, confirm: true }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(d.error || "Wijzigen is niet gelukt.");
    setStatus((d.workflows as WorkflowStatus[]).find((w) => w.id === WORKFLOW) || null);
  }

  async function setMin(autoPublishMinRating: number) {
    setSaved("");
    await onChange({ ...settings, autoPublishMinRating, enabled: true, mode: "auto" });
    setSaved("Opgeslagen.");
  }

  const on = !!status?.configured;
  const running = status?.state === "running";
  const canSwitch = role === "OWNER" || role === "ADMIN";
  const lastRun = status?.lastRun as Run | null | undefined;

  return (
    <section className="rvl-auto" aria-labelledby="rvl-auto-title">
      <div className="ui-card rvl-auto-card">
        <div className="rvl-auto-head">
          <span className="rvl-auto-icon" aria-hidden="true">
            <Sparkles size={20} />
          </span>
          <div>
            <h2 id="rvl-auto-title">Reviews automatisch beantwoorden</h2>
            <p>Mavix beantwoordt nieuwe positieve reviews vanzelf, in jouw toon, zonder dat je hoeft te klikken. Klachten en lage scores blijven altijd bij jou.</p>
          </div>
          <span className={"rvl-auto-state" + (running ? " is-on" : on ? " is-waiting" : "")}>{!status ? "Laden…" : running ? "Actief" : on ? "Wacht op koppeling" : "Uit"}</span>
        </div>

        <div className="rvl-auto-rules">
          <fieldset>
            <legend>Automatisch antwoorden vanaf</legend>
            <div className="rvl-auto-stars" role="radiogroup" aria-label="Minimale score voor een automatisch antwoord">
              {[4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={settings.autoPublishMinRating === n} onClick={() => void setMin(n)}>
                  {n === 4 ? "4 en 5 sterren" : "Alleen 5 sterren"}
                </button>
              ))}
            </div>
            {saved && <small role="status">{saved}</small>}
          </fieldset>
          <ul className="rvl-auto-guard" aria-label="Wat Mavix nooit zelf doet">
            <li>
              <ShieldCheck size={14} aria-hidden="true" /> 1 tot 3 sterren: altijd jij.
            </li>
            <li>
              <ShieldCheck size={14} aria-hidden="true" /> Klachten, allergieën, gezondheid, geld terug en andere gevoelige onderwerpen: altijd jij.
            </li>
            <li>
              <ShieldCheck size={14} aria-hidden="true" /> Reviews die al een antwoord hebben worden overgeslagen.
            </li>
          </ul>
          <p className="rvl-auto-tone">
            Toon en ondertekening: <Link href="/reviews?tab=settings">instellingen</Link>. Mavix gebruikt je Brand Hub voor de bedrijfsnaam en merkstem.
          </p>
        </div>

        {status && (
          <ul className="au-reqs rvl-auto-reqs" aria-label="Voorwaarden">
            {status.requirements.map((r) => (
              <li key={r.label} className={r.met ? "is-met" : ""}>
                {r.met ? <CheckCircle2 size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
                {r.label}
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="rvl-error">
            {error}
          </p>
        )}
        <div className="rvl-auto-bar">
          <small>
            {lastRun ? `Laatst: ${new Date(lastRun.at).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" })} · ${lastRun.status === "ok" ? "beantwoord" : lastRun.status === "failed" ? "mislukt" : "aan jou gelaten"}${lastRun.detail ? " · " + lastRun.detail : ""}` : "Nog geen automatische antwoorden."}
          </small>
          {canSwitch ? (
            <button type="button" className={"button " + (on ? "secondary" : "primary")} disabled={busy || !status} onClick={() => setConfirm(true)}>
              {busy ? <Loader2 size={14} className="int-spin" aria-hidden="true" /> : <Zap size={14} aria-hidden="true" />}
              {on ? "Uitzetten" : "Aanzetten"}
            </button>
          ) : (
            <small>Alleen een eigenaar of beheerder kan dit aan- of uitzetten.</small>
          )}
        </div>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={on ? "Automatisch beantwoorden uitzetten?" : "Reviews automatisch laten beantwoorden?"} confirmLabel={on ? "Uitzetten" : "Aanzetten"} onConfirm={() => void toggle()}>
        {on
          ? "Mavix plaatst daarna geen antwoorden meer uit zichzelf. Je kunt reviews nog steeds zelf beantwoorden, met of zonder voorstel van Mavix."
          : `Mavix plaatst vanaf nu zelf een antwoord op nieuwe reviews met ${settings.autoPublishMinRating === 5 ? "5 sterren" : "4 of 5 sterren"} zonder gevoelige inhoud. Die antwoorden staan direct op Google. Lagere scores en klachten blijven voor jou. Je kunt dit altijd weer uitzetten.`}
      </ConfirmDialog>
    </section>
  );
}
