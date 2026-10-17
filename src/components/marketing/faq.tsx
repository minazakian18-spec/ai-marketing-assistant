import Link from "next/link";
import { Plus } from "lucide-react";
import { Reveal } from "./reveal";
import { PLAN_IDS, PLANS, euro } from "@/lib/plans";

export type FaqItem = { q: string; a: string };

const prices = PLAN_IDS.map((id) => `${PLANS[id].name} ${euro(PLANS[id].monthlyPrice)}`).join(", ");
const users = PLAN_IDS.map((id) => `${PLANS[id].name} ${PLANS[id].users}`).join(", ");

// Homepage FAQ. Answers describe what works today and say plainly what is
// still waiting for approval by Google or Meta, without dropping the plan.
export const generalFaq: FaqItem[] = [
  {
    q: "Wat is Mavix precies?",
    a: "Mavix is een AI-marketingwerkruimte voor ondernemers. Je beantwoordt er Google-reviews, maakt en plant Instagram-content, schrijft e-mailcampagnes en houdt je resultaten bij. De AI bereidt het werk voor op basis van jouw Brand Hub; jij beslist wat er gebeurt.",
  },
  {
    q: "Voor welke bedrijven is Mavix geschikt?",
    a: "Voor kleine en middelgrote bedrijven zonder eigen marketingafdeling: restaurants, winkels, salons, sportscholen, praktijken en andere lokale dienstverleners. Mavix is gemaakt voor ondernemers die hun marketing goed willen doen, maar er niet elke dag uren aan kunnen besteden.",
  },
  {
    q: "Welke marketingkanalen kan ik beheren?",
    a: "Google-reviews, Instagram (posts, AI-afbeeldingen en carrousels), e-mailmarketing en klantgesprekken in je Inbox. Daarnaast helpen SEO Intelligence en Inzichten je met vindbaarheid en resultaten. Google Ads is in ontwikkeling. Facebook, LinkedIn en TikTok volgen later.",
  },
  {
    q: "Kan ik mijn bestaande accounts koppelen?",
    a: "Ja. Je koppelt onder meer je Google Bedrijfsprofiel, Gmail, Google Agenda, Search Console, Instagram, WhatsApp Business en Facebook Messenger aan je werkruimte. Een aantal koppelingen wacht nog op goedkeuring van Google of Meta; in Mavix zie je per koppeling of hij al actief is. Tot die tijd plan je content in Mavix en plaats je die zelf.",
  },
  {
    q: "Heb ik technische kennis nodig?",
    a: "Nee. Je werkt met gewone formulieren en knoppen, en je kunt de Mavix Agent in gewone taal vragen wat je wilt. Bij de start helpen we je persoonlijk met je Brand Hub en je eerste koppelingen.",
  },
  {
    q: "Hoe leert Mavix mijn bedrijf kennen?",
    a: "Via de Brand Hub. Daarin leg je vast wat je doet, voor wie, hoe je klinkt, welke producten je hebt, wat je doelen zijn en wat Mavix wel of niet mag zeggen. Elke AI-functie gebruikt die informatie, zodat je content consistent en herkenbaar blijft.",
  },
  {
    q: "Kan ik AI-content controleren voordat deze wordt gebruikt?",
    a: "Ja. Wat Mavix maakt, komt eerst als concept bij jou binnen. Je leest het, past het aan of keurt het goed. Pas daarna wordt het ingepland of verstuurd.",
  },
  {
    q: "Kan Mavix automatisch taken uitvoeren?",
    a: "Je kiest zelf hoeveel Mavix doet. In Assist werkt Mavix alleen als jij een opdracht geeft. Met Auto Create bereidt Mavix volgens je planning zelf concepten voor die op je goedkeuring wachten; die functie is nu als voorbeeld te bekijken en wordt verder uitgebouwd. Volledig automatisch publiceren volgt zodra de koppelingen met Google en Meta zijn goedgekeurd, en altijd binnen de regels die jij instelt.",
  },
  {
    q: "Hoe werkt de contentkalender?",
    a: "In de kalender zie je al je posts, campagnes en afspraken per dag of week. Bij elk item staat de status: concept, wacht op goedkeuring, goedgekeurd of ingepland. Je verplaatst items, opent ze om ze te bewerken en ziet in één oogopslag waar nog gaten zitten.",
  },
  {
    q: "Kan ik meerdere medewerkers of locaties beheren?",
    a: `Je nodigt collega's uit met een eigen rol: eigenaar, beheerder of lid. Het aantal gebruikers hangt af van je pakket (${users}). Elke werkruimte hoort bij één bedrijf; heb je meerdere vestigingen, neem dan contact op, dan bekijken we samen wat het beste werkt.`,
  },
  {
    q: "Hoe werken de abonnementen?",
    a: `Er zijn drie pakketten: ${prices} per maand, excl. btw. Elk pakket heeft een maandtegoed aan AI-credits en een maximum per functie. Je zegt maandelijks op. Tijdens de besloten beta betalen deelnemers niets.`,
  },
  {
    q: "Zijn er extra kosten voor externe platformen?",
    a: "Mavix rekent zelf geen extra kosten voor koppelingen. Kosten die je bij een ander platform maakt, zoals advertentiebudget, betaal je rechtstreeks aan dat platform.",
  },
  {
    q: "Hoe veilig zijn mijn bedrijfsgegevens?",
    a: "Elke werkruimte is afgeschermd: je ziet en bewerkt alleen de gegevens van je eigen bedrijf. Foto's staan in privéopslag en worden alleen via tijdelijke, beveiligde links getoond. Hoe we met gegevens omgaan, lees je in ons privacybeleid.",
  },
  {
    q: "Kan ik op elk moment opzeggen?",
    a: "Ja. Elk abonnement is maandelijks opzegbaar, zonder opzegkosten.",
  },
  {
    q: "Kan ik eerst een demo aanvragen?",
    a: "Graag zelfs. Vraag een demo aan en we laten in een persoonlijk gesprek zien hoe Mavix werkt voor jouw bedrijf. Daarna beslis je of je wilt starten; we zetten je werkruimte dan samen met je klaar.",
  },
];

export function Faq({ items = generalFaq, heading = "Veelgestelde vragen" }: { items?: FaqItem[]; heading?: string }) {
  return (
    <section className="mkt-section" id="faq">
      <div className="mkt-container fq">
        <Reveal className="fq-head">
          <span className="mkt-eyebrow">Vragen</span>
          <h2 className="mkt-h2">{heading}</h2>
          <p>
            Staat je vraag er niet bij? <Link href="/demo">Plan een demo</Link> en stel hem persoonlijk.
          </p>
        </Reveal>
        <Reveal>
          <div className="mkt-faq fq-list">
            {items.map((item) => (
              <details className="mkt-faq-item fq-item" key={item.q}>
                <summary>
                  <span>{item.q}</span>
                  <Plus size={18} aria-hidden="true" />
                </summary>
                <div className="fq-answer">
                  <p>{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
