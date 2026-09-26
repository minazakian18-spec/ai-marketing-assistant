import { Reveal } from "./reveal";

// Placeholder testimonials — replace with real, verified customer quotes
// before this ever ships publicly with real traffic.
const testimonials = [
  {
    quote:
      "“Voorbeeldtekst: Mavix bespaart ons elke week uren aan reviewbeheer.”",
    name: "Voorbeeldklant",
    role: "Placeholder — nog geen echte klant",
  },
  {
    quote:
      "“Voorbeeldtekst: onze Instagram voelt eindelijk consistent, zonder dat ik er zelf achter zit.”",
    name: "Voorbeeldklant",
    role: "Placeholder — nog geen echte klant",
  },
  {
    quote:
      "“Voorbeeldtekst: de contentkalender gaf ons voor het eerst overzicht.”",
    name: "Voorbeeldklant",
    role: "Placeholder — nog geen echte klant",
  },
];

export function Testimonials() {
  return (
    <section className="mkt-section mkt-section-tight">
      <div className="mkt-container">
        <Reveal>
          <div className="mkt-section-head">
            <span className="mkt-eyebrow">Wat klanten zeggen</span>
            <h2 className="mkt-h2">Binnenkort echte verhalen</h2>
            <p className="mkt-lede">
              Deze kaarten zijn placeholders totdat we ze vervangen door
              geverifieerde klantervaringen.
            </p>
          </div>
        </Reveal>
        <div className="mkt-testimonial-grid">
          {testimonials.map((t, i) => (
            <Reveal delay={i * 90} key={t.name + i}>
              <div className="mkt-testimonial-card">
                <p>{t.quote}</p>
                <div className="mkt-testimonial-person">
                  <span className="mkt-testimonial-avatar">
                    {t.name.slice(0, 1)}
                  </span>
                  <div>
                    <strong>{t.name}</strong>
                    <span>{t.role}</span>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
