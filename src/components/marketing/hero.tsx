import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { ProductPreview } from "./product-preview";
import { Reveal } from "./reveal";

export function Hero() {
  return (
    <section className="mkt-hero" id="product">
      <div className="mkt-container mkt-hero-inner">
        <Reveal>
          <span className="mkt-eyebrow">AI-marketingplatform voor ondernemers</span>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="mkt-h1">
            Jouw AI-marketingteam.
            <br />
            <em>In één werkruimte.</em>
          </h1>
        </Reveal>
        <Reveal delay={140}>
          <p className="mkt-lede" style={{ margin: "0 auto" }}>
            Mavix beheert je Google-reviews, Instagram, e-mailmarketing en
            content vanuit één plek — zodat jij weer tijd hebt voor je bedrijf
            in plaats van voor je marketing.
          </p>
        </Reveal>
        <Reveal delay={200}>
          <div className="mkt-hero-actions">
            <Link href="/register" className="mkt-btn mkt-btn-primary">
              Gratis starten <ArrowRight size={17} />
            </Link>
            <Link href="#product-demo" className="mkt-btn mkt-btn-secondary">
              <PlayCircle size={17} /> Bekijk hoe Mavix werkt
            </Link>
          </div>
          <p className="mkt-hero-note">
            Geen creditcard nodig om te starten · opzegbaar wanneer je wilt
          </p>
        </Reveal>
        <Reveal delay={260} className="mkt-hero-preview">
          <ProductPreview />
        </Reveal>
      </div>
    </section>
  );
}
