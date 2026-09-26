import Link from "next/link";
import { PricingCards } from "./pricing-cards";
import { Reveal } from "./reveal";

export function PricingTeaser() {
  return (
    <section className="mkt-section">
      <div className="mkt-container">
        <Reveal>
          <div className="mkt-section-head">
            <span className="mkt-eyebrow">Simpele, eerlijke prijzen</span>
            <h2 className="mkt-h2">Kies het niveau dat bij je past</h2>
            <p className="mkt-lede">
              Begin klein en groei naar meer automatisering wanneer jij er
              klaar voor bent.
            </p>
          </div>
        </Reveal>
        <Reveal>
          <PricingCards />
        </Reveal>
        <p style={{ textAlign: "center", marginTop: 32 }}>
          <Link href="/pricing" className="mkt-btn mkt-btn-ghost">
            Vergelijk alle features en bekijk de FAQ →
          </Link>
        </p>
      </div>
    </section>
  );
}
