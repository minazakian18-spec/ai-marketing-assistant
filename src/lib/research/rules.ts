// Turns collected facts into classified findings (good / improve /
// uncertain). Deterministic and testable: every finding states what was
// measured, why it matters and what to do. Missing data becomes an
// "uncertain" finding instead of a guess.
import type { Finding, ResearchInput } from "./types.ts";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const nl = (n: number) => new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 }).format(n);

export function analyze(input: ResearchInput): Finding[] {
  const out: Finding[] = [];
  const r = input.businessKind === "restaurant";
  const add = (f: Finding) => out.push(f);
  const p = input.profile;

  /* ---------- Business profile ---------- */
  const missing = [
    !p.description && "bedrijfsomschrijving",
    !p.audience && "doelgroep",
    !p.website && "website",
    !p.hasAddress && "adres",
    !p.products.length && (r ? "menu/gerechten" : "producten of diensten"),
  ].filter(Boolean) as string[];
  if (missing.length)
    add({
      id: "profile-incomplete",
      area: "profile",
      status: "improve",
      title: "Bedrijfsprofiel in Mavix is niet compleet",
      found: `Nog niet ingevuld: ${missing.join(", ")}.`,
      why: "Mavix gebruikt deze gegevens voor alle teksten en voor dit onderzoek. Zonder deze basis worden adviezen en content algemener.",
      action: "Vul de ontbrekende onderdelen aan in Brand Hub. Dit kost ongeveer tien minuten.",
      priority: missing.length >= 3 ? "high" : "medium",
      impact: missing.length >= 3 ? 4 : 3,
      sources: ["profile"],
    });
  else
    add({
      id: "profile-complete",
      area: "profile",
      status: "good",
      title: "Je bedrijfsprofiel is goed ingevuld",
      found: "Omschrijving, doelgroep, website, adres en aanbod staan in Mavix.",
      why: "Een volledig profiel zorgt voor content en antwoorden die echt bij je bedrijf passen.",
      action: "Houd je aanbod en prijzen actueel, zeker bij een nieuwe kaart of seizoensmenu.",
      impact: 2,
      sources: ["profile"],
    });
  if (r && p.products.length && !p.products.some((x) => typeof x.price === "number"))
    add({
      id: "menu-prices",
      area: "profile",
      status: "improve",
      title: "Gerechten staan zonder prijzen in Mavix",
      found: `${p.products.length} gerechten of producten, geen enkele met prijs.`,
      why: "Gasten vergelijken vooraf vaak op prijs. Met prijzen kan Mavix ook betere acties en posts voorstellen.",
      action: "Voeg bij je belangrijkste gerechten de prijs toe in Brand Hub → Producten.",
      priority: "low",
      impact: 2,
      sources: ["profile"],
    });

  /* ---------- Reviews ---------- */
  const rv = input.reviews;
  if (!rv)
    add({
      id: "reviews-unknown",
      area: "reviews",
      status: "uncertain",
      title: "Reviews konden niet worden onderzocht",
      found: "Google Bedrijfsprofiel is niet gekoppeld, dus Mavix kan je echte reviews niet lezen.",
      why: r ? "Voor restaurants zijn Google-reviews een van de belangrijkste redenen om wel of niet te reserveren." : "Reviews bepalen voor veel klanten of ze voor jou kiezen.",
      action: "Koppel Google Bedrijfsprofiel bij Integraties; het volgende onderzoek neemt je reviews dan mee.",
      priority: "high",
      impact: 4,
      sources: ["reviews"],
    });
  else if (rv.total === 0)
    add({
      id: "reviews-none",
      area: "reviews",
      status: "improve",
      title: "Nog geen Google-reviews",
      found: "Je Google Bedrijfsprofiel heeft nog geen reviews.",
      why: "Zonder reviews kiezen nieuwe gasten sneller voor een zaak met ervaringen van anderen.",
      action: "Vraag tevreden gasten actief om een review, bijvoorbeeld met een QR-code op de rekening of tafel.",
      priority: "high",
      impact: 5,
      sources: ["reviews"],
    });
  else {
    const avg = rv.average ?? 0;
    if (avg >= 4.5)
      add({
        id: "reviews-score-strong",
        area: "reviews",
        status: "good",
        title: "Sterke gemiddelde beoordeling",
        found: `Gemiddeld ${nl(avg)} sterren uit ${rv.total} reviews.`,
        why: "Een score vanaf 4,5 is een sterk argument voor nieuwe gasten.",
        action: "Laat deze score zien op je website en in je social media.",
        impact: 3,
        sources: ["reviews"],
      });
    else if (avg < 4.2)
      add({
        id: "reviews-score-low",
        area: "reviews",
        status: "improve",
        title: "Gemiddelde beoordeling kan omhoog",
        found: `Gemiddeld ${nl(avg)} sterren uit ${rv.total} reviews.`,
        why: "Veel gasten filteren op 4+ sterren. Elke tiende punt erbij maakt je zichtbaarder en aantrekkelijker.",
        action: "Pak de terugkerende klachten hieronder aan en vraag tevreden gasten actief om een review.",
        priority: "high",
        impact: 5,
        sources: ["reviews"],
      });
    const rate = pct(rv.replied, rv.total);
    if (rate < 60)
      add({
        id: "reviews-replies",
        area: "reviews",
        status: "improve",
        title: "Veel reviews zijn niet beantwoord",
        found: `${rv.unanswered} van de ${rv.total} reviews hebben geen reactie (${100 - rate}% onbeantwoord)` + (rv.unansweredNegative ? `, waarvan ${rv.unansweredNegative} negatief.` : "."),
        why: "Toekomstige gasten lezen je reacties mee. Een vriendelijke reactie, zeker op kritiek, laat zien dat je om gasten geeft.",
        action: rv.unansweredNegative
          ? "Beantwoord eerst de negatieve reviews, daarna de rest. Mavix kan in Reviews conceptreacties voorstellen."
          : "Beantwoord de openstaande reviews. Mavix kan in Reviews conceptreacties voorstellen.",
        priority: rv.unansweredNegative ? "high" : "medium",
        impact: rv.unansweredNegative ? 5 : 4,
        sources: ["reviews"],
      });
    else
      add({
        id: "reviews-replies-good",
        area: "reviews",
        status: "good",
        title: "Je reageert op de meeste reviews",
        found: `${rate}% van je reviews heeft een reactie.`,
        why: "Gasten zien dat er iemand meeleest en reageert.",
        action: "Blijf dit volhouden; reageer bij voorkeur binnen een paar dagen.",
        impact: 2,
        sources: ["reviews"],
      });
    if (rv.recent90 < 3)
      add({
        id: "reviews-recent",
        area: "reviews",
        status: "improve",
        title: "Weinig recente reviews",
        found: `${rv.recent90} nieuwe reviews in de afgelopen 90 dagen.`,
        why: "Gasten en Google kijken vooral naar recente ervaringen. Oude reviews tellen minder zwaar.",
        action: "Vraag deze maand actief om reviews, bijvoorbeeld via je nieuwsbrief of een kaartje bij de rekening.",
        priority: "medium",
        impact: 3,
        sources: ["reviews"],
      });
    if (rv.recentAverage !== null && rv.average !== null && rv.recent90 >= 3 && rv.recentAverage < rv.average - 0.3)
      add({
        id: "reviews-trend",
        area: "reviews",
        status: "improve",
        title: "Recente reviews zijn minder positief",
        found: `Laatste 90 dagen gemiddeld ${nl(rv.recentAverage)} sterren, tegen ${nl(rv.average)} over alle reviews.`,
        why: "Een dalende lijn kan wijzen op een recent probleem in service, keuken of drukte.",
        action: "Lees de recente reviews na en bespreek de terugkerende punten met je team.",
        priority: "high",
        impact: 4,
        sources: ["reviews"],
      });
    const complaints = rv.themes.filter((t) => t.negative >= 2).sort((a, b) => b.negative - a.negative).slice(0, 2);
    for (const t of complaints)
      add({
        id: "reviews-complaint-" + t.theme,
        area: "reviews",
        status: "improve",
        title: `Terugkerende klacht: ${t.theme}`,
        found: `${t.negative} kritische reviews noemen ${t.theme}.`,
        why: "Een klacht die vaker terugkomt, is meestal een patroon en geen toeval.",
        action: `Bekijk deze reviews samen met je team en maak één concrete afspraak over ${t.theme}.`,
        priority: t.negative >= 4 ? "high" : "medium",
        impact: t.negative >= 4 ? 4 : 3,
        sources: ["reviews"],
      });
    const praise = rv.themes.filter((t) => t.positive >= 3).sort((a, b) => b.positive - a.positive)[0];
    if (praise)
      add({
        id: "reviews-praise-" + praise.theme,
        area: "reviews",
        status: "good",
        title: `Gasten zijn positief over ${praise.theme}`,
        found: `${praise.positive} positieve reviews noemen ${praise.theme}.`,
        why: "Dit is waar je om bekend staat. Dat is een sterk verhaal voor je marketing.",
        action: `Maak ${praise.theme} een vast thema in je posts en op je website.`,
        impact: 2,
        sources: ["reviews"],
      });
  }

  /* ---------- Google Business Profile ---------- */
  const g = input.google;
  if (g) {
    const gaps = [!g.hasHours && "openingstijden", !g.hasWebsite && "website", !g.hasPhone && "telefoonnummer", !g.hasDescription && "omschrijving"].filter(Boolean) as string[];
    if (gaps.length)
      add({
        id: "google-incomplete",
        area: "google",
        status: "improve",
        title: "Google Bedrijfsprofiel mist belangrijke informatie",
        found: `Niet ingevuld op Google: ${gaps.join(", ")}.`,
        why: r ? "Gasten zoeken op Google vaak direct op openingstijden en telefoonnummer om te reserveren." : "Klanten verwachten deze gegevens direct in Google te vinden.",
        action: "Vul de ontbrekende gegevens aan in je Google Bedrijfsprofiel.",
        priority: gaps.includes("openingstijden") ? "high" : "medium",
        impact: gaps.includes("openingstijden") ? 5 : 3,
        sources: ["google_profile"],
      });
    else
      add({
        id: "google-complete",
        area: "google",
        status: "good",
        title: "Google Bedrijfsprofiel is compleet",
        found: "Openingstijden, website, telefoonnummer en omschrijving staan erop.",
        why: "Een compleet profiel wordt vaker getoond in Google Maps en zoekresultaten.",
        action: "Controleer je openingstijden rond feestdagen.",
        impact: 2,
        sources: ["google_profile"],
      });
  } else
    add({
      id: "google-unknown",
      area: "google",
      status: "uncertain",
      title: "Google-zichtbaarheid niet gecontroleerd",
      found: "Mavix heeft geen toegang tot je Google Bedrijfsprofiel.",
      why: "Je profiel in Google Maps is voor veel gasten het eerste contact met je zaak.",
      action: "Koppel Google Bedrijfsprofiel bij Integraties en kies je locatie.",
      impact: 3,
      sources: ["google_profile"],
    });

  /* ---------- Website ---------- */
  const w = input.website;
  if (!p.website)
    add({
      id: "website-none",
      area: "website",
      status: "uncertain",
      title: "Geen website bekend",
      found: "Er staat geen website-adres in je bedrijfsprofiel.",
      why: "Zonder website kan Mavix niet beoordelen hoe makkelijk gasten je menu of reserveringen vinden.",
      action: "Vul je website in bij Brand Hub, of overweeg een eenvoudige site met menu en contactgegevens.",
      impact: 3,
      sources: ["website"],
    });
  else if (!w)
    add({
      id: "website-unreachable",
      area: "website",
      status: "uncertain",
      title: "Website kon niet worden gecontroleerd",
      found: `Mavix kon ${p.website} niet ophalen.`,
      why: "Als Mavix de site niet kan openen, lukt dat zoekmachines mogelijk ook niet.",
      action: "Controleer of je website online is en het adres in Brand Hub klopt.",
      impact: 3,
      sources: ["website"],
    });
  else {
    if (!w.https)
      add({
        id: "website-https",
        area: "website",
        status: "improve",
        title: "Website is niet beveiligd (geen https)",
        found: `${w.url} wordt zonder beveiligde verbinding geladen.`,
        why: "Browsers tonen dan 'Niet veilig'. Dat schrikt bezoekers af en Google waardeert het lager.",
        action: "Vraag je websitebouwer of hostingpartij om een (gratis) SSL-certificaat te activeren.",
        priority: "high",
        impact: 4,
        sources: ["website"],
      });
    if (r) {
      if (!w.mentionsMenu)
        add({
          id: "website-menu",
          area: "website",
          status: "improve",
          title: "Menu is niet te vinden op je homepage",
          found: "Op je homepage staat geen verwijzing naar een menu of kaart.",
          why: "Het menu is de meest bekeken informatie op restaurantwebsites. Gasten die het niet vinden, haken af.",
          action: "Zet een duidelijke knop 'Bekijk het menu' bovenaan je homepage, bij voorkeur als webpagina in plaats van alleen een pdf.",
          priority: "high",
          impact: 5,
          sources: ["website"],
        });
      else
        add({
          id: "website-menu-good",
          area: "website",
          status: "good",
          title: "Menu is vindbaar op je website",
          found: w.menuLink ? "Je homepage linkt naar je menu." : "Je homepage noemt je menu of kaart.",
          why: "Gasten vinden snel wat ze willen weten.",
          action: w.menuLink ? "Houd prijzen en gerechten actueel." : "Maak er een duidelijke link of knop van.",
          impact: 2,
          sources: ["website"],
        });
      if (!w.mentionsReservation && !w.phoneLink)
        add({
          id: "website-reservations",
          area: "website",
          status: "improve",
          title: "Reserveren is niet zichtbaar op je homepage",
          found: "Mavix vond geen reserveringsmogelijkheid en geen klikbaar telefoonnummer op je homepage.",
          why: "Elke extra stap om te reserveren kost gasten. Zeker op mobiel moet reserveren met één tik kunnen.",
          action: "Zet een opvallende knop 'Reserveren' bovenaan je site, of minimaal een klikbaar telefoonnummer.",
          priority: "high",
          impact: 5,
          sources: ["website"],
        });
      else if (w.reservationLink || w.mentionsReservation)
        add({
          id: "website-reservations-good",
          area: "website",
          status: "good",
          title: "Reserveren is te vinden op je website",
          found: w.reservationLink ? "Je homepage heeft een reserveringslink." : "Je homepage noemt reserveren.",
          why: "Gasten kunnen direct boeken.",
          action: "Controleer of reserveren ook op mobiel met één tik lukt.",
          impact: 2,
          sources: ["website"],
        });
      if (!w.mentionsOpeningHours)
        add({
          id: "website-hours",
          area: "website",
          status: "improve",
          title: "Openingstijden niet gevonden op je homepage",
          found: "Mavix vond geen openingstijden op je homepage.",
          why: "'Zijn ze nu open?' is een van de meest gestelde vragen van gasten.",
          action: "Zet je openingstijden op de homepage of in de footer van elke pagina.",
          priority: "medium",
          impact: 3,
          sources: ["website"],
        });
    }
    if (!w.metaDescription || !w.title)
      add({
        id: "website-seo-basics",
        area: "website",
        status: "improve",
        title: "Zoekresultaat van je website is niet ingericht",
        found: [!w.title && "geen paginatitel", !w.metaDescription && "geen meta-omschrijving"].filter(Boolean).join(" en ") + ".",
        why: "Dit is de tekst die mensen in Google zien. Zonder goede tekst klikken minder mensen door.",
        action: `Laat een titel en korte omschrijving instellen met je naam, type zaak en plaats${p.city ? ` (bijvoorbeeld '${p.name || "Je zaak"} – ${r ? "restaurant" : "bedrijf"} in ${p.city}')` : ""}.`,
        priority: "medium",
        impact: 3,
        sources: ["website"],
      });
    if (!w.mobileViewport)
      add({
        id: "website-mobile",
        area: "website",
        status: "improve",
        title: "Website lijkt niet geschikt voor mobiel",
        found: "De homepage heeft geen mobiele weergave-instelling (viewport).",
        why: "De meeste gasten zoeken op hun telefoon. Een site die daar slecht werkt, kost reserveringen.",
        action: "Laat je website mobielvriendelijk maken of kies een modern template.",
        priority: "high",
        impact: 4,
        sources: ["website"],
      });
    if (r && !w.restaurantSchema)
      add({
        id: "website-schema",
        area: "website",
        status: "improve",
        title: "Google krijgt geen gestructureerde restaurantgegevens",
        found: "Je website bevat geen gestructureerde gegevens (schema.org) voor een restaurant.",
        why: "Hiermee begrijpt Google je openingstijden, keuken en prijsklasse beter.",
        action: "Vraag je websitebouwer om 'Restaurant'-structured data toe te voegen.",
        priority: "low",
        impact: 2,
        sources: ["website"],
      });
    if (w.loadMs > 4000)
      add({
        id: "website-speed",
        area: "website",
        status: "improve",
        title: "Website reageert traag",
        found: `De homepage deed er ${nl(w.loadMs / 1000)} seconden over om te laden (gemeten vanaf de Mavix-server).`,
        why: "Bij een trage site haken mobiele bezoekers snel af.",
        action: "Laat je afbeeldingen verkleinen en de hosting controleren.",
        priority: "medium",
        impact: 3,
        sources: ["website"],
      });
  }

  /* ---------- Content / social ---------- */
  const c = input.content;
  add({
    id: "instagram-stats-unknown",
    area: "social",
    status: "uncertain",
    title: "Instagram-resultaten nog niet meetbaar",
    found: "Mavix kan bereik, likes en volgers van je Instagram nog niet uitlezen.",
    why: "Zonder deze cijfers is niet vast te stellen welke posts het beste werken.",
    action: "Zodra de Instagram-statistiekenkoppeling beschikbaar is, neemt Mavix dit mee in het volgende onderzoek.",
    impact: 1,
    sources: ["instagram_insights"],
  });
  if (c.last30 + c.scheduledAhead < 4)
    add({
      id: "content-frequency",
      area: "social",
      status: "improve",
      title: "Weinig content gepland via Mavix",
      found: `${c.last30} posts in de afgelopen 30 dagen en ${c.scheduledAhead} ingepland vooruit (alleen content uit Mavix).`,
      why: r ? "Regelmatig posten houdt je zaak in beeld. Voor restaurants werken 2–3 posts per week goed." : "Regelmatig posten houdt je bedrijf in beeld bij je volgers.",
      action: r ? "Plan voor de komende vier weken twee posts per week, bijvoorbeeld één gerecht en één kijkje achter de schermen." : "Plan voor de komende vier weken minimaal één post per week.",
      priority: "medium",
      impact: 3,
      sources: ["content"],
    });
  else
    add({
      id: "content-frequency-good",
      area: "social",
      status: "good",
      title: "Je plant regelmatig content",
      found: `${c.last30} posts in de afgelopen 30 dagen en ${c.scheduledAhead} vooruit ingepland via Mavix.`,
      why: "Een vast ritme houdt je zaak zichtbaar.",
      action: "Wissel gerechten, team, sfeer en acties af.",
      impact: 2,
      sources: ["content"],
    });
  if (r && c.last30 + c.scheduledAhead >= 2 && c.withPhotos < Math.ceil((c.last30 + c.scheduledAhead) / 2))
    add({
      id: "content-photos",
      area: "social",
      status: "improve",
      title: "Weinig eigen foto's in je posts",
      found: `${c.withPhotos} van je ${c.last30 + c.scheduledAhead} recente posts hebben een eigen foto.`,
      why: "Bij restaurants zijn echte foto's van gerechten en sfeer de belangrijkste reden om te stoppen met scrollen.",
      action: "Maak deze maand een vaste fotomoment: 10 gerechten en 5 sfeerbeelden, en gebruik die in je posts.",
      priority: "medium",
      impact: 3,
      sources: ["content"],
    });

  /* ---------- Marketing / e-mail ---------- */
  const e = input.email;
  if (e.subscribed >= 20 && e.campaigns90 === 0)
    add({
      id: "email-unused",
      area: "marketing",
      status: "improve",
      title: "Je bereikt je vaste klanten niet via e-mail",
      found: `${e.subscribed} ingeschreven contacten, maar geen nieuwsbrief in de afgelopen 90 dagen.`,
      why: "Vaste gasten komen sneller terug met een persoonlijke uitnodiging dan via social media.",
      action: r ? "Stuur deze maand een korte nieuwsbrief, bijvoorbeeld over een nieuw seizoensgerecht of een rustige-avond-actie." : "Stuur deze maand een korte nieuwsbrief met een duidelijke aanleiding.",
      priority: "medium",
      impact: 4,
      sources: ["email"],
    });
  else if (e.subscribed < 20)
    add({
      id: "email-list-small",
      area: "marketing",
      status: "improve",
      title: "Nog weinig e-mailcontacten",
      found: `${e.subscribed} ingeschreven contacten in Mavix.`,
      why: "Een eigen klantenlijst is het enige kanaal dat je zelf in handen hebt, los van Google en Instagram.",
      action: r ? "Vraag gasten om hun e-mailadres, bijvoorbeeld bij reserveren of met een kleine attentie bij inschrijving." : "Bouw een klantenlijst op, bijvoorbeeld via je website of aankoopmoment.",
      priority: "low",
      impact: 2,
      sources: ["email"],
    });
  else
    add({
      id: "email-active",
      area: "marketing",
      status: "good",
      title: "Je gebruikt e-mail om klanten te bereiken",
      found: `${e.campaigns90} campagne(s) in de afgelopen 90 dagen naar ${e.subscribed} ingeschreven contacten.`,
      why: "E-mail is het kanaal met de meeste herhaalbezoeken.",
      action: "Houd een vast ritme aan, bijvoorbeeld één keer per maand.",
      impact: 2,
      sources: ["email"],
    });

  /* ---------- Customer contact ---------- */
  const ib = input.inbox;
  if (ib && ib.waitingOver24h > 0)
    add({
      id: "inbox-waiting",
      area: "customers",
      status: "improve",
      title: "Klantvragen wachten langer dan een dag",
      found: `${ib.waitingOver24h} gesprek(ken) in je Inbox wachten al meer dan 24 uur op antwoord.`,
      why: "Wie geen snel antwoord krijgt, reserveert vaak ergens anders.",
      action: "Beantwoord openstaande berichten dagelijks; Mavi kan antwoorden voorstellen.",
      priority: "high",
      impact: 4,
      sources: ["inbox"],
    });
  else if (ib && ib.conversations30 > 0)
    add({
      id: "inbox-good",
      area: "customers",
      status: "good",
      title: "Klantvragen worden op tijd beantwoord",
      found: `${ib.conversations30} gesprekken in de afgelopen 30 dagen, geen enkele wacht langer dan 24 uur.`,
      why: "Snelle reacties leveren reserveringen en vertrouwen op.",
      action: "Houd dit vast, ook in drukke weken.",
      impact: 2,
      sources: ["inbox"],
    });

  return out;
}

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 } as const;
export const byImportance = (a: Finding, b: Finding) =>
  (PRIORITY_RANK[b.priority || "low"] - PRIORITY_RANK[a.priority || "low"]) || b.impact - a.impact;
