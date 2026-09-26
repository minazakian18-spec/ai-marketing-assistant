import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { TrustSection } from "@/components/marketing/trust-section";
import { ProductDemo } from "@/components/marketing/product-demo";
import { AutomationModes } from "@/components/marketing/automation-modes";
import { FeatureShowcase } from "@/components/marketing/feature-showcase";
import { IntegrationsTeaser } from "@/components/marketing/integrations-teaser";
import { AiAssistantDemo } from "@/components/marketing/ai-assistant-demo";
import { PricingTeaser } from "@/components/marketing/pricing-teaser";
import { Testimonials } from "@/components/marketing/testimonials";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";

export const metadata: Metadata = {
  title: "Mavix — Jouw AI-marketingteam in één werkruimte",
  description:
    "Mavix beheert je Google-reviews, Instagram, e-mailmarketing en content vanuit één AI-werkruimte.",
};

export default function MarketingHome() {
  return (
    <main>
      <Hero />
      <TrustSection />
      <ProductDemo />
      <AutomationModes />
      <FeatureShowcase />
      <IntegrationsTeaser />
      <AiAssistantDemo />
      <PricingTeaser />
      <Testimonials />
      <Faq />
      <FinalCta />
    </main>
  );
}
