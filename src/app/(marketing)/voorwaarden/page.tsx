import type { Metadata } from "next";
import Link from "next/link";
import { Controller, LegalDocument, Pending, type LegalSection } from "@/components/marketing/legal-document";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Algemene voorwaarden",
  description: "De afspraken voor het gebruik van Mavix tijdens de besloten beta en daarna.",
  path: "/voorwaarden",
});

const sections: LegalSection[] = [
  {
    id: "toepassing",
    title: "Toepassing en aanvaarding",
    body: (
      <>
        <p>Deze voorwaarden gelden voor het gebruik van Mavix, de website en de software. Door een account aan te maken of Mavix te gebruiken, ga je akkoord met deze voorwaarden en met het <Link href="/privacy">privacybeleid</Link>.</p>
        <p>Mavix is bedoeld voor ondernemers en organisaties, niet voor consumenten. Je gebruikt Mavix namens je bedrijf en verklaart dat je bevoegd bent om dat bedrijf aan deze voorwaarden te binden.</p>
        <Controller />
      </>
    ),
  },
  {
    id: "beta",
    title: "Besloten beta",
    body: (
      <>
        <p>Mavix is op dit moment in besloten beta. Dat betekent:</p>
        <ul>
          <li>Toegang krijg je pas na een aanvraag en persoonlijke goedkeuring.</li>
          <li>Tijdens de beta betaal je niets. Er worden geen betalingen verwerkt.</li>
          <li>Functies kunnen veranderen, tijdelijk beperkt zijn of nog in ontwikkeling zijn. Wat nog niet werkt, staat in Mavix aangegeven, bijvoorbeeld met &quot;Binnenkort&quot; of &quot;In ontwikkeling&quot;.</li>
          <li>We kunnen de beta beëindigen of omzetten naar betaalde abonnementen. Dat doen we niet zonder je vooraf te informeren. Een betaald abonnement begint pas nadat jij er uitdrukkelijk voor kiest.</li>
        </ul>
      </>
    ),
  },
  {
    id: "account",
    title: "Account en toegang",
    body: (
      <ul>
        <li>Je houdt je inloggegevens geheim en bent verantwoordelijk voor wat er met je account gebeurt.</li>
        <li>De eigenaar van een werkruimte kan collega&apos;s uitnodigen met een eigen rol (eigenaar, beheerder of lid) en bepaalt wie toegang heeft.</li>
        <li>Merk je misbruik van je account, meld het ons dan zo snel mogelijk.</li>
      </ul>
    ),
  },
  {
    id: "gebruik",
    title: "Jouw verantwoordelijkheid als ondernemer",
    body: (
      <ul>
        <li>Jij bepaalt wat er met concepten van Mavix gebeurt en bent verantwoordelijk voor wat je publiceert, verstuurt of beantwoordt.</li>
        <li>Je verstuurt alleen e-mailcampagnes naar mensen die daarvoor toestemming hebben gegeven, en je respecteert afmeldingen.</li>
        <li>Je houdt je aan de regels van de platforms die je koppelt, zoals Meta en Google, en aan de wet, waaronder de AVG.</li>
        <li>Voor de gegevens van jouw klanten ben jij verwerkingsverantwoordelijke en verwerkt Mavix die in jouw opdracht.</li>
      </ul>
    ),
  },
  {
    id: "ai",
    title: "AI-gegenereerde content",
    body: (
      <ul>
        <li>Mavix gebruikt AI om teksten, beelden en voorstellen te maken. AI kan fouten maken, onjuiste of verouderde informatie geven, of iets maken dat niet bij je bedrijf past.</li>
        <li>Lees AI-content altijd na voordat je die gebruikt. Mavix publiceert of verstuurt niets zonder jouw handeling of een instelling die je zelf hebt aangezet.</li>
        <li>Mavix garandeert niet dat AI-content uniek is, vrij is van rechten van derden, of een bepaald resultaat oplevert, zoals meer klanten of betere reviews.</li>
      </ul>
    ),
  },
  {
    id: "platforms",
    title: "Koppelingen met andere platforms",
    body: (
      <ul>
        <li>Je koppelt zelf accounts van Google, Meta en andere diensten. Die accounts blijven van jou of van je bedrijf. Mavix wordt geen eigenaar van je pagina&apos;s, accounts of bedrijfsportfolio&apos;s.</li>
        <li>Je kunt een koppeling altijd verbreken in Mavix of bij het platform zelf.</li>
        <li>Mavix is afhankelijk van die platforms. Als een platform zijn regels, toegang of techniek verandert, kan een functie tijdelijk of blijvend minder werken. Daar heeft Mavix geen invloed op.</li>
      </ul>
    ),
  },
  {
    id: "content",
    title: "Eigendom van je content",
    body: <p>Wat jij in Mavix zet en wat je met Mavix maakt, blijft van jou of van je bedrijf. Je geeft Mavix alleen de toestemming die nodig is om de dienst te leveren, zoals het opslaan, verwerken en tonen van die content in je werkruimte.</p>,
  },
  {
    id: "toegestaan",
    title: "Toegestaan gebruik",
    body: (
      <>
        <p>Het is niet toegestaan Mavix te gebruiken om:</p>
        <ul>
          <li>spam of ongevraagde berichten te versturen;</li>
          <li>misleidende, discriminerende, onrechtmatige of inbreukmakende content te maken of te verspreiden;</li>
          <li>valse reviews te plaatsen of mensen te misleiden;</li>
          <li>de beveiliging van Mavix te omzeilen, de dienst te overbelasten of andermans gegevens in te zien.</li>
        </ul>
      </>
    ),
  },
  {
    id: "abonnementen",
    title: "Abonnementen, prijzen en opzeggen",
    body: (
      <>
        <p>
          De abonnementen en prijzen die gelden zodra Mavix commercieel beschikbaar is, staan op de <Link href="/pricing">prijzenpagina</Link>. Op dit moment worden er geen betalingen verwerkt.
        </p>
        <p>
          Zodra betaalde abonnementen actief zijn, gelden deze uitgangspunten: je betaalt per maand of per jaar vooraf, prijzen zijn exclusief btw, en je kunt je abonnement maandelijks opzeggen. <Pending>De volledige betalings- en opzegvoorwaarden worden hier vastgelegd voordat betaalde abonnementen worden geactiveerd.</Pending>
        </p>
      </>
    ),
  },
  {
    id: "beschikbaarheid",
    title: "Beschikbaarheid en onderhoud",
    body: <p>We doen ons best om Mavix goed bereikbaar te houden, maar garanderen geen ononderbroken beschikbaarheid. Voor onderhoud of updates kan Mavix tijdelijk minder of niet beschikbaar zijn. Tijdens de beta gelden geen afspraken over beschikbaarheid of reactietijden.</p>,
  },
  {
    id: "ie",
    title: "Intellectueel eigendom",
    body: <p>De software, het ontwerp, de merknaam en de documentatie van Mavix blijven eigendom van Mavix of van de licentiegevers. Je krijgt een niet-overdraagbaar recht om Mavix te gebruiken zolang je account actief is.</p>,
  },
  {
    id: "vertrouwelijkheid",
    title: "Vertrouwelijkheid en gegevens",
    body: (
      <p>
        We gaan vertrouwelijk om met de gegevens in je werkruimte en gebruiken die alleen om Mavix te leveren. Hoe we persoonsgegevens verwerken, staat in het <Link href="/privacy">privacybeleid</Link>. <Pending>Een verwerkersovereenkomst voor de gegevens van jouw klanten wordt beschikbaar gesteld vóór de commerciële lancering.</Pending>
      </p>
    ),
  },
  {
    id: "aansprakelijkheid",
    title: "Aansprakelijkheid",
    body: (
      <>
        <p>
          Mavix is niet aansprakelijk voor indirecte schade, zoals gederfde winst of gemiste omzet, of voor schade door content die je na eigen controle hebt gepubliceerd of verstuurd. Ook niet voor storingen of wijzigingen bij gekoppelde platforms.
        </p>
        <p>
          Tijdens de gratis beta is de aansprakelijkheid van Mavix beperkt tot wat wettelijk is toegestaan. Deze beperkingen gelden niet bij opzet of bewuste roekeloosheid. <Pending>Een maximumbedrag voor betaalde abonnementen wordt vastgesteld vóór de commerciële lancering.</Pending>
        </p>
      </>
    ),
  },
  {
    id: "beeindiging",
    title: "Opschorting en beëindiging",
    body: (
      <ul>
        <li>Je kunt je werkruimte deactiveren via Account → Beveiliging en privacy, en verwijdering van je gegevens aanvragen via <Link href="/gegevens-verwijderen">Gegevens verwijderen</Link>.</li>
        <li>Mavix kan een account of werkruimte tijdelijk pauzeren of beëindigen bij misbruik, een overtreding van deze voorwaarden, of als de wet of een platform dat vereist. Waar mogelijk informeren we je vooraf.</li>
      </ul>
    ),
  },
  {
    id: "recht",
    title: "Toepasselijk recht en geschillen",
    body: (
      <p>
        Op deze voorwaarden is Nederlands recht van toepassing. Komen we er samen niet uit, dan legt de partij die een geschil wil voorleggen het voor aan de bevoegde rechter in Nederland. <Pending>Het precieze arrondissement wordt vermeld zodra het vestigingsadres is vastgelegd.</Pending>
      </p>
    ),
  },
  {
    id: "wijzigingen",
    title: "Wijzigingen",
    body: <p>We kunnen deze voorwaarden aanpassen. Belangrijke wijzigingen maken we vooraf bekend via je account of per e-mail. Gebruik je Mavix daarna nog, dan gelden de nieuwe voorwaarden.</p>,
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Algemene voorwaarden"
      current="/voorwaarden"
      intro="De afspraken tussen Mavix en de ondernemers die Mavix gebruiken, tijdens de besloten beta en daarna."
      sections={sections}
    />
  );
}
