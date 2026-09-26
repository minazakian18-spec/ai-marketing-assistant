import { ChevronDown } from "lucide-react";
import { Reveal } from "./reveal";

export type FaqItem = { q: string; a: string };

export const generalFaq: FaqItem[] = [
  {
    q: "Wat is Mavix?",
    a: "Mavix is een AI-marketingwerkruimte waarmee je Google-reviews, Instagram, e-mailmarketing en content vanuit één plek beheert.",
  },
  {
    q: "Kan Mavix automatisch op reviews reageren?",
    a: "Ja. In Assist stel je zelf een reactie op met AI-hulp, in Auto Create keur je AI-reacties goed voordat ze gepubliceerd worden, en in Full Pilot handelt Mavix dit volledig zelfstandig af binnen de regels die jij instelt.",
  },
  {
    q: "Kan Mavix automatisch posten op Instagram?",
    a: "Ja, met Auto Create of Full Pilot. Je bepaalt zelf of Mavix eerst jouw goedkeuring vraagt.",
  },
  {
    q: "Kan ik content eerst goedkeuren?",
    a: "Altijd. Assist en Auto Create vragen standaard om goedkeuring; alleen Full Pilot publiceert zelfstandig, en alleen binnen de grenzen die jij vooraf instelt.",
  },
  {
    q: "Welke integraties ondersteunt Mavix?",
    a: "Op dit moment Google Business Profile, Instagram en Gmail. We voegen bewust geen koppelingen toe die nog niet goed werken.",
  },
  {
    q: "Kan ik op elk moment opzeggen?",
    a: "Ja, elk Mavix-abonnement is maandelijks opzegbaar.",
  },
  {
    q: "Is mijn bedrijfsdata veilig?",
    a: "Beveiliging en dataverwerking worden zorgvuldig geïmplementeerd; details vind je zodra ons Privacybeleid en de verwerkersovereenkomst gepubliceerd zijn.",
  },
  {
    q: "Kunnen meerdere medewerkers dezelfde werkruimte gebruiken?",
    a: "Ja, via Team & Gebruikers kun je collega's uitnodigen met een eigen rol (Eigenaar, Beheerder of Lid).",
  },
];

export function Faq({
  items = generalFaq,
  heading = "Veelgestelde vragen",
}: {
  items?: FaqItem[];
  heading?: string;
}) {
  return (
    <section className="mkt-section" id="faq">
      <div className="mkt-container">
        <Reveal>
          <div className="mkt-section-head">
            <span className="mkt-eyebrow">Vragen</span>
            <h2 className="mkt-h2">{heading}</h2>
          </div>
        </Reveal>
        <Reveal>
          <div className="mkt-faq">
            {items.map((item) => (
              <details className="mkt-faq-item" key={item.q}>
                <summary>
                  {item.q}
                  <ChevronDown size={17} />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
