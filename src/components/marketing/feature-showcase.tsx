import {
  Star,
  Instagram,
  Mail,
  CalendarDays,
  ChartNoAxesCombined,
  Images,
  Plug,
  Check,
} from "lucide-react";
import { Reveal } from "./reveal";

const features = [
  {
    icon: Star,
    title: "Review AI",
    description:
      "Beantwoord Google-reviews met een persoonlijke toon die past bij je merk — niet met dezelfde tekst voor iedereen.",
    points: [
      "Herkent sterren, sentiment en type klacht",
      "Assist, Auto Create of Full Pilot per regel",
      "Waarschuwing bij negatieve reviews",
    ],
  },
  {
    icon: Instagram,
    title: "Instagram AI",
    description:
      "Van los idee naar caption, hashtags en beeldconcept — afgestemd op doel, doelgroep en merkstem.",
    points: [
      "Structured brief per post: doel, segment, CTA",
      "Gebruikt je Brand Hub en productcatalogus",
      "Plant automatisch door naar de kalender",
    ],
  },
  {
    icon: Mail,
    title: "Email AI",
    description:
      "Nieuwsbrieven, promoties en follow-ups die klinken zoals jouw bedrijf, niet zoals een generieke tool.",
    points: [
      "Doel, toon, lengte en CTA per e-mail",
      "Segmenteert op basis van je contacten",
      "Nooit verzonden zonder jouw goedkeuring",
    ],
  },
  {
    icon: CalendarDays,
    title: "Content Calendar",
    description:
      "Alle content — Instagram, e-mail en campagnes — in één overzicht dat aanvoelt als plannen, niet als administratie.",
    points: [
      "Maand-, week- en lijstweergave",
      "Sleep content simpelweg naar een andere dag",
      "Zie in één oogopslag wat goedkeuring nodig heeft",
    ],
  },
  {
    icon: ChartNoAxesCombined,
    title: "Analytics",
    description:
      "Begrijp wat werkt per kanaal, zodat elke volgende actie beter onderbouwd is dan de vorige.",
    points: [
      "Aparte inzichten voor Instagram, e-mail en reviews",
      "Duidelijk onderscheid tussen voorbeeld- en live data",
      "Groeit mee zodra kanalen echt gekoppeld zijn",
    ],
  },
  {
    icon: Images,
    title: "Library",
    description:
      "Je centrale archief voor alles wat Mavix en jouw team ooit heeft gemaakt.",
    points: [
      "Filter op type, kanaal en status",
      "Hergebruik eerdere content in nieuwe campagnes",
      "Nooit meer een goede caption kwijtraken",
    ],
  },
  {
    icon: Plug,
    title: "Integraties",
    description:
      "Koppel de tools die je al gebruikt, zonder overal apart te hoeven inloggen.",
    points: [
      "Google Business Profile voor reviews",
      "Instagram voor publiceren en plannen",
      "Gmail voor Email AI",
    ],
  },
];

export function FeatureShowcase() {
  return (
    <section className="mkt-section">
      <div className="mkt-container">
        <Reveal>
          <div className="mkt-section-head">
            <span className="mkt-eyebrow">Alles wat je nodig hebt</span>
            <h2 className="mkt-h2">Eén platform, elk marketingkanaal</h2>
          </div>
        </Reveal>
        {features.map((f, i) => (
          <Reveal key={f.title}>
            <div className={"mkt-feature-row" + (i % 2 ? " reverse" : "")}>
              <div className="mkt-feature-copy">
                <span className="mkt-feature-icon">
                  <f.icon size={19} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.description}</p>
                <ul>
                  {f.points.map((p) => (
                    <li key={p}>
                      <Check size={15} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mkt-feature-visual" aria-hidden="true">
                <div className="mkt-preview-card-line">
                  <strong>{f.title}</strong>
                  <span>Productvoorbeeld</span>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
