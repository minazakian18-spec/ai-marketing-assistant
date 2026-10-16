"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, CreditCard, Gauge, Receipt } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { isBrowserDemo } from "@/lib/demo";
import { BILLING_LABEL, type BillingState } from "@/lib/billing-state";

// Subscription and invoices. Mavix is in a private beta: unless the owner has
// opened paid plans, this page says plainly that nothing is charged. Paid
// state is only shown when Stripe reported it (server-verified webhook).

type Invoice = { number: string | null; date: number; amount: number; currency: string; status: string | null; url: string | null; pdf: string | null };
type Billing = { state: BillingState; subscription: { plan: string | null; billing_interval: string | null; current_period_end: string | null } | null; invoices: Invoice[]; invoiceError: boolean; checkout: boolean; portal: boolean };
const PLAN = { starter: "Starter", growth: "Growth", autopilot: "Autopilot" } as Record<string, string>;

export default function BillingPage() {
  const params = useSearchParams();
  const [b, setB] = useState<Billing | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const demo = isBrowserDemo();

  useEffect(() => {
    if (demo) return;
    fetch("/api/billing", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.status === 403) return; // members: billing is for owners
        if (!r.ok) throw new Error(d.error || "De facturatie kon niet worden geladen.");
        setB(d);
      })
      .catch((e) => setError((e as Error).message));
  }, [demo]);

  async function go(body: object) {
    setBusy(true);
    setError("");
    const r = await fetch("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || !d.url) return setError(d.error || "Dit lukte niet. Probeer het later opnieuw.");
    window.location.assign(d.url);
  }

  const state: BillingState = b?.state || "beta";
  const label = BILLING_LABEL[state];
  const returned = params.get("betaling");
  return (
    <>
      <PageHeading eyebrow="Werkruimte" title="Abonnement en facturatie" description={state === "beta" ? "Mavix is in besloten beta. Je betaalt nu niets." : "Je abonnement, facturen en betaalmethode."} />
      {returned === "bezig" && <p className="int-notice" role="status">Bedankt. Zodra Stripe de betaling bevestigt, zie je je abonnement hier. Dat kan een paar minuten duren.</p>}
      {returned === "geannuleerd" && <p className="int-notice" role="status">Je hebt het afrekenen afgebroken. Er is niets in rekening gebracht.</p>}
      <section className="panel account-panel">
        <div className="section-heading">
          <div>
            <h2>
              <BadgeCheck size={18} aria-hidden="true" /> {label.title}
            </h2>
            <p>{label.text}</p>
          </div>
        </div>
        <div className="account-panel-body st-billing">
          <div className="st-channel is-static">
            <span>
              <strong>Huidig plan</strong>
              <small>
                {state === "beta"
                  ? "Beta-toegang · geen betaalmethode nodig"
                  : `${PLAN[b?.subscription?.plan || ""] || "Abonnement"}${b?.subscription?.billing_interval ? " · per " + (b.subscription.billing_interval === "year" ? "jaar" : "maand") : ""}${b?.subscription?.current_period_end ? " · loopt tot " + new Date(b.subscription.current_period_end).toLocaleDateString("nl-NL") : ""}`}
              </small>
            </span>
          </div>
          <Link href="/account/ai" className="st-channel">
            <span>
              <strong>
                <Gauge size={14} aria-hidden="true" /> AI-tegoed
              </strong>
              <small>Bekijk je AI-gebruik en het maandtegoed van je werkruimte.</small>
            </span>
          </Link>
          <div className="st-channel is-static">
            <span>
              <strong>
                <Receipt size={14} aria-hidden="true" /> Facturen
              </strong>
              {b?.invoices.length ? (
                <ul className="bl-invoices">
                  {b.invoices.map((i) => (
                    <li key={(i.number || "") + i.date}>
                      {new Date(i.date * 1000).toLocaleDateString("nl-NL")} · {(i.amount / 100).toLocaleString("nl-NL", { style: "currency", currency: i.currency.toUpperCase() })} · {i.status === "paid" ? "betaald" : i.status === "open" ? "open" : i.status || ""}
                      {i.url && (
                        <a href={i.url} target="_blank" rel="noreferrer">
                          Bekijken
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <small>{b?.invoiceError ? "Facturen konden nu niet worden opgehaald bij Stripe." : state === "beta" ? "Er zijn geen facturen: tijdens de beta wordt niets in rekening gebracht." : "Nog geen facturen."}</small>
              )}
            </span>
          </div>
          {b?.portal && (
            <button type="button" className="button secondary" disabled={busy} onClick={() => void go({ action: "portal" })}>
              <CreditCard size={15} aria-hidden="true" /> Betaalmethode, facturen en opzeggen
            </button>
          )}
          {b?.checkout && (
            <div className="bl-plans">
              <p className="field-note">
                Kies een plan. Je rekent veilig af bij Stripe (onder meer kaart en iDEAL); je abonnement start pas als Stripe de betaling bevestigt. Prijzen en verschillen staan op de <Link href="/pricing">prijzenpagina</Link>.
              </p>
              {Object.entries(PLAN).map(([id, name]) => (
                <button key={id} type="button" className="button secondary" disabled={busy} onClick={() => void go({ action: "checkout", plan: id, interval: "month" })}>
                  {name} per maand
                </button>
              ))}
            </div>
          )}
          {state === "beta" && !b?.checkout && <p className="field-note">Betaalde abonnementen komen pas na de beta. We laten het je ruim van tevoren weten; er wordt nooit automatisch iets afgeschreven.</p>}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
