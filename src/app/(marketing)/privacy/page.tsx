import type { Metadata } from "next";
import Link from "next/link";
import { Controller, LegalDocument, Pending, type LegalSection } from "@/components/marketing/legal-document";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacybeleid",
  description: "Welke gegevens Mavix verwerkt, waarom, met welke diensten en welke rechten je hebt.",
  path: "/privacy",
});

// Based on what the application really does (see the code: Supabase,
// OpenAI, Resend, Meta, Google, Stripe, Twilio, Hostinger). Nothing here
// promises a retention period, certification or agreement that is not in place.
const sections: LegalSection[] = [
  {
    id: "wie",
    title: "Wie is verantwoordelijk",
    body: (
      <>
        <p>Mavix is AI-marketingsoftware voor ondernemers. Voor de gegevens van je eigen account (zoals je naam en e-mailadres) is Mavix de verwerkingsverantwoordelijke.</p>
        <p>
          Voor gegevens die jij als ondernemer in Mavix verwerkt over jouw klanten (bijvoorbeeld contacten, reviews en berichten in de Inbox) ben jij de verwerkingsverantwoordelijke en verwerkt Mavix die gegevens in jouw opdracht, als verwerker.
        </p>
        <Controller />
      </>
    ),
  },
  {
    id: "gegevens",
    title: "Welke gegevens we verwerken",
    body: (
      <ul>
        <li>
          <strong>Accountgegevens:</strong> naam, e-mailadres, eventueel telefoonnummer en profielfoto, en je inloggegevens. Wachtwoorden worden beheerd door onze inlogdienst (Supabase Auth) en nooit leesbaar door Mavix opgeslagen. Je kunt ook inloggen met Google.
        </li>
        <li>
          <strong>Aanvragen:</strong> als je een demo of account aanvraagt: naam, bedrijfsnaam, e-mailadres en wat je zelf invult, zoals telefoonnummer, website en bericht.
        </li>
        <li>
          <strong>Bedrijfs- en werkruimtegegevens:</strong> je Brand Hub (bedrijfsinformatie, huisstijl, tone of voice, doelgroepen, producten, doelen), concepten, planning, campagnes en instellingen.
        </li>
        <li>
          <strong>Bestanden:</strong> foto&apos;s, logo&apos;s en AI-beelden in je Bibliotheek. Ze staan in afgeschermde opslag en zijn alleen via tijdelijke, beveiligde links te bekijken.
        </li>
        <li>
          <strong>Klantgegevens die jij beheert:</strong> contacten en hun toestemming voor nieuwsbrieven, afmeldingen, reviews van je Google-bedrijfsprofiel en berichten uit gekoppelde kanalen (Gmail, Instagram, Facebook Messenger en WhatsApp Business) in je Inbox.
        </li>
        <li>
          <strong>AI-gegevens:</strong> de opdrachten die je geeft, de context uit je Brand Hub die daarbij hoort, en de gegenereerde teksten en beelden. Per AI-aanvraag houden we bij hoeveel tokens en kosten er zijn gebruikt, niet de inhoud.
        </li>
        <li>
          <strong>Koppelingen:</strong> toegangssleutels (OAuth-tokens) en de toestemmingen die je aan Mavix geeft voor Google- en Meta-diensten.
        </li>
        <li>
          <strong>Technische gegevens:</strong> serverlogs die nodig zijn voor beveiliging en foutopsporing, en een auditlog van belangrijke acties (zoals inloggen op een koppeling of een werkruimte deactiveren). We loggen geen tokens, wachtwoorden of berichtinhoud.
        </li>
        <li>
          <strong>Abonnement en betaling:</strong> je abonnement en de status daarvan. Betaalgegevens worden verwerkt door Stripe, niet door Mavix. Tijdens de besloten beta zijn betaalde abonnementen nog niet actief.
        </li>
      </ul>
    ),
  },
  {
    id: "doelen",
    title: "Waarvoor en op welke grondslag",
    body: (
      <>
        <ul>
          <li>
            <strong>Mavix leveren en je account beheren</strong>: uitvoering van de overeenkomst (art. 6 lid 1 sub b AVG).
          </li>
          <li>
            <strong>Je aanvraag behandelen en contact met je opnemen</strong>: je toestemming en onze voorbereiding op een overeenkomst (art. 6 lid 1 sub a en b AVG).
          </li>
          <li>
            <strong>Koppelingen met Google en Meta</strong>: alleen na jouw toestemming in het scherm van Google of Meta, ter uitvoering van de overeenkomst.
          </li>
          <li>
            <strong>Beveiliging, fraudepreventie en het voorkomen van misbruik</strong>: ons gerechtvaardigd belang (art. 6 lid 1 sub f AVG).
          </li>
          <li>
            <strong>Facturatie en administratie</strong>, zodra betaalde abonnementen actief zijn: wettelijke verplichting en uitvoering van de overeenkomst (art. 6 lid 1 sub c en b AVG).
          </li>
        </ul>
        <p>We gebruiken je gegevens niet voor advertenties en verkopen ze niet.</p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI en jouw gegevens",
    body: (
      <>
        <p>
          Voor AI-teksten en AI-afbeeldingen stuurt Mavix je opdracht en de benodigde context naar OpenAI. Mavix stuurt alleen wat voor die opdracht nodig is. AI-resultaten zijn altijd concepten: jij beslist wat ermee gebeurt.
        </p>
        <p>
          Hoe lang OpenAI gegevens bewaart en of ze worden gebruikt voor training, hangt af van de voorwaarden van OpenAI voor zakelijke API-klanten. <Pending>De precieze afspraken en het bewaarbeleid worden hier vermeld zodra ze zijn vastgelegd.</Pending>
        </p>
      </>
    ),
  },
  {
    id: "koppelingen",
    title: "Koppelingen met Meta en Google",
    body: (
      <>
        <p>Je koppelt diensten zelf vanuit Integraties. Mavix vraagt alleen de toestemmingen die nodig zijn voor de functie die je gebruikt:</p>
        <ul>
          <li>
            <strong>Instagram en Facebook (Meta):</strong> je professionele Instagram-account en de gekoppelde Facebook-pagina vinden, berichten ontvangen en beantwoorden in je Inbox, en (zodra beschikbaar) posts publiceren. Facebook Messenger werkt via je Facebook-pagina.
          </li>
          <li>
            <strong>WhatsApp Business (Meta):</strong> berichten ontvangen en versturen via de WhatsApp Business-account die je zelf koppelt.
          </li>
          <li>
            <strong>Gmail:</strong> e-mails lezen voor je Inbox en namens jou versturen.
          </li>
          <li>
            <strong>Google Agenda:</strong> afspraken en geplande content tonen en aanmaken in je agenda.
          </li>
          <li>
            <strong>Google Search Console:</strong> gegevens over hoe je website in Google wordt gevonden, voor SEO Intelligence.
          </li>
          <li>
            <strong>Google-bedrijfsprofiel:</strong> reviews lezen en beantwoorden.
          </li>
        </ul>
        <p>
          Toegangssleutels worden versleuteld opgeslagen, per werkruimte, en nooit naar je browser gestuurd. Je kunt een koppeling altijd verbreken in Integraties, en de toegang ook intrekken bij Google of Meta zelf. Mavix gebruikt gegevens uit Google-diensten alleen om de functies te leveren die je in Mavix gebruikt.
        </p>
      </>
    ),
  },
  {
    id: "verwerkers",
    title: "Diensten die we inschakelen",
    body: (
      <>
        <p>Mavix gebruikt de volgende partijen om de dienst te leveren:</p>
        <ul>
          <li>
            <strong>Supabase</strong>: database, inloggen en bestandsopslag.
          </li>
          <li>
            <strong>Hostinger</strong>: hosting van de website en de applicatie.
          </li>
          <li>
            <strong>OpenAI</strong>: AI-teksten en AI-afbeeldingen.
          </li>
          <li>
            <strong>Resend</strong>: e-mails over je account en, als je ze verstuurt, je e-mailcampagnes.
          </li>
          <li>
            <strong>Twilio</strong>: sms- of WhatsApp-meldingen, als je die inschakelt.
          </li>
          <li>
            <strong>Stripe</strong>: betalingen, zodra betaalde abonnementen actief zijn.
          </li>
          <li>
            <strong>Google en Meta</strong>: alleen voor de koppelingen die jij zelf maakt. Voor die diensten gelden ook hun eigen privacyvoorwaarden.
          </li>
        </ul>
        <p>
          Een aantal van deze partijen is gevestigd in of verwerkt gegevens in de Verenigde Staten. Doorgifte buiten de Europese Economische Ruimte gebeurt alleen met passende waarborgen, zoals het EU-VS-gegevensprivacykader of standaardcontractbepalingen. <Pending>Per partij worden de verwerkersafspraken, de opslaglocatie en de gebruikte waarborg hier vermeld zodra die zijn bevestigd.</Pending>
        </p>
      </>
    ),
  },
  {
    id: "bewaren",
    title: "Hoe lang we gegevens bewaren",
    body: (
      <>
        <p>We bewaren gegevens niet langer dan nodig voor het doel waarvoor ze zijn verzameld. Wat we nu al concreet doen:</p>
        <ul>
          <li>Verbreek je een koppeling, dan verwijdert Mavix de toegangssleutels van die koppeling.</li>
          <li>Een beveiligingscode voor het koppelen van een dienst is maximaal 10 minuten geldig.</li>
          <li>Deactiveer je een werkruimte, dan verliest iedereen direct de toegang. De gegevens blijven tijdelijk bewaard, zodat een vergissing hersteld kan worden. Wil je dat ze definitief worden verwijderd, dien dan een verwijderverzoek in.</li>
          <li>Gegevens die we wettelijk moeten bewaren, zoals facturen zodra betaalde abonnementen actief zijn, bewaren we zolang de wet dat voorschrijft (voor de belastingdienst in Nederland in de regel zeven jaar).</li>
        </ul>
        <p>
          <Pending>Vaste bewaartermijnen voor overige gegevens, zoals serverlogs en gedeactiveerde werkruimtes, worden hier vermeld zodra ze zijn vastgesteld.</Pending>
        </p>
      </>
    ),
  },
  {
    id: "beveiliging",
    title: "Beveiliging",
    body: (
      <ul>
        <li>Elke werkruimte is afgeschermd: je ziet alleen de gegevens van je eigen bedrijf.</li>
        <li>Toegangssleutels van koppelingen worden versleuteld opgeslagen en nooit naar de browser gestuurd.</li>
        <li>Bestanden staan in afgeschermde opslag en zijn alleen bereikbaar via tijdelijke, beveiligde links.</li>
        <li>Nieuwe werkruimtes krijgen pas toegang na persoonlijke goedkeuring.</li>
        <li>Inkomende berichten van Meta worden gecontroleerd op een geldige digitale handtekening.</li>
      </ul>
    ),
  },
  {
    id: "rechten",
    title: "Jouw rechten",
    body: (
      <>
        <p>Je hebt het recht op inzage, correctie, verwijdering, beperking van de verwerking, overdraagbaarheid en bezwaar. Heb je toestemming gegeven, dan kun je die altijd intrekken.</p>
        <ul>
          <li>
            <strong>Inzage en overdraagbaarheid:</strong> download je profiel en de bedrijfsgegevens van je werkruimte via Account → Beveiliging en privacy.
          </li>
          <li>
            <strong>Correctie:</strong> pas je gegevens aan in je account en in de Brand Hub.
          </li>
          <li>
            <strong>Verwijdering:</strong> zie <Link href="/gegevens-verwijderen">Gegevens verwijderen</Link>.
          </li>
        </ul>
        <p>
          We reageren binnen één maand op een verzoek. Ben je het niet eens met hoe we met je gegevens omgaan, dan kun je een klacht indienen bij de Autoriteit Persoonsgegevens.
        </p>
        <p>
          Ben je een klant van een bedrijf dat Mavix gebruikt, bijvoorbeeld omdat je dat bedrijf een bericht of review stuurde? Neem dan eerst contact op met dat bedrijf. Het bedrijf beslist over jouw gegevens; Mavix helpt het bedrijf je verzoek uit te voeren.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <p>
        Mavix gebruikt alleen cookies en lokale opslag die nodig zijn om in te loggen, je werkruimte te onthouden en koppelingen veilig af te ronden. Er zijn geen analyse- of advertentiecookies. Lees meer in het <Link href="/cookies">cookiebeleid</Link>.
      </p>
    ),
  },
  {
    id: "wijzigingen",
    title: "Wijzigingen",
    body: <p>We passen dit privacybeleid aan als Mavix verandert of de wet dat vraagt. De datum bovenaan laat zien wanneer het voor het laatst is bijgewerkt. Bij belangrijke wijzigingen informeren we je via je account of per e-mail.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacybeleid"
      current="/privacy"
      intro="Hoe Mavix omgaat met de gegevens van ondernemers die Mavix gebruiken en van hun klanten: welke gegevens, waarom, met welke diensten en welke rechten je hebt."
      sections={sections}
    />
  );
}
