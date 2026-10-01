import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { PricingNewTrending } from "@/components/marketing/pricing-new-trending";

export const metadata: Metadata = {
  title: "Mavix — Je marketingteam. In één werkruimte.",
  description:
    "Mavix beheert je Google-reviews, Instagram en e-mail vanuit één werkruimte.",
};

export default function MarketingHome() {
  return (
    <main>
      <Hero />
      <PricingNewTrending />
    </main>
  );
}
