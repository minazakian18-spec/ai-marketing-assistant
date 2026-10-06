"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, X } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";
import { IconButton } from "@/components/ui";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { isBrowserDemo } from "@/lib/demo";

// Shape of GET /api/integrations/google_calendar/status.
type Status = {
  status: string;
  connected: boolean;
  accountEmail: string | null;
  mine?: boolean;
};
type View =
  | { kind: "loading" }
  | { kind: "load-error"; message: string }
  | { kind: "disconnected" }
  | { kind: "connected"; email: string }
  | { kind: "team" }
  | { kind: "reconnect"; reason: "expired" | "permission" | "other"; email: string | null };

const BASE = "/api/integrations/google_calendar/";
const RIGHTS = ["Je Google-account herkennen (e-mailadres)", "Je lijst met agenda's bekijken", "Afspraken bekijken, maken, wijzigen en verwijderen"];

function viewOf(s: Status): View {
  if (s.status === "disconnected") return { kind: "disconnected" };
  if (s.connected) return { kind: "connected", email: s.accountEmail || "" };
  if (s.status === "connected" && s.mine === false) return { kind: "team" };
  return {
    kind: "reconnect",
    reason: s.status === "reconnect_required" ? "expired" : s.status === "permission_missing" ? "permission" : "other",
    email: s.accountEmail,
  };
}

async function request<T>(path: string, method: "GET" | "POST" = "GET"): Promise<T> {
  const r = await fetch(BASE + path, method === "POST" ? { method, headers: { "Content-Type": "application/json" }, body: "{}" } : { cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Er ging iets mis. Probeer het opnieuw.");
  return d as T;
}

// Google Calendar has its own backend (calendar-oauth.ts), so it gets its own
// row with real states instead of the generic integration row.
export function GoogleCalendarCard({ demo, onNotice }: { demo: boolean; onNotice: (message: string) => void }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");
  const [manage, setManage] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    try {
      setView(viewOf(await request<Status>("status")));
    } catch (e) {
      setView({ kind: "load-error", message: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    // The page learns about test mode after mount, so check the cookie here too.
    if (isBrowserDemo()) setView({ kind: "disconnected" });
    else void load();
  }, [load]);

  async function connect() {
    setConnecting(true);
    setError("");
    try {
      const { url } = await request<{ url: string }>("connect", "POST");
      window.location.assign(url); // Google consent; the callback returns to /calendar.
    } catch (e) {
      setError((e as Error).message);
      setConnecting(false);
    }
  }

  async function disconnect() {
    setConfirm(false);
    setDisconnecting(true);
    setError("");
    try {
      await request("disconnect", "POST");
      setManage(false);
      setView({ kind: "disconnected" });
      onNotice("Google Agenda is ontkoppeld. Je afspraken in Google blijven bestaan.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDisconnecting(false);
    }
  }

  const busy = connecting || disconnecting;
  const linked = view.kind === "connected" || view.kind === "team" || view.kind === "reconnect";
  const state =
    view.kind === "connected"
      ? { cls: "connected", text: "Verbonden" }
      : view.kind === "team"
        ? { cls: "selection", text: "Teamlid" }
        : view.kind === "reconnect"
          ? { cls: view.reason === "permission" ? "permission" : "reconnect", text: view.reason === "permission" ? "Toestemming nodig" : view.reason === "expired" ? "Verlopen" : "Fout bij koppeling" }
          : view.kind === "load-error"
            ? { cls: "error", text: "Niet beschikbaar" }
            : view.kind === "loading"
              ? { cls: "loading", text: "Laden…" }
              : { cls: "disconnected", text: "Niet verbonden" };

  const description =
    view.kind === "connected"
      ? "Je afspraken staan naast je Mavix-planning in de Kalender."
      : view.kind === "team"
        ? "Gekoppeld door een teamlid. Die agenda is privé en alleen voor diegene zichtbaar."
        : view.kind === "reconnect"
          ? view.reason === "expired"
            ? "De koppeling is verlopen of ingetrokken. Koppel opnieuw om je afspraken weer te zien."
            : view.reason === "permission"
              ? "Mavix mist toegang tot je agenda's. Koppel opnieuw en sta alle gevraagde toegang toe."
              : "Er is een probleem met de koppeling. Koppel opnieuw."
          : view.kind === "load-error"
            ? view.message
            : "Synchroniseer je afspraken met Mavix.";

  const connectButton = (label: string, primary = true) => (
    <button type="button" className={"button " + (primary ? "primary" : "secondary")} disabled={demo || busy || view.kind === "loading"} onClick={() => void connect()}>
      {connecting ? <Loader2 size={14} className="int-spin" aria-hidden="true" /> : null}
      {connecting ? "Doorsturen…" : label}
    </button>
  );

  return (
    <li className="int-row int-gc" aria-busy={view.kind === "loading" || busy}>
      <span className="int-logo">
        <BrandIcon brand="google_calendar" size={24} />
      </span>
      <div className="int-info">
        <strong>Google Agenda</strong>
        <p className={view.kind === "reconnect" || view.kind === "load-error" ? "int-warn" : undefined}>{description}</p>
        {(view.kind === "connected" || (view.kind === "reconnect" && view.email)) && <small>{view.email}</small>}
        {error && !manage && (
          <p role="alert" className="int-error int-inline-error">
            {error}
          </p>
        )}
      </div>
      <span className={"int-state is-" + state.cls}>{state.text}</span>
      <div className="int-actions">
        {view.kind === "loading" ? (
          <span className="int-skeleton" aria-hidden="true" />
        ) : view.kind === "load-error" ? (
          <button type="button" className="button secondary" onClick={() => void load()}>
            <RefreshCw size={14} aria-hidden="true" />
            Opnieuw proberen
          </button>
        ) : view.kind === "connected" ? (
          <>
            <button type="button" className="button secondary" onClick={() => setManage(true)} disabled={busy}>
              Beheren
            </button>
            <button type="button" className="button danger-text" onClick={() => setConfirm(true)} disabled={busy}>
              {disconnecting ? "Ontkoppelen…" : "Ontkoppelen"}
            </button>
          </>
        ) : view.kind === "team" ? (
          <button type="button" className="button secondary" onClick={() => setManage(true)} disabled={busy}>
            Beheren
          </button>
        ) : view.kind === "reconnect" ? (
          connectButton("Opnieuw koppelen")
        ) : (
          connectButton("Koppelen")
        )}
      </div>

      {manage && linked && (
        <>
          <div className="int-scrim" onClick={() => setManage(false)} aria-hidden="true" />
          <div className="int-modal" role="dialog" aria-modal="true" aria-labelledby="gc-modal-title">
            <header>
              <BrandIcon brand="google_calendar" size={26} />
              <div>
                <h2 id="gc-modal-title">Google Agenda</h2>
                <span className={"int-state is-" + state.cls}>{state.text}</span>
              </div>
              <IconButton label="Sluiten" onClick={() => setManage(false)}>
                <X size={16} />
              </IconButton>
            </header>
            <div className="int-modal-body">
              {error && (
                <p role="alert" className="int-error">
                  {error}
                </p>
              )}
              <dl className="int-details">
                <dt>Account</dt>
                <dd>{view.kind === "connected" ? view.email : view.kind === "reconnect" ? view.email || "—" : "Privé (teamlid)"}</dd>
                <dt>Status</dt>
                <dd>{state.text}</dd>
                <dt>Rechten</dt>
                <dd>
                  <ul className="int-scopes">
                    {RIGHTS.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </dd>
              </dl>
              {view.kind === "connected" ? (
                <p className="int-hint">
                  Kies in de <Link href="/calendar">Kalender</Link> welke agenda&apos;s je wilt zien en of geplande Mavix-content ook in Google Agenda komt.
                </p>
              ) : view.kind === "team" ? (
                <p className="int-hint">Alleen het teamlid dat Google Agenda heeft gekoppeld ziet deze afspraken. Koppel je eigen account om die koppeling te vervangen.</p>
              ) : (
                <p className="int-hint">{description}</p>
              )}
              <p className="int-hint">Ontkoppelen verwijdert de opgeslagen toegang in Mavix. Afspraken in Google Agenda worden niet verwijderd.</p>
            </div>
            <footer>
              <button type="button" className="button danger-text" onClick={() => setConfirm(true)} disabled={busy}>
                {disconnecting ? "Ontkoppelen…" : "Ontkoppelen"}
              </button>
              {connectButton(view.kind === "team" ? "Eigen account koppelen" : "Opnieuw koppelen", view.kind !== "connected")}
            </footer>
          </div>
        </>
      )}

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Google Agenda ontkoppelen?" confirmLabel="Ontkoppelen" danger onConfirm={() => void disconnect()}>
        <p>Mavix stopt met synchroniseren en verwijdert de opgeslagen toegang. Je afspraken in Google Agenda blijven gewoon bestaan. Je kunt later opnieuw koppelen.</p>
      </ConfirmDialog>
    </li>
  );
}
