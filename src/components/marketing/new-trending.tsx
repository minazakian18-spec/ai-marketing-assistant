import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";

const cards = [
  {
    badge: "Nieuw",
    title: "Mavix Agent",
    description:
      "Vraag Mavix om content te maken, te verbeteren of je marketing te beheren — in één gesprek.",
    href: "/register",
  },
  {
    badge: "Populair",
    title: "Review AI",
    description:
      "Zet binnenkomende Google-reviews om in persoonlijke reacties, zonder je dag door te brengen in Google Business Profile.",
    href: "/register",
  },
  {
    badge: "Binnenkort",
    title: "Instagram AI",
    description: "Maak en plan content die past bij jouw merk.",
    href: "/register",
  },
];

export function NewTrending() {
  return (
    <section className="mkt-section mkt-section-tight">
      <div className="mkt-container">
        <div className="mkt-trending-grid">
          {cards.map((card, i) => (
            <Reveal delay={i * 80} key={card.title}>
              <Link href={card.href} className="mkt-trending-card">
                <span className="mkt-trending-badge">{card.badge}</span>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                <span className="mkt-trending-arrow">
                  <ArrowRight size={18} />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
