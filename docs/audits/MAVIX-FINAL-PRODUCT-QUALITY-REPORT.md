# Mavix — Eindrapport productkwaliteit (fase 1–4)

Datum: 23 oktober 2026 · Branch `mavix-2.0` · Productie: https://mavix.webbo-solutions.nl

## A. Samenvatting

Mavix is in vier fasen doorgelicht en verbeterd, zonder herbouw en zonder functies te verwijderen. In totaal zijn **14 echte problemen** gevonden en opgelost (1 P1, 7 P2, 6 P3), elk met een regressietest of een herhaalde meting. Vier vermoedelijke problemen bleken bij controle geen probleem en zijn bewust niet gewijzigd.

**Belangrijkste les van fase 4.** De enige P1 was een regressie die ik in fase 1 zelf had veroorzaakt: de Brand Hub was leeg (een redirect naar zichzelf). Fase 1 stond nog niet in productie, dus klanten hebben dit niet gezien. Hij is gevonden met een controle over alle routes in fase 4 en is nu vastgelegd in een test.

**Oordeel: Mavix is nog niet "klaar om te verkopen" als volledig product.** De software is stabiel en eerlijk over wat werkt, maar er staan commerciële blokkades open die buiten de code liggen (§L):
- Google- en Meta-goedkeuringen;
- verificatie van het verzenddomein;
- echte betaaltests;
- een juridische toets van privacy en bewaartermijnen.

## B. Voor en na

| Onderwerp | Voor | Na | Bewijs |
|---|---|---|---|
| Sidebar-groep "Werkruimte" | twee betekenissen | "Dagelijks werk"; werkruimte = bedrijfsaccount | test `navigation-ia` |
| Kruimelpad en tabbladtitels | "Werkruimte / Mavix", elke tab "Werkruimte" | bedrijf / pagina; eigen titel per pagina | browser, 42 routes |
| "Demo gepubliceerd" bij echte publicaties | misleidend | alleen met bevestiging van de provider "Gepubliceerd" | test |
| Brand Hub vs. Bedrijfsprofiel, Integraties vs. "Data en koppelingen" | dubbele namen | één naam per begrip | test |
| Toetsenbordfocus in de sidebar | onzichtbaar | zichtbaar; 142 elementen gecontroleerd | browser |
| Direct schrijven in werkruimtegegevens buiten de server om | mogelijk (eigen werkruimte) | server schrijft na de controles; migratie klaar | test + SQL |
| Onderbroken e-mailverzending of Instagram-publicatie | voor altijd geblokkeerd | eerlijk afgesloten, nooit stilzwijgend herhaald | 2 tests |
| SSRF bij IPv6-notaties | `0:0:0:0:0:0:0:1` gold als publiek | genormaliseerd | test (19 notaties) |
| Herlaadknop bij geweigerde opslag | wiste de wijziging | alleen bij een echt versieconflict | test |
| Integratiestatus | 5 vage toestanden | 8 eenduidige Nederlandse labels | test |
| JavaScript op Contacten | 309 KB | 187 KB | meting |
| 1.000 contacten, klik "Alle contacten" | 344 ms | 40 ms | meting |
| Kalender op mobiel | schaduwstrook in beeld; 55 onzichtbare focusbare elementen | geen strook; 0 focusbaar in gesloten toestand | browser |
| Selectievakjes Contacten op touch | 13×13 px | 22×22 px | browser |
| Brand Hub-pagina (regressie fase 1) | leeg | werkt; `/bedrijfsprofiel` stuurt door | browser + test |

## C. Navigatie (eindstand)

- Dashboard
- **Dagelijks werk:** Mavix Agent · Content Studio · Inbox · Kalender
- **Marketing:** Social · E-mail · Reviews · Google Ads · SEO Intelligence
- **Groei:** Contacten · Inzichten
- **Merk:** Brand Hub · Bibliotheek
- **Systeem:** Integraties · Instellingen (Account en profiel, Meldingen, Beveiliging en privacy · Werkruimte: Bedrijfsinstellingen, Team, AI-voorkeuren, Abonnement en facturatie, Integraties)

Oude adressen blijven werken: `/instagram-ai`, `/ai-content`, `/email-ai`, `/review-ai`, `/contentkalender`, `/bedrijfsprofiel`, `/legal/*`.

## D. Ontwerpstandaarden (vastgelegd)

- **Tokens.** Centraal in `globals.css` en `typography.css`. De `--ds-*`-tokens verwijzen daar nu naar, waar de waarden gelijk waren. Paars alleen als accent, voor actieve status en primaire acties.
- **Focus.** Overal één focusring (`--focus-ring`). Componentregels mogen hem niet uitzetten.
- **Statuslabels.**
  - Integraties: Verbonden, Beperkt, Actie nodig, Opnieuw koppelen, Wacht op provider, Nog niet ingericht, Binnenkort, Niet gekoppeld.
  - Content: Concept of Wacht op goedkeuring (zie open vraag), Goedgekeurd, Ingepland, Gepubliceerd, Verzonden. "Demo …" alleen zonder bevestiging van de provider.
- **Terminologie.** Mavix Agent = het gesprek; Mavix AI = de schrijfhulp in de modules; Brand Hub = de merkcontext; Bedrijfsprofiel = alleen Google.
- **Beweging.** Alleen functionele en bewust gekozen Mavix-patronen: de gloed van de composer, het ademende logo, de mascotte en de cursor. Alle vier gaan uit bij `prefers-reduced-motion` (in de browser gecontroleerd).
- **Lange lijsten.** Maximaal 100 rijen tegelijk tekenen, met "Meer tonen". Filters en selectie werken altijd over alles.
- **Aanraakdoelen.** Minimaal 22–24 px op touch.

**Niet gedaan.** Ik heb de 56 radii, 128 schaduwen en 520 kleuren niet massaal vervangen. Dat raakt elk scherm en hoort per module te gebeuren, met screenshots vóór en na. Er is geen nieuwe override-laag toegevoegd.

## E. Route-inventaris

Alle **42 routes** gaven in de browser status 200 of een correcte redirect, met een eigen titel (fase 1). In fase 4 zijn **26 hoofdroutes** opnieuw geopend: elk heeft echte inhoud en precies één `h1`. Dit is na de reparatie van de Brand Hub, waar de controle de lege pagina vond.

- **Publiek:** `/`, `/pricing`, `/demo`, `/aanvragen`, `/aanvragen/bedankt`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/privacy`, `/voorwaarden`, `/cookies`, `/gegevens-verwijderen`, `/nieuwsbrief/*`.
- **App:** `/dashboard`, `/agent`, `/studio` (+ `/nieuw`, `/tekst`, `/campagne`), `/inbox`, `/calendar`, `/social`, `/email`, `/reviews`, `/ads`, `/seo` (+ `/rapport/[id]`), `/contacten`, `/inzichten`, `/brand-hub`, `/library`, `/account/*` (8 pagina's), `/beheer`.
- **API:** 91 routes. Elke route vraagt een ingelogd lid of is gedocumenteerd publiek; elke schrijvende route controleert de herkomst (test `security-boundaries`).

## F. Functie-inventaris

Zie het rapport van fase 1, §1 (pagina's en functies) en fase 2, §3 (de featurematrix met handlers en bewijs). In fase 4 is niets verwijderd. Toekomstige functies (Google Ads, inzichten bij Instagram, de contactsync) zijn eerlijk gelabeld en behouden.

## G. Scorecard over 12 categorieën

PASS = met echte browser of echte code aangetoond. PARTIAL = deels aangetoond of alleen met gesimuleerde providers. BLOCKED = afhankelijk van derden. NOT TESTED = niet uitgevoerd.

| # | Categorie | Status | Bevindingen en wijzigingen | Bewijs | Beperking of blokkade |
|---|---|---|---|---|---|
| 1 | Functionaliteit | **PARTIAL** | Brand Hub-regressie (P1) opgelost; Contacten CRUD, import en dubbelklik gecontroleerd | browser (herladen als bewijs), 454 tests | geen echte E2E met accounts (Playwright niet geïnstalleerd) |
| 2 | UI | **PARTIAL** | focusring, schaduwstrook Kalender, selectievakjes, statusbadges | screenshots, metingen | geen volledige consolidatie van tokens; statusbadge alleen met echt account zichtbaar |
| 3 | UX | **PARTIAL** | terminologie, herlaadknop, eerlijke statussen | tests en browser | open vragen: "Concept" vs "Wacht op goedkeuring"; contact opslaan vanuit de Inbox |
| 4 | Navigatie | **PASS** | groepsnaam, kruimelpad, titels, redirects | 42 routes in de browser, terug/vooruit, tests | — |
| 5 | Prestaties | **PARTIAL** | 2 knelpunten opgelost, met meting | productie-build, Event Timing | alleen lokaal zonder throttling; geen Lighthouse of veldgegevens |
| 6 | Fouten en foutafhandeling | **PASS** voor de geteste paden | onderbroken runs, versieconflict, offline-melding | tests | providers gesimuleerd |
| 7 | Integraties en API's | **BLOCKED** | statusmodel, matrix | tests (gesimuleerd) | Google Bedrijfsprofiel, Meta App Review, verzenddomein, Ads |
| 8 | Database en opslag | **PARTIAL** | RLS op 45 tabellen; schrijfpolicy-migratie | code en tests | migratie nog niet gedraaid; geen controle van de productiedatabase |
| 9 | Beveiliging en privacy | **PARTIAL** | SSRF, routevorm, isolatie, policy | tests | export onvolledig; bewaartermijnen juridisch |
| 10 | Responsive | **PASS** | 156 combinaties (26 routes × 360–1920 px) zonder overloop; Kalender gerepareerd | sweep (detector bewezen met een proef), screenshots | 200% zoom alleen benaderd via viewportbreedte |
| 11 | AI en automatisering | **PARTIAL** | veiligheid agent-acties vastgelegd; geen publiceer- of verwijdertools | tests, kostenberekening | live AI-evaluatie niet gedraaid (kost geld, wacht op akkoord) |
| 12 | Stabiliteit en schaalbaarheid | **PARTIAL** | 1.000 contacten vlot in de UI; idempotente runs | meting en tests | de opslag van contacten in één document wordt krap bij 10.000 contacten (P2) |

Geen enkele categorie krijgt PASS op basis van gesimuleerde tests alleen.

## H. Alle problemen

| Ernst | Probleem | Status |
|---|---|---|
| P1 | Brand Hub leeg door een redirect naar zichzelf (regressie fase 1, niet in productie geweest) | ✔ opgelost (fase 4) |
| P2 | Werkruimtegegevens direct schrijfbaar buiten de servercontroles | ✔ code; migratie draaien na deploy |
| P2 | Onderbroken e-mailverzending blokkeert voor altijd | ✔ |
| P2 | Onderbroken Instagram-publicatie blokkeert voor altijd | ✔ |
| P2 | Toetsenbordfocus in de sidebar onzichtbaar | ✔ |
| P2 | Kalender mobiel: 55 focusbare elementen in een onzichtbaar paneel en een schaduwstrook | ✔ |
| P2 | Misleidende labels "Demo gepubliceerd/verzonden" | ✔ |
| P2 | Twee namen voor één begrip (Brand Hub/Bedrijfsprofiel, Integraties) | ✔ |
| P2 | 1.000 contacten: 344 ms per klik | ✔ (40 ms) |
| P2 | Contacten in één document: krap bij 10.000 contacten | open (plan in fase 3, §7) |
| P2 | Privacy-export onvolledig (Inbox, bibliotheek, agent, nieuwsbrief) | open |
| P2 | Inbox: onbekende afzender niet als contact op te slaan | open (vraag aan de eigenaar) |
| P3 | SSRF bij IPv6-notaties | ✔ |
| P3 | Herlaadknop bij regelweigering; Engelse offline-melding | ✔ |
| P3 | 309 KB JavaScript op Contacten | ✔ |
| P3 | Selectievakjes 13 px op touch | ✔ |
| P3 | Tabbladtitels en kruimelpad | ✔ |
| P3 | Dubbele SVG-ID's in merkiconen (`bi-instagram`) | open, geen zichtbaar effect |
| P3 | Duizenden losse CSS-waarden in plaats van tokens | open, per module |

**Vals-positief (niet gewijzigd):**
- labels in het contactformulier (correct impliciet gekoppeld);
- vier "dode knoppen" uit de scan;
- het honeypotveld "fax" (correct verborgen);
- het zoekveld in de Inbox (aanraakvlak van 36 px via het label).

## I. Regressietests

Nieuw of uitgebreid: `navigation-ia` (7), `security-boundaries` (4), `workspace-isolation` (2), `integrations-phase3` (6), `publishing` (+2), `newsletter` (+1), `contact-sync` (27, niet gecommit). Stand nu: **454/454** met de contactsync erbij. Elke commit is apart gecontroleerd zonder de contactsync.

## J. Prestaties

Zie fase 3, §6. Productie-build, localhost, zonder throttling:
- alle gemeten pagina's: LCP ≤ 116 ms, CLS ≤ 0,019, ongeveer 175–190 KB JavaScript;
- Contacten: van 309 naar 187 KB;
- interactie met 1.000 contacten: van 344 naar 40 ms.

Lighthouse is niet gedraaid (niet geïnstalleerd). Op een echt mobiel netwerk liggen de waarden hoger.

## K. Gereedheid van integraties

Zie fase 3, §1. In het kort:
- **Werkt (met eigen OAuth van de klant):** Gmail, Google Agenda, Search Console, Instagram (lezen en berichten, binnen de door Meta verleende rechten), WhatsApp, Messenger.
- **Wacht op een provider:** Google Bedrijfsprofiel en Reviews, Instagram-publicatie (Meta-recht).
- **Platformschakelaar uit:** het versturen van e-mailcampagnes.
- **Binnenkort:** Google Ads.
- **Niet gecommit:** de contactsync.

## L. Echte commerciële blokkades

1. Google Business Profile API-toegang (reviews zijn een kernbelofte).
2. Meta App Review voor Instagram-publicatie, Instagram-berichten en Messenger.
3. Een geverifieerd verzenddomein, en daarna e-mailcampagnes aanzetten.
4. Google OAuth-verificatie voor de Gmail-scopes (en later contacten).
5. **Echte betaaltests:** Stripe staat bewust uit. Een testmodusronde met checkout, webhook en opzeggen is niet uitgevoerd.
6. Juridische toets: privacybeleid tegenover verwerkers, bewaartermijnen en de volledigheid van de gegevensexport.
7. Migratie `202610230002_business_profiles_server_writes.sql` draaien na de deploy.

## M. Niet-blokkerende verbeteringen

- CSS-tokens per module consolideren.
- Statuslabel "Concept" vs "Wacht op goedkeuring" kiezen.
- Contact opslaan vanuit de Inbox.
- Contacten naar een eigen tabel.
- "Laatste mislukte sync" per koppeling.
- Een beheerdersscherm met diagnostiek.
- Streaming en annuleren bij de agent.
- Unieke SVG-ID's in de merkiconen.

## N. Expliciet niet getest

- **Playwright/E2E** (niet geïnstalleerd; nieuwe dependency van ongeveer 150 MB, wacht op akkoord) en **Lighthouse**.
- Registratie, goedkeuring door een beheerder en inloggen met echte accounts; uploads naar echte opslag; Stripe in testmodus.
- Echte Google-, Meta- en Resend-aanroepen; elke actie in productie.
- Een live AI-kwaliteitsevaluatie (de set staat in fase 3; minder dan $2).
- Echte netwerkvertraging en goedkope toestellen; echte schermlezers (wel geautomatiseerde basischecks).
- De productiedatabase en schema-drift.

## O. Uitrol en rollback

**Commits** op `mavix-2.0`, met `main` als productiebranch voor Hostinger: `122e4d9` (fase 1), `246027f` (fase 2), `04654c9` (fase 3) en de fase-4-commit.

**Volgorde:**
1. Pushen naar `mavix-2.0` en `main`.
2. Wachten tot Hostinger klaar is: de `Last-Modified` van een `/_next/static`-chunk ligt na het tijdstip van de push.
3. Daarna in Supabase `202610230002_business_profiles_server_writes.sql` draaien.

**Rollback:**
- Vóór stap 3: de commits terugdraaien en opnieuw pushen.
- Na stap 3: eerst de rollback-SQL uit het migratiebestand draaien, dan de code terugdraaien.

Er zijn geen destructieve migraties. Klantgegevens worden niet gewijzigd.
