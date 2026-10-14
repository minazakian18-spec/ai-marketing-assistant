import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Aanvraag ontvangen", robots: { index: false, follow: false } };

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const demo = (await searchParams).type === "demo";
  return (
    <AuthShell
      title={demo ? "Bedankt voor je demo-aanvraag!" : "Bedankt voor uw aanvraag!"}
      subtitle={demo ? "We nemen binnen twee werkdagen contact met je op om een moment af te spreken." : "Wij hebben uw aanvraag voor Mavix ontvangen."}
      visualTitle="Wat gebeurt er nu?"
      visualBody={
        demo
          ? "We plannen samen een demo. Na de demo kun je een account aanvragen; we beoordelen elke aanvraag persoonlijk."
          : "We beoordelen je aanvraag persoonlijk. Na goedkeuring maak je je account aan en betaal je het abonnement; daarna activeren we je werkruimte."
      }
      footer={
        <p className="mkt-auth-footer-link">
          <Link href="/">Terug naar de website</Link>
        </p>
      }
    >
      <div className="mkt-thanks" role="status">
        <CheckCircle2 size={28} aria-hidden="true" />
        {demo ? (
          <p>Er is nog niets afgesproken of vastgelegd. Je hoeft nu niets te doen.</p>
        ) : (
          <>
            <p>Uw aanvraag wordt momenteel beoordeeld. Zodra de controle is afgerond, ontvangt u van ons bericht per e-mail.</p>
            <p>U hoeft voorlopig niets te doen. Er is niets afgeschreven: betalen gebeurt pas na goedkeuring.</p>
          </>
        )}
      </div>
    </AuthShell>
  );
}
