import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { TrustSection } from "@/components/marketing/trust-section";
import { Testimonials } from "@/components/marketing/testimonials";
import { PricingTeaser } from "@/components/marketing/pricing-teaser";
import { NewTrending } from "@/components/marketing/new-trending";
import { FinalCta } from "@/components/marketing/final-cta";

export const metadata: Metadata = {
  title: "Mavix — Je marketingteam. Eén werkruimte.",
  description:
    "Mavix beheert je Google-reviews, Instagram en e-mail vanuit één werkruimte.",
};

export default function MarketingHome() {
  return (
    <main>
      <Hero />
      <TrustSection />
      <Testimonials />
      <PricingTeaser />
      <NewTrending />
      <FinalCta />
    </main>
  );
}
