import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductPreview } from "./product-preview";
import { Reveal } from "./reveal";
import { PromoLine } from "./promo-line";

export function Hero() {
  return (
    <section className="mkt-hero" id="product">
      <div className="mkt-container mkt-hero-inner">
        <Reveal>
          <PromoLine />
        </Reveal>
        <Reveal delay={60}>
          <h1 className="mkt-h1">
            Je marketingteam.
            <br />
            <em>Eén werkruimte.</em>
          </h1>
        </Reveal>
        <Reveal delay={120}>
          <p className="mkt-lede mkt-hero-lede">
            Reviews, social media en e-mail vanuit één plek — met Mavix als
            extra kracht in je team.
          </p>
        </Reveal>
        <Reveal delay={180}>
          <div className="mkt-hero-actions">
            <Link href="/register" className="mkt-btn mkt-btn-primary mkt-btn-lg">
              Gratis starten <ArrowRight size={18} />
            </Link>
          </div>
        </Reveal>
        <Reveal delay={260} className="mkt-hero-preview">
          <ProductPreview />
        </Reveal>
      </div>
    </section>
  );
}
