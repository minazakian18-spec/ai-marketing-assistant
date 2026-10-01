import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductShowcase } from "./product-showcase";
import { Reveal } from "./reveal";
import { PromoLine } from "./promo-line";

export function Hero() {
  return (
    <section className="mkt-hero mkt-hero-dark" id="product">
      <div className="mkt-container mkt-hero-inner">
        <Reveal>
          <PromoLine />
        </Reveal>
        <Reveal delay={60}>
          <h1 className="mkt-h1">
            Je marketingteam.
            <br />
            <em>In één werkruimte.</em>
          </h1>
        </Reveal>
        <Reveal delay={120}>
          <p className="mkt-lede mkt-hero-lede">
            Reviews, social media en e-mail vanuit één plek, zodat jij tijd
            houdt voor je bedrijf.
          </p>
        </Reveal>
        <Reveal delay={180}>
          <div className="mkt-hero-actions">
            <Link href="/register" className="mkt-btn mkt-btn-secondary mkt-btn-lg">
              Gratis starten <ArrowRight size={18} />
            </Link>
          </div>
          <p className="mkt-hero-confidence">Opzegbaar wanneer je wilt</p>
        </Reveal>
        <Reveal delay={260} className="mkt-hero-preview">
          <ProductShowcase />
        </Reveal>
        <Reveal delay={320}>
          <p className="mkt-hero-proof">
            Mavix wordt gebouwd samen met de eerste ondernemers die ermee
            werken.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
