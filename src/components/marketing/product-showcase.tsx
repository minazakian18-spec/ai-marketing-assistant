import { Star, Sparkles, Instagram, CalendarCheck, Send } from "lucide-react";

export function ProductShowcase() {
  return (
    <div className="mkt-showcase">
      <div className="mkt-showcase-panel mkt-showcase-panel-review">
        <span className="mkt-showcase-stars">
          <Star size={12} fill="currentColor" />
          <Star size={12} fill="currentColor" />
          <Star size={12} fill="currentColor" />
          <Star size={12} fill="currentColor" />
          <Star size={12} fill="currentColor" />
        </span>
        <p className="mkt-showcase-name">Lotte V.</p>
        <p className="mkt-showcase-quote">
          “Superfijne ervaring, het team dacht echt mee!”
        </p>
      </div>

      <div className="mkt-showcase-panel mkt-showcase-panel-main">
        <span className="mkt-showcase-tag">
          <Sparkles size={12} />
          Mavix reageert
        </span>
        <p className="mkt-showcase-reply">
          “Wat fijn om te lezen, Lotte! Dankjewel voor je vertrouwen — we
          hopen je snel weer te mogen verwelkomen.”
        </p>
        <span className="mkt-showcase-sent">Automatisch verzonden</span>
      </div>

      <div className="mkt-showcase-panel mkt-showcase-panel-instagram">
        <div className="mkt-showcase-insta-art" aria-hidden="true" />
        <p className="mkt-showcase-caption">Nieuwe collectie is binnen ✨</p>
        <span className="mkt-showcase-meta">
          <Instagram size={12} />
          <CalendarCheck size={12} />
          Gepland
        </span>
      </div>

      <div className="mkt-showcase-panel mkt-showcase-panel-agent">
        <p className="mkt-showcase-agent-q">Wat wil je vandaag maken?</p>
        <span className="mkt-showcase-chip">Beantwoord review</span>
        <span className="mkt-showcase-chip">Plan Instagram-post</span>
        <span className="mkt-showcase-send">
          <Send size={13} />
        </span>
      </div>
    </div>
  );
}
