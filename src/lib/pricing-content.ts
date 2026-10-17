import { ACTIONS, PLAN_IDS, PLANS, euro, type AiAction, type Plan, type PlanId } from "./plans";

// The pricing comparison, generated from the central plan configuration
// (./plans.ts). Availability is honest: "soon" = built or planned but not
// operational (shown as Binnenkort), false = not in this plan. Rows only
// promise what the server allows, and the server blocks what is not here.

export type Cell = true | false | "soon" | number | string;
export type Row = { label: string; info?: string; values: Record<PlanId, Cell> };
export type Category = { id: string; title: string; open?: boolean; rows: Row[] };

const all = (v: Cell): Record<PlanId, Cell> => ({ starter: v, growth: v, autopilot: v });
const per = (s: Cell, g: Cell, p: Cell): Record<PlanId, Cell> => ({ starter: s, growth: g, autopilot: p });
const field = (f: (p: Plan) => Cell): Record<PlanId, Cell> => Object.fromEntries(PLAN_IDS.map((id) => [id, f(PLANS[id])])) as Record<PlanId, Cell>;
/** Monthly maximum of an action; 0 → not included. */
const limit = (a: AiAction): Record<PlanId, Cell> => field((p) => (p.limits[a] === 0 ? false : (p.limits[a] ?? true)));
const has = (e: Plan["entitlements"][number]) => field((p) => p.entitlements.includes(e));
const size = (b: number) => (b >= 1024 ** 3 ? `${b / 1024 ** 3} GB` : `${Math.round(b / 1024 ** 2)} MB`);
const slides = field((p) => (p.carouselSlides ? `2–${p.carouselSlides}` : false));

export const INFO = {
  credits: "Je gedeelde maandtegoed voor AI-acties. Een AI-afbeelding kost 10 credits, een kort reviewantwoord 1. Daarnaast heeft elke functie een maandmaximum.",
  instagram: "Laat Mavix Instagram-captions en hashtags schrijven die passen bij jouw bedrijf, doelgroep en merkstem. Je past alles aan voordat je het gebruikt.",
  images: "Laat AI een nieuwe afbeelding maken op basis van jouw opdracht, vierkant of in Instagram-formaat (4:5). Je hebt geen eigen foto nodig.",
  imageEdit: "Kies een eigen foto en laat AI hem aanpassen, bijvoorbeeld de sfeer of de achtergrond. Je origineel blijft bewaard.",
  inspiration: "Upload één of meer voorbeelden van afbeeldingen die je mooi vindt. Mavix gebruikt de stijl en sfeer om een nieuwe AI-afbeelding te maken; de voorbeelden worden niet gekopieerd.",
  carousel: "Maak meerdere samenhangende slides voor één Instagram-post. Mavix bedenkt het verhaal, maakt de beelden in één stijl en schrijft één caption. Elke AI-slide telt mee als AI-afbeelding.",
  slides: "Bevalt één slide niet, dan maak je alleen die slide opnieuw. De andere slides blijven precies zoals ze zijn; je betaalt alleen voor de nieuwe afbeelding.",
  download: "Download alle slides in de juiste volgorde (slide-01.jpg, slide-02.jpg …), met tekst op de afbeelding, plus de caption als tekstbestand.",
  manualCarousel: "Stel zelf een carrousel samen met je eigen foto's en tekst per slide. Hiervoor gebruik je geen AI-credits.",
  reviews: "Ontvang AI-voorstellen voor antwoorden op Google-reviews, in de toon van jouw bedrijf. Jij bekijkt en plaatst ze.",
  email: "Laat Mavix e-mailconcepten en nieuwsbrieven schrijven en verbeteren, met een voorbeeld voor desktop en mobiel.",
  seo: "Scan je website op technische en inhoudelijke verbeterpunten, met scores en concrete actiepunten.",
  seoAi: "Ontvang suggesties om de inhoud van je website te verbeteren, zoals betere paginatitels en omschrijvingen. Jij beslist wat je overneemt.",
  agent: "Een AI-assistent die vragen over je marketing beantwoordt, je gegevens in Mavix opzoekt en campagnes als concept klaarzet. Opslaan gebeurt pas na jouw bevestiging.",
  brandHub: "Bewaar je merkidentiteit, doelgroep, schrijfstijl, producten en visuele voorkeuren op één plek. Alle AI in Mavix gebruikt deze context.",
  calendar: "Plan je posts en e-mails in een overzichtelijke kalender met dag-, week- en maandweergave.",
  insights: "Bekijk gemeten resultaten per bron, vergeleken met de vorige periode, met concrete volgende stappen. Alleen echte cijfers.",
  advice: "Bespreek iedere maand 20 minuten je marketingaanpak, resultaten en verbeterkansen met een adviseur van Mavix (een mens, geen AI). Niet gebruikte gesprekken schuiven niet door.",
  inbox: "Mavix stelt antwoorden voor op klantberichten in je Inbox. Jij controleert en verstuurt ze zelf.",
  campaigns: "Eén doel, één klik: Mavix maakt een samenhangende campagne met Instagram-post, e-mail, tekst en voorgestelde momenten, als concepten.",
  research: "Mavix onderzoekt je bedrijf op basis van profiel, website, reviews en content, en scheidt gemeten feiten van advies.",
  autoCreate: "Mavix maakt volgens je planning zelf concepten die op je goedkeuring wachten. Nu als simulatie te bekijken; de echte automatische functie volgt.",
  autoPublish: "Ingeplande posts automatisch op Instagram plaatsen. Gebouwd, maar wacht op goedkeuring van Meta.",
  emailSend: "Campagnes versturen naar ontvangers met toestemming, met afmeldlink en afleverstatus. Beschikbaar zodra het verzenddomein is ingericht.",
  gmail: "E-mail van je eigen Gmail lezen en beantwoorden in de Inbox. Gebouwd; wacht op verificatie door Google.",
  gbp: "Je Google-reviews lezen en beantwoorden vanuit Mavix. Gebouwd; wacht op API-toegang van Google.",
  searchConsole: "Klikken en vertoningen uit Google zoeken. Gebouwd; wacht op verificatie door Google.",
  team: "Collega's uitnodigen met een eigen rol (beheerder of lid). Het aantal gebruikers hangt af van je pakket.",
};

const R = {
  credits: { label: "AI-credits per maand", info: INFO.credits, values: field((p) => p.credits) } as Row,
  captions: { label: "Instagram-captions per maand", info: INFO.instagram, values: limit("instagram_caption") } as Row,
  images: { label: "AI-afbeeldingen per maand", info: INFO.images, values: limit("image_generate") } as Row,
  imageEdits: { label: "AI-afbeeldingsbewerkingen per maand", info: INFO.imageEdit, values: limit("image_edit") } as Row,
  inspiration: { label: "Max. inspiratiebeelden", info: INFO.inspiration, values: field((p) => p.inspirationMax) } as Row,
  imageGen: { label: "AI-afbeeldingen genereren", info: INFO.images, values: all(true) } as Row,
  inspirationUse: { label: "Inspiratiebeelden gebruiken", info: INFO.inspiration, values: all(true) } as Row,
  carouselMake: { label: "AI-carrousels maken", info: INFO.carousel, values: field((p) => (p.entitlements.includes("carousels") ? true : "Nee")) } as Row,
  slideEdit: { label: "Individuele slides bewerken", info: INFO.slides, values: has("carousels") } as Row,
  slideRegen: { label: "Individuele slides opnieuw genereren", info: INFO.slides, values: has("carousels") } as Row,
  download: { label: "Carrousels downloaden", info: INFO.download, values: has("carousels") } as Row,
  brand: { label: "Brand Hub AI-verbeteringen per maand", info: INFO.brandHub, values: limit("brand_improve") } as Row,
  emails: { label: "AI-e-mailconcepten per maand", info: INFO.email, values: limit("email_draft") } as Row,
  reviews: { label: "AI-review­antwoorden per maand", info: INFO.reviews, values: limit("review_reply") } as Row,
  inbox: { label: "Inbox AI-antwoorden per maand", info: INFO.inbox, values: limit("inbox_reply") } as Row,
  seoAi: { label: "SEO AI-adviezen per maand", info: INFO.seoAi, values: limit("seo_advice") } as Row,
  campaigns: { label: "AI-campagnevoorstellen per maand", info: INFO.campaigns, values: limit("campaign") } as Row,
  research: { label: "AI-bedrijfsonderzoek per maand", info: INFO.research, values: limit("research") } as Row,
  agent: { label: "Mavix Agent-taken per maand", info: INFO.agent, values: limit("agent_task") } as Row,
  carousels: { label: "Max. carrousels per maand", info: INFO.carousel, values: field((p) => p.limits.carousel ?? 0) } as Row,
  slides: { label: "Slides per carrousel", info: INFO.carousel, values: slides } as Row,
  users: { label: "Gebruikers", info: INFO.team, values: field((p) => p.users) } as Row,
  contacts: { label: "Contacten", values: field((p) => p.contacts) } as Row,
  storage: { label: "Bibliotheekopslag", values: field((p) => size(p.storageBytes)) } as Row,
  scans: { label: "SEO-websitescans per maand", info: INFO.seo, values: field((p) => p.seoScansPerMonth) } as Row,
  advice: { label: "Persoonlijk advies", info: INFO.advice, values: field((p) => (p.entitlements.includes("advice_call") ? "20 minuten per maand" : false)) } as Row,
};

export const CATEGORIES: Category[] = [
  {
    id: "key",
    title: "Belangrijkste verschillen",
    open: true,
    rows: [R.inspiration, R.carouselMake, R.carousels, R.slides, R.slideEdit, R.slideRegen, R.download, R.images, R.credits, R.captions, R.reviews, R.inbox, R.seoAi, R.campaigns, R.research, { label: "Mavix Agent", info: INFO.agent, values: has("agent") }, R.users, R.contacts, R.storage, R.scans, R.advice],
  },
  {
    id: "credits",
    title: "AI-credits en generaties",
    open: true,
    rows: [R.credits, R.captions, R.images, R.imageEdits, R.inspiration, R.brand, R.emails, R.reviews, R.inbox, R.seoAi, R.campaigns, R.research, R.agent],
  },
  {
    id: "instagram",
    title: "Instagram en contentcreatie",
    rows: [
      { label: "Instagram-posts maken", values: all(true) },
      { label: "AI-captions en hashtags genereren", info: INFO.instagram, values: all(true) },
      R.imageGen,
      { label: "Eigen foto's gebruiken", values: all(true) },
      { label: "AI-foto's bewerken", info: INFO.imageEdit, values: all(true) },
      { label: "Afbeeldingen opnieuw genereren", values: all(true) },
      R.inspirationUse,
      { label: "Inspiratiebeelden uploaden", info: INFO.inspiration, values: all(true) },
      { label: "Inspiratiebeelden uit de Bibliotheek kiezen", info: INFO.inspiration, values: all(true) },
      R.carouselMake,
      R.carousels,
      R.slides,
      R.slideEdit,
      R.slideRegen,
      { label: "Tekst op slides opmaken (positie, kleur, lettertype)", info: INFO.slides, values: has("carousels") },
      { label: "Eigen foto's combineren met AI-slides", info: INFO.carousel, values: has("carousels") },
      { label: "Carrousel zelf samenstellen met eigen foto's", info: INFO.manualCarousel, values: has("carousels") },
      R.download,
      { label: "Content inplannen in de kalender", info: INFO.calendar, values: all(true) },
      { label: "AI-content automatisch voorbereiden", info: INFO.autoCreate, values: all("soon") },
      { label: "Automatisch publiceren op Instagram", info: INFO.autoPublish, values: all("soon") },
    ],
  },
  {
    id: "email",
    title: "E-mail en Inbox",
    rows: [
      { label: "AI-e-mails schrijven", info: INFO.email, values: all(true) },
      { label: "AI-e-mails herschrijven en verbeteren", info: INFO.email, values: all(true) },
      { label: "E-mails in de stijl van je Brand Hub", info: INFO.brandHub, values: all(true) },
      { label: "E-mailcampagnes voorbereiden", info: INFO.email, values: all(true) },
      { label: "Contacten gebruiken voor campagnes", values: all(true) },
      { label: "Campagnes plannen", info: INFO.calendar, values: all(true) },
      R.inbox,
      { label: "Inbox-samenvattingen", info: INFO.inbox, values: has("inbox_ai") },
      { label: "Berichten verbeteren met AI", info: INFO.inbox, values: has("inbox_ai") },
      { label: "Campagnes versturen naar je ontvangers", info: INFO.emailSend, values: all("soon") },
      { label: "Gmail-integratie", info: INFO.gmail, values: all("soon") },
    ],
  },
  {
    id: "reviews",
    title: "Reviews en reputatie",
    rows: [
      R.reviews,
      { label: "Reviewvoorstellen genereren", info: INFO.reviews, values: all(true) },
      { label: "Reviewreacties aanpassen", info: INFO.reviews, values: all(true) },
      { label: "Analyse van klantfeedback (in bedrijfsonderzoek)", info: INFO.research, values: has("research") },
      { label: "Reviewoverzicht met prioriteiten", info: INFO.gbp, values: all("soon") },
      { label: "Google Bedrijfsprofiel-integratie", info: INFO.gbp, values: all("soon") },
      { label: "Reviews beantwoorden, bewerken en verwijderen", info: INFO.gbp, values: all("soon") },
      { label: "Locaties", values: all(1) },
    ],
  },
  {
    id: "seo",
    title: "SEO Intelligence en inzichten",
    rows: [
      R.scans,
      R.seoAi,
      R.research,
      { label: "Technische SEO-controles", info: INFO.seo, values: all(true) },
      { label: "SEO-actiepunten", info: INFO.seo, values: all(true) },
      { label: "Websiteprestaties (laadsnelheid)", info: INFO.seo, values: all(true) },
      { label: "Eerdere scans terugzien", values: all(true) },
      { label: "Zoekwoord- en titeladviezen met AI", info: INFO.seoAi, values: has("seo_ai") },
      { label: "Marketinginzichten", info: INFO.insights, values: all(true) },
      { label: "Inzichten met vergelijkingsperiodes", info: INFO.insights, values: all(true) },
      { label: "Google Search Console", info: INFO.searchConsole, values: all("soon") },
    ],
  },
  {
    id: "studio",
    title: "Content Studio en campagnes",
    rows: [
      { label: "Content Studio (posts, e-mails, teksten)", values: all(true) },
      { label: "Contentkalender", info: INFO.calendar, values: all(true) },
      { label: "Concepten opslaan en versies", values: all(true) },
      { label: "Posts goedkeuren", values: all(true) },
      { label: "Marketingcontent vanuit Brand Hub", info: INFO.brandHub, values: all(true) },
      { label: "Campagnevoorstellen met AI", info: INFO.campaigns, values: has("campaigns") },
      { label: "Meerdere kanalen in één campagne", info: INFO.campaigns, values: has("campaigns") },
      { label: "Campagneplanning", info: INFO.calendar, values: all(true) },
      { label: "Mavix Agent", info: INFO.agent, values: has("agent") },
      { label: "Google Ads-campagnes", info: "Een overzicht van je Google Ads-campagnes, uitgaven en resultaten. In ontwikkeling; Mavix maakt nooit campagnes zonder jouw goedkeuring.", values: all("soon") },
    ],
  },
  {
    id: "workspace",
    title: "Werkruimte, organisatie en bestanden",
    rows: [
      R.users,
      R.contacts,
      R.storage,
      { label: "Dashboard", values: all(true) },
      { label: "Brand Hub", info: INFO.brandHub, values: all(true) },
      { label: "Bibliotheek", values: all(true) },
      { label: "Bestanden organiseren in albums", values: all(true) },
      { label: "AI-creaties bewaard in de Bibliotheek", values: all(true) },
      { label: "Teambeheer en gebruikersrollen", info: INFO.team, values: has("team") },
      { label: "Integraties beheren", values: all(true) },
      { label: "Gegevens exporteren", values: all(true) },
      { label: "Werkruimtes", values: all(1) },
    ],
  },
  {
    id: "support",
    title: "Ondersteuning en persoonlijk advies",
    rows: [
      { label: "Zelfservice en uitleg in de app", values: all(true) },
      { label: "Ondersteuning per e-mail", values: all(true) },
      R.advice,
      { label: "Adviesgesprekken per maand", info: INFO.advice, values: field((p) => (p.entitlements.includes("advice_call") ? 1 : false)) },
      { label: "Duur adviesgesprek", info: INFO.advice, values: field((p) => (p.entitlements.includes("advice_call") ? "20 minuten" : false)) },
      { label: "Mavix Agent", info: INFO.agent, values: has("agent") },
    ],
  },
];

/** Unique comparison rows across the eight detail categories (the summary repeats some). */
export const uniqueRows = () => {
  const seen = new Set<string>();
  return CATEGORIES.filter((c) => c.id !== "key")
    .flatMap((c) => c.rows)
    .filter((r) => (seen.has(r.label) ? false : (seen.add(r.label), true)));
};

/** Rows where the plans differ (for "Toon alleen verschillen"). */
export const differs = (r: Row) => new Set(PLAN_IDS.map((id) => String(r.values[id]))).size > 1;

/**
 * "Dit krijg je extra met …": concrete differences, computed from the plan
 * configuration so numbers and prices can never contradict the cards.
 */
export function upgradeBenefits(fromId: PlanId, toId: PlanId) {
  const a = PLANS[fromId],
    b = PLANS[toId];
  const nl = (n: number) => n.toLocaleString("nl-NL");
  const out: string[] = [];
  const more = (label: string, x: number, y: number) => y > x && out.push(`${nl(y)} in plaats van ${nl(x)} ${label}`);
  more("AI-credits per maand", a.credits, b.credits);
  more("AI-afbeeldingen per maand", a.limits.image_generate || 0, b.limits.image_generate || 0);
  more("Instagram-captions per maand", a.limits.instagram_caption || 0, b.limits.instagram_caption || 0);
  more("AI-reviewantwoorden per maand", a.limits.review_reply || 0, b.limits.review_reply || 0);
  if (b.carouselSlides && !a.carouselSlides) out.push(`Instagram-carrousels met AI: ${b.limits.carousel} per maand, tot ${b.carouselSlides} slides`);
  else if (b.carouselSlides > a.carouselSlides) out.push(`Tot ${b.limits.carousel} AI-carrousels per maand met maximaal ${b.carouselSlides} slides (nu ${a.limits.carousel} met ${a.carouselSlides})`);
  more("inspiratiebeelden per opdracht", a.inspirationMax, b.inspirationMax);
  const gained = (e: Plan["entitlements"][number], text: string) => b.entitlements.includes(e) && !a.entitlements.includes(e) && out.push(text);
  gained("inbox_ai", `AI-antwoorden in je Inbox (${b.limits.inbox_reply} per maand)`);
  gained("seo_ai", `SEO AI-adviezen (${b.limits.seo_advice} per maand)`);
  gained("campaigns", `AI-campagnevoorstellen (${b.limits.campaign} per maand)`);
  gained("research", "Maandelijks AI-bedrijfsonderzoek");
  gained("agent", `Mavix Agent (${b.limits.agent_task} taken per maand)`);
  if (b.entitlements.includes("inbox_ai") && a.entitlements.includes("inbox_ai")) more("Inbox AI-antwoorden per maand", a.limits.inbox_reply || 0, b.limits.inbox_reply || 0);
  more("gebruikers", a.users, b.users);
  more("contacten", a.contacts, b.contacts);
  if (b.storageBytes > a.storageBytes) out.push(`${size(b.storageBytes)} in plaats van ${size(a.storageBytes)} opslag`);
  gained("advice_call", "Eén persoonlijk marketingadviesgesprek van 20 minuten per maand");
  return { from: a, to: b, extraPerMonth: euro(b.monthlyPrice - a.monthlyPrice), items: out };
}

export const UPGRADE_PITCH: Record<"growth" | "autopilot", string> = {
  growth: `Maak tot ${PLANS.growth.limits.image_generate} AI-afbeeldingen per maand en complete Instagram-carrousels met maximaal ${PLANS.growth.carouselSlides} slides, met AI-hulp in je Inbox, SEO en campagnes.`,
  autopilot: `Ontgrendel de Mavix Agent, maak grotere AI-carrousels tot ${PLANS.autopilot.carouselSlides} slides en krijg iedere maand 20 minuten persoonlijk marketingadvies.`,
};

export const FAQ: { q: string; a: string }[] = [
  { q: "Wat is Mavix?", a: "Mavix is een AI-marketingwerkruimte voor ondernemers. Je maakt posts, afbeeldingen, carrousels, e-mails en reviewantwoorden met AI, plant ze in en ziet je resultaten op één plek. Jij houdt altijd de regie." },
  { q: "Welk abonnement past bij mijn bedrijf?", a: "Starter is voor wie eenvoudig wil beginnen. Growth is voor bedrijven die wekelijks content maken en carrousels, Inbox-, SEO- en campagnehulp willen. Premium is voor wie intensief met AI werkt, de Mavix Agent wil gebruiken en maandelijks persoonlijk advies wil. Gebruik de keuzehulp hierboven." },
  { q: "Wat zijn AI-credits?", a: "Credits zijn je maandelijkse AI-tegoed. Elke AI-actie gebruikt een vast aantal credits uit het gedeelde tegoed van je werkruimte. Daarnaast heeft elke functie een maandmaximum, zodat je tegoed niet aan één ding opgaat." },
  { q: "Hoeveel AI-credits kost een Instagram-post?", a: `Een caption kost ${ACTIONS.instagram_caption.credits} credit. Met een nieuwe AI-afbeelding erbij kost de post ${ACTIONS.instagram_caption.credits + ACTIONS.image_generate.credits} credits.` },
  { q: "Hoeveel kost het om een AI-afbeelding te maken?", a: `Een nieuwe AI-afbeelding kost ${ACTIONS.image_generate.credits} credits (ook met inspiratiebeelden), een AI-bewerking van een eigen foto ${ACTIONS.image_edit.credits} credits. Er geldt ook een maandmaximum per pakket: ${PLAN_IDS.map((id) => PLANS[id].limits.image_generate).join(", ")} nieuwe afbeeldingen.` },
  { q: "Wat is een AI-carrousel en wat kost hij?", a: `Een carrousel is één Instagram-post met meerdere slides. Mavix bedenkt het verhaal en de caption (${ACTIONS.carousel.credits} credits) en maakt per slide een AI-afbeelding (${ACTIONS.image_generate.credits} credits per slide, telt mee in je maandlimiet voor AI-afbeeldingen). Growth: ${PLANS.growth.limits.carousel} carrousels per maand tot ${PLANS.growth.carouselSlides} slides; Premium: ${PLANS.autopilot.limits.carousel} per maand tot ${PLANS.autopilot.carouselSlides} slides. Eigen foto's als slide kosten geen credits.` },
  { q: "Wat zijn inspiratiebeelden?", a: `Voorbeelden van afbeeldingen die je mooi vindt. Mavix gebruikt de stijl, het licht en de sfeer als inspiratie voor een nieuwe AI-afbeelding, zonder ze te kopiëren. Starter: ${PLANS.starter.inspirationMax}, Growth: ${PLANS.growth.inspirationMax}, Premium: ${PLANS.autopilot.inspirationMax} per opdracht.` },
  { q: "Kan ik zelf bepalen waarvoor ik mijn credits gebruik?", a: "Ja, binnen de maandmaxima per functie. Je kunt bijvoorbeeld meer reviews beantwoorden en minder e-mails maken, zolang je onder het maximum van elke functie blijft." },
  { q: "Wat gebeurt er als mijn AI-credits op zijn?", a: "Dan stopt Mavix met nieuwe AI-acties tot je tegoed vernieuwt. Je ziet hoeveel credits er over zijn en wanneer je tegoed vernieuwt. Al je content en gegevens blijven gewoon beschikbaar, en Mavix rekent nooit automatisch extra credits af." },
  { q: "Worden ongebruikte credits meegenomen naar de volgende maand?", a: "Nee. Je tegoed vernieuwt elke maand op je factuurdatum, ook bij een jaarabonnement; ongebruikte credits vervallen." },
  { q: "Wat is het verschil tussen Starter en Growth?", a: upgradeBenefits("starter", "growth").items.join("; ") + "." },
  { q: "Wat is het verschil tussen Growth en Premium?", a: upgradeBenefits("growth", "autopilot").items.join("; ") + "." },
  { q: "Wat kan de Mavix Agent doen?", a: "De Agent beantwoordt vragen over je marketing, zoekt je gegevens in Mavix op (zoals planning, campagnes, SEO en resultaten) en kan een campagne als concepten klaarzetten. Opslaan gebeurt pas na jouw bevestiging; de Agent publiceert of verstuurt nooit zelf. De Agent hoort bij Premium." },
  { q: "Kan ik mijn eigen foto's gebruiken in Mavix?", a: "Ja. Upload je eigen foto's of kies ze uit je Bibliotheek, gebruik ze in posts en als carrouselslide, of laat ze met AI bewerken." },
  { q: "Kan Mavix zelf afbeeldingen genereren?", a: "Ja. Mavix maakt met AI een nieuwe afbeelding op basis van je opdracht, vierkant of in Instagram-formaat, eventueel in de stijl van je inspiratiebeelden. Je hebt geen eigen foto nodig." },
  { q: "Kan ik Instagram-posts direct publiceren?", a: "Publiceren naar Instagram is gebouwd, maar wacht op goedkeuring van Meta. Tot die tijd plan je posts in Mavix en plaats je ze zelf; carrousels download je met alle slides in de juiste volgorde." },
  { q: "Kan ik mijn Google Bedrijfsprofiel koppelen?", a: "De koppeling is gebouwd en wacht op API-toegang van Google. Daarna lees en beantwoord je je Google-reviews vanuit Mavix." },
  { q: "Wat doet SEO Intelligence?", a: "Het scant je website op technische en inhoudelijke verbeterpunten, geeft scores en concrete actiepunten, en (vanaf Growth) AI-voorstellen voor betere titels en omschrijvingen." },
  { q: "Kan ik meerdere medewerkers toevoegen?", a: `Ja, vanaf Growth. Growth heeft ${PLANS.growth.users} gebruikers en Premium ${PLANS.autopilot.users}, elk met een eigen rol (eigenaar, beheerder of lid).` },
  { q: "Wat houdt het persoonlijke marketingadvies van Premium in?", a: "Elke maand een gesprek van 20 minuten met een adviseur van Mavix, geen AI. Je bespreekt bijvoorbeeld je contentstrategie, Instagram, hoe je meer klanten trekt, SEO, reviews, je resultaten en hoe je Mavix het beste gebruikt. Niet gebruikte gesprekken schuiven niet door." },
  { q: "Kan ik mijn abonnement later upgraden?", a: "Ja. Bij een upgrade krijg je direct het tegoed en de functies van het nieuwe pakket; wat je deze periode al gebruikte, blijft meetellen. Je houdt dus je resterende ruimte." },
  { q: "Kan ik mijn abonnement opzeggen?", a: "Ja, maandelijks. Je houdt toegang tot het einde van de betaalde periode. Daarna blijven je gegevens bewaard, maar staan AI-functies uit." },
  { q: "Zijn de prijzen inclusief btw?", a: "Nee, alle prijzen zijn exclusief btw. Het btw-bedrag staat op je factuur." },
  { q: "Is mijn bedrijfsinformatie veilig?", a: "Je gegevens staan in een afgeschermde werkruimte die alleen jouw team kan openen. Toegangssleutels van koppelingen worden versleuteld bewaard en Mavix bewaart van AI-verzoeken alleen aantallen, niet je teksten. Ons privacybeleid wordt binnenkort gepubliceerd." },
  { q: "Kan ik Mavix eerst via een demo bekijken?", a: "Ja. Vraag een demo aan; we laten je zien hoe Mavix werkt voor jouw bedrijf. Mavix is nu in besloten beta: na een persoonlijke beoordeling zetten we je werkruimte klaar." },
];
