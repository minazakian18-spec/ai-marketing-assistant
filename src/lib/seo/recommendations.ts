import type { CheckResult, PsiResult, Recommendation, Severity } from "./types";

// Rule-based recommendations from failed checks: what is wrong, why it
// matters, how bad it is, which URLs, and what to do. Written for owners who
// know little about SEO. AI only adds optional text alternatives (titles,
// descriptions, structure) on request.

type Template = {
  severity: (ratio: number) => Severity;
  problem: (c: CheckResult) => string;
  why: string;
  action: string;
  guidance: string[];
  suggest?: Recommendation["suggest"];
};
// by(c, h, m): share <= c -> critical, <= h -> high, <= m -> medium, else low (-1 = never).
const by = (critical: number, high: number, medium: number) => (r: number): Severity => (r <= critical ? "critical" : r <= high ? "high" : r <= medium ? "medium" : "low");
const fixed = (s: Severity) => () => s;

const T: Record<string, Template> = {
  reachable: {
    severity: fixed("critical"),
    problem: () => "Je website is niet bereikbaar voor zoekmachines.",
    why: "Als Google je homepage niet kan openen, kan niemand je via zoekresultaten vinden.",
    action: "Zorg dat de homepage een normale pagina toont (statuscode 200).",
    guidance: ["Open je website in een privévenster en controleer of hij laadt.", "Vraag je hostingpartij of de server bereikbaar is en of er een firewall of beveiliging bezoekers blokkeert.", "Start daarna een nieuwe analyse."],
  },
  status: {
    severity: by(0.5, 0.8, 0.95),
    problem: (c) => `Sommige pagina's geven een foutmelding. ${c.detail}`,
    why: "Pagina's met een fout (zoals 404 of 500) verdwijnen uit Google en geven bezoekers een slechte ervaring.",
    action: "Herstel deze pagina's of stuur ze met een 301-doorverwijzing naar een passende pagina.",
    guidance: ["Bekijk de lijst met URL's hieronder.", "Bestaat de pagina niet meer? Maak een 301-doorverwijzing naar de beste vervangende pagina.", "Geeft de pagina een serverfout (5xx)? Neem contact op met je websitebouwer of hosting."],
  },
  robots: {
    severity: fixed("low"),
    problem: () => "Je website heeft geen robots.txt-bestand.",
    why: "robots.txt vertelt zoekmachines welke delen ze mogen bekijken en waar je sitemap staat. Zonder bestand mag alles, maar je mist die sturing.",
    action: "Voeg een eenvoudig robots.txt-bestand toe met een verwijzing naar je sitemap.",
    guidance: ["Maak een bestand robots.txt in de hoofdmap van je website.", "Inhoud bijvoorbeeld:\nUser-agent: *\nAllow: /\nSitemap: https://jouwdomein.nl/sitemap.xml", "In WordPress regelt een SEO-plugin (zoals Yoast) dit meestal automatisch."],
  },
  "robots-blocks": {
    severity: fixed("critical"),
    problem: () => "robots.txt verbiedt zoekmachines je website te bekijken.",
    why: "Zolang dit zo is, kan Google je pagina's niet goed lezen en worden ze slecht of niet gevonden.",
    action: "Verwijder de regel 'Disallow: /' (of een vergelijkbare blokkade) uit robots.txt.",
    guidance: ["Open https://jouwdomein.nl/robots.txt.", "Zoek naar 'Disallow: /' onder 'User-agent: *'.", "Haal die regel weg, tenzij je de site bewust verborgen houdt (bijvoorbeeld een testomgeving)."],
  },
  sitemap: {
    severity: fixed("medium"),
    problem: () => "Er is geen XML-sitemap gevonden.",
    why: "Een sitemap helpt Google al je belangrijke pagina's snel te vinden, vooral nieuwe pagina's.",
    action: "Maak een XML-sitemap en meld die aan in robots.txt en Google Search Console.",
    guidance: ["WordPress: zet de sitemap aan in je SEO-plugin of gebruik de ingebouwde /wp-sitemap.xml.", "Andere websitebouwers (Wix, Squarespace, Shopify) maken meestal automatisch /sitemap.xml.", "Voeg 'Sitemap: https://jouwdomein.nl/sitemap.xml' toe aan robots.txt."],
  },
  indexable: {
    severity: by(0.5, 0.8, 0.95),
    problem: (c) => `Sommige pagina's vragen Google om ze niet te tonen (noindex). ${c.detail}`,
    why: "Pagina's met 'noindex' verschijnen niet in zoekresultaten. Soms is dat bewust, vaak is het een vergeten instelling.",
    action: "Haal 'noindex' weg bij pagina's die gevonden moeten worden.",
    guidance: ["Controleer de pagina's hieronder.", "Zoek in je websitebouwer naar een instelling als 'Verbergen voor zoekmachines' of 'noindex'.", "In WordPress: Instellingen → Lezen → 'Zoekmachines ontmoedigen' moet uit staan."],
  },
  canonical: {
    severity: by(-1, -1, 0.5),
    problem: (c) => `Niet alle pagina's hebben een canonical-URL. ${c.detail}`,
    why: "Een canonical vertelt Google welke versie van een pagina de echte is. Dat voorkomt dat vergelijkbare URL's (met en zonder www, of met parameters) elkaar beconcurreren.",
    action: "Voeg op elke pagina een canonical-link toe die naar de pagina zelf verwijst.",
    guidance: ["HTML: <link rel=\"canonical\" href=\"https://jouwdomein.nl/pagina/\"> in de <head>.", "De meeste SEO-plugins voegen dit automatisch toe."],
  },
  redirects: {
    severity: fixed("low"),
    problem: (c) => `Sommige pagina's gaan via meerdere doorverwijzingen. ${c.detail}`,
    why: "Elke extra doorverwijzing maakt de pagina trager en kost Google meer moeite.",
    action: "Verwijs direct naar de eindbestemming in één stap.",
    guidance: ["Pas oude links in menu's en teksten aan naar de nieuwe URL.", "Combineer doorverwijzingen (bijvoorbeeld http → https én www) tot één regel bij je hosting."],
  },
  "broken-links": {
    severity: by(0.7, 0.9, 0.98),
    problem: (c) => `Er staan kapotte links op je website. ${c.detail}`,
    why: "Kapotte links frustreren bezoekers en laten zoekmachines doodlopen.",
    action: "Pas de links aan of verwijder ze.",
    guidance: ["Bekijk welke links kapot zijn en op welke pagina ze staan (zie details).", "Vervang ze door een werkende URL of verwijder de link."],
  },
  "structured-data": {
    severity: fixed("low"),
    problem: () => "Je website gebruikt (nog) geen gestructureerde data, of de gegevens zijn ongeldig.",
    why: "Gestructureerde data (schema.org) helpt Google je bedrijfsgegevens, openingstijden of reviews te begrijpen en soms uitgebreider te tonen.",
    action: "Voeg schema.org-gegevens toe, bijvoorbeeld LocalBusiness of Restaurant met adres en openingstijden.",
    guidance: ["Gebruik een SEO-plugin of de schema-generator van je websitebouwer.", "Controleer het resultaat met de Rich Results Test van Google (search.google.com/test/rich-results)."],
  },
  title: {
    severity: by(0, 0.5, 0.9),
    problem: (c) => `Pagina's zonder titel. ${c.detail}`,
    why: "De paginatitel is de blauwe kop in Google. Zonder titel weet Google niet goed waar de pagina over gaat en klikken minder mensen.",
    action: "Geef elke pagina een unieke, beschrijvende titel.",
    guidance: ["Noem het belangrijkste onderwerp en je bedrijfsnaam, bijvoorbeeld 'Italiaans restaurant in Gouda | Trattoria'.", "Gebruik de knop 'Voorstellen' voor alternatieven."],
    suggest: "title",
  },
  "title-length": {
    severity: by(-1, -1, 0.5),
    problem: (c) => `Titels zijn te kort of te lang. ${c.detail}`,
    why: "Te lange titels worden in Google afgekapt, te korte zeggen te weinig.",
    action: "Houd titels tussen ongeveer 30 en 60 tekens.",
    guidance: ["Zet het belangrijkste woord vooraan.", "Gebruik de knop 'Voorstellen' voor alternatieven van een goede lengte."],
    suggest: "title",
  },
  "title-unique": {
    severity: by(-1, 0.5, 0.9),
    problem: (c) => `Meerdere pagina's hebben dezelfde titel. ${c.detail}`,
    why: "Gelijke titels maken het voor Google lastig te kiezen welke pagina het beste antwoord is.",
    action: "Geef elke pagina een eigen titel die beschrijft wat er op die pagina staat.",
    guidance: ["Vergelijk de pagina's hieronder en benoem wat elke pagina uniek maakt."],
    suggest: "title",
  },
  description: {
    severity: by(-1, 0.3, 0.8),
    problem: (c) => `Pagina's zonder metabeschrijving. ${c.detail}`,
    why: "De metabeschrijving is vaak de tekst onder je titel in Google. Een goede beschrijving zorgt voor meer kliks.",
    action: "Schrijf per pagina een beschrijving van 70-160 tekens die uitnodigt om te klikken.",
    guidance: ["Vertel wat de bezoeker vindt en waarom hij moet klikken.", "Gebruik de knop 'Voorstellen' voor alternatieven."],
    suggest: "description",
  },
  "description-length": {
    severity: by(-1, -1, 0.5),
    problem: (c) => `Beschrijvingen zijn te kort of te lang. ${c.detail}`,
    why: "Te lange beschrijvingen worden afgekapt; te korte benutten de ruimte niet.",
    action: "Houd beschrijvingen tussen ongeveer 70 en 160 tekens.",
    guidance: ["Gebruik de knop 'Voorstellen' voor alternatieven van een goede lengte."],
    suggest: "description",
  },
  "description-unique": {
    severity: by(-1, -1, 0.7),
    problem: (c) => `Meerdere pagina's hebben dezelfde beschrijving. ${c.detail}`,
    why: "Dezelfde beschrijving op meerdere pagina's maakt ze in Google minder onderscheidend.",
    action: "Schrijf per pagina een eigen beschrijving.",
    guidance: ["Gebruik de knop 'Voorstellen' per pagina."],
    suggest: "description",
  },
  h1: {
    severity: by(-1, 0.3, 0.8),
    problem: (c) => `Niet elke pagina heeft precies één hoofdkop (H1). ${c.detail}`,
    why: "De H1 is de hoofdtitel op de pagina zelf. Eén duidelijke H1 helpt bezoekers en zoekmachines het onderwerp te begrijpen.",
    action: "Geef elke pagina één H1 met het hoofdonderwerp; gebruik H2 en H3 voor onderdelen.",
    guidance: ["Controleer in je websitebouwer welke tekst als 'Kop 1' is ingesteld.", "Gebruik de knop 'Voorstellen' voor een voorstel van een kopstructuur."],
    suggest: "structure",
  },
  "heading-order": {
    severity: fixed("low"),
    problem: (c) => `De kopjes slaan niveaus over. ${c.detail}`,
    why: "Een logische volgorde (H1 → H2 → H3) maakt een pagina beter leesbaar, ook voor schermlezers.",
    action: "Gebruik kopniveaus op volgorde, zonder er een over te slaan.",
    guidance: ["Kies kopniveaus op basis van structuur, niet op basis van lettergrootte."],
    suggest: "structure",
  },
  "word-count": {
    severity: by(-1, -1, 0.5),
    problem: (c) => `Sommige pagina's hebben weinig tekst. ${c.detail}`,
    why: "Met weinig tekst heeft Google weinig om te begrijpen waar de pagina over gaat.",
    action: "Vul belangrijke pagina's aan met nuttige informatie voor je klanten.",
    guidance: ["Beantwoord vragen die klanten vaak stellen.", "Beschrijf je producten of diensten, je werkwijze en je locatie."],
    suggest: "structure",
  },
  keyword: {
    severity: by(-1, 0.25, 0.75),
    problem: (c) => `Je zoekwoord komt niet overal op de homepage terug. ${c.detail}`,
    why: "Als je belangrijkste zoekwoord in de titel, hoofdkop en tekst staat, begrijpt Google beter waarvoor je gevonden wilt worden.",
    action: "Verwerk het zoekwoord natuurlijk in titel, H1, beschrijving en tekst.",
    guidance: ["Schrijf voor mensen: herhaal het woord niet onnatuurlijk vaak.", "Gebruik de knoppen 'Voorstellen' voor titel en beschrijving."],
    suggest: "title",
  },
  "lh-performance-mobile": {
    severity: by(-1, 0.49, 0.89),
    problem: (c) => `Je website laadt traag op mobiel. ${c.detail}`,
    why: "Trage pagina's verliezen bezoekers en snelheid is een van de signalen die Google gebruikt.",
    action: "Werk de verbeterpunten van Google Lighthouse af (zie Prestaties).",
    guidance: ["Verklein afbeeldingen en gebruik moderne formaten (WebP/AVIF).", "Verwijder ongebruikte plugins en scripts.", "Gebruik caching of een CDN via je hosting."],
  },
  "lh-performance-desktop": {
    severity: by(-1, -1, 0.89),
    problem: (c) => `Je website kan sneller op desktop. ${c.detail}`,
    why: "Snelheid bepaalt mede of bezoekers blijven.",
    action: "Werk de verbeterpunten van Google Lighthouse af (zie Prestaties).",
    guidance: ["Begin met de grootste besparingen die Lighthouse noemt."],
  },
  "core-web-vitals": {
    severity: by(-1, 0.34, 0.99),
    problem: (c) => `Echte bezoekers ervaren je website als traag of onrustig. ${c.detail}`,
    why: "Core Web Vitals meten laadsnelheid (LCP), reactiesnelheid (INP) en verspringen (CLS) bij echte Chrome-gebruikers. Google gebruikt deze meetwaarden.",
    action: "Verbeter de onderdelen die niet 'goed' zijn (zie Prestaties).",
    guidance: ["LCP: maak de grootste afbeelding of tekst bovenaan sneller zichtbaar.", "INP: beperk zware scripts.", "CLS: geef afbeeldingen en advertenties vaste afmetingen."],
  },
  viewport: {
    severity: by(0.5, 0.9, 0.99),
    problem: (c) => `Niet elke pagina past zich aan mobiele schermen aan. ${c.detail}`,
    why: "Google beoordeelt je website vooral op de mobiele versie. Zonder viewport-instelling is de pagina op een telefoon klein en onleesbaar.",
    action: "Voeg <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> toe aan de <head>.",
    guidance: ["Moderne thema's doen dit standaard; controleer of je thema responsive is."],
  },
  zoom: {
    severity: fixed("low"),
    problem: (c) => `Inzoomen wordt geblokkeerd. ${c.detail}`,
    why: "Slechtzienden moeten kunnen inzoomen op je pagina.",
    action: "Verwijder 'user-scalable=no' en 'maximum-scale=1' uit de viewport-instelling.",
    guidance: ["Pas de viewport-meta-tag aan in je thema."],
  },
  "font-size": {
    severity: fixed("low"),
    problem: () => "Een deel van de tekst is te klein op mobiel.",
    why: "Kleine tekst is slecht leesbaar op een telefoon.",
    action: "Gebruik minimaal 16 pixels voor gewone tekst op mobiel.",
    guidance: ["Pas de lettergrootte aan in je thema-instellingen."],
  },
  https: {
    severity: fixed("critical"),
    problem: () => "Je website gebruikt geen HTTPS.",
    why: "Browsers tonen 'Niet veilig' bij websites zonder HTTPS en Google geeft de voorkeur aan beveiligde websites.",
    action: "Zet een SSL-certificaat aan bij je hosting en stuur alle bezoekers naar https://.",
    guidance: ["Bij de meeste hostingpartijen is een gratis certificaat (Let's Encrypt) met één klik aan te zetten.", "Stel daarna een doorverwijzing in van http:// naar https://."],
  },
  "http-redirect": {
    severity: fixed("high"),
    problem: () => "Wie http:// intypt, wordt niet doorgestuurd naar de beveiligde versie.",
    why: "Zonder doorverwijzing bestaan er twee versies van je website en komen sommige bezoekers op de onbeveiligde versie.",
    action: "Stel een permanente (301) doorverwijzing in van http:// naar https://.",
    guidance: ["Dit staat meestal als optie 'HTTPS forceren' in het hostingpaneel."],
  },
  hsts: {
    severity: fixed("low"),
    problem: () => "De beveiligingsheader Strict-Transport-Security ontbreekt.",
    why: "Met HSTS gebruiken browsers altijd HTTPS voor je website, ook als iemand http:// intypt.",
    action: "Vraag je hosting om de HSTS-header in te stellen.",
    guidance: ["Voorbeeld: Strict-Transport-Security: max-age=31536000"],
  },
  "mixed-content": {
    severity: fixed("medium"),
    problem: (c) => `Pagina's laden onderdelen via onbeveiligd http://. ${c.detail}`,
    why: "Gemengde inhoud kan worden geblokkeerd door browsers en ondermijnt de beveiliging.",
    action: "Laad afbeeldingen, scripts en stijlen via https://.",
    guidance: ["Vervang http:// door https:// in de bronnen van afbeeldingen en scripts."],
  },
  nosniff: {
    severity: fixed("low"),
    problem: () => "De header X-Content-Type-Options ontbreekt.",
    why: "Deze header voorkomt dat browsers bestanden verkeerd interpreteren, een veelgebruikte basisbeveiliging.",
    action: "Laat je hosting 'X-Content-Type-Options: nosniff' instellen.",
    guidance: ["Vaak in te stellen via .htaccess of het hostingpaneel."],
  },
  lang: {
    severity: fixed("low"),
    problem: (c) => `De taal van de pagina is niet ingesteld. ${c.detail}`,
    why: "Met het lang-attribuut weten zoekmachines en schermlezers in welke taal je pagina is geschreven.",
    action: "Zet <html lang=\"nl\"> bovenaan je pagina's.",
    guidance: ["In WordPress: Instellingen → Algemeen → Taal van de site."],
  },
  alt: {
    severity: by(-1, 0.5, 0.9),
    problem: (c) => `Afbeeldingen zonder alt-tekst. ${c.detail}`,
    why: "Alt-teksten beschrijven afbeeldingen voor blinden en voor Google Afbeeldingen.",
    action: "Geef elke inhoudelijke afbeelding een korte beschrijving; decoratieve afbeeldingen een lege alt (alt=\"\").",
    guidance: ["Beschrijf wat er op de foto staat, bijvoorbeeld 'Huisgemaakte pasta met truffel'."],
  },
  "link-text": {
    severity: fixed("low"),
    problem: (c) => `Er staan links zonder tekst op je pagina's. ${c.detail}`,
    why: "Links zonder tekst (bijvoorbeeld alleen een icoon) zijn onbruikbaar voor schermlezers.",
    action: "Geef iconen-links een aria-label of zichtbare tekst.",
    guidance: ["Bijvoorbeeld een Instagram-icoon: aria-label=\"Instagram\"."],
  },
  "lh-accessibility": {
    severity: by(-1, 0.49, 0.89),
    problem: (c) => `Lighthouse vindt toegankelijkheidsproblemen. ${c.detail}`,
    why: "Een toegankelijke website werkt voor iedereen en is in veel gevallen ook wettelijk wenselijk.",
    action: "Bekijk de toegankelijkheidspunten in PageSpeed Insights.",
    guidance: ["Let vooral op kleurcontrast, labels bij formulieren en knoppen met tekst."],
  },
};

const ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function buildRecommendations(checks: CheckResult[], psi?: { mobile: PsiResult; desktop: PsiResult } | null): Recommendation[] {
  const out: Recommendation[] = [];
  for (const c of checks) {
    if (c.ratio === null || c.ratio >= 1) continue;
    // Lighthouse calls 90-100 "good": no recommendation for those.
    if (c.id.startsWith("lh-") && c.ratio >= 0.9) continue;
    const t = T[c.id];
    if (!t) continue;
    const guidance = [...t.guidance];
    if (c.id === "lh-performance-mobile" && psi?.mobile.ok && psi.mobile.opportunities.length)
      guidance.unshift("Grootste verbeterpunten volgens Lighthouse: " + psi.mobile.opportunities.slice(0, 4).map((o) => o.title + (o.display ? ` (${o.display})` : "")).join("; ") + ".");
    out.push({
      id: c.id,
      checkId: c.id,
      category: c.category,
      severity: t.severity(c.ratio),
      problem: t.problem(c),
      why: t.why,
      action: t.action,
      guidance,
      urls: c.failing.slice(0, 20),
      totalUrls: c.failing.length,
      ...(t.suggest ? { suggest: t.suggest } : {}),
    });
  }
  // Highest severity first; within a level, the heaviest check first.
  return out.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || (checks.find((c) => c.id === b.checkId)?.weight || 0) - (checks.find((c) => c.id === a.checkId)?.weight || 0));
}
