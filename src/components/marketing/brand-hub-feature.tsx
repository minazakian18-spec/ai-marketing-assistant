import { Building2, Goal, Mail, MessageSquareQuote, Package, Palette, ScrollText, Star, Users, Volume2 } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";
import { Reveal } from "./reveal";
import { InView } from "./in-view";

// Brand Hub: the knowledge every AI feature in Mavix starts from. The preview
// mirrors the real Brand Hub fields; the values are an illustrative example.

const STORED = [
  { icon: Building2, label: "Bedrijfsinformatie", text: "Wat je doet, waar je zit en wat je bijzonder maakt." },
  { icon: Palette, label: "Huisstijl", text: "Logo, merkkleuren en beeldstijl." },
  { icon: Volume2, label: "Tone of voice", text: "Hoe je klinkt: vriendelijk, zakelijk, speels of juist rustig." },
  { icon: Users, label: "Doelgroepen", text: "Voor wie je het doet en wat zij belangrijk vinden." },
  { icon: Package, label: "Producten en diensten", text: "Je aanbod, met prijzen en kenmerken." },
  { icon: Goal, label: "Bedrijfsdoelen", text: "Meer reserveringen, vaste klanten of naamsbekendheid." },
  { icon: MessageSquareQuote, label: "Communicatievoorkeuren", text: "Je of u, emoji wel of niet, hoe lang een bericht mag zijn." },
  { icon: ScrollText, label: "Merkinstructies", text: "Wat Mavix altijd of juist nooit moet zeggen." },
];

export function BrandHubFeature() {
  return (
    <section className="mkt-section bh" id="brand-hub" aria-labelledby="bh-title">
      <div className="mkt-container bh-grid">
        <Reveal className="bh-copy">
          <span className="mkt-eyebrow">Brand Hub</span>
          <h2 className="mkt-h2" id="bh-title">
            Mavix leert jouw bedrijf kennen.
          </h2>
          <p className="bh-lead">Je vertelt één keer wie je bent, hoe je klinkt en wat je wilt bereiken. Daarna gebruikt Mavix die kennis in elke post, elke nieuwsbrief en elk reviewantwoord.</p>
          <ul className="bh-stored">
            {STORED.map((s) => (
              <li key={s.label}>
                <s.icon size={16} aria-hidden="true" />
                <span>
                  <strong>{s.label}</strong>
                  <small>{s.text}</small>
                </span>
              </li>
            ))}
          </ul>
          <p className="bh-note">Je past je Brand Hub aan wanneer je wilt. Nieuwe content gebruikt meteen de nieuwste versie.</p>
        </Reveal>
        <Reveal delay={80}>
          <InView className="bh-visual">
            <div className="bh-card">
              <div className="bh-card-head">
                <span className="bh-logo" aria-hidden="true">
                  NL
                </span>
                <span>
                  <strong>Trattoria Nonna Lucia</strong>
                  <small>Italiaans restaurant · Rotterdam</small>
                </span>
              </div>
              <dl>
                <div>
                  <dt>Tone of voice</dt>
                  <dd className="bh-chips">
                    <span>Warm</span>
                    <span>Gastvrij</span>
                    <span>Met een knipoog</span>
                  </dd>
                </div>
                <div>
                  <dt>Doelgroep</dt>
                  <dd>Gezinnen en vriendengroepen uit de buurt</dd>
                </div>
                <div>
                  <dt>Doel dit kwartaal</dt>
                  <dd>Meer reserveringen op doordeweekse avonden</dd>
                </div>
                <div>
                  <dt>Merkkleuren</dt>
                  <dd className="bh-swatches" aria-label="Rood, groen en crème">
                    <i style={{ background: "#a4161a" }} />
                    <i style={{ background: "#2d6a4f" }} />
                    <i style={{ background: "#fbf3e4" }} />
                  </dd>
                </div>
                <div>
                  <dt>Instructie</dt>
                  <dd>Spreek gasten aan met &lsquo;je&rsquo;. Noem nooit kortingen boven 20%.</dd>
                </div>
              </dl>
            </div>
            <div className="bh-flow" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <ul className="bh-outputs">
              <li style={{ ["--i" as string]: 0 }}>
                <BrandIcon brand="instagram" size={16} title="Instagram" />
                <span>
                  <strong>Social</strong>
                  <small>&ldquo;Doordeweeks uit eten? Bij ons voelt dinsdag als zaterdag 🍝&rdquo;</small>
                </span>
              </li>
              <li style={{ ["--i" as string]: 1 }}>
                <Mail size={16} aria-hidden="true" />
                <span>
                  <strong>E-mail</strong>
                  <small>&ldquo;Je tafel staat klaar: reserveer voor donderdag&rdquo;</small>
                </span>
              </li>
              <li style={{ ["--i" as string]: 2 }}>
                <Star size={16} aria-hidden="true" />
                <span>
                  <strong>Reviews</strong>
                  <small>&ldquo;Grazie, Sanne! Fijn dat je je bij ons thuis voelde.&rdquo;</small>
                </span>
              </li>
            </ul>
            <span className="hs-sample">Voorbeeld</span>
          </InView>
        </Reveal>
      </div>
    </section>
  );
}
