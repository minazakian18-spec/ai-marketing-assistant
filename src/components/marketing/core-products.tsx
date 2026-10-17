import Image from "next/image";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send, Sparkles, Star } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";
import { Reveal } from "./reveal";
import { InView } from "./in-view";

// Three large product demos. All names, reviews, posts and e-mails are
// illustrative examples (labelled as such), not real customers or results.

function Stars({ n = 5 }: { n?: number }) {
  return (
    <span className="hs-stars" aria-label={`${n} van 5 sterren`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={14} fill={i < n ? "currentColor" : "none"} aria-hidden="true" />
      ))}
    </span>
  );
}

function ReviewDemo() {
  return (
    <InView className="hs-shot hs-review">
      <div className="hs-review-card">
        <div className="hs-review-top">
          <span className="hs-avatar" style={{ background: "#0f766e" }} aria-hidden="true">
            S
          </span>
          <span>
            <strong>Sanne de V.</strong>
            <small>2 dagen geleden</small>
          </span>
          <BrandIcon brand="google_reviews" size={18} title="Google-review" />
        </div>
        <Stars />
        <p>Heerlijke pizza en supersnel bezorgd. De truffelpizza is echt een aanrader, we komen zeker terug!</p>
      </div>
      <div className="hs-reply">
        <span className="hs-reply-label">
          <Sparkles size={13} aria-hidden="true" /> Voorstel van Mavix
        </span>
        <p>
          <span className="hs-type">Wat leuk om te lezen, Sanne! Fijn dat de truffelpizza zo goed beviel.</span>{" "}
          <span className="hs-type hs-type-2">Tot de volgende keer, het team van Nonna Lucia</span>
        </p>
        <div className="hs-reply-actions" aria-hidden="true">
          <span className="is-primary">Goedkeuren</span>
          <span>Aanpassen</span>
        </div>
      </div>
      <span className="hs-sample">Voorbeeld</span>
    </InView>
  );
}

function SocialDemo() {
  return (
    <InView className="hs-shot hs-social">
      <div className="hs-ig">
        <div className="hs-ig-head">
          <span className="hs-ig-ring">
            <Image src="/showcase/nonna-lucia.svg" alt="" width={30} height={30} unoptimized />
          </span>
          <span>
            <strong>trattoria.nonnalucia</strong>
            <small>Rotterdam</small>
          </span>
          <MoreHorizontal size={16} aria-hidden="true" />
        </div>
        <div className="hs-ig-media">
          <Image src="/showcase/social-pizza-post.svg" alt="Voorbeeldpost: het plan is één stukje pizza, de werkelijkheid is een hele pizza" width={400} height={400} unoptimized />
        </div>
        <div className="hs-ig-icons" aria-hidden="true">
          <Heart size={19} />
          <MessageCircle size={19} />
          <Send size={19} />
          <Bookmark size={19} className="hs-ig-save" />
        </div>
        <p className="hs-ig-caption">
          <strong>trattoria.nonnalucia</strong> We kennen het allemaal. 🍕 Elke maandag krijg je de tweede pizza voor de halve prijs. Tag je pizzamaatje!
          <span className="hs-ig-tags"> #pizzamaandag #rotterdam</span>
        </p>
      </div>
      <span className="hs-sample">Voorbeeld, niet gepubliceerd</span>
    </InView>
  );
}

function EmailDemo() {
  return (
    <InView className="hs-shot hs-email">
      <div className="hs-mail">
        <div className="hs-mail-meta">
          <span>
            <small>Van</small> <span>Bakkerij De Korenaar</span>
          </span>
          <span>
            <small>Onderwerp</small> <strong>Dit weekend: verse croissants voor €1</strong>
          </span>
        </div>
        <div className="hs-mail-body">
          <div className="hs-mail-brand">
            <Image src="/showcase/de-korenaar.svg" alt="" width={34} height={34} unoptimized />
            <span>De Korenaar</span>
          </div>
          <Image className="hs-mail-hero" src="/showcase/newsletter-bakery.svg" alt="Illustratie van croissants en koffie" width={480} height={220} unoptimized />
          <h4>Ons weekendontbijt is terug</h4>
          <p>Zaterdag en zondag begin je de dag bij ons: roomboter&shy;croissants voor €1 bij elke koffie.</p>
          <span className="hs-mail-cta">Bekijk het weekendmenu</span>
        </div>
      </div>
      <span className="hs-sample">Voorbeeld</span>
    </InView>
  );
}

const products = [
  { name: "Review AI", title: "Elke review een persoonlijk antwoord", description: "Mavix leest je Google-reviews en stelt een passend antwoord voor in jouw toon. Jij keurt goed met één klik.", demo: <ReviewDemo /> },
  { name: "Social AI", title: "Posts waarvoor mensen stoppen met scrollen", description: "Van idee tot beeld en caption: Mavix maakt Instagram-content die bij je merk past, klaar om in te plannen.", demo: <SocialDemo /> },
  { name: "Email AI", title: "Nieuwsbrieven met de uitstraling van een bureau", description: "Mavix schrijft je campagne en zet hem op, met onderwerpregel, beeld en knop. Jij bepaalt wanneer hij de deur uit gaat.", demo: <EmailDemo /> },
];

export function CoreProducts() {
  return (
    <section className="mkt-section hs-core" id="product">
      <div className="mkt-container">
        <Reveal className="mkt-section-head">
          <h2 className="mkt-h2">Alles wat je marketing nodig heeft.</h2>
          <p className="hs-lead">Drie AI-assistenten in één werkruimte. Bekijk wat ze voor je voorbereiden.</p>
        </Reveal>
        <div className="hs-core-grid">
          {products.map((p, i) => (
            <Reveal delay={i * 80} key={p.name}>
              <article className="hs-core-card">
                {p.demo}
                <div className="hs-core-text">
                  <span className="hs-core-tag">
                    <Sparkles size={12} aria-hidden="true" />
                    {p.name}
                  </span>
                  <h3>{p.title}</h3>
                  <p>{p.description}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
