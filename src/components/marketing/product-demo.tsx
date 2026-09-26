"use client";
import { useState } from "react";
import { Star, Instagram, Mail, CalendarDays } from "lucide-react";
import { Reveal } from "./reveal";

const demos = [
  {
    id: "review",
    label: "Review AI",
    icon: Star,
    steps: [
      ["Klant schrijft een Google-review", "Positief of negatief, met of zonder tekst."],
      ["Review komt binnen bij Mavix", "Automatisch gesynchroniseerd via Google Business Profile."],
      ["AI analyseert toon en inhoud", "Sterren, sentiment en type klacht worden herkend."],
      ["AI stelt een persoonlijke reactie voor", "Geen twee reacties zijn hetzelfde."],
      ["Jij keurt goed, of Full Pilot regelt het", "Op basis van de regels die jij instelt."],
      ["Reactie verschijnt op Google", "Binnen enkele seconden na goedkeuring."],
    ],
    visualTitle: "Reactie op 5★ review van Lotte V.",
    visualBody:
      "“Wat fijn om te lezen, Lotte! Dankjewel voor je vertrouwen — we hopen je snel weer te mogen verwelkomen.”",
  },
  {
    id: "instagram",
    label: "Instagram AI",
    icon: Instagram,
    steps: [
      ["Jij geeft een kort idee", "“Maak een post over onze zomercollectie.”"],
      ["Mavix gebruikt je Brand Hub", "Merkstem, doelgroep en producten worden meegenomen."],
      ["AI maakt caption, hashtags en beeldconcept", "Afgestemd op doel en doelgroep."],
      ["Jij bekijkt en past aan", "Volledige controle voor publicatie."],
      ["Content verschijnt in de kalender", "Ingepland op het beste moment."],
    ],
    visualTitle: "Nieuw concept: Zomercollectie",
    visualBody: "Caption, hashtags en beeldconcept klaar voor jouw goedkeuring.",
  },
  {
    id: "email",
    label: "Email AI",
    icon: Mail,
    steps: [
      ["Kies doel en doelgroep", "Nieuwsbrief, promotie of follow-up."],
      ["Mavix combineert context", "Merkstem, product en gewenste toon en lengte."],
      ["AI schrijft onderwerp, body en CTA", "Klaar om te bekijken."],
      ["Jij keurt goed en plant in", "Verstuurd op het moment dat jij kiest."],
    ],
    visualTitle: "Concept: Nieuwe zomercollectie",
    visualBody: "Onderwerp, preview-tekst en body staan klaar voor controle.",
  },
  {
    id: "calendar",
    label: "Content Calendar",
    icon: CalendarDays,
    steps: [
      ["Alle content op één plek", "Instagram, e-mail en campagnes samen."],
      ["Sleep content naar een andere dag", "Tijd blijft behouden."],
      ["Zie in één oogopslag de status", "Concept, ter goedkeuring, gepland of gepubliceerd."],
      ["Open het zijpaneel voor details", "Bewerk, dupliceer of keur direct goed."],
    ],
    visualTitle: "Deze week",
    visualBody: "3 Instagram-posts, 1 nieuwsbrief en 2 concepten ter goedkeuring.",
  },
] as const;

type DemoId = (typeof demos)[number]["id"];

export function ProductDemo() {
  const [active, setActive] = useState<DemoId>(demos[0].id);
  const demo = demos.find((d) => d.id === active) || demos[0];
  return (
    <section className="mkt-section" id="product-demo">
      <div className="mkt-container">
        <Reveal>
          <div className="mkt-section-head">
            <span className="mkt-eyebrow">Zo werkt het echt</span>
            <h2 className="mkt-h2">Eén werkruimte, vier AI-collega&apos;s</h2>
            <p className="mkt-lede">
              Wissel tussen kanalen en zie precies hoe Mavix van idee naar
              resultaat gaat.
            </p>
          </div>
        </Reveal>
        <div
          className="mkt-demo-tabs"
          role="tablist"
          aria-label="Kies een Mavix-onderdeel"
        >
          {demos.map((d) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={active === d.id}
              className="mkt-demo-tab"
              onClick={() => setActive(d.id)}
            >
              <d.icon size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
              {d.label}
            </button>
          ))}
        </div>
        <Reveal key={demo.id}>
          <div className="mkt-demo-panel" role="tabpanel">
            <div className="mkt-demo-steps">
              {demo.steps.map(([title, body], i) => (
                <div className="mkt-demo-step" key={title}>
                  <span className="mkt-demo-step-num">{i + 1}</span>
                  <div>
                    <strong>{title}</strong>
                    <span>{body}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mkt-demo-visual">
              <div className="mkt-preview-card-line">
                <strong>{demo.visualTitle}</strong>
                <span>{demo.visualBody}</span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
