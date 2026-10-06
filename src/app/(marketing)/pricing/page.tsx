import type { Metadata } from "next";
import { Check } from "lucide-react";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { Reveal } from "@/components/marketing/reveal";
import { compareRows, pricingPlans } from "@/lib/pricing-data";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Prijzen",
  description:
    "Bekijk de Mavix-abonnementen voor AI-marketing: Starter, Growth en Autopilot. Maandelijks opzegbaar, prijzen exclusief btw.",
  path: "/pricing",
});

const pricingFaq: FaqItem[] = [
  {
    q: "Kan ik op elk moment op- of afschalen?",
    a: "Ja, je kunt op elk moment upgraden. Downgraden gaat in op de eerstvolgende factureringsdatum.",
  },
  {
    q: "Welke betaalmethoden ondersteunt Mavix?",
    a: "iDEAL, creditcard/debitcard en PayPal.",
  },
  {
    q: "Zijn de prijzen inclusief btw?",
    a: "Nee, alle prijzen zijn exclusief btw. Het toepasselijke btw-tarief wordt op je factuur getoond op basis van je factuurgegevens.",
  },
  {
    q: "Kan ik op elk moment opzeggen?",
    a: "Ja. Elk abonnement is maandelijks opzegbaar; bij jaarlijkse facturering loopt het abonnement door tot het einde van de betaalde periode.",
  },
];

export default function PricingPage() {
  return (
    <main>
      <section className="mkt-hero">
        <div className="mkt-container mkt-hero-inner">
          <Reveal>
            <span className="mkt-eyebrow">Prijzen</span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mkt-h1">Simpele prijzen, geen verrassingen.</h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="mkt-lede" style={{ margin: "0 auto" }}>
              Kies een plan dat past bij hoeveel je Mavix nu al wilt laten
              automatiseren — en groei mee wanneer je er klaar voor bent.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-container">
          <Reveal>
            <PricingCards />
          </Reveal>
        </div>
      </section>

      <section className="mkt-section mkt-section-tight">
        <div className="mkt-container">
          <Reveal>
            <div className="mkt-section-head">
              <span className="mkt-eyebrow">Vergelijk</span>
              <h2 className="mkt-h2">Vergelijk alle features</h2>
            </div>
          </Reveal>
          <Reveal>
            <div style={{ overflowX: "auto" }}>
              <table className="mkt-compare-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    {pricingPlans.map((p) => (
                      <th key={p.id}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      {row.values.map((v, i) => (
                        <td key={i}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mkt-section-tight">
        <div className="mkt-container">
          <Reveal>
            <div
              className="mkt-preview-card-line"
              style={{ maxWidth: 640, margin: "0 auto", display: "flex", gap: 10 }}
            >
              <Check size={18} style={{ flexShrink: 0, color: "var(--color-primary)" }} />
              <span>
                <strong>Opzegbaar wanneer je wilt.</strong> Geen langlopende
                contracten — je kunt maandelijks op- of afschalen.
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      <Faq items={pricingFaq} heading="Vragen over facturering" />
    </main>
  );
}
