import { Store, UtensilsCrossed, Scissors } from "lucide-react";
import { Reveal } from "./reveal";

const audiences = [
  {
    icon: UtensilsCrossed,
    title: "Horeca en restaurants",
    text: "Reageer persoonlijk op elke review, deel je menu en acties op Instagram en houd vaste gasten op de hoogte met een nieuwsbrief.",
  },
  {
    icon: Store,
    title: "Winkels en webshops",
    text: "Plan productposts, kondig nieuwe collecties aan per e-mail en beantwoord vragen en reviews van klanten zonder vertraging.",
  },
  {
    icon: Scissors,
    title: "Salons, praktijken en dienstverleners",
    text: "Laat zien wat je doet, herinner klanten aan je aanbod en bouw met persoonlijke reacties aan een sterke online reputatie.",
  },
];

// Who Mavix is for: plain descriptions of the real use cases.
export function Audiences() {
  return (
    <section className="mkt-section-tight" id="voor-wie" aria-labelledby="voor-wie-title">
      <div className="mkt-container">
        <Reveal className="mkt-section-head">
          <h2 className="mkt-h2" id="voor-wie-title">
            Gemaakt voor lokale ondernemers.
          </h2>
          <p className="mkt-lede">Je hebt geen marketingafdeling nodig om professioneel zichtbaar te zijn. Mavix doet het voorbereidende werk; jij kent je klanten en houdt de regie.</p>
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
