import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ApplicationForm } from "@/components/auth/application-form";
import { pageMetadata } from "@/lib/site";

// Public, indexable: the first step for a new customer.
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Demo aanvragen van Mavix, AI-marketingsoftware",
    description: "Vraag een persoonlijke demo aan van Mavix: zie hoe je Google-reviews beantwoordt, Instagram-content maakt en e-mailcampagnes plant met AI.",
    path: "/demo",
  }),
  robots: { index: true, follow: true },
};

export default function DemoPage() {
  return (
    <AuthShell
      title="Demo aanvragen"
      subtitle="In een persoonlijke demo van ongeveer 30 minuten laten we zien wat Mavix voor jouw bedrijf kan doen."
      visualTitle="Zie Mavix werken met jouw bedrijf als voorbeeld."
      visualBody="We bespreken je marketing, laten de werkruimte zien en beantwoorden je vragen. Daarna beslis je of je een account aanvraagt."
      footer={
        <p className="mkt-auth-footer-link">
          Al een demo gehad? <Link href="/aanvragen">Account aanvragen</Link>
        </p>
      }
    >
      <ApplicationForm kind="demo" />
    </AuthShell>
  );
}
