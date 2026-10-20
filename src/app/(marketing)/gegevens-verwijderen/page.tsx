import type { Metadata } from "next";
import Link from "next/link";
import { Controller, LegalDocument, type LegalSection } from "@/components/marketing/legal-document";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Gegevens verwijderen",
  description: "Hoe je Instagram, Facebook en andere koppelingen verbreekt en verwijdering van je Mavix-account en gegevens aanvraagt.",
  path: "/gegevens-verwijderen",
});

// Data Deletion Instructions (also the URL for Meta's "Data deletion
// instructions" setting). Describes the real flows: disconnecting in
// Integraties removes the tokens, deactivation is immediate, full deletion is
// a verified request carried out by an administrator.
const sections: LegalSection[] = [
  {
    id: "koppeling",
    title: "Instagram, Facebook of WhatsApp loskoppelen",
    body: (
      <>
        <p>In Mavix:</p>
        <ol>
          <li>Log in bij Mavix en ga naar Account → Integraties.</li>
          <li>Klik bij de koppeling (Instagram, Facebook Messenger of WhatsApp Business) op Beheren en kies Verbinding verwijderen.</li>
        </ol>
        <p>Mavix verwijdert dan direct de toegangssleutels van die koppeling. Daarna kan Mavix niets meer lezen of versturen via dat account.</p>
        <p>Bij Meta kun je de toegang ook zelf intrekken:</p>
        <ol>
          <li>Open Facebook en ga naar Instellingen en privacy → Instellingen → Bedrijfsintegraties.</li>
          <li>Kies Mavix en klik op Verwijderen.</li>
        </ol>
        <p>Voor Google-koppelingen (Gmail, Google Agenda, Search Console, Google-bedrijfsprofiel) werkt het hetzelfde: ontkoppel in Mavix, of trek de toegang in via je Google-account onder Beveiliging → Apps van derden.</p>
      </>
    ),
  },
  {
    id: "account",
    title: "Je Mavix-account en gegevens laten verwijderen",
    body: (
      <>
        <p>Heb je een Mavix-account:</p>
        <ol>
          <li>Log in en ga naar Account → Beveiliging en privacy.</li>
          <li>Download eventueel eerst een kopie van je gegevens.</li>
          <li>Kies &quot;Verwijdering aanvragen&quot;. Je verzoek komt direct bij de beheerders van Mavix binnen.</li>
        </ol>
        <p>
          Als eigenaar kun je je werkruimte daar ook meteen deactiveren. Iedereen verliest dan direct de toegang; de gegevens worden definitief verwijderd zodra je verzoek is uitgevoerd.
        </p>
        <p>Heb je geen Mavix-account, of kun je niet meer inloggen? Neem dan contact op via de gegevens hieronder.</p>
        <Controller />
      </>
    ),
  },
  {
    id: "wat",
    title: "Wat er wordt verwijderd",
    body: (
      <ul>
        <li>Je account: naam, e-mailadres, profiel en inloggegevens.</li>
        <li>De toegangssleutels van alle koppelingen.</li>
        <li>Als je eigenaar bent: de werkruimte met de Brand Hub, concepten, planning, contacten, opgeslagen berichten en reviews in de Inbox, en de bestanden in de Bibliotheek.</li>
        <li>Je gesprekken met de Mavix Agent.</li>
      </ul>
    ),
  },
  {
    id: "bewaren",
    title: "Wat we soms moeten bewaren",
    body: (
      <ul>
        <li>Gegevens die we wettelijk moeten bewaren, zoals facturen en betaalgegevens zodra betaalde abonnementen actief zijn.</li>
        <li>Een minimaal verslag dat je verzoek is uitgevoerd, zonder de inhoud van je gegevens, om te kunnen aantonen dat we het hebben gedaan.</li>
        <li>Een afmeldlijst voor e-mail, zodat iemand die zich heeft afgemeld geen berichten meer krijgt.</li>
      </ul>
    ),
  },
  {
    id: "termijn",
    title: "Hoe en wanneer we je verzoek afhandelen",
    body: (
      <>
        <p>We controleren eerst of het verzoek echt van jou komt, zodat niemand anders jouw gegevens kan laten verwijderen. Daarna voeren we het uit en bevestigen we het per e-mail. We reageren binnen één maand, zoals de AVG voorschrijft.</p>
        <p>
          Ben je een klant van een bedrijf dat Mavix gebruikt, bijvoorbeeld omdat je dat bedrijf een Instagram-bericht stuurde? Dan beslist dat bedrijf over je gegevens. Vraag het bedrijf om je gegevens te verwijderen; Mavix helpt het bedrijf daarbij. Je kunt ook bij ons terecht, dan sturen we je verzoek door.
        </p>
        <p>
          Meer over je rechten lees je in het <Link href="/privacy">privacybeleid</Link>.
        </p>
      </>
    ),
  },
];

export default function DataDeletionPage() {
  return (
    <LegalDocument
      title="Gegevens verwijderen"
      current="/gegevens-verwijderen"
      intro="Zo verbreek je de koppeling met Instagram, Facebook en andere diensten, en zo vraag je verwijdering van je Mavix-account en gegevens aan."
      sections={sections}
    />
  );
}
