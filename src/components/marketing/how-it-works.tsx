import { Plug, Sparkles, CircleCheck } from "lucide-react";
import { Reveal } from "./reveal";

const steps = [
  {
    icon: Plug,
    title: "Koppel je kanalen",
    description: "Google, Gmail, Instagram, WhatsApp en meer.",
  },
  {
    icon: Sparkles,
    title: "Mavix doet het werk",
    description:
      "Mavix maakt content, schrijft reacties en bereidt campagnes voor.",
  },
  {
    icon: CircleCheck,
    title: "Jij houdt controle",
    description: "Goedkeuren, aanpassen of automatiseren.",
  },
];

export function HowItWorks() {
  return (
    <section className="mkt-section-tight">
      <div className="mkt-container">
        <Reveal className="mkt-section-head">
          <h2 className="mkt-h2">Zo werkt Mavix.</h2>
        </Reveal>
        <div className="mkt-steps-grid">
          {steps.map((s, i) => (
            <Reveal delay={i * 80} key={s.title}>
              <div className="mkt-step">
                <span className="mkt-step-number">{i + 1}</span>
                <s.icon size={18} className="mkt-step-icon" />
                <h3>{s.title}</h3>
                <p>{s.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
