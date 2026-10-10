"use client";
import Link from "next/link";
import { BadgeCheck, Gauge, Receipt } from "lucide-react";
import { PageHeading } from "@/components/ui";

// Mavix is in a private beta: there are no paid plans, checkout or invoices
// yet. This page says so plainly instead of showing a payment flow.
export default function BillingPage() {
  return (
    <>
      <PageHeading eyebrow="Werkruimte" title="Abonnement en facturatie" description="Mavix is in besloten beta. Je betaalt nu niets." />
      <section className="panel account-panel">
        <div className="section-heading">
          <div>
            <h2>
              <BadgeCheck size={18} aria-hidden="true" /> Besloten beta
            </h2>
            <p>Je werkruimte is goedgekeurd voor de beta. Alle beschikbare functies zijn inbegrepen, zonder kosten.</p>
          </div>
        </div>
        <div className="account-panel-body st-billing">
          <div className="st-channel is-static">
            <span>
              <strong>Huidig plan</strong>
              <small>Beta-toegang · geen betaalmethode nodig</small>
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
              <small>Er zijn geen facturen: tijdens de beta wordt niets in rekening gebracht.</small>
            </span>
          </div>
          <p className="field-note">Betaalde abonnementen komen pas na de beta. We laten het je ruim van tevoren weten; er wordt nooit automatisch iets afgeschreven.</p>
        </div>
      </section>
    </>
  );
}
