import Link from "next/link";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
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
            <Link href="/register" className="mkt-btn mkt-hero-cta">
              Get started
            </Link>
          </div>
          <p className="mkt-hero-confidence">
            <ShieldCheck size={14} />
            Opzegbaar wanneer je wilt
          </p>
        </Reveal>
      </div>
      <Reveal delay={260} className="mkt-hero-visual">
        <Image
          src="/hero-visual.webp"
          alt="Het Mavix-dashboard met een Google-review, een door Mavix geschreven reactie, een geplande Instagram-post en een e-mailcampagne"
          width={1672}
          height={791}
          sizes="(max-width: 640px) 165vw, (max-width: 1200px) 100vw, 1200px"
          loading="eager"
          fetchPriority="high"
          unoptimized
        />
      </Reveal>
      <div className="mkt-container">
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
