# Mavix — Fase 1: productaudit, informatiearchitectuur, UX en navigatie

Datum: 23 oktober 2026 · Basis: `main` = `mavix-2.0` = `2565f56` (bevestigd met `git fetch`; lokaal, `origin/main` en `origin/mavix-2.0` wijzen naar dezelfde commit).

In de werkmap stond bij de start al een niet-gecommitte, losse wijziging (contactensynchronisatie, vorige opdracht). Die valt buiten deze fase: ze is niet aangepast en niet meegecommit.

Ernst: **P0** beveiliging/dataverlies/storing · **P1** kernworkflow kapot · **P2** wezenlijk gebruiks- of kwaliteitsprobleem · **P3** kleine afwerking.

## 0. Hoe er getest is (eerlijk)

| Methode | Wat |
|---|---|
| Code gelezen | Alle routes in `src/app`, navigatie (`src/lib/navigation.ts`, `account-nav.ts`, `app-shell.tsx`), statuslabels, CSS-tokens, relaties tussen modules (zie §4). |
| Echte browser (in-app, testmodus `mavix-local-demo`) | Alle 42 routes opgevraagd (status + `<title>`), kruimelpad, redirects, terug/vooruit, refresh op geneste route, toetsenbordfocus op 142 elementen (4 pagina's), tablet 768 px, desktop 1440 px, mobiel 375 px (contacten, vorige opdracht). |
| **Niet** getest | Journeys met echte externe koppelingen (Google, Meta, e-mailverzending, Stripe): in testmodus bestaan die niet, en in productie inloggen of accounts aanmaken is niet toegestaan. Inloggen na registratie en goedkeuring via Beheer zijn alleen in code gevolgd. |
| Patroononderzoek | Linear, GitHub, Notion, HubSpot, Stripe, Google Workspace, Hostinger en de NN/g-heuristieken zijn toegepast vanuit bestaande kennis; ze zijn in deze sessie **niet** opnieuw online nagelezen. |

## 1. Pagina- en functie-inventaris

Rechten: *iedereen* = elk werkruimtelid; *beheer* = OWNER/ADMIN (API-routes controleren dit server-side).

### Publieke website

| Pagina | Doel / gebruiker | Staat | Afhankelijk van | Bevinding |
|---|---|---|---|---|
| `/` Home | Product begrijpen (ondernemer) | Werkt, eigen metadata | — | Belooft koppelingen eerlijk ("wacht op toegang"); behouden. |
| `/pricing` | Pakketten vergelijken | Werkt | `pricing-content.ts` | "soon"-markeringen zijn eerlijk; behouden. |
| `/demo` | Demo aanvragen | Werkt | e-mailprovider | — |
| `/aanvragen`, `/aanvragen/bedankt` | Account aanvragen (besloten beta) | Werkt | `account_applications` | Titel miste "· Mavix" → **opgelost** (P3). |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Toegang | Werkt (code + 200) | Supabase Auth | Alle vier heetten "Account \| Mavix" → **opgelost**, nu unieke titels (P3). |
| `/privacy`, `/voorwaarden`, `/cookies`, `/gegevens-verwijderen` | Juridisch | Werkt | — | `/legal/*` redirect permanent; ok. |
| `/nieuwsbrief/*` | Publiek aanmeldformulier | Werkt | newsletter-tabellen | — |

### Product (`src/app/(app)`)

| Route | Doel | Navigatie | Staat / externe afhankelijkheid | Belangrijkste frictie |
|---|---|---|---|---|
| `/dashboard` | Startpunt, to-do's, snelle acties | Bovenaan | Werkt | Activiteit toonde "Demo gepubliceerd" ook bij echte publicaties (**P2, opgelost**). |
| `/agent` | Gesprek met Mavix Agent, projecten | Dagelijks werk | Werkt met AI-model; testmodus geeft eerlijke melding | — |
| `/studio` (+ `/nieuw`, `/tekst`, `/campagne`) | Content maken | Dagelijks werk | Werkt | Geneste routes toonden kruimelpad "Werkruimte / Mavix" (**P2, opgelost**). |
| `/inbox` | Gesprekken uit Gmail, Instagram, Messenger, WhatsApp | Dagelijks werk | Meta/Google-koppelingen | Onbekende afzender: "Geen overeenkomend Mavix-contact", zonder actie om het contact op te slaan (**P2, uitgesteld**, zie §6). |
| `/calendar` | Planning + Google Agenda | Dagelijks werk | Google Calendar | — |
| `/social` | Instagram-posts, wachtrij, publiceren | Marketing | Meta (Instagram) | Statuslabel "Demo gepubliceerd" bij echte publicatie (**P2, opgelost**). |
| `/email` | Campagnes, verzending | Marketing | e-mailprovider, toestemming | "Demo verzonden" bij echte verzending (**P2, opgelost**). |
| `/reviews` | Google-reviews en antwoorden | Marketing | Google Business Profile (wacht op API-toegang van Google) | Verwijst correct naar Integraties. |
| `/ads` | Google Ads (in ontwikkeling) | Marketing | Google Ads API (nog niet) | Eerlijk gelabeld; belofte behouden. |
| `/seo` (+ `/rapport/[id]`) | SEO Intelligence | Marketing | Search Console | Rapportroute toonde geen modulenaam (**opgelost**). |
| `/contacten` | Contactendatabase, toestemming | Groei | newsletter, (contactsync: niet in deze fase) | — |
| `/inzichten` | Interpretatie + volgende acties | Groei | gekoppelde bronnen | Volgende acties linken al naar de juiste module. |
| `/brand-hub` | Merkidentiteit en context | Merk | — | Mavix-kant heette ook "Bedrijfsprofiel" / "merkprofiel" (**P2, opgelost**). |
| `/bedrijfsprofiel` | Oud adres Brand Hub | — | — | Was een **tweede kopie** van de Brand Hub (200) → nu echte redirect 307 (**P3, opgelost**). |
| `/library` | Bibliotheek: media en concepten | Merk | — | Links naar Studio/Social aanwezig. |
| `/account/*` | Instellingen (persoonlijk + werkruimte) | Systeem | Supabase, Stripe (betalingen niet actief) | "Integraties" heette in de instellingennavigatie "Data en koppelingen" (**P2, opgelost**). |
| `/beheer` | Platformbeheer, aanvragen goedkeuren | Alleen platformbeheerders (`platformAdmin()`) | — | — |

Legacy-adressen (blijven werken): `/instagram-ai`, `/ai-content` → `/social`; `/email-ai` → `/email`; `/review-ai` → `/reviews`; `/contentkalender` → `/calendar`; nieuw: `/bedrijfsprofiel` → `/brand-hub`; `/legal/*` → korte juridische URL's.

Lege/laad/fout-staten: de modules gebruiken een gedeeld `panel ig-empty`-patroon met eigen tekst en een eerlijke "vereist een echt account"-melding in testmodus (bv. aanmeldformulieren, Agent). Er zijn geen nep-successen gevonden, op de twee demo-labels na (opgelost).

## 2. Navigatie: huidig vs voorgesteld

| Groep (huidig) | Items | Voorgesteld | Waarom |
|---|---|---|---|
| — | Dashboard | ongewijzigd | |
| **Werkruimte** | Mavix Agent, Content Studio, Inbox, Kalender | **Dagelijks werk** (doorgevoerd) | "Werkruimte" betekent elders het bedrijfsaccount (Team: "Wissel van werkruimte", Facturatie, Beheer, deactiveren). Eén woord, één betekenis. |
| Marketing | Social, E-mail, Reviews, Google Ads, SEO Intelligence | ongewijzigd | Kanalen bij elkaar; Ads is eerlijk "in ontwikkeling". |
| Groei | Contacten, Inzichten | ongewijzigd | |
| Merk | Brand Hub, Bibliotheek | ongewijzigd | |
| Systeem | Integraties, Instellingen | ongewijzigd; Integraties heet nu ook in Instellingen zo | |

Bovenbalk: was overal "Werkruimte / {pagina}", met "Mavix" als pagina op geneste routes. Nu staat er "{bedrijfsnaam} / {pagina}", met de module op elke geneste route (`pageLabel`). Elke module heeft nu een eigen tabbladtitel ("Contacten | Mavix"); eerst heette elke app-pagina "Werkruimte | Mavix".

Bewust **niet** verplaatst (geen herindeling om de sidebar korter te maken):
- **Agent ↔ Content Studio**: verschillende taken (gesprek/opdracht vs. formulier om te maken). Agent-acties linken door naar de module.
- **Studio ↔ Social/E-mail/Kalender**: Studio maakt, de kanaalmodules beheren de wachtrij en publicatie, de Kalender plant. Studio verwijst al naar inplannen (`studio/page.tsx:242`).
- **Reviews ↔ Google Bedrijfsprofiel**: de koppeling staat bij Integraties en Reviews verwijst ernaar (`review/live.tsx`).
- **Brand Hub ↔ Bedrijfsinstellingen**: merkcontext (Brand Hub) vs. administratieve gegevens (Instellingen); de teksten verwijzen nu naar elkaar met dezelfde naam.

## 3. Terminologie (één naam per begrip)

| Begrip | Gekozen | Was ook | Status |
|---|---|---|---|
| Bedrijfsaccount (tenant) | Werkruimte | sidebargroep "Werkruimte" | Sidebargroep hernoemd |
| Merkcontext in Mavix | Brand Hub | "Bedrijfsprofiel (Brand Hub)", "Bedrijfsprofiel in Mavix", "merkprofiel" | Opgelost; "Bedrijfsprofiel" betekent nu alleen Google Bedrijfsprofiel |
| Gekoppelde diensten | Integraties | "Data en koppelingen" | Opgelost |
| Conversatie-AI | Mavix Agent | — | Consistent |
| Schrijfhulp in modules | Mavix AI | — | Bewust apart: knop/label voor tekst laten (her)schrijven binnen een module; gedocumenteerd, niet gewijzigd |
| Status `scheduled` | Ingepland | "Gepland" (dashboard) | Opgelost |
| Status `published`/`sent` | Gepubliceerd / Verzonden **alleen met bevestiging van de provider** | "Demo gepubliceerd", "Demo verzonden" voor alles | Opgelost (`src/lib/status-labels.ts`); oude records zonder bevestiging houden "Demo …" |
| Status `draft` | "Concept" (Studio, kaart-status) en "Wacht op goedkeuring" (kanaaloverzicht, e-mail) | — | **Open vraag**: zelfde status, twee labels. "Wacht op goedkeuring" is handelingsgericht, "Concept" beschrijft het object. Niet eenzijdig gewijzigd. |
| Kalender | Kalender (app) / Contentkalender (marketing, pakketten) | — | Acceptabel: marketingtekst beschrijft de functie; niet gewijzigd |

## 4. Journeys (in code gevolgd, in browser waar mogelijk)

1. **Nieuwe klant**: Home → Demo of Aanvragen → goedkeuring in `/beheer` (`access_status`) → registreren → inloggen → Dashboard met to-do's. Geen doodlopend pad gevonden. Wachtstatus wordt getoond (`AccessPendingError`). *Browser: pagina's 200; inloggen/goedkeuring niet live getest.*
2. **Content**: Brand Hub → Studio → concept → goedkeuren → inplannen (Kalender) → publiceren (alleen echt via Instagram; client kan `published` niet zetten, `api/workspace` weigert dat). Uitkomst: activiteit en kanaaloverzicht tonen nu de bevestigde status.
3. **Klantcommunicatie**: koppelen → Inbox → antwoorden → contact. **Frictie P2**: bij een onbekende afzender is er geen actie "Opslaan als contact"; de gebruiker moet naar Contacten en handmatig overtypen. Uitgesteld (raakt toestemmingslogica; zie §6).
4. **Reviews**: koppeling wacht op API-toegang van Google; de pagina zegt dat eerlijk en verwijst naar Integraties. Niet live te testen.
5. **E-mail**: contacten → toestemming (`consentOf`: alleen *aantoonbaar* via formulier ontvangt campagnes) → campagne → test → verzenden (echt, met `delivery`). Label "Verzonden" nu alleen met bevestiging.
6. **Inzichten**: bronnen → blokken met "niet gekoppeld"-reden → volgende acties met link (`lib/insights.ts nextActions`). Geen nepcijfers gevonden.
7. **Agent**: project → gesprek → voorstel → bevestigen. Testmodus geeft eerlijke melding; geen nep-antwoord.
8. **Accountbeheer**: Team, Integraties, Beveiliging (wachtwoord, werkruimte deactiveren), Facturatie (beta, geen betaling). Integraties had twee namen → opgelost.

Terug/vooruit en refresh: `/studio/nieuw` → `/bedrijfsprofiel` (→ `/brand-hub`) → terug → vooruit getest; juiste pagina en titel.

## 5. Designsysteem (gemeten)

| Meting (alle `src/app/*.css`) | Waarde |
|---|---|
| Verschillende `border-radius`-waarden | 56 (meest: 999px, 50%, 8, 10, 12, 7, 6, 14, 9 px) |
| Verschillende `box-shadow`-waarden | 128 |
| Verschillende hexkleuren | 520 |
| Verschillende `font-size`-waarden | 73 |
| `!important` | 81, verspreid over 16 bestanden (meeste: seo 14, marketing 11, interactions 10, calendar 9) |
| Gebruik van tokens `var(--radius*/--shadow*/--ds-radius*/--ds-shadow*)` | 112 |
| Reduced motion | Elk bestand met animaties heeft een `prefers-reduced-motion`-blok ✔ |

Bevindingen:
- **P2: twee parallelle tokensets.** `--ds-*` (design-system.css) naast `--radius-*`/`--shadow-*` (globals.css) en `--text-*` (typography.css), met vrijwel gelijke waarden. **Opgelost voor de identieke**: `--ds-text`, `--ds-heading`, `--ds-radius-sm`, `--ds-shadow-xs` en `--ds-shadow-sm` verwijzen nu naar de centrale tokens (verschil was onzichtbaar: bv. #15141a vs #121118). Gecontroleerd in de browser: de waarden lossen correct op. `--ds-radius` (10) en `--ds-radius-lg` (14) hebben geen tegenhanger en zijn gebleven.
- **P2: specificiteit doofde de focusring.** `.app-shell .sidebar .side-nav .nav-item { box-shadow: none }` (0,4,0) won van de centrale focusregel, waardoor de toetsenbordfocus in de hele sidebar onzichtbaar was (WCAG 2.4.7). **Opgelost** bij het component zelf (`workspace.css`), niet met een extra globale override. Daarna 142 focusbare elementen op 4 pagina's gecontroleerd: 0 onzichtbaar.
- **P3: literal-waarden in plaats van tokens** (radii, schaduwen, kleuren). Niet massaal vervangen: dat raakt elk scherm en kan alleen per module met screenshots vóór/na. Voorstel voor fase 2: per module de radii terugbrengen naar 8/10/14/999 en de schaduwen naar `--shadow-xs/sm/md`, en daarna overbodige `!important` verwijderen.
- Bewust behouden: de paarse composer-gloed, `channel-themes` per module en de status- en badgekleuren (succes groen, waarschuwing amber, gevaar rood).

## 6. Uitgestelde risico's en voorstellen

| Ernst | Onderwerp | Waarom uitgesteld | Plan |
|---|---|---|---|
| P2 | Inbox: onbekende afzender opslaan als contact | Een nieuw contact moet "Niet bevestigd" krijgen en mag geen toestemming afleiden uit een bericht; overlapt met de nog niet gecommitte contactensynchronisatie (zelfde bestanden). | Na het afronden van de contactsync: actie "Opslaan als contact" in `inbox/context-panel.tsx` met bron "inbox", status "Niet bevestigd". |
| P3 | Tokens/literals (§5) | Brede visuele impact | Per module, met screenshots. |
| P3 | "Concept" vs "Wacht op goedkeuring" | Productkeuze | Zie open vraag. |

Geen P0- of P1-bevindingen.

## 7. Gewijzigde bestanden (fase 1)

- Navigatie en titels: `src/lib/navigation.ts` (groepsnaam, `pageLabel`), `src/components/app-shell.tsx` (kruimelpad), `src/components/account/account-nav.ts` (Integraties), `next.config.ts` (redirect `/bedrijfsprofiel`), `src/app/(app)/bedrijfsprofiel/page.tsx` (redirect i.p.v. kopie), `src/app/(app)/layout.tsx` (standaardtitel), `src/app/(auth)/layout.tsx` (template), `src/app/(app)/account/layout.tsx` (template), nieuwe titel-layouts in elke modulemap en in `login`, `register`, `forgot-password` en `reset-password`.
- Statuslabels: `src/lib/status-labels.ts` (nieuw), `src/components/ui.tsx`, `src/components/instagram/queues.tsx`, `src/components/dashboard-review.tsx`, `src/components/channel/workspace-ui.tsx`, `src/components/instagram/workspace.tsx`, `src/components/email/workspace.tsx`, `src/lib/dashboard-data.ts`, `src/components/dashboard/content-sections.tsx`.
- Terminologie Brand Hub: `src/components/research/research-section.tsx`, `src/lib/server/research.ts`, `src/lib/research/rules.ts`, `src/lib/research/types.ts`, `src/components/account/business-form.tsx`, `src/lib/dashboard-todos.ts`, `src/lib/insights.ts`, `src/components/brand-hub/brand-hub.tsx`.
- Design: `src/app/design-system.css` (token-aliassen), `src/app/workspace.css` (focusring sidebar).
- Tests: `tests/navigation-ia.test.mjs` (nieuw, 6 tests).

## 8. Tests en bewijs

- `npm run build` ✔ · `npx tsc --noEmit` ✔ · `npm test` 438/438 ✔ (6 nieuw) · `npm run lint` 0 fouten (14 bestaande waarschuwingen, ongewijzigd).
- Browser, routes: alle 42 routes opgevraagd. App-pagina's 200 met eigen titel (bv. "Contacten | Mavix", "Team | Mavix", "Inloggen | Mavix"); `/bedrijfsprofiel`, `/instagram-ai`, `/contentkalender` en `/legal/privacy` geven een echte redirect.
- Browser, kruimelpad: "Mavix / Content Studio" op `/studio/nieuw`, "Mavix / Brand Hub" na `/bedrijfsprofiel`, "Mavix / Team" op `/account/team`.
- Browser, focus: vóór de fix had de sidebarlink "Content Studio" `outline: none` en `box-shadow: none`. Daarna waren 0 van de 142 elementen onzichtbaar.
- Tablet 768 px: sidebar toont "Dagelijks werk" en er is geen horizontale overloop (753 px document bij 768 px viewport, inclusief scrollbalk).
- Schermafbeelding vóór (eerdere sessie): kruimelpad "Werkruimte / Contacten". Na: "Mavix / Contacten". In testmodus heeft het voorbeeldprofiel geen bedrijfsnaam, dus valt het terug op "Mavix".

## 9. Open vragen die implementatie blokkeren

1. **Concept vs Wacht op goedkeuring**: welke naam wil je voor een niet-goedgekeurd stuk content? Voorstel: status "Wacht op goedkeuring" overal, en "concept" alleen als zelfstandig naamwoord ("Concept opgeslagen").
2. **Inbox → contact**: mag een afzender uit de Inbox met één klik als contact worden opgeslagen (altijd "Niet bevestigd", bron "Inbox")? Dit hangt samen met het afronden van de contactensynchronisatie.

Fase 2 is niet gestart.
