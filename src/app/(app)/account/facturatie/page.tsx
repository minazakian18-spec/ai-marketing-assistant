"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, CreditCard, Gauge, Receipt } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { isBrowserDemo } from "@/lib/demo";
import { BILLING_LABEL, type BillingState } from "@/lib/billing-state";
import { PLAN_IDS, PLANS, euro, yearlyPrice, type PlanId } from "@/lib/plans";
import { AdviceCall } from "@/components/account/advice-call";

// Subscription and invoices. Mavix is in a private beta: unless the owner has
// opened paid plans, this page says plainly that nothing is charged. Paid
// state is only shown when Stripe reported it (server-verified webhook).

type Invoice = { number: string | null; date: number; amount: number; currency: string; status: string | null; url: string | null; pdf: string | null };
type Billing = { state: BillingState; subscription: { plan: string | null; billing_interval: string | null; current_period_end: string | null } | null; invoices: Invoice[]; invoiceError: boolean; checkout: boolean; portal: boolean; yearly: boolean };
const PLAN = Object.fromEntries(PLAN_IDS.map((id) => [id, PLANS[id].name])) as Record<string, string>;

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
  const currentId = b?.subscription?.plan as PlanId | undefined;
  const current = state !== "beta" && currentId && PLANS[currentId] ? PLANS[currentId] : null;
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
                  ? "Beta-toegang · alle beschikbare functies · geen betaalmethode nodig"
                  : `${PLAN[b?.subscription?.plan || ""] || "Abonnement"}${current ? " · " + (b?.subscription?.billing_interval === "year" ? euro(yearlyPrice(current).perYear) + " per jaar" : euro(current.monthlyPrice) + " per maand") + " excl. btw" : ""}${b?.subscription?.current_period_end ? " · volgende factuur " + new Date(b.subscription.current_period_end).toLocaleDateString("nl-NL") : ""}`}
              </small>
              {current && (
                <small>
                  {current.credits.toLocaleString("nl-NL")} AI-credits per maand · {current.users} {current.users === 1 ? "gebruiker" : "gebruikers"} · {current.contacts.toLocaleString("nl-NL")} contacten
                </small>
              )}
              {current && (
                <small>
                  {current.limits.image_generate} AI-afbeeldingen per maand · max. {current.inspirationMax} {current.inspirationMax === 1 ? "inspiratiebeeld" : "inspiratiebeelden"} per opdracht · {current.carouselSlides ? `${current.limits.carousel} AI-carrousels per maand tot ${current.carouselSlides} slides` : "geen AI-carrousels (vanaf Growth)"}
                </small>
              )}
            </span>
          </div>
          {current?.id === "autopilot" && <AdviceCall />}
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
              {PLAN_IDS.map((id) => (
                <button key={id} type="button" className={"button " + (PLANS[id].recommended ? "primary" : "secondary")} disabled={busy} onClick={() => void go({ action: "checkout", plan: id, interval: "month" })}>
                  {PLANS[id].name} · {euro(PLANS[id].monthlyPrice)} per maand
                </button>
              ))}
              {b.yearly &&
                PLAN_IDS.map((id) => (
                  <button key={id + "y"} type="button" className="button secondary" disabled={busy} onClick={() => void go({ action: "checkout", plan: id, interval: "year" })}>
                    {PLANS[id].name} · {euro(yearlyPrice(PLANS[id]).perYear)} per jaar (vooraf)
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
