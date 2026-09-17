import Link from "next/link";
import { Instagram, Film, Mail } from "lucide-react";
import { PageHeading } from "@/components/ui";
export default function CampaignsPage() {
  return (
    <>
      <PageHeading
        eyebrow="CONTENT"
        title="Campagnes"
        description="Eén verhaal, meerdere kanalen. Breng straks je marketing samen."
      />
      <div className="demo-notice">
        <span className="badge draft">Voorbeeld</span>Campagnes zijn nog in
        voorbereiding. Er wordt niets aangemaakt of gepubliceerd.
      </div>
      <section className="panel campaign-example">
        <div className="section-heading">
          <div>
            <h2>Weekendactie</h2>
            <p>Een voorbeeld van een campagne met meerdere kanalen.</p>
          </div>
          <span className="badge scheduled">Campagnevoorbeeld</span>
        </div>
        <div className="feature-grid">
          {[
            [
              Instagram,
              "Instagram post",
              "Een caption en afbeelding voor de actie.",
            ],
            [
              Film,
              "Instagram Reel",
              "Een korte video die je actie tot leven brengt.",
            ],
            [
              Mail,
              "E-mailcampagne",
              "Een persoonlijke uitnodiging aan je doelgroep.",
            ],
          ].map(([Icon, title, description]) => {
            const I = Icon as typeof Mail;
            return (
              <div className="campaign-channel" key={String(title)}>
                <I size={23} />
                <h3>{String(title)}</h3>
                <p>{String(description)}</p>
                <span className="badge draft">Binnenkort</span>
              </div>
            );
          })}
        </div>
      </section>
      <div className="placeholder-links">
        <Link href="/instagram-ai" className="button secondary">
          Naar Instagram AI
        </Link>
        <Link href="/email-ai" className="button secondary">
          Naar Email AI
        </Link>
      </div>
    </>
  );
}
