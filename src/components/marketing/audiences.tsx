import { Store, UtensilsCrossed, Scissors } from "lucide-react";
import { Reveal } from "./reveal";

const audiences = [
  {
    icon: UtensilsCrossed,
    title: "Horeca en restaurants",
    text: "Beantwoord Google-reviews van gasten, deel je menu en acties op Instagram en houd vaste gasten op de hoogte met een nieuwsbrief.",
  },
  {
    icon: Store,
    title: "Winkels en webshops",
    text: "Plan productposts, stuur e-mailcampagnes voor nieuwe collecties en reageer snel op vragen en reviews van klanten.",
  },
  {
    icon: Scissors,
    title: "Salons, praktijken en dienstverleners",
    text: "Laat zien wat je doet, herinner klanten aan je aanbod en bouw een goede online reputatie op met persoonlijke reacties.",
  },
];

// Who Mavix is for: plain descriptions of the real use cases.
export function Audiences() {
  return (
    <section className="mkt-section-tight" id="voor-wie" aria-labelledby="voor-wie-title">
      <div className="mkt-container">
        <Reveal className="mkt-section-head">
          <h2 className="mkt-h2" id="voor-wie-title">
            AI-marketing voor kleine en middelgrote bedrijven.
          </h2>
          <p className="mkt-lede">Gemaakt voor ondernemers zonder eigen marketingafdeling.</p>
        </Reveal>
        <div className="mkt-steps-grid">
          {audiences.map((a, i) => (
            <Reveal delay={i * 60} key={a.title}>
              <div className="mkt-step">
                <a.icon size={18} className="mkt-step-icon" aria-hidden="true" />
                <h3>{a.title}</h3>
                <p>{a.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
