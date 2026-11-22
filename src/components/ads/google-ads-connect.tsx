"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plug } from "lucide-react";
import { isBrowserDemo } from "@/lib/demo";

// Step 3 on /ads: log in with Google, then choose which Google Ads account
// Mavix may read. Server: src/lib/server/google-ads.ts.
type Status = { connected: boolean; status: string; email: string | null; customerId: string | null };
type Account = { id: string; label: string };
const fmt = (id: string) => `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}`;
const BASE = "/api/integrations/google_ads/";

export function GoogleAdsConnect({ onChange }: { onChange?: (connected: boolean) => void }) {
  const demo = isBrowserDemo();
  const [status, setStatus] = useState<Status | null>(null);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (demo) return setStatus({ connected: false, status: "disconnected", email: null, customerId: null });
    const r = await fetch(BASE + "status", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setError(d.error || "De status kon niet worden geladen.");
    setStatus(d);
    onChange?.(d.connected && d.status === "connected");
  }, [demo, onChange]);
  useEffect(() => {
    void load();
  }, [load]);

  // After login: list the accounts to choose from.
  useEffect(() => {
    if (!status?.connected || status.status === "connected" || accounts) return;
    void (async () => {
      const r = await fetch(BASE + "accounts", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setError(d.error || "Je Google Ads-accounts konden niet worden geladen.");
      setAccounts(d.accounts);
      if (d.accounts?.length) setChoice(d.accounts[0].id);
    })();
  }, [status, accounts]);

  async function post(action: string, body: object = {}) {
    setBusy(action);
    setError("");
    const r = await fetch(BASE + action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) {
      setError(d.error || "Dat is niet gelukt. Probeer het opnieuw.");
      return null;
    }
    return d;
  }

  async function connect() {
    const d = await post("connect");
    if (d?.url) window.location.assign(d.url);
  }

  if (demo) return <p className="ads-connect-note">In de testmodus kun je Google Ads niet koppelen. Met een echt account log je hier in met Google.</p>;
  if (!status) return <p className="ads-connect-note">Laden…</p>;

  return (
    <div className="ads-connect">
      {!status.connected || status.status === "reconnect_required" ? (
        <>
          <button type="button" className="button primary" disabled={!!busy} onClick={() => void connect()}>
            {busy === "connect" ? <Loader2 size={15} className="int-spin" aria-hidden="true" /> : <Plug size={15} aria-hidden="true" />}
            {status.status === "reconnect_required" ? "Opnieuw koppelen" : "Koppel Google Ads"}
          </button>
          <p className="ads-connect-note">Je logt in met het Google-account waarmee je in Google Ads werkt en geeft Mavix leestoegang. Mavix wijzigt niets in je campagnes.</p>
        </>
      ) : status.status === "connected" ? (
        <div className="ads-connect-done">
          <Check size={15} aria-hidden="true" />
          <span>
            Gekoppeld: account <strong>{status.customerId ? fmt(status.customerId) : "—"}</strong>
            {status.email ? ` (${status.email})` : ""}
          </span>
          <button type="button" className="button secondary" disabled={!!busy} onClick={() => void post("disconnect").then((d) => d && (setAccounts(null), load()))}>
            Ontkoppelen
          </button>
        </div>
      ) : (
        <div className="ads-connect-pick">
          <p>
            Ingelogd als <strong>{status.email}</strong>. Kies welk Google Ads-account Mavix mag lezen:
          </p>
          {accounts === null ? (
            !error && <p className="ads-connect-note">Accounts laden…</p>
          ) : accounts.length ? (
            <div className="ads-connect-row">
              <label className="sr-only" htmlFor="ads-account">
                Google Ads-account
              </label>
              <select id="ads-account" value={choice} onChange={(e) => setChoice(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              <button type="button" className="button primary" disabled={!!busy || !choice} onClick={() => void post("select", { customerId: choice }).then((d) => d && load())}>
                {busy === "select" ? "Opslaan…" : "Gebruik dit account"}
              </button>
            </div>
          ) : (
            <p className="ads-connect-note">Met deze Google-login is geen Google Ads-account gevonden. Log in met het account dat toegang heeft tot je advertenties.</p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="ads-connect-error">
          {error}
        </p>
      )}
    </div>
  );
}
