import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, type LegalSection } from "@/components/marketing/legal-document";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Cookiebeleid",
  description: "Welke cookies en lokale opslag Mavix gebruikt. Alleen wat nodig is om in te loggen en veilig te koppelen: geen tracking.",
  path: "/cookies",
});

// Audited in the code: no analytics, advertising or social tracking scripts.
// Only the functional cookies and browser storage listed below exist.
const COOKIES: [string, string, string][] = [
  ["Inlogcookies van Supabase (naam begint met sb-)", "Houden je ingelogd en beveiligen je sessie.", "Zolang je ingelogd bent; verdwijnen bij uitloggen."],
  ["mavix-workspace", "Onthoudt welke werkruimte je hebt gekozen als je toegang hebt tot meer werkruimtes.", "30 dagen"],
  ["mavix_oauth_… (bijvoorbeeld mavix_oauth_instagram)", "Eenmalige beveiligingscode tijdens het koppelen van Google of Meta, tegen misbruik van de koppeling.", "Maximaal 10 minuten"],
  ["mavix-local-demo", "Alleen als je de testmodus gebruikt: zet de testmodus aan.", "Tot je de testmodus verlaat"],
];
const STORAGE: [string, string][] = [
  ["marketing-ai.workspace.v1", "Alleen in de testmodus: voorbeeldgegevens, uitsluitend in je eigen browser."],
  ["mavix-studio-intro-dismissed", "Onthoudt dat je de introductie van Content Studio hebt gesloten."],
  ["mavix.calendar.hidden.v1", "Onthoudt welke items je in de kalender hebt verborgen."],
  ["mavix.library.view", "Onthoudt welke weergave je in de Bibliotheek hebt gekozen."],
  ["mavix-agent-handoff (sessionStorage)", "Geeft een opdracht door aan de Mavix Agent als je een ander scherm opent; verdwijnt als je het tabblad sluit."],
];

const sections: LegalSection[] = [
  {
    id: "kort",
    title: "In het kort",
    body: (
      <ul>
        <li>Mavix gebruikt alleen functionele cookies en lokale opslag die nodig zijn om de dienst te laten werken.</li>
        <li>Er zijn geen analyse-, advertentie- of trackingcookies, en geen scripts van advertentienetwerken of social media die je volgen.</li>
        <li>Daarom is er geen cookiebanner nodig: voor strikt noodzakelijke cookies hoeft geen toestemming te worden gevraagd.</li>
      </ul>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <div className="lg-table-wrap">
        <table className="lg-table">
          <thead>
            <tr>
              <th scope="col">Cookie</th>
              <th scope="col">Waarvoor</th>
              <th scope="col">Hoe lang</th>
            </tr>
          </thead>
          <tbody>
            {COOKIES.map(([name, why, how]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{why}</td>
                <td>{how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: "opslag",
    title: "Lokale opslag in je browser",
    body: (
      <>
        <p>Een paar voorkeuren bewaart Mavix in de opslag van je eigen browser. Deze gegevens worden niet naar Mavix verstuurd.</p>
        <div className="lg-table-wrap">
          <table className="lg-table">
            <thead>
              <tr>
                <th scope="col">Sleutel</th>
                <th scope="col">Waarvoor</th>
              </tr>
            </thead>
            <tbody>
              {STORAGE.map(([name, why]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "derden",
    title: "Diensten van derden",
    body: (
      <p>
        Koppel je Google of Meta, dan gebruik je tijdens het koppelen de inlogpagina van Google of Meta. Die diensten plaatsen daar hun eigen cookies, volgens hun eigen cookiebeleid. Mavix zelf laadt geen trackers van deze partijen op mavix.webbo-solutions.nl.
      </p>
    ),
  },
  {
    id: "beheren",
    title: "Cookies beheren",
    body: (
      <p>
        Je kunt cookies verwijderen of blokkeren in je browser. Blokkeer je de inlogcookies, dan kun je niet inloggen bij Mavix. Gaan we ooit analyse- of marketingcookies gebruiken, dan vragen we eerst je toestemming en passen we dit beleid aan. Meer over je gegevens lees je in het <Link href="/privacy">privacybeleid</Link>.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return <LegalDocument title="Cookiebeleid" current="/cookies" intro="Welke cookies en lokale opslag Mavix gebruikt, en waarom. Kort gezegd: alleen wat nodig is, geen tracking." sections={sections} />;
}
