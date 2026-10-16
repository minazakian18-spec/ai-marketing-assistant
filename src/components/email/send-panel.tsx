"use client";
import { useCallback, useEffect, useState } from "react";
import { MailCheck, Send, ShieldCheck } from "lucide-react";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { isBrowserDemo } from "@/lib/demo";
import type { EmailCampaign } from "@/lib/email-model";

// Sending a campaign for real (POST /api/email/send): a pre-flight with the
// number of recipients WITH recorded consent, a test e-mail to yourself, and
// the real send after a confirmation. Delivery numbers come only from the
// provider's events.

type Preflight = {
  capability: { ready: boolean; testReady: boolean; code: string; message: string };
  recipients: number | null;
  withoutConsent: number | null;
  stats: { stats: { recipients: number; sent: number; delivered: number; bounced: number; complained: number; failed: number; opened: number; clicked: number } | null } | null;
};

export function SendPanel({ campaign }: { campaign: EmailCampaign }) {
  const demo = isBrowserDemo();
  const [pre, setPre] = useState<Preflight | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"" | "test" | "send">("");
  const [confirm, setConfirm] = useState<"" | "test" | "send">("");

  const load = useCallback(async () => {
    if (demo) return;
    const r = await fetch("/api/email/send?" + new URLSearchParams({ campaignId: campaign.id, audience: campaign.audience }), { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setPre(d);
    else setError(d.error || "De verzendgegevens konden niet worden geladen.");
  }, [demo, campaign.id, campaign.audience]);
  useEffect(() => {
    void load();
  }, [load]);

  async function go(mode: "test" | "send") {
    setConfirm("");
    setBusy(mode);
    setError("");
    setMessage("");
    const r = await fetch("/api/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId: campaign.id, mode, confirm: true }) });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) return setError(d.error || "Versturen is niet gelukt.");
    if (mode === "test") setMessage(`Testmail verstuurd naar ${d.to}.`);
    else {
      setMessage(d.status === "partial" ? `Verstuurd naar ${d.sent} van ${d.recipients} ontvangers. Een deel is niet gelukt; zie de cijfers hieronder.` : `Verstuurd naar ${d.sent} ontvangers.`);
      window.dispatchEvent(new Event("mavix:workspace-reload"));
    }
    void load();
  }

  if (demo)
    return (
      <p className="cs-publish-note">
        <Send size={14} aria-hidden="true" />
        <span>In de testmodus verstuurt Mavix geen e-mails. Met een echt account kun je een testmail naar jezelf sturen en, als het verzenddomein is ingericht, je campagne versturen.</span>
      </p>
    );

  const cap = pre?.capability;
  const stats = pre?.stats?.stats;
  const real = !!campaign.delivery;
  const sendable = (campaign.status === "approved" || campaign.status === "scheduled") && !real;
  return (
    <section className="em-send" aria-label="Versturen">
      <div className="em-send-head">
        <ShieldCheck size={16} aria-hidden="true" />
        <p>
          {pre?.recipients === null || !pre ? (
            "Ontvangers controleren…"
          ) : (
            <>
              <strong>{pre.recipients}</strong> {pre.recipients === 1 ? "ontvanger" : "ontvangers"} met aantoonbare toestemming in “{campaign.audience}”.
              {!!pre.withoutConsent && ` ${pre.withoutConsent} ${pre.withoutConsent === 1 ? "contact krijgt" : "contacten krijgen"} deze e-mail niet: daarvan heeft Mavix geen inschrijving via een aanmeldformulier.`}
            </>
          )}
        </p>
      </div>
      {cap && !cap.ready && <p className="cs-hint">{cap.message}</p>}
      {campaign.status === "sent" && !real && <p className="cs-hint">Deze campagne staat op “verstuurd” door de simulatie; er is niets echt verzonden.</p>}
      <div className="em-send-actions">
        <button type="button" className="button secondary" disabled={!cap?.testReady || !!busy} onClick={() => setConfirm("test")}>
          <MailCheck size={15} aria-hidden="true" />
          {busy === "test" ? "Versturen…" : "Testmail naar mij"}
        </button>
        {sendable && (
          <button type="button" className="button primary" disabled={!cap?.ready || !pre?.recipients || !!busy} onClick={() => setConfirm("send")}>
            <Send size={15} aria-hidden="true" />
            {busy === "send" ? "Versturen…" : "Nu versturen"}
          </button>
        )}
      </div>
      {(message || error) && (
        <p role={error ? "alert" : "status"} className={error ? "cs-error" : "cs-message"}>
          {error || message}
        </p>
      )}
      {stats && (
        <dl className="em-stats" aria-label="Verzendresultaten">
          <div><dt>Verstuurd</dt><dd>{stats.sent} / {stats.recipients}</dd></div>
          <div><dt>Afgeleverd</dt><dd>{stats.delivered}</dd></div>
          <div><dt>Geopend</dt><dd>{stats.opened}</dd></div>
          <div><dt>Geklikt</dt><dd>{stats.clicked}</dd></div>
          <div><dt>Bounces</dt><dd>{stats.bounced}</dd></div>
          <div><dt>Klachten</dt><dd>{stats.complained}</dd></div>
          <div><dt>Mislukt</dt><dd>{stats.failed}</dd></div>
        </dl>
      )}
      {stats && <p className="cs-hint">Cijfers komen van de e-mailprovider. Openingen zijn een indicatie: veel e-mailprogramma’s blokkeren of openen afbeeldingen automatisch.</p>}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm("")}
        title={confirm === "send" ? "Campagne nu versturen?" : "Testmail versturen?"}
        confirmLabel={confirm === "send" ? `Versturen naar ${pre?.recipients ?? 0}` : "Testmail versturen"}
        onConfirm={() => void go(confirm || "test")}
      >
        {confirm === "send"
          ? `“${campaign.subject}” gaat nu naar ${pre?.recipients ?? 0} ontvangers met toestemming. Iedere e-mail bevat een afmeldlink. Versturen kun je niet terugdraaien.`
          : "Mavix stuurt één testmail naar het e-mailadres van je eigen account. Klanten ontvangen niets."}
      </ConfirmDialog>
    </section>
  );
}
