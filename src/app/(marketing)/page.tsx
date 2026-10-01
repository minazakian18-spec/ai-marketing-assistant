import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { CoreProducts } from "@/components/marketing/core-products";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PricingNewTrending } from "@/components/marketing/pricing-new-trending";
import { IntegrationsStrip } from "@/components/marketing/integrations-strip";
import { FinalCta } from "@/components/marketing/final-cta";

export const metadata: Metadata = {
  title: "Mavix — Je marketingteam. In één werkruimte.",
  description:
    "Mavix beheert je Google-reviews, Instagram en e-mail vanuit één werkruimte.",
};

export default function MarketingHome() {
  return (
    <main>
      <Hero />
      <CoreProducts />
      <HowItWorks />
      <PricingNewTrending />
      <IntegrationsStrip />
      <FinalCta />
    </main>
  );
}
