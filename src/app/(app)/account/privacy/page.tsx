"use client";
import { useState } from "react";
import Link from "next/link";
import { KeyRound, LogOut, Plug, Download, ShieldAlert, ArrowUpRight } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { downloadFile } from "@/lib/download";
import { authRequest } from "@/lib/auth-client";

// Security and privacy: only what Mavix really supports. Password changes go
// through the e-mailed reset link; signing out ends every session.
export default function PrivacyPage() {
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  async function action(remove: boolean) {
    setBusy(remove ? "remove" : "export");
    setMessage("");
    try {
      const r = await fetch("/api/privacy", remove ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: confirmation }) } : { cache: "no-store" });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error || "Deze actie is niet gelukt.");
      if (remove) setMessage(b.message);
      else {
        downloadFile("mavix-export.json", JSON.stringify(b, null, 2), "application/json");
        setMessage("Je export is gedownload.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Deze actie is niet gelukt.");
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageHeading eyebrow="Persoonlijk" title="Beveiliging en privacy" description="Je wachtwoord, sessies, gekoppelde diensten en je gegevens." />
      <section className="panel account-panel">
        <div className="section-heading">
          <div>
            <h2>
              <KeyRound size={18} aria-hidden="true" /> Inloggen
            </h2>
            <p>Mavix bewaart je wachtwoord nooit zelf; het wordt beheerd door onze beveiligde inlogdienst.</p>
          </div>
        </div>
        <div className="account-panel-body">
          <Link href="/forgot-password" className="st-channel">
            <span>
              <strong>Wachtwoord wijzigen</strong>
              <small>Je ontvangt een beveiligde link per e-mail. Daarna word je overal uitgelogd.</small>
            </span>
            <ArrowUpRight size={16} />
          </Link>
          <button
            type="button"
            className="st-channel st-channel-button"
            disabled={busy === "logout"}
            onClick={() => {
              setBusy("logout");
              void authRequest("logout").catch((e) => {
                setMessage(e instanceof Error ? e.message : "Uitloggen is niet gelukt.");
                setBusy("");
              });
            }}
          >
            <span>
              <strong>
                <LogOut size={14} aria-hidden="true" /> Uitloggen op alle apparaten
              </strong>
              <small>Beëindigt alle actieve sessies, ook op je telefoon en andere computers.</small>
            </span>
          </button>
        </div>
      </section>
      <section className="panel account-panel">
        <div className="section-heading">
          <div>
            <h2>
              <Plug size={18} aria-hidden="true" /> Gekoppelde diensten
            </h2>
            <p>Instagram, Gmail, Google en WhatsApp krijgen alleen de toegang die jij goedkeurt. Je kunt die altijd intrekken.</p>
          </div>
        </div>
        <div className="account-panel-body">
          <Link href="/account/integraties" className="st-channel">
            <span>
              <strong>Koppelingen beheren</strong>
              <small>Bekijk wat er gekoppeld is en verbreek een koppeling.</small>
            </span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
      <section className="panel account-panel">
        <div className="section-heading">
          <div>
            <h2>
              <Download size={18} aria-hidden="true" /> Je gegevens
            </h2>
            <p>Download je profiel en de bedrijfsgegevens van deze werkruimte. Toegangssleutels van koppelingen worden nooit meegegeven.</p>
          </div>
          <button type="button" disabled={!!busy} className="button secondary" onClick={() => action(false)}>
            <Download size={15} /> {busy === "export" ? "Bezig…" : "Gegevens downloaden"}
          </button>
        </div>
      </section>
      <section className="panel account-panel st-danger">
        <div className="section-heading">
          <div>
            <h2>
              <ShieldAlert size={18} aria-hidden="true" /> Werkruimte deactiveren
            </h2>
            <p>Alleen de eigenaar kan dit. Alle leden verliezen toegang. Gegevens blijven voorlopig bewaard voor handmatig herstel; je inlogaccount blijft bestaan.</p>
          </div>
        </div>
        <div className="account-panel-body">
          <label className="st-confirm">
            Typ <strong>VERWIJDER WERKRUIMTE</strong> om te bevestigen
            <input value={confirmation} autoComplete="off" onChange={(e) => setConfirmation(e.target.value)} />
          </label>
          <button type="button" disabled={!!busy || confirmation !== "VERWIJDER WERKRUIMTE"} className="button danger-outline" onClick={() => action(true)}>
            Werkruimte deactiveren
          </button>
        </div>
      </section>
      <p role="status" className="st-feedback">
        {message}
      </p>
    </>
  );
}
