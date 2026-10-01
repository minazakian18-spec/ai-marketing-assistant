import { Reveal } from "./reveal";

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  rating?: number;
};

// No fabricated quotes. Pass real, verified testimonials in here once they
// exist — until then this list stays empty and the section renders nothing.
const realTestimonials: Testimonial[] = [];

export function Testimonials() {
  if (realTestimonials.length === 0) return null;
  return (
    <section className="mkt-section mkt-section-tight" id="reviews">
      <div className="mkt-container">
        <Reveal>
          <div className="mkt-section-head">
            <span className="mkt-eyebrow">Reviews</span>
            <h2 className="mkt-h2">Wat klanten zeggen</h2>
          </div>
        </Reveal>
        <div className="mkt-testimonial-grid">
          {realTestimonials.map((t, i) => (
            <Reveal delay={i * 90} key={t.name + i}>
              <div className="mkt-testimonial-card">
                {t.rating && (
                  <span className="mkt-testimonial-rating">
                    {"★".repeat(t.rating)}
                  </span>
                )}
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
