import { Star, Instagram, Mail } from "lucide-react";
import { Reveal } from "./reveal";

const integrations = [
  { icon: Star, name: "Google Business Profile" },
  { icon: Mail, name: "Gmail" },
  { icon: Instagram, name: "Instagram" },
];

export function IntegrationsStrip() {
  return (
    <section className="mkt-section-tight">
      <div className="mkt-container">
        <Reveal className="mkt-section-head">
          <h2 className="mkt-h2">Koppel de tools die je al gebruikt.</h2>
        </Reveal>
        <div className="mkt-integrations-strip">
          {integrations.map((it, i) => (
            <Reveal delay={i * 80} key={it.name}>
              <div className="mkt-integration-chip">
                <it.icon size={17} />
                <span>{it.name}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
