import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Reveal } from "./reveal";
import { PLAN_IDS, PLANS, euro } from "@/lib/plans";

// Pricing teaser: plan names, prices and highlights come from the central
// plan configuration (src/lib/plans.ts); nothing is typed twice here.
export function PricingNewTrending() {
  return (
    <section className="mkt-section pt" id="prijzen" aria-labelledby="pt-title">
      <div className="mkt-container">
        <Reveal className="mkt-section-head">
          <span className="mkt-eyebrow">Prijzen</span>
          <h2 className="mkt-h2" id="pt-title">
            Een abonnement dat meegroeit met je bedrijf.
          </h2>
          <p className="hs-lead">Begin klein en schaal op wanneer je meer wilt. Elk pakket is maandelijks opzegbaar; prijzen zijn excl. btw.</p>
        </Reveal>
        <Reveal>
          <ul className="pt-plans">
            {PLAN_IDS.map((id) => {
              const p = PLANS[id];
              return (
                <li key={id} className={"pt-plan" + (p.recommended ? " is-recommended" : "")}>
                  {p.recommended && <span className="pt-badge">Aanbevolen</span>}
                  <h3>{p.name}</h3>
                  <p className="pt-audience">{p.audience}</p>
                  <p className="pt-price">
                    <strong>{euro(p.monthlyPrice)}</strong> <small>per maand</small>
                  </p>
                  <ul>
                    {p.highlights.slice(0, 4).map((h) => (
                      <li key={h}>
                        <Check size={15} aria-hidden="true" /> {h}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Reveal>
        <div className="pt-actions">
          <Link href="/pricing" className="mkt-btn mkt-btn-primary">
            Bekijk de abonnementen <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/pricing#vergelijk" className="pt-compare">
            Vergelijk alle functies
          </Link>
        </div>
        <p className="pt-beta">Mavix is nu in besloten beta: deelnemers betalen tijdens de beta niets.</p>
      </div>
    </section>
  );
}
