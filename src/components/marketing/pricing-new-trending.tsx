import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "./reveal";

const cards = [
  {
    badge: "New",
    title: "Mavix Agent",
    description: "Werk samen met Mavix vanuit één gesprek.",
    href: "/register",
  },
  {
    badge: "Trending",
    title: "Review AI",
    description: "Reageer sneller en persoonlijker op je Google-reviews.",
    href: "/register",
  },
];

export function PricingNewTrending() {
  return (
    <section className="mkt-section" id="pricing">
      <div className="mkt-container">
        <div className="mkt-pnt-grid">
          <Reveal className="mkt-pnt-pricing-wrap">
            <div className="mkt-pricing-promo">
              <span className="mkt-eyebrow mkt-eyebrow-on-dark">Prijzen</span>
              <h2>Plannen en prijzen.</h2>
              <p>
                Kies hoeveel van je marketing je aan Mavix wilt overlaten.
              </p>
              <Link href="/pricing" className="mkt-btn mkt-btn-secondary">
                Bekijk alle pakketten
              </Link>
            </div>
          </Reveal>
          <div className="mkt-pnt-stack">
            {cards.map((card, i) => (
              <Reveal delay={i * 80} key={card.title}>
                <Link href={card.href} className="mkt-trending-card">
                  <span className="mkt-trending-arrow">
                    <ArrowUpRight size={16} />
                  </span>
                  <span className="mkt-trending-badge">{card.badge}</span>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
