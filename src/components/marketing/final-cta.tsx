import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="mkt-section">
      <div className="mkt-container">
        <Reveal>
          <div className="mkt-final-cta">
            <h2 className="mkt-h2">Zet je marketing op autopilot.</h2>
            <p className="mkt-lede">
              Begin gratis en ontdek binnen enkele minuten wat Mavix voor je
              bedrijf kan doen.
            </p>
            <div className="mkt-hero-actions">
              <Link href="/register" className="mkt-btn mkt-btn-secondary">
                Gratis starten <ArrowRight size={17} />
              </Link>
              <Link
                href="/pricing"
                className="mkt-btn"
                style={{ color: "#fff", border: "1px solid #ffffff55" }}
              >
                Bekijk prijzen
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
