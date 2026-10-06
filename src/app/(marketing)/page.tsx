import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { CoreProducts } from "@/components/marketing/core-products";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Audiences } from "@/components/marketing/audiences";
import { PricingNewTrending } from "@/components/marketing/pricing-new-trending";
import { IntegrationsStrip } from "@/components/marketing/integrations-strip";
import { FinalCta } from "@/components/marketing/final-cta";
import { pageMetadata, structuredData } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Mavix — AI-marketingsoftware voor reviews, Instagram en e-mail",
  absoluteTitle: true,
  description:
    "Mavix is je AI-marketingassistent voor kleine en middelgrote bedrijven. Beantwoord Google-reviews, maak en plan Instagram-content en verstuur e-mailcampagnes vanuit één werkruimte.",
  path: "/",
});

export default function MarketingHome() {
  return (
    <main>
      <script
        type="application/ld+json"
        // Static, server-generated JSON (no user input); "<" is escaped.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, "\\u003c") }}
      />
      <Hero />
      <CoreProducts />
      <HowItWorks />
      <Audiences />
      <PricingNewTrending />
      <IntegrationsStrip />
      <FinalCta />
    </main>
  );
}
