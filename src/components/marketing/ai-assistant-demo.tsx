import { Sparkles } from "lucide-react";
import { Reveal } from "./reveal";

export function AiAssistantDemo() {
  return (
    <section className="mkt-section mkt-section-tight">
      <div className="mkt-container">
        <Reveal>
          <div className="mkt-section-head">
            <span className="mkt-eyebrow">Praat gewoon met Mavix</span>
            <h2 className="mkt-h2">Eén opdracht is genoeg</h2>
            <p className="mkt-lede">
              Geen ingewikkelde formulieren — vertel Mavix wat je wilt en het
              werkt de rest uit met je merkcontext.
            </p>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="mkt-chat">
            <div className="mkt-chat-bubble mkt-chat-user">
              Maak een Instagram-campagne voor onze nieuwe zomermenukaart.
            </div>
            <div className="mkt-chat-bubble mkt-chat-mavix">
              <Sparkles size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Ik heb 5 postconcepten gemaakt op basis van je Brand Hub en ze
              voor volgende week ingepland. Bekijk en keur ze goed in je
              contentkalender.
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
