import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";

export function PricingTeaser() {
  return (
    <section className="mkt-section" id="pricing">
      <div className="mkt-container">
        <Reveal>
          <div className="mkt-pricing-promo">
            <span className="mkt-eyebrow mkt-eyebrow-on-dark">Prijzen</span>
            <h2>Plannen die met je meegroeien.</h2>
            <p>
              Begin klein en schaal op naar meer automatisering wanneer jij
              er klaar voor bent.
            </p>
            <Link href="/pricing" className="mkt-btn mkt-btn-secondary">
              Bekijk alle plannen <ArrowRight size={16} />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
