import { Reveal } from "./reveal";

// All figures below are illustrative placeholders until Mavix has real
// customers and review data — never present them as verified numbers.
const stats = [
  { value: "—", label: "bedrijven op Mavix (nog geen live data)" },
  { value: "—", label: "gemiddelde Google-reviewscore (nog geen live data)" },
  { value: "—", label: "reacties automatisch afgehandeld (nog geen live data)" },
];

export function TrustSection() {
  return (
    <section className="mkt-trust">
      <div className="mkt-container">
        <Reveal>
          <p className="mkt-trust-label">Gebouwd voor ondernemende bedrijven</p>
          <div className="mkt-trust-logos" aria-hidden="true">
            <span>Studio Bloom</span>
            <span>De Buurtbakker</span>
            <span>Noord Interieur</span>
            <span>Kade &amp; Co</span>
          </div>
          <div className="mkt-trust-stats">
            {stats.map((s) => (
              <div className="mkt-trust-stat" key={s.label}>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
          <p className="mkt-placeholder-note">
            Voorbeeldmerken en placeholders — Mavix toont hier live cijfers
            zodra er echte klantdata is.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
