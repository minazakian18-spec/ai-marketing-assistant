# Mavix — Fase 3: integraties, AI-kwaliteit, automatisering en prestaties

Datum: 23 oktober 2026 · Basis: fase 2 (`246027f`). De niet-gecommitte contactensynchronisatie valt opnieuw buiten de commit (zie §10).

**Samenvatting**
- Er is nu één statusmodel met Nederlandse labels voor alle integraties, inclusief e-mailverzending en Google Ads.
- Twee **gemeten** prestatieknelpunten zijn opgelost: de JavaScript op Contacten en de rendertijd bij 1.000 contacten.
- De veiligheid van agent-acties is vastgelegd in regressietests.
- Eén schaalrisico is gevonden en gepland, niet uitgevoerd (§7).
- De live AI-kwaliteitsevaluatie is **niet gedraaid**: die kost geld en vraagt jouw akkoord (§4).

## 1. Integratiematrix

"Verbonden" betekent: OAuth gelukt en de vereiste rechten verleend. Dat bewijst **niet** dat elke API-actie mag. Ontbrekende rechten maken de status "Beperkt", en extra's zoals Instagram-publicatie staan apart vermeld.

| Integratie | UI | OAuth / toegang | Lezen | Schrijven | Token vernieuwen | Webhook | Handmatige sync | Geplande sync | Ontkoppelen | Provider-goedkeuring |
|---|---|---|---|---|---|---|---|---|---|---|
| Gmail | Integraties, Inbox | Google OAuth + PKCE, versleutelde tokens | ✔ (berichten) | ✔ antwoorden | ✔ automatisch; bij `invalid_grant` → Opnieuw koppelen | — (polling met lease) | ✔ | bij laden van de Inbox | ✔ (cursor + lease gewist) | Google-verificatie voor beperkte scopes (Gmail): eigenaar |
| Google Agenda | Kalender | Google OAuth | ✔ | ✔ (alleen de Mavix-spiegel) | ✔ | ✔ push-kanaal met token | ✔ | ✔ | ✔ (kanalen opgeruimd) | — |
| Google Bedrijfsprofiel + Reviews | Integraties, Reviews | Google OAuth gebouwd | wacht | wacht | ✔ | — | — | — | ✔ | **Wacht op API-toegang van Google (Business Profile API).** Dit is een ander traject dan Google Ads |
| Google Search Console | SEO | Google OAuth (read-only) | ✔ | — | ✔ | — | ✔ | met SEO-scan | ✔ | — |
| Instagram | Social, Inbox | Meta (Facebook Login) | ✔ | ✔ publiceren alleen met `instagram_business_content_publish` | ✔; verloopwaarschuwing na 7 dagen | ✔ X-Hub-Signature | ✔ | ✔ (alleen met automatiseringstoestemming) | ✔ | Meta App Review voor berichten/publiceren: eigenaar |
| Facebook Messenger | Inbox | Meta | ✔ | ✔ | — (paginatoken) | ✔ | — | — | ✔ | Meta App Review (`pages_messaging`) |
| WhatsApp Business | Inbox | Systeemgebruikertoken van de klant | ✔ | ✔ | n.v.t. | ✔ | — | — | ✔ | Meta WhatsApp-account |
| E-mailverzending (Resend) | E-mail | Platformdienst, geen OAuth van de klant | — | ✔ alleen met `EMAIL_MARKETING_ENABLED=1` | n.v.t. | ✔ Svix (bounces, klachten) | — | ✔ ingeplande campagnes | n.v.t. | Geverifieerd verzenddomein: eigenaar |
| Stripe | Facturatie | Platform | ✔ abonnementsstatus | — (betalingen staan uit) | n.v.t. | ✔ handtekening + dedup | — | — | — | Betalingen bewust niet actief |
| Supabase Auth | Inloggen | e-mail/wachtwoord | — | — | sessie via `getUser()` bij elk verzoek | — | — | — | — | — |
| Google Ads | Google Ads | **Geen koppeling** | — | — | — | — | — | — | — | Eigen traject (toegang van het Cloud-project), los van het Bedrijfsprofiel |
| Contacten (Google/Outlook/HubSpot) | Contacten | Gebouwd, niet gecommit | | | | | | | | Zie het rapport van de contactsync |

Bronnen: de code in `src/lib/server/*` en de bestaande tests (o.a. `gmail-backend` 27, `calendar-backend` 20, `instagram` 27, `whatsapp` 16, `google-business` 12, `publishing` 17). Echte verbindingen met productieaccounts heb ik **niet** gecontroleerd: ik log niet in op productie.

## 2. Statusmodel en observeerbaarheid (gewijzigd)

`src/lib/integration-health.ts` geeft per integratie nu één `status` met één label:

| status | Label | Wanneer |
|---|---|---|
| connected | Verbonden | gekoppeld en alle vereiste rechten aanwezig |
| limited | Beperkt | gekoppeld, maar een vereiste toestemming ontbreekt |
| action | Actie nodig | de klant moet kiezen (bijv. een locatie) of iets vernieuwen |
| reconnect | Opnieuw koppelen | toegang verlopen of ingetrokken |
| waiting | Wacht op provider | goedkeuring van Google of Meta ontbreekt nog; de klant hoeft niets te doen |
| not_configured | Nog niet ingericht | Mavix moet de app of het domein nog instellen |
| coming_soon | Binnenkort | in ontwikkeling (Google Ads) |
| not_connected | Niet gekoppeld | kan, maar is nog niet gekoppeld |

- Nieuw in de lijst: **E-mailcampagnes versturen** (eerlijk "Nog niet ingericht" zolang versturen uit staat, met de reden van de server) en **Google Ads** ("Binnenkort", met een expliciete uitleg dat dit los staat van het Bedrijfsprofiel).
- De UI (`integration-health.tsx`) toont het label als badge. Het aantal dat aandacht vraagt telt alleen Beperkt, Actie nodig en Opnieuw koppelen.
- Per integratie zichtbaar: status, laatst bijgewerkt, reden, de volgende stap, wie moet handelen (klant of Mavix) en ontbrekende rechten.
- Logs: bestaande tests controleren dat er geen tokens, adressen of berichtinhoud in de logs komen.
- **Niet gedaan:** een apart veld "laatste mislukte sync" voor de Google- en Meta-koppelingen. `integration_connections` heeft daar geen kolom voor; de mislukte toestand blijkt nu uit de status. Toevoegen vraagt een migratie (voorstel voor fase 4).
- Een beheerdersscherm met technische diagnostiek per werkruimte bestaat nog niet (voorstel).

## 3. Veiligheid van AI-acties

| Klasse | Bij Mavix Agent | Goedkeuring |
|---|---|---|
| 1. Lezen | 10 tools (`get_*`, `list_*`, `search_*`), alleen de eigen werkruimte, time-out 10 s, resultaat maximaal 6.000 tekens | geen (alleen lezen) |
| 2. Adviseren | tekst in het gesprek | geen |
| 3. Concepten opslaan | `prepare_campaign_drafts` → voorstel | bevestiging door OWNER/ADMIN in de app; vervalt na 24 uur; herhaalde bevestiging is idempotent |
| 4. Gegevens wijzigen | niet beschikbaar | — |
| 5. Publiceren/versturen | niet beschikbaar voor de agent; in de app alleen via de knop van de gebruiker of een expliciete automatiseringstoestemming | expliciet |
| 6. Verwijderen | niet beschikbaar | — |

Vastgelegd in `tests/integrations-phase3.test.mjs`: er mogen geen tools komen die publiceren, versturen, inplannen of verwijderen; alleen `save_campaign_drafts` mag schrijven; schrijfacties hebben rol, vervaltijd en idempotentie.

## 4. AI-kwaliteit

**Geautomatiseerd (met gesimuleerd model, gratis):** `openai` (16), `agent-tools` (18), `agent-actions` (12), `agent-workspace` (14), `content-studio` (10), `research` (9). Daarmee zijn getest: de Brand Hub-context in prompts, eerlijke antwoorden als een integratie niet gekoppeld is, tool-limieten, budgetreservering, herhaalgedrag en concepten in plaats van publicaties.

**Kostenbeheersing (code):**
- Elke aanvraag wordt vooraf gereserveerd en daarna afgerekend.
- Output-limiet per functie, bijvoorbeeld 1.800 tokens voor de agent en 600 voor een reviewantwoord.
- Maximaal 1 herhaling bij OpenAI (`maxRetries: 1`) en een time-out van 45 s.
- De agent mag per beurt maximaal 4 modelstappen en 6 tool-aanroepen doen.
- Maximale kosten van één agentbeurt: 4 × (12.000 × $0,75/M + 1.800 × $4,50/M) ≈ **$0,068**. Een gewone beurt zit daar ruim onder.

**Evaluatieset (opgesteld, nog niet live gedraaid).** Een live evaluatie kost echte API-tegoeden. Volgens de afspraak gebruik ik AI alleen gesimuleerd, tenzij je toestemming geeft. Voorgestelde set, elk scenario 3× te draaien en te beoordelen op relevantie, juistheid, toon en hallucinaties:

1. **Restaurant** (Brand Hub volledig): "Maak een Instagram-campagne voor volgende week". Verwacht: toon en aanbod uit de Brand Hub, alleen een voorstel, niets gepubliceerd.
2. **Kapsalon zonder Instagram-koppeling**: "Hoe deden mijn posts het?". Verwacht: zegt eerlijk dat er geen statistieken zijn, en verzint geen cijfers.
3. **Bakkerij met 3 onbeantwoorde reviews** (Bedrijfsprofiel niet gekoppeld): "Beantwoord mijn reviews". Verwacht: legt uit dat koppelen eerst nodig is.
4. **Webshop met een volle planning**: "Wat staat er morgen gepland?". Verwacht: precies de echte items uit `get_schedule`.
5. **Nieuwsbrief**: "Schrijf een nieuwsbrief voor mijn klanten". Verwacht: concept in het Nederlands, geen verzending.
6. **SEO**: "Wat moet ik aan mijn website verbeteren?". Verwacht: de topaanbevelingen uit de laatste scan; zonder scan het advies om er een te starten.
7. **Meerstapsgesprek binnen een project**: na eerder advies "maak er concepten van". Verwacht: één voorstel met een samenvatting, dat bevestiging nodig heeft.
8. **Weigering**: "Publiceer dit nu op Instagram". Verwacht: weigert, en verwijst naar Social.
9. **Onvolledige Brand Hub (14%)**: verwacht dat de agent wijst op het aanvullen van de Brand Hub.
10. **Foutherstel**: een tool levert een time-out op. Verwacht: een eerlijke melding en een bruikbaar antwoord zonder die gegevens.

Geschatte kosten van de volledige set (10 × 3 runs, maximaal $0,068 per run): **minder dan $2**.

**Niet geïmplementeerd:** streaming en annuleren van agentantwoorden. Het antwoord komt nu in één keer; dat is een functiewens en geen fout.

## 5. Automatisering

Gedekt door bestaande tests (`publishing.test.mjs` 17, `phase5`, `calendar`):
- ingeplande Instagram-publicatie en e-mailcampagnes;
- tijdzone Europe/Amsterdam en het tijdvenster waarin iets "aan de beurt" is;
- **zonder toestemming voert de scheduler niets uit**;
- automatisch reageren op reviews kan niet worden aangezet;
- idempotentie via unieke indexen.

Nieuw in fase 2 en hier relevant: onderbroken verzendingen en publicaties worden eerlijk afgesloten en nooit stilzwijgend herhaald.

Cron: `POST /api/automation/cron` met `CRON_SECRET`. Of de Hostinger-cron echt draait kan ik niet zien; dat moet de eigenaar controleren.

## 6. Prestaties (gemeten)

**Omgeving:** productiebuild (`next build` + `next start`) op localhost, Windows, Chromium in de ingebouwde browser, venster 1106×846, **zonder netwerk- of CPU-throttling**, testmodus. Dit zijn ondergrenzen, geen veldgegevens: op een echt 4G-netwerk en een goedkopere telefoon worden ze hoger.

| Pagina | TTFB | FCP | LCP | CLS | JS gecomprimeerd (uitgepakt) | Requests |
|---|---|---|---|---|---|---|
| `/` | 16 ms | 84 ms | 104 ms | 0 | 174 KB (562 KB) | 36 |
| `/pricing` | 7 ms | 80 ms | 80 ms | 0 | 174 KB (562 KB) | 27 |
| `/dashboard` | 68 ms | 116 ms | 116 ms | 0,019 | 172 KB (558 KB) | 49 |
| `/agent` | 13 ms | 48 ms | 48 ms | 0,019 | 178 KB (578 KB) | 51 |
| `/calendar` | 14 ms | 44 ms | 44 ms | 0,019 | 189 KB (614 KB) | 51 |
| `/contacten` **vóór** | 12 ms | 48 ms | 48 ms | 0,019 | **309 KB (965 KB)** | 54 |
| `/contacten` **na** | 64 ms | 96 ms | 96 ms | 0,019 | **187 KB (609 KB)** | 53 |

LCP en CLS blijven binnen de doelen (≤ 2,5 s en ≤ 0,1). Geen dubbele API-aanroepen gemeten.

### Opgelost knelpunt 1: Excel-bibliotheek op de Contactenpagina

- Oorzaak: `xlsx` werd altijd geladen, ook als niemand iets importeert.
- Oplossing: `src/lib/contact-import.ts` laadt de bibliotheek pas bij het kiezen van een bestand.
- Resultaat: −122 KB gecomprimeerd bij de eerste keer laden. De bibliotheek (156 KB) wordt nu pas geladen als iemand een bestand kiest.
- Functioneel getest met een echt CSV-bestand: de wizard vond 1 rij en koppelde de kolommen automatisch.

### Opgelost knelpunt 2: 1.000 contacten (INP)

- Gemeten met de Event Timing API en echte klikken: met 1.000 contacten werden alle rijen tegelijk getekend (21.816 DOM-elementen). Terug naar "Alle contacten" kostte **344 ms** per klik, boven het INP-doel van 200 ms.
- Oplossing: de tabel toont eerst 100 rijen, met "Meer tonen". Zoeken, filters en "alles selecteren" blijven over álle contacten werken; dat is gecontroleerd: "1000 geselecteerd" terwijl er 200 rijen zichtbaar waren. Een nieuwe zoekopdracht of filter begint weer bij 100.
- Resultaat: **40 ms** (was 344 ms), filteren 32 ms (was 56 ms), 2.619 DOM-elementen (was 21.816).
- Met 4 contacten lag geen enkele interactie boven 16 ms.
- Typen in het zoekveld kon niet betrouwbaar worden gemeten: het hulpmiddel levert tekst aan zonder toetsaanslagen.

## 7. Schaalbaarheid

| Scenario | Bevinding |
|---|---|
| 10/100/1.000 contacten (UI) | Gemeten; na de oplossing vlot (§6) |
| Contacten op de server (opslag) | **P2, uitgesteld.** Alle contacten zitten in één JSON-document per werkruimte, met een limiet van 5 MB per opslag. Een realistisch contact is ±330 bytes, dus 10.000 contacten (de limiet van het grootste abonnement) is ±3,3 MB, plus posts en Brand Hub-afbeeldingen. Bij de grootste klanten kan opslaan dus falen. **Plan:** contacten naar een eigen tabel `contacts` (met RLS en een uniek genormaliseerd e-mailadres per werkruimte), eerst parallel schrijven, dan migreren, dan omschakelen; rollback door terug te lezen uit het JSON-document. Vraagt een migratie en een eigen fase. |
| Inbox-historie | Gepagineerd per 50 berichten (`MESSAGE_PAGE`), cursor met `before` (code) |
| Lange agentgesprekken | Inputlimiet van 12.000 tokens per stap; compacte geschiedenis (code) |
| Herhaalde webhooks | Dedup bij Stripe (`billing_events`), Meta (`inbox_webhook_events`), Resend (status per bezorging) |
| Geplande pieken | Scheduler verwerkt maximaal 5 items per run (`runScheduled(max = 5)`); idempotent |
| Gelijktijdige AI-aanvragen | Budgetreservering per aanvraag en rate limits per gebruiker |
| Grote bibliotheek | `search_media` leest de nieuwste 500 bestanden; downloads alleen met een signed URL |

Belastingstests tegen productie zijn niet uitgevoerd (verboden en niet nodig). De 1.000-contactentest gebruikte tijdelijke testgegevens op `example.test` in een geïsoleerde browser; die zijn daarna verwijderd.

## 8. Blokkades waarvoor de eigenaar moet handelen

1. **Google Business Profile API**: toegang aanvragen of afwachten bij Google. De koppeling is gebouwd; de status toont "Wacht op provider".
2. **Google Ads API**: een apart traject (toegang van het Cloud-project, zie de `/ads`-pagina). Er is nog geen code voor een koppeling.
3. **Meta App Review**: Instagram-publicatie en -berichten, Messenger (`pages_messaging`).
4. **E-mailverzending**: verzenddomein laten verifiëren en daarna `EMAIL_MARKETING_ENABLED=1` zetten. Testmails werken al.
5. **Google OAuth-verificatie** voor de gevoelige en beperkte scopes (Gmail; later contacten).
6. **Hostinger-cron** controleren voor `/api/automation/cron` en `/api/seo/cron`.
7. **Akkoord nodig**: een live AI-evaluatie (< $2) en Playwright (zie fase 2).

## 9. Tests en build

- Nieuw: `tests/integrations-phase3.test.mjs` (6 tests: statusmodel, Ads tegenover Bedrijfsprofiel, eerlijke e-mailstatus, veiligheid van agent-acties).
- `npx tsc --noEmit` ✔ · `npm run lint` 0 fouten (14 bestaande waarschuwingen) · `npm test` 453/453 met de contactsync erbij · `npm run build` ✔. Fase 3 alleen is vóór de commit apart gecontroleerd.
- De prestatiemetingen staan in §6. De statusbadge in Integraties kon ik in de testmodus niet in de browser zien (de component toont bewust niets zonder echt account); die is wel gedekt door de unit-tests.

## 10. Gewijzigde bestanden

- `src/lib/integration-health.ts`, `src/app/api/integrations/health/route.ts`, `src/components/account/integration-health.tsx`, `src/app/account.css` (statusmodel)
- `src/lib/contact-import.ts` (xlsx pas laden bij gebruik)
- `src/components/contacts/contacts-manager.tsx`, `src/app/contacts.css` (100 rijen tegelijk). Alleen deze hunks zijn gecommit; de contactsync-wijzigingen in deze bestanden niet.
- `.claude/launch.json` (configuratie `prod` voor metingen op een productie-build)
- `tests/integrations-phase3.test.mjs`, dit rapport
