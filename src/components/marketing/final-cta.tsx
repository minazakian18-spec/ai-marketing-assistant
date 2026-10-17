import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="mkt-section-tight">
      <div className="mkt-container mkt-final-cta-minimal">
        <Reveal>
          <h2 className="mkt-h2">Zie wat Mavix voor jouw bedrijf kan doen.</h2>
          <p className="fc-sub">In een persoonlijke demo laten we Mavix zien met voorbeelden uit jouw branche. Vrijblijvend, en je weet daarna precies of het bij je past.</p>
          <div className="fc-actions">
            <Link href="/demo" className="mkt-btn mkt-btn-primary mkt-btn-lg">
              Plan een demo <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/pricing" className="fc-link">
              Bekijk de abonnementen
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
