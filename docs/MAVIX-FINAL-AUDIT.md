# Mavix — eindaudit en lanceringsgereedheid

Stand: 17 oktober 2026, na fase 1 t/m 6 (branch `mavix-2.0`, gespiegeld naar `main`).

**Conclusie vooraf: Mavix is nog niet klaar voor commerciële verkoop.** De software is
breed gebouwd en getest, maar essentiële externe goedkeuringen (Google, Meta), de
juridische teksten, het verzenddomein voor e-mail, Stripe-inrichting en twee
database-migraties ontbreken nog. Zie de lanceringschecklist onderaan.

## Hoe getest

| Controle | Resultaat |
|---|---|
| Automatische tests (`npm test`, node:test met in-memory database en gemockte providers) | 353 / 353 geslaagd |
| Typecheck (`tsc --noEmit`) | geen fouten |
| Lint | 0 fouten, 14 bestaande waarschuwingen (`<img>`, `location.assign`) |
| Productiebuild | geslaagd |
| Browsercontrole, testmodus, 375 px | 25 app-routes en 12 publieke pagina's: geen renderfouten, geen horizontaal scrollen, geen lege pagina's; elke publieke pagina heeft titel en meta-omschrijving |
| Live (Hostinger) | nieuwe routes antwoorden met 401 zonder sessie (dus gedeployed); testmodus op productie gebruikt |

**Niet getest, met reden:** echte Instagram-publicaties, echte e-mailcampagnes,
Stripe-betalingen, Google-/Meta-koppelingen met een echt account en AI-antwoorden op
productie. Daarvoor zijn echte accounts, goedkeuringen of betaalde acties nodig; die
heb ik bewust niet uitgevoerd. Deze paden zijn gedekt door tests met gemockte
providers. Een volledige knop-voor-knop-test met een echt account op een
testwerkruimte blijft een handmatige stap (zie checklist).

Legenda status: **Werkt** = gebouwd en getest · **Credentials** = gebouwd, wacht op
sleutels/inrichting · **Goedkeuring** = wacht op Google/Meta · **Gesimuleerd** = bewust
nagebootst en zo gelabeld · **Niet gebouwd**.

## Per module

### Publieke website (/, /pricing, /demo, /aanvragen, footer, juridisch)
- **Bestaand:** hero met productbeeld, partnerstrook (één echte partner, geen verzonnen logo's), producten, "Zo werkt Mavix", doelgroepen, prijzen, integraties, eind-CTA; testimonials-sectie rendert niets zolang er geen echte reviews zijn.
- **Fase 6:** sectie "Van aanvraag tot je eerste campagne" (gesloten onboarding), FAQ op de homepage, FAQ-integratielijst gecorrigeerd (was verouderd) en vraag "Hoe start ik met Mavix?".
- **Beperkingen:** juridische pagina's (privacy, voorwaarden, cookies, AVG) zijn **placeholders** en staan op `noindex`. Bestaande FAQ-antwoorden over Auto Create/Full Pilot beschrijven de geplande werking (behouden, conform opdracht).
- **Status:** Werkt · **Lanceringsblokkade:** juridische teksten (jurist nodig).

### Aanvraag, demo en goedkeuring
- **Bestaand:** één open aanvraag per e-mailadres (demo loopt door in aanvraag), honeypot, rate limits, statusgeschiedenis, bevestigings-/goedkeurings-/afwijzingsmails via Resend, beheerscherm.
- **Werkruimtes starten als `pending`**; `workspace()` laat alleen `approved` toe (faalt dicht). Registreren of Google-login geeft geen actieve werkruimte zonder goedkeuring.
- **Niet gebouwd:** automatische demo-inplanning (bewust niet: vraagt beschikbaarheid/tijdzone-controle).
- **Status:** Werkt (mails: Credentials `EMAIL_API_KEY`, `EMAIL_FROM`).

### Inloggen en account
- Login, Google-login, registreren, wachtwoord vergeten/resetten bestaan; Google-login vereist Google OAuth-configuratie in Supabase.
- **Status:** Werkt · handmatige test met echt account nog nodig.

### Facturatie en abonnementen (Stripe)
- **Bestaand:** Stripe-checkout, klantportaal, facturenlijst, ondertekende webhook met idempotentie (`billing_events`).
- **Fase 6:**
  - betalen staat **uit** tot `BILLING_CHECKOUT_ENABLED=1`, en alleen voor goedgekeurde werkruimtes zonder lopend abonnement;
  - geen "alleen kaart" meer: Checkout toont de betaalmethoden uit het Stripe-dashboard (iDEAL via SEPA-incasso voor terugkerende betalingen);
  - beta en betaald abonnement zijn duidelijk gescheiden (`billing-state.ts`);
  - Nederlandse foutmeldingen;
  - mislukte en betaalde facturen worden gelogd;
  - facturatiepagina toont echte status, facturen, het portaal (betaalmethode, opzeggen) en planknoppen alleen als betalen open is;
  - deactiveren van een werkruimte met lopend abonnement wordt geweigerd.
- **Beperkingen:** activering van een werkruimte volgt uit goedkeuring, niet uit betaling (bewust, beta). Up-/downgraden gaat via het Stripe-portaal.
- **Status:** Credentials (zie checklist) · niet getest met echte betalingen.

### Beheer (/beheer, alleen `platform_admins`, server-side)
- **Bestaand:** aanvragen met geschiedenis, goedkeuren/afwijzen, werkruimtes goedkeuren/pauzeren, AI-limiet per werkruimte en tokenverbruik.
- **Fase 6:** per werkruimte de abonnementsstatus en het aantal koppelingen, plus koppelingen die aandacht vragen; lijst met recente auditgebeurtenissen (alleen namen van gebeurtenissen, geen inhoud of geheimen).
- **Status:** Werkt.

### Account, team en privacy
- Persoonlijke gegevens, bedrijf (Brand Hub), team en uitnodigingen (rollen Eigenaar/Beheerder/Lid), AI-gebruik, meldingen, integraties, facturatie, privacy.
- **Rechten:**
  - Lid mag lezen maar niet opslaan;
  - facturatie alleen Eigenaar;
  - publiceren, versturen en automatiseringen alleen Eigenaar/Beheerder.
- **Privacy:** de gegevensexport bevat geen tokens. "Werkruimte deactiveren" is eerlijk benoemd: gegevens blijven bewaard voor handmatig herstel, er is **geen permanente verwijdering**.
- **Juridisch te beoordelen:** bewaartermijnen, verwerkersovereenkomst, definitieve verwijderprocedure.

### Dashboard
- Agent, snelle acties, to-do's (de drie belangrijkste eerst; kapotte koppelingen voor alle 7 providers), planning, reviews, recente activiteit. · Werkt.

### Mavix Agent
- Leesgereedschap:
  - Brand Hub, kalender en content;
  - campagnes en media;
  - reviews, Inbox-tellingen en SEO;
  - Inzichten (gemeten resultaten).
- Schrijven: alleen een voorstel "campagne als concepten opslaan", dat jij bevestigt (idempotent, gelogd).
- Projecten met instructies.
- **Status:** Werkt (OpenAI: Credentials) · migratie `202610170001` nodig voor voorstellen.

### Content Studio en campagnes
- Multichannel-campagnes, versies, herstel, previews; items staan in Social, E-mail en de kalender zonder dubbele opslag. · Werkt.

### Social / Instagram
- **Werkt:** AI-posts, concepten, goedkeuren, inplannen, kalender, previews, controles tijdens het bewerken.
- **Publiceren** (officiële API, eenmalig per post, bevestigd, media-id vastgelegd): **Goedkeuring** (Meta `instagram_content_publish`).
- **Automatisch publiceren op het geplande moment:** gebouwd; vraagt toestemming in de app, `CRON_SECRET` en de migratie.
- **Niet gebouwd:** Reels, Stories en bereikcijfers (`instagram_manage_insights`).
- **Gesimuleerd:** Auto Create-simulatie; oude "gepubliceerde" posts zijn als simulatie gelabeld.

### E-mail
- **Werkt:** AI-campagnes, editor met desktop/mobiel-voorbeeld, doelgroepen, toestemmingscheck, afmelden.
- **Credentials:**
  - testmail;
  - echt versturen via Resend (alleen aantoonbaar ingeschrevenen, eenmalig, afmeldheaders);
  - afleverstatus, bounces, klachten, opens en kliks via de webhook.
- **Gesimuleerd:** Auto Create-planning.

### Reviews (Google Bedrijfsprofiel)
- **Werkt (na koppeling):**
  - echte reviews met paginering en filters;
  - AI-suggesties;
  - reageren, bijwerken en verwijderen;
  - negatieve reviews eerst;
  - trend over de geladen reviews.
- **Goedkeuring:** toegang tot de Business Profile API.
- Auto Reply is ontworpen met vangrails, maar staat bewust **niet aan**.

### Inbox
- **Gmail:** werkt met koppeling (Google-verificatie nodig voor productie).
- **Instagram DM, Messenger, WhatsApp:** gebouwd, wachten op Meta-goedkeuring of inrichting.
- Labels, toewijzen, notities, sjablonen, AI-antwoord en opnieuw proberen zijn aanwezig.

### Kalender
- Dag/week/maand/agenda, slepen, Google Agenda tweerichtings, lokale agenda's.
- Content verplaatsen past het echte record aan; gepubliceerde items zijn niet versleepbaar en simulaties zijn gelabeld.
- Werkt (Google: verificatie).

### Inzichten
- Bedrijfsonderzoek (gemeten versus interpretatie) behouden.
- Gemeten resultaten per bron met vergelijkingsperiode; bronnen zonder gegevens leggen uit waarom.
- "Wat nu?" (drie acties) en doelen.
- **Niet beschikbaar:** Instagram-bereik.

### SEO Intelligence
- Scans met SSRF-bescherming, Search Console en actiepunten. Werkt (Search Console: verificatie; PageSpeed: optionele API-sleutel).

### Brand Hub
- Profiel, stem, doelgroepen, producten, call-to-actions, woorden om te vermijden en AI-voorbeeld.
- **Nieuw:** website-import met bevestiging per veld.
- Werkt.

### Contacten
- Import met kolomkoppeling, ongeldige adressen en duplicaten.
- **Nieuw:** samenvoegen (alleen lege velden), toestemmingsherkomst en slimme segmenten.
- Werkt.

### Bibliotheek
- Raster/lijst, zoeken, sorteren, albums, multiselect, opslaglimiet.
- **Nieuw:** herstel na een mislukte upload en geen dubbele opslag.
- **Niet gebouwd:** favorieten en tags (vraagt een migratie).

### Integraties
- Statusoverzicht per provider (wie moet handelen, volgende stap, ontbrekende rechten).
- Details in `docs/INTEGRATIES.md`.

### Google Ads
- Geen echte koppeling. De pagina toont eerlijk de status, een checklist, de geplande functies en een voorbeeldindeling zonder cijfers. **Niet gebouwd** (API-toegang nodig).

## Beveiliging en prestaties (bevindingen)
- **Multi-tenant:**
  - elke server-route haalt de werkruimte uit de sessie, nooit uit de browser;
  - gevoelige tabellen staan achter RLS (alleen lezen voor leden; schrijven via de server);
  - tests controleren isolatie (agent, publiceren, versturen, inzichten, beheer).
- **CSRF:** `sameOrigin` op alle muterende routes. **XSS:**
  - e-mail-HTML wordt ge-escaped;
  - JSON-LD op de homepage is ge-escaped;
  - geen `dangerouslySetInnerHTML` met gebruikersinvoer gevonden in de gewijzigde modules.
- **SSRF:** website-import en SEO gebruiken `safe-fetch` (publieke adressen, poorten 80/443, maximale grootte, robots.txt).
- **Geheimen:**
  - tokens worden versleuteld opgeslagen (AES-GCM, context per werkruimte);
  - status-endpoints geven nooit variabelenamen of tokens terug (getest).
- **Webhooks:** Stripe (handtekening en idempotentie), Resend (Svix-handtekening met maximaal 5 minuten), Meta (app secret), cron (`CRON_SECRET`, constante tijd).
- **AI-kosten:** reservering vooraf per verzoek, maandlimiet per werkruimte, rate limits, idempotency-keys.
- **Aandachtspunten:**
  - het beheeroverzicht laadt tot 50.000 gebruiksregels per keer; met veel klanten moet dit worden geaggregeerd in SQL;
  - de werkruimte staat als één JSON-document opgeslagen (prima voor kleine bedrijven, maar met veel media of posts wordt het zwaar; zie de foto-limiet van 4 per post);
  - de 14 lint-waarschuwingen zijn cosmetisch.

## Productieconfiguratie

| Onderdeel | Variabelen / inrichting | Status |
|---|---|---|
| Hostinger | auto-deploy vanaf `main`; Node ≥ 22.6 | Werkt (geverifieerd) |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, publieke sleutel, service role; migraties t/m `202610160001` toegepast | **Nog toepassen:** `202610170001`, `202610180001` |
| OpenAI | `OPENAI_API_KEY`, modelinstellingen, budgetlimieten | Credentials |
| Google OAuth (Gmail, Agenda, Search Console, Bedrijfsprofiel) | `GOOGLE_CLIENT_ID/SECRET`, `OAUTH_ENCRYPTION_KEY`, redirect-URI's | Goedkeuring (OAuth-verificatie, Business Profile API) |
| PageSpeed Insights | optionele API-sleutel | Credentials |
| Meta (Instagram, Messenger) | `META_CLIENT_ID/SECRET`, `META_INSTAGRAM_CONFIG_ID`, `META_WEBHOOK_VERIFY_TOKEN` | Goedkeuring (App Review) |
| WhatsApp | handmatige koppeling werkt; Embedded Signup vraagt Tech Provider-status en verificatie | Goedkeuring / niet gebouwd |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_{STARTER,GROWTH,AUTOPILOT}_{MONTH,YEAR}`, iDEAL/SEPA aan in het dashboard, klantportaal (opzeggen, betaalmethode, facturen), webhook naar `/api/billing/webhook` met `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`; daarna pas `BILLING_CHECKOUT_ENABLED=1` | Credentials, bewust uit |
| Transactionele mail | `EMAIL_API_KEY`, `EMAIL_FROM` (Resend) | Credentials |
| Marketingmail | `EMAIL_MARKETING_FROM` (geverifieerd domein), `EMAIL_MARKETING_ENABLED=1`, `RESEND_WEBHOOK_SECRET` | Credentials |
| Cron | Hostinger: `POST /api/seo/cron` en `POST /api/automation/cron` elke 5 minuten met `Authorization: Bearer CRON_SECRET` | Credentials |

## Lanceringschecklist (op prioriteit)

**Blokkerend voor verkoop**
1. Juridisch: privacybeleid, algemene voorwaarden, cookiebeleid, verwerkersovereenkomst en bewaar-/verwijderbeleid laten opstellen door een jurist; daarna `noindex` van de juridische pagina's halen.
2. Supabase: migraties `202610170001_agent_actions_projects.sql` en `202610180001_publishing_sending_automation.sql` toepassen.
3. Google: OAuth-verificatie voor de Gmail-, Agenda- en Search Console-scopes; toegang tot de Business Profile API.
4. Meta: App Review voor berichten (Instagram, Messenger) en `instagram_content_publish`; bedrijfsverificatie.
5. E-mail: verzenddomein verifiëren (SPF, DKIM, DMARC), `EMAIL_MARKETING_FROM`, webhook en secret instellen; testmail naar jezelf; pas daarna `EMAIL_MARKETING_ENABLED=1`.
6. Stripe: producten en prijzen, iDEAL/SEPA, klantportaal, webhook en belastinginstellingen; volledige testmodus-doorloop (checkout → webhook → status → portaal → opzeggen → mislukte betaling); pas daarna `BILLING_CHECKOUT_ENABLED=1`.
7. Handmatige end-to-endtest met een echte testwerkruimte, per module de knoppen uit deze audit, op desktop en mobiel.

**Belangrijk vóór de eerste betalende klanten**
8. Cron-jobs instellen (`CRON_SECRET`) en de eerste runs controleren in de automatiseringsstatus.
9. Monitoring: foutlogs van Hostinger koppelen aan alerts; dagelijkse back-up van Supabase controleren.
10. OpenAI-budget en de standaard AI-limiet per werkruimte vaststellen.
11. Beheeroverzicht schaalbaar maken (aggregatie in SQL) wanneer er meer dan circa 50 werkruimtes zijn.

**Later (producttoezeggingen behouden)**
12. WhatsApp Embedded Signup, Instagram-bereik (insights), Reels en Stories, Google Ads-koppeling, Review Auto Reply (na expliciete opt-in), favorieten en tags in de bibliotheek, automatische demo-inplanning.
