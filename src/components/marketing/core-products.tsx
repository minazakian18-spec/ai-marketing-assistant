import { Star, Sparkles, Instagram, Mail } from "lucide-react";
import { Reveal } from "./reveal";

const products = [
  {
    name: "Review AI",
    description:
      "Beantwoord Google-reviews persoonlijk met AI, zonder er dagelijks mee bezig te zijn.",
    visual: (
      <div className="mkt-core-visual">
        <span className="mkt-core-stars">
          <Star size={11} fill="currentColor" />
          <Star size={11} fill="currentColor" />
          <Star size={11} fill="currentColor" />
          <Star size={11} fill="currentColor" />
          <Star size={11} fill="currentColor" />
        </span>
        <p className="mkt-core-visual-line">
          “Wat fijn om te lezen! Dankjewel voor je vertrouwen.”
        </p>
      </div>
    ),
  },
  {
    name: "Social AI",
    description: "Maak en plan Instagram-posts, stories en reels die passen bij jouw merk.",
    visual: (
      <div className="mkt-core-visual">
        <div className="mkt-core-insta-art" aria-hidden="true" />
        <p className="mkt-core-visual-line">
          <Instagram size={12} /> Nieuwe collectie is binnen ✨
        </p>
      </div>
    ),
  },
  {
    name: "Email AI",
    description: "Schrijf e-mailcampagnes en nieuwsbrieven met AI en verstuur ze vanuit één werkruimte.",
    visual: (
      <div className="mkt-core-visual">
        <p className="mkt-core-visual-subject">
          <Mail size={12} /> Onderwerp: Jouw weekaanbieding
        </p>
        <p className="mkt-core-visual-line">
          Klaar om te versturen naar 1.204 contacten.
        </p>
      </div>
    ),
  },
];

export function CoreProducts() {
  return (
    <section className="mkt-section" id="oplossingen">
      <div className="mkt-container">
        <Reveal className="mkt-section-head">
          <h2 className="mkt-h2">Alles wat je marketing nodig heeft.</h2>
        </Reveal>
        <div className="mkt-core-grid">
          {products.map((p, i) => (
            <Reveal delay={i * 80} key={p.name}>
              <div className="mkt-core-card">
                {p.visual}
                <h3 className="mkt-core-tag">
                  <Sparkles size={12} aria-hidden="true" />
                  {p.name}
                </h3>
                <p className="mkt-core-desc">{p.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
