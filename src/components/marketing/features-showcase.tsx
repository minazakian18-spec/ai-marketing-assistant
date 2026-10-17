import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, CalendarDays, FolderOpen, Gauge, Inbox, Megaphone, Palette, Plug, type LucideIcon } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";
import { Reveal } from "./reveal";

// The other parts of Mavix, grouped by what they help with. Status labels are
// honest: "In ontwikkeling" = planned and being built, not yet operational.

type Feature = { icon: LucideIcon; name: string; text: string; status?: string; href?: string; mini: ReactNode };

const GROUPS: { title: string; intro: string; items: Feature[] }[] = [
  {
    title: "Groei en zichtbaarheid",
    intro: "Gevonden worden en begrijpen wat je marketing oplevert.",
    items: [
      {
        icon: Gauge,
        name: "SEO Intelligence",
        text: "Scan je website, krijg een SEO-score en concrete verbeterpunten. Met Search Console zie je ook hoe je gevonden wordt in Google.",
        mini: (
          <div className="ft-gauge">
            <span className="ft-score">
              78<small>/100</small>
            </span>
            <ul>
              <li className="is-ok">Laadsnelheid in orde</li>
              <li className="is-warn">3 pagina&apos;s zonder metabeschrijving</li>
            </ul>
          </div>
        ),
      },
      {
        icon: BarChart3,
        name: "Inzichten",
        text: "Je resultaten met uitleg, plus onderzoek naar je bedrijf en markt. Mavix vertelt wat er gebeurt en wat je eraan kunt doen.",
        mini: (
          <div className="ft-spark">
            <svg viewBox="0 0 120 36" aria-hidden="true">
              <polyline points="0,30 20,26 40,28 60,18 80,20 100,10 120,6" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <small>Reviews en bereik groeien sinds je vaker post.</small>
          </div>
        ),
      },
      {
        icon: Megaphone,
        name: "Google Ads",
        status: "In ontwikkeling",
        text: "Je advertentiecampagnes en resultaten begrijpen en beheren vanuit Mavix, met voorstellen om je budget slimmer in te zetten.",
        mini: (
          <div className="ft-ads">
            <BrandIcon brand="google_ads" size={16} title="Google Ads" />
            <span>
              <strong>Campagne: lunchmenu</strong>
              <small>Voorbeeld van de geplande weergave</small>
            </span>
          </div>
        ),
      },
    ],
  },
  {
    title: "Organisatie",
    intro: "Je planning, gesprekken en beeldmateriaal op orde.",
    items: [
      {
        icon: CalendarDays,
        name: "Kalender",
        text: "Content, campagnes en afspraken centraal gepland. Je ziet per dag wat klaarstaat en wat nog goedgekeurd moet worden.",
        mini: (
          <div className="ft-cal">
            <i className="is-purple" />
            <i />
            <i className="is-green" />
            <i className="is-amber" />
            <i />
            <i className="is-purple" />
            <i />
          </div>
        ),
      },
      {
        icon: Inbox,
        name: "Inbox",
        text: "Klantgesprekken uit je gekoppelde kanalen op één plek, met AI-hulp bij het antwoorden. Kanalen komen stap voor stap beschikbaar.",
        mini: (
          <div className="ft-inbox">
            <BrandIcon brand="whatsapp" size={15} title="WhatsApp" />
            <BrandIcon brand="gmail" size={15} title="Gmail" />
            <BrandIcon brand="messenger" size={15} title="Messenger" />
            <small>1 inbox voor al je kanalen</small>
          </div>
        ),
      },
      {
        icon: FolderOpen,
        name: "Bibliotheek",
        text: "Al je foto's, AI-beelden en logo's veilig bewaard en snel terug te vinden, zodat je ze opnieuw gebruikt in posts en mails.",
        mini: (
          <div className="ft-lib" aria-hidden="true">
            <i style={{ background: "linear-gradient(135deg,#fde68a,#f97316)" }} />
            <i style={{ background: "linear-gradient(135deg,#c4b5fd,#6d28d9)" }} />
            <i style={{ background: "linear-gradient(135deg,#a7f3d0,#059669)" }} />
            <i style={{ background: "linear-gradient(135deg,#fbcfe8,#db2777)" }} />
          </div>
        ),
      },
    ],
  },
  {
    title: "De basis",
    intro: "Waar alles in Mavix mee begint.",
    items: [
      {
        icon: Palette,
        name: "Brand Hub",
        href: "#brand-hub",
        text: "Je bedrijfsinformatie, huisstijl en tone of voice op één plek. Elke AI-functie gebruikt deze kennis.",
        mini: (
          <div className="ft-swatches" aria-hidden="true">
            <i style={{ background: "#6d28d9" }} />
            <i style={{ background: "#f59e0b" }} />
            <i style={{ background: "#0f766e" }} />
            <small>Warm · gastvrij · met een knipoog</small>
          </div>
        ),
      },
      {
        icon: Plug,
        name: "Integraties",
        href: "#integraties",
        text: "Koppel Google, Instagram, WhatsApp en meer aan je werkruimte. In de app zie je per koppeling of hij actief is.",
        mini: (
          <div className="ft-inbox">
            <BrandIcon brand="google_business" size={15} title="Google" />
            <BrandIcon brand="instagram" size={15} title="Instagram" />
            <BrandIcon brand="google_calendar" size={15} title="Google Agenda" />
            <BrandIcon brand="search_console" size={15} title="Search Console" />
          </div>
        ),
      },
    ],
  },
];

export function FeaturesShowcase() {
  return (
    <section className="mkt-section ft" id="functies" aria-labelledby="ft-title">
      <div className="mkt-container">
        <Reveal className="mkt-section-head">
          <span className="mkt-eyebrow">Functies</span>
          <h2 className="mkt-h2" id="ft-title">
            Alles wat er verder bij hoort.
          </h2>
          <p className="hs-lead">Naast reviews, social en e-mail helpt Mavix je met vindbaarheid, planning en overzicht.</p>
        </Reveal>
        <div className="ft-groups">
          {GROUPS.map((g) => (
            <Reveal key={g.title} className="ft-group">
              <div className="ft-group-head">
                <h3>{g.title}</h3>
                <p>{g.intro}</p>
              </div>
              <ul className="ft-cards">
                {g.items.map((f) => (
                  <li key={f.name} className="ft-card">
                    <div className="ft-mini">{f.mini}</div>
                    <h4>
                      <f.icon size={16} aria-hidden="true" /> {f.name}
                      {f.status && <span className="ft-status">{f.status}</span>}
                    </h4>
                    <p>{f.text}</p>
                    {f.href && (
                      <Link href={f.href} className="ft-link">
                        Meer over {f.name} <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
