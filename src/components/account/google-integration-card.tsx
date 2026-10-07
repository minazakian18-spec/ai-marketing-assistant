"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, X } from "lucide-react";
import { BrandIcon, type Brand } from "@/components/brand-icon";
import { IconButton } from "@/components/ui";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { isBrowserDemo } from "@/lib/demo";

// Shape of GET /api/integrations/{google_calendar|gmail}/status.
type Status = {
  status: string;
  connected: boolean;
  accountEmail: string | null;
  mine?: boolean;
  lastSyncedAt?: string | null;
};
type View =
  | { kind: "loading" }
  | { kind: "load-error"; message: string }
  | { kind: "disconnected" }
  | { kind: "connected"; email: string; lastSyncedAt?: string | null }
  | { kind: "team" }
  | { kind: "reconnect"; reason: "expired" | "permission" | "other"; email: string | null };

export type GoogleCardConfig = {
  provider: "google_calendar" | "gmail";
  brand: Brand;
  name: string;
  rights: string[];
  copy: {
    disconnected: string;
    connected: string;
    expired: string;
    permission: string;
    team?: string;
    disconnect: string;
  };
  /** Extra guidance in the Beheren dialog for a working connection. */
  manageHint: ReactNode;
};

export const CALENDAR_CARD: GoogleCardConfig = {
  provider: "google_calendar",
  brand: "google_calendar",
  name: "Google Agenda",
  rights: ["Je Google-account herkennen (e-mailadres)", "Je lijst met agenda's bekijken", "Afspraken bekijken, maken, wijzigen en verwijderen"],
  copy: {
    disconnected: "Synchroniseer je afspraken met Mavix.",
    connected: "Je afspraken staan naast je Mavix-planning in de Kalender.",
    expired: "De koppeling is verlopen of ingetrokken. Koppel opnieuw om je afspraken weer te zien.",
    permission: "Mavix mist toegang tot je agenda's. Koppel opnieuw en sta alle gevraagde toegang toe.",
    team: "Gekoppeld door een teamlid. Die agenda is privé en alleen voor diegene zichtbaar.",
    disconnect:
      "Mavix stopt met synchroniseren en verwijdert de opgeslagen toegang. Je afspraken in Google Agenda blijven gewoon bestaan. Je kunt later opnieuw koppelen.",
  },
  manageHint: (
    <>
      Kies in de <Link href="/calendar">Kalender</Link> welke agenda&apos;s je wilt zien en of geplande Mavix-content ook in Google Agenda komt.
    </>
  ),
};

export const GMAIL_CARD: GoogleCardConfig = {
  provider: "gmail",
  brand: "gmail",
  name: "Gmail",
  rights: ["Je Google-account herkennen (e-mailadres)", "E-mails lezen voor je Inbox", "E-mails versturen namens jou"],
  copy: {
    disconnected: "Beheer je klantmails rechtstreeks vanuit Mavix.",
    connected: "Klantmails komen binnen in je Inbox en je antwoordt vanuit Mavix.",
    expired: "Je Gmail-koppeling is verlopen.",
    permission: "Mavix mist toegang tot Gmail. Koppel opnieuw en sta lezen en versturen toe.",
    disconnect:
      "Mavix stopt met synchroniseren en verwijdert de opgeslagen toegang. Je e-mails in Gmail blijven gewoon bestaan. Google Agenda en inloggen met Google blijven werken.",
  },
  manageHint: (
    <>
      Je e-mails staan in de <Link href="/inbox">Inbox</Link> onder E-mail. Mavix haalt nieuwe e-mail ongeveer elke minuut op zolang de Inbox open is (geen realtime).
    </>
  ),
};

const dateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Nog niet";

function viewOf(s: Status): View {
  if (s.status === "disconnected") return { kind: "disconnected" };
  if (s.connected) return { kind: "connected", email: s.accountEmail || "", lastSyncedAt: s.lastSyncedAt };
  if (s.status === "connected" && s.mine === false) return { kind: "team" };
  return {
    kind: "reconnect",
    reason: s.status === "reconnect_required" ? "expired" : s.status === "permission_missing" ? "permission" : "other",
    email: s.accountEmail,
  };
}

// One Google integration row with real states (status endpoint per provider):
// loading, not connected, connecting, connected, team member, reconnect and
// load error. Tokens never reach the browser; only status and e-mail address.
export function GoogleIntegrationCard({ config, demo, onNotice }: { config: GoogleCardConfig; demo: boolean; onNotice: (message: string) => void }) {
  const base = "/api/integrations/" + config.provider + "/";
  const [view, setView] = useState<View>({ kind: "loading" });
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");
  const [manage, setManage] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const request = useCallback(
    async <T,>(path: string, method: "GET" | "POST" = "GET"): Promise<T> => {
      const r = await fetch(base + path, method === "POST" ? { method, headers: { "Content-Type": "application/json" }, body: "{}" } : { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Er ging iets mis. Probeer het opnieuw.");
      return d as T;
    },
    [base],
  );

  const load = useCallback(async () => {
    try {
      setView(viewOf(await request<Status>("status")));
    } catch (e) {
      setView({ kind: "load-error", message: (e as Error).message });
    }
  }, [request]);

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
      window.location.assign(url); // Google consent screen; the callback returns to Mavix.
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
      onNotice(config.name + " is ontkoppeld.");
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
      ? config.copy.connected
      : view.kind === "team"
        ? config.copy.team || config.copy.connected
        : view.kind === "reconnect"
          ? view.reason === "expired"
            ? config.copy.expired
            : view.reason === "permission"
              ? config.copy.permission
              : "Er is een probleem met de koppeling. Koppel opnieuw."
          : view.kind === "load-error"
            ? view.message
            : config.copy.disconnected;

  const connectButton = (label: string, primary = true) => (
    <button type="button" className={"button " + (primary ? "primary" : "secondary")} disabled={demo || busy || view.kind === "loading"} onClick={() => void connect()}>
      {connecting ? <Loader2 size={14} className="int-spin" aria-hidden="true" /> : null}
      {connecting ? "Doorsturen…" : label}
    </button>
  );
  const titleId = "gi-modal-" + config.provider;

  return (
    <li className="int-row int-gc" aria-busy={view.kind === "loading" || busy}>
      <span className="int-logo">
        <BrandIcon brand={config.brand} size={24} />
      </span>
      <div className="int-info">
        <strong>{config.name}</strong>
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
          <div className="int-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header>
              <BrandIcon brand={config.brand} size={26} />
              <div>
                <h2 id={titleId}>{config.name}</h2>
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
                {view.kind === "connected" && view.lastSyncedAt !== undefined && (
                  <>
                    <dt>Laatst gesynchroniseerd</dt>
                    <dd>{dateTime(view.lastSyncedAt)}</dd>
                  </>
                )}
                <dt>Rechten</dt>
                <dd>
                  <ul className="int-scopes">
                    {config.rights.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </dd>
              </dl>
              <p className="int-hint">{view.kind === "connected" ? config.manageHint : view.kind === "team" ? config.copy.team : description}</p>
              <p className="int-hint">Ontkoppelen verwijdert de opgeslagen toegang in Mavix. Er wordt niets in je Google-account verwijderd.</p>
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

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={config.name + " ontkoppelen?"} confirmLabel="Ontkoppelen" danger onConfirm={() => void disconnect()}>
        <p>{config.copy.disconnect}</p>
      </ConfirmDialog>
    </li>
  );
}
