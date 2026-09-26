import { PenLine, Sparkles, Rocket } from "lucide-react";
import { Reveal } from "./reveal";

const modes = [
  {
    icon: PenLine,
    title: "Assist",
    description:
      "AI helpt je op aanvraag: jij vraagt om een reactie, caption of e-mail, en blijft overal zelf de regie voeren.",
  },
  {
    icon: Sparkles,
    title: "Auto Create",
    description:
      "Mavix bedenkt en maakt content volgens jouw ritme en regels. Jij keurt goed voordat er iets naar buiten gaat.",
    featured: true,
  },
  {
    icon: Rocket,
    title: "Full Pilot",
    description:
      "Mavix handelt goedgekeurde workflows volledig zelfstandig af binnen de grenzen die jij instelt — zonder dat je per item hoeft te klikken.",
  },
];

export function AutomationModes() {
  return (
    <section className="mkt-section" id="oplossingen">
      <div className="mkt-container">
        <Reveal>
          <div className="mkt-section-head">
            <span className="mkt-eyebrow">Jij bepaalt hoeveel AI doet</span>
            <h2 className="mkt-h2">Drie niveaus van automatisering</h2>
            <p className="mkt-lede">
              Begin met volledige controle en schaal op naar automatisering
              zodra je Mavix vertrouwt.
            </p>
          </div>
        </Reveal>
        <div className="mkt-modes">
          {modes.map((m, i) => (
            <Reveal delay={i * 100} key={m.title}>
              <div className={"mkt-mode-card" + (m.featured ? " featured" : "")}>
                <span className="mkt-mode-icon">
                  <m.icon size={20} />
                </span>
                <h3>{m.title}</h3>
                <p>{m.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
