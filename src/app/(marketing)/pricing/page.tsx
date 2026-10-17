import type { Metadata } from "next";
import { Faq } from "@/components/marketing/faq";
import { Reveal } from "@/components/marketing/reveal";
import { PricingExperience } from "@/components/marketing/pricing-experience";
import { FAQ } from "@/lib/pricing-content";
import { PLAN_IDS, PLANS } from "@/lib/plans";
import { pageMetadata } from "@/lib/site";
import "../../pricing.css";

export const metadata: Metadata = pageMetadata({
  title: "Prijzen en abonnementen voor AI-marketing",
  description: `Vergelijk Mavix Starter (€${PLANS.starter.monthlyPrice}), Growth (€${PLANS.growth.monthlyPrice}) en Premium (€${PLANS.autopilot.monthlyPrice}) per maand: AI-credits, AI-afbeeldingen, functies en limieten. Prijzen exclusief btw.`,
  path: "/pricing",
});

// Yearly billing is only offered when every yearly Stripe price exists and
// checkout is open; otherwise the toggle says it is coming soon.
const yearlyAvailable = () => process.env.BILLING_CHECKOUT_ENABLED === "1" && PLAN_IDS.every((p) => !!process.env[`STRIPE_PRICE_${p.toUpperCase()}_YEAR`]);

export default function PricingPage() {
  return (
    <main className="pr">
      <section className="mkt-hero pr-hero">
        <div className="mkt-container mkt-hero-inner">
          <Reveal>
            <span className="mkt-eyebrow">Prijzen</span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mkt-h1">Eén slimme werkruimte. Het pakket dat bij jou past.</h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="mkt-lede" style={{ margin: "0 auto" }}>
              Van je eerste AI-post tot complete marketingondersteuning. Kies hoeveel hulp, automatisering en AI-capaciteit jouw bedrijf nodig heeft.
            </p>
          </Reveal>
        </div>
      </section>
      <section className="mkt-section pr-main">
        <div className="mkt-container">
          <PricingExperience yearlyAvailable={yearlyAvailable()} />
        </div>
      </section>
      <Faq items={FAQ} heading="Veelgestelde vragen over abonnementen" />
    </main>
  );
}
