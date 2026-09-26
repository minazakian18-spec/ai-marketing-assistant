import Link from "next/link";
import { Star, Instagram, Mail } from "lucide-react";
import { Reveal } from "./reveal";

// Only integrations Mavix actually supports (or is actively building) are
// listed here — never show connections that don't exist yet.
const integrations = [
  {
    icon: Star,
    name: "Google Business Profile",
    description: "Ontvang en beantwoord Google-reviews vanuit Mavix.",
  },
  {
    icon: Instagram,
    name: "Instagram",
    description: "Plan en publiceer content rechtstreeks naar je account.",
  },
  {
    icon: Mail,
    name: "Gmail",
    description: "Verstuur en beheer je e-mailmarketing via Email AI.",
  },
];

export function IntegrationsTeaser() {
  return (
    <section className="mkt-section" id="integraties">
      <div className="mkt-container">
        <Reveal>
          <div className="mkt-section-head">
            <span className="mkt-eyebrow">Koppel wat je al gebruikt</span>
            <h2 className="mkt-h2">Integraties</h2>
            <p className="mkt-lede">
              Mavix richt zich bewust op een klein aantal koppelingen en doet
              die goed, in plaats van tientallen half werkende integraties.
            </p>
          </div>
        </Reveal>
        <div className="mkt-integration-cards">
          {integrations.map((it, i) => (
            <Reveal delay={i * 80} key={it.name}>
              <div className="mkt-integration-card">
                <span className="mkt-integration-logo">
                  <it.icon size={19} />
                </span>
                <h3>{it.name}</h3>
                <p>{it.description}</p>
                <span className="mkt-status-pill">Niet verbonden</span>
              </div>
            </Reveal>
          ))}
        </div>
        <p style={{ textAlign: "center", marginTop: 28 }}>
          <Link href="/register" className="mkt-btn mkt-btn-secondary">
            Bekijk integraties
          </Link>
        </p>
      </div>
    </section>
  );
}
