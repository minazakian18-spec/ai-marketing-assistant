"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { isBrowserDemo } from "@/lib/demo";

// One Google account for all of Mavix: one consent screen (minimal scopes),
// per service a tick and its status, one disconnect that also revokes the
// access at Google. Server: src/lib/server/google-account.ts.

type Service = { provider: string; label: string; purpose: string; href: string; status: string; granted: boolean };
type Status = { connected: boolean; email: string | null; services: Service[] };

const LABEL: Record<string, string> = {
  connected: "Werkt",
  selection_required: "Kies een locatie",
  api_access_required: "Wacht op Google",
  reconnect_required: "Opnieuw koppelen",
  permission_missing: "Geen toestemming",
  error: "Fout",
  disconnected: "Niet gekoppeld",
};

export function GoogleAccountCard({ onNotice }: { onNotice: (message: string) => void }) {
  const demo = isBrowserDemo();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "connect" | "disconnect">("");
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    if (demo) return setStatus({ connected: false, email: null, services: [] });
    const r = await fetch("/api/integrations/google/status", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setError(d.error || "De Google-koppeling kon niet worden geladen.");
    setStatus(d);
  }, [demo]);
  useEffect(() => {
    void load();
  }, [load]);

  async function connect() {
    setBusy("connect");
    setError("");
    const r = await fetch("/api/integrations/google/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.url) {
      setBusy("");
      return setError(d.error || "Koppelen is niet gelukt. Probeer het opnieuw.");
    }
    window.location.assign(d.url);
  }

  async function disconnect() {
    setConfirm(false);
    setBusy("disconnect");
    setError("");
    const r = await fetch("/api/integrations/google/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) return setError(d.error || "Ontkoppelen is niet gelukt.");
    onNotice("Google is ontkoppeld. Mavix heeft de toegang ook bij Google ingetrokken.");
    void load();
  }

  const needsAttention = status?.services.some((s) => ["reconnect_required", "permission_missing", "error"].includes(s.status));
  return (
    <li className="int-row int-google">
      <span className="int-logo">
        <BrandIcon brand="google_business" size={24} />
      </span>
      <div className="int-info">
        <strong>Google-account</strong>
        <p>Eén koppeling voor je Bedrijfsprofiel en reviews, Agenda, Search Console en e-mail versturen. Mavix leest je e-mail niet.</p>
        {status?.email && <small>{status.email}</small>}
        {status && status.services.length > 0 && (
          <ul className="int-google-services" aria-label="Google-diensten">
            {status.services.map((s) => {
              const ok = s.status === "connected";
              const off = s.status === "disconnected";
              const Icon = ok ? CheckCircle2 : off ? Circle : AlertTriangle;
              return (
                <li key={s.provider} className={ok ? "is-ok" : off ? "is-off" : "is-warn"}>
                  <Icon size={14} aria-hidden="true" />
                  <span>
                    <strong>{s.label}</strong> <small>{s.purpose}</small>
                  </span>
                  <span className="int-google-state">{LABEL[s.status] || s.status}</span>
                  {s.status === "selection_required" || s.status === "api_access_required" ? (
                    <Link href={s.href} className="text-link">
                      {s.status === "selection_required" ? "Locatie kiezen" : "Bekijken"}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {error && (
          <p role="alert" className="int-error int-inline-error">
            {error}
          </p>
        )}
      </div>
      <span className={"int-state is-" + (!status ? "loading" : status.connected ? (needsAttention ? "reconnect" : "connected") : "disconnected")}>
        {!status ? "Laden…" : status.connected ? (needsAttention ? "Actie nodig" : "Verbonden") : "Niet verbonden"}
      </span>
      <div className="int-actions">
        <button type="button" className={"button " + (status?.connected && !needsAttention ? "secondary" : "primary")} disabled={demo || !!busy || !status} onClick={() => void connect()}>
          {busy === "connect" ? <Loader2 size={14} className="int-spin" aria-hidden="true" /> : status?.connected ? <RefreshCw size={14} aria-hidden="true" /> : null}
          {busy === "connect" ? "Doorsturen…" : status?.connected ? "Opnieuw koppelen" : "Koppel Google"}
        </button>
        {status?.connected && (
          <button type="button" className="button danger-text" disabled={!!busy} onClick={() => setConfirm(true)}>
            {busy === "disconnect" ? "Ontkoppelen…" : "Ontkoppelen"}
          </button>
        )}
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Google ontkoppelen?" confirmLabel="Ontkoppelen" onConfirm={() => void disconnect()}>
        Mavix trekt de toegang bij Google in en wist de opgeslagen sleutels voor alle Google-diensten. Je reviews, agenda en zoekcijfers zijn daarna niet meer zichtbaar in Mavix. In je Google-account zelf wordt niets verwijderd.
      </ConfirmDialog>
    </li>
  );
}
