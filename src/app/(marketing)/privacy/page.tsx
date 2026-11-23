import type { Metadata } from "next";
import Link from "next/link";
import { Controller, LegalDocument, Pending, type LegalSection } from "@/components/marketing/legal-document";
import { LEGAL } from "@/lib/legal";
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
          Voor gegevens die jij als ondernemer in Mavix verwerkt over jouw klanten (bijvoorbeeld contacten, reviews en berichten in de Inbox) ben jij de verwerkingsverantwoordelijke en verwerkt Mavix die gegevens in jouw opdracht, als verwerker. De afspraken daarover staan in de <Link href="/verwerkersovereenkomst">verwerkersovereenkomst</Link>.
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
          <strong>Klantgegevens die jij beheert:</strong> contacten en hun toestemming voor nieuwsbrieven, afmeldingen, reviews van je Google-bedrijfsprofiel en berichten uit Instagram in je Inbox, en e-mails die je zelf via Mavix verstuurt. Mavix leest je Gmail-postvak niet.
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
          AI wordt alleen gebruikt voor de functie die je zelf aanvraagt, zoals een reviewantwoord, een post of een e-mail. Mavix gebruikt jouw gegevens en gegevens uit Google-diensten <strong>niet om algemene AI-modellen te trainen</strong>, niet voor advertenties en verkoopt ze niet.
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
        <p>Je koppelt diensten zelf vanuit Integraties. Mavix vraagt alleen de toestemmingen die nodig zijn voor de functie die je gebruikt.</p>
        <p>
          <strong>Instagram en Facebook (Meta):</strong> je professionele Instagram-account en de gekoppelde Facebook-pagina vinden, berichten ontvangen en beantwoorden in je Inbox, en posts publiceren die jij hebt goedgekeurd of ingepland.
        </p>
        <p>
          <strong>Google:</strong> je koppelt Google met één Google-account. Per toestemming (scope) gebruiken we dit, en niets anders:
        </p>
        <div className="lg-table-wrap">
          <table className="lg-table">
            <thead>
              <tr>
                <th scope="col">Toestemming</th>
                <th scope="col">Welke gegevens</th>
                <th scope="col">Waarvoor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>openid</code>, <code>email</code>, <code>profile</code>
                </td>
                <td>Je naam, e-mailadres en Google-account-ID</td>
                <td>Inloggen en laten zien welk Google-account gekoppeld is.</td>
              </tr>
              <tr>
                <td>
                  <code>business.manage</code>
                </td>
                <td>Je bedrijfsprofiel, locaties en de reviews daarop</td>
                <td>Reviews tonen en jouw antwoorden plaatsen. Jij keurt elk antwoord goed, of zet zelf automatisch antwoorden aan.</td>
              </tr>
              <tr>
                <td>
                  <code>calendar.events</code>
                </td>
                <td>Afspraken in je hoofdagenda</td>
                <td>Je marketingplanning tonen en afspraken die je in Mavix maakt in je agenda zetten.</td>
              </tr>
              <tr>
                <td>
                  <code>webmasters.readonly</code>
                </td>
                <td>Zoekcijfers van je website (klikken, vertoningen, zoekwoorden)</td>
                <td>Laten zien hoe je website in Google wordt gevonden. Alleen lezen; we wijzigen niets.</td>
              </tr>
              <tr>
                <td>
                  <code>gmail.send</code>
                </td>
                <td>Alleen het versturen van e-mail</td>
                <td>E-mails en antwoorden versturen vanaf je eigen adres, als jij op Versturen klikt. Mavix leest, wijzigt of verwijdert je e-mail niet.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>Gegevens uit Google-diensten worden niet verkocht, niet gebruikt voor advertenties en niet gebruikt om algemene AI-modellen te trainen. Medewerkers van Mavix kunnen ze niet inzien, behalve met jouw toestemming voor support, als de wet dat vraagt of om misbruik te onderzoeken.</p>
        <p lang="en">Mavix&apos;s use and transfer of information received from Google APIs to any other app will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
        <p>
          <strong>Ontkoppelen:</strong> ga naar Integraties en klik op Ontkoppelen. Mavix trekt de toegang dan ook bij Google in en wist de opgeslagen sleutels. Je kunt de toegang ook zelf intrekken via{" "}
          <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.
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
            <strong>Twilio</strong>: meldingen via WhatsApp of sms, als je die inschakelt.
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
        <p>Gegevens staan in de database en opslag van Supabase in de Europese Unie (Ierland). Toegangssleutels van koppelingen zijn versleuteld met AES-256-GCM.</p>
        <p>We bewaren gegevens niet langer dan nodig voor het doel waarvoor ze zijn verzameld. Wat we nu al concreet doen:</p>
        <ul>
          <li>Verbreek je een koppeling, dan verwijdert Mavix direct de toegangssleutels van die koppeling. Bij Google trekken we de toegang ook in.</li>
          <li>Reviews, agenda-afspraken en zoekcijfers uit Google worden opgehaald wanneer je ze bekijkt en alleen bewaard zolang de koppeling actief is.</li>
          <li>Vraag je verwijdering aan, dan verwijderen we je werkruimte en de bijbehorende gegevens binnen 30 dagen.</li>
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
            <strong>Verwijdering:</strong> mail naar {LEGAL.privacyEmail} of zie <Link href="/gegevens-verwijderen">Gegevens verwijderen</Link>.
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
      alternate="/en/privacy"
      intro="Hoe Mavix omgaat met de gegevens van ondernemers die Mavix gebruiken en van hun klanten: welke gegevens, waarom, met welke diensten en welke rechten je hebt."
      sections={sections}
    />
  );
}
