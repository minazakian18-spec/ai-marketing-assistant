import type { Metadata } from "next";
import Link from "next/link";
import { Controller, LegalDocument, type LegalSection } from "@/components/marketing/legal-document";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Verwerkersovereenkomst",
  description: "De afspraken over persoonsgegevens die Mavix namens jouw bedrijf verwerkt, zoals contacten, reviews en berichten.",
  path: "/verwerkersovereenkomst",
});

// Data processing agreement (art. 28 AVG) for the customer data a business
// keeps in Mavix. Describes only what the software really does.
const sections: LegalSection[] = [
  {
    id: "partijen",
    title: "Partijen en rollen",
    body: (
      <>
        <p>
          Deze verwerkersovereenkomst hoort bij de <Link href="/voorwaarden">algemene voorwaarden</Link>. Het bedrijf dat Mavix gebruikt (&quot;jij&quot;) is verwerkingsverantwoordelijke voor de gegevens van zijn eigen klanten. Mavix is verwerker: we verwerken die gegevens alleen in jouw opdracht en volgens jouw instructies, zoals die blijken uit hoe je Mavix gebruikt.
        </p>
        <Controller />
      </>
    ),
  },
  {
    id: "gegevens",
    title: "Welke gegevens en van wie",
    body: (
      <ul>
        <li>
          <strong>Contacten:</strong> naam, e-mailadres, telefoonnummer, groep, toestemming voor nieuwsbrieven en afmeldingen.
        </li>
        <li>
          <strong>Berichten:</strong> gesprekken via Instagram, Facebook en e-mail in de Inbox, met de naam en het account-ID van de afzender.
        </li>
        <li>
          <strong>Reviews:</strong> naam van de reviewer, beoordeling, tekst en jouw antwoord.
        </li>
        <li>
          <strong>Nieuwsbrieven:</strong> wie welke campagne kreeg, aflevering, bounces en afmeldingen.
        </li>
      </ul>
    ),
  },
  {
    id: "doel",
    title: "Doel van de verwerking",
    body: <p>Mavix verwerkt deze gegevens alleen om de functies te leveren die jij gebruikt: klantgesprekken beantwoorden, reviews beantwoorden, nieuwsbrieven versturen naar wie toestemming gaf, en je marketing plannen. Mavix gebruikt ze niet voor eigen doeleinden, verkoopt ze niet en gebruikt ze niet om algemene AI-modellen te trainen.</p>,
  },
  {
    id: "jouw-taken",
    title: "Wat jij als bedrijf regelt",
    body: (
      <ul>
        <li>Je hebt een geldige grondslag voor de gegevens die je in Mavix zet, zoals toestemming voor nieuwsbrieven.</li>
        <li>Je informeert je klanten in je eigen privacyverklaring dat je Mavix gebruikt voor klantcontact en marketing.</li>
        <li>Je importeert geen gegevens waarvoor je geen toestemming of andere grondslag hebt, en geen bijzondere persoonsgegevens (zoals gezondheid).</li>
      </ul>
    ),
  },
  {
    id: "beveiliging",
    title: "Beveiliging",
    body: (
      <ul>
        <li>Elke werkruimte is afgeschermd; databasebeleid (row level security) voorkomt dat andere bedrijven je gegevens zien.</li>
        <li>Toegangssleutels van koppelingen zijn versleuteld (AES-256-GCM) en komen nooit in de browser.</li>
        <li>Verbindingen zijn versleuteld (HTTPS). Bestanden zijn alleen via tijdelijke, ondertekende links te openen.</li>
        <li>Alleen leden van je werkruimte hebben toegang, met rollen (eigenaar, beheerder, lid). Belangrijke acties worden gelogd zonder inhoud.</li>
      </ul>
    ),
  },
  {
    id: "subverwerkers",
    title: "Subverwerkers",
    body: (
      <>
        <p>Je geeft toestemming voor deze subverwerkers. Bij een nieuwe subverwerker informeren we je vooraf, zodat je bezwaar kunt maken.</p>
        <ul>
          <li>
            <strong>Supabase</strong> (database, opslag, inloggen), servers in de EU (Ierland).
          </li>
          <li>
            <strong>Hostinger</strong> (hosting van de applicatie).
          </li>
          <li>
            <strong>OpenAI</strong> (AI-teksten en -beelden), alleen de tekst die voor die ene opdracht nodig is.
          </li>
          <li>
            <strong>Resend</strong> (versturen van e-mails en nieuwsbrieven).
          </li>
          <li>
            <strong>Twilio</strong> (meldingen via WhatsApp of sms, alleen als je dat aanzet).
          </li>
          <li>
            <strong>Google en Meta</strong>, alleen voor de koppelingen die jij zelf maakt.
          </li>
        </ul>
        <p>Waar een subverwerker buiten de EER verwerkt, gebeurt dat met passende waarborgen (het EU-VS-gegevensprivacykader of standaardcontractbepalingen).</p>
      </>
    ),
  },
  {
    id: "datalek",
    title: "Datalekken",
    body: <p>Ontdekken we een beveiligingsincident met jouw gegevens, dan laten we je dat zonder onnodige vertraging weten, en waar mogelijk binnen 48 uur, met wat we weten en wat we doen. Zo kun jij binnen 72 uur melden bij de Autoriteit Persoonsgegevens als dat nodig is.</p>,
  },
  {
    id: "rechten",
    title: "Verzoeken van betrokkenen",
    body: <p>Vraagt een klant van jou om inzage, correctie of verwijdering, dan kun je dat zelf in Mavix doen (Contacten, Inbox) of ons vragen te helpen. Komt een verzoek direct bij ons binnen, dan sturen we het door naar jou.</p>,
  },
  {
    id: "einde",
    title: "Bewaren en einde",
    body: <p>Gegevens blijven bewaard zolang je Mavix gebruikt of tot je ze zelf verwijdert. Stop je, dan kun je je gegevens exporteren; daarna verwijderen we ze binnen 30 dagen, behalve wat de wet ons verplicht te bewaren. Back-ups worden volgens het vaste schema van onze hostingpartij overschreven.</p>,
  },
  {
    id: "audit",
    title: "Controle",
    body: <p>Op verzoek geven we je de informatie die nodig is om te laten zien dat we ons aan deze afspraken houden. Een controle (audit) stemmen we in redelijkheid samen af.</p>,
  },
];

export default function DpaPage() {
  return (
    <LegalDocument
      title="Verwerkersovereenkomst"
      current="/verwerkersovereenkomst"
      intro="De afspraken over de persoonsgegevens van jouw klanten die Mavix namens jou verwerkt: contacten, berichten, reviews en nieuwsbrieven."
      sections={sections}
    />
  );
}
