import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ApplicationForm } from "@/components/auth/application-form";
import { pricingPlans, type PricingPlan } from "@/lib/pricing-data";

export const metadata: Metadata = { title: "Account aanvragen", robots: { index: false, follow: true } };

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const initial = pricingPlans.find((p) => p.id === plan)?.id as PricingPlan["id"] | undefined;
  return (
    <AuthShell
      title="Account aanvragen"
      subtitle="Kies een pakket en vertel kort over je bedrijf. We beoordelen elke aanvraag persoonlijk."
      visualTitle="Zo werkt aanvragen."
      visualBody="1. Je dient je aanvraag in. 2. We plannen een kennismaking of demo. 3. Na goedkeuring maak je je account aan en betaal je het abonnement. 4. Daarna activeren we je werkruimte."
      footer={
        <p className="mkt-auth-footer-link">
          Liever eerst zien hoe het werkt? <Link href="/demo">Demo aanvragen</Link> · Al een account? <Link href="/login">Inloggen</Link>
        </p>
      }
    >
      <ApplicationForm kind="application" initialPlan={initial} />
    </AuthShell>
  );
}
