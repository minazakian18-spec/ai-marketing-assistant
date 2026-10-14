import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="mkt-section-tight">
      <div className="mkt-container mkt-final-cta-minimal">
        <Reveal>
          <h2 className="mkt-h2">Laat Mavix je marketingteam versterken.</h2>
          <Link href="/demo" className="mkt-btn mkt-btn-primary mkt-btn-lg">
            Demo aanvragen <ArrowRight size={18} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
