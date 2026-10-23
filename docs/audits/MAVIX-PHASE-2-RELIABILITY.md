# Mavix — Fase 2: functionele QA, foutopsporing, database-integriteit en beveiliging

Datum: 23 oktober 2026 · Basis: fase 1 (`122e4d9`). In de werkmap stond nog de niet-gecommitte contactensynchronisatie; die valt buiten deze fase en is niet meegecommit (zie §9).

Ernst: **P0** beveiliging/dataverlies/storing · **P1** kernworkflow kapot · **P2** wezenlijk probleem · **P3** klein.

**Samenvatting**
- Geen P0- of P1-problemen gevonden.
- Vijf echte problemen gevonden en opgelost: drie P2 en twee P3.
- Eén vermoedelijke bevinding bleek vals-positief en is niet aangepast.
- Er zijn 17 nieuwe of uitgebreide regressietests.
- Wat niet getest kon worden staat in §7. Dit rapport zegt niet dat alle fouten weg zijn.

## 1. Hoe er getest is

| Soort | Wat | Echt of gesimuleerd |
|---|---|---|
| Unit- en routetests (`node --test`) | Echte route-handlers en servicecode; alleen Supabase (in-memory `memoryDb`), cookies, opslag en `fetch` naar providers zijn vervangen | Gesimuleerde providers en database |
| Statische beveiligingstests | Alle 91 `route.ts`-bestanden: authenticatie, origincontrole bij schrijfacties | Echte broncode |
| Browser (ingebouwde browser, lokale testmodus) | Contacten: aanmaken, dubbelklik, herladen, bewerken, herladen, verwijderen met bevestiging, herladen; verlopen testcookie → `/login`; serverlogs | Echte UI, lokale opslag (testmodus) |
| Niet beschikbaar | Playwright/E2E met echte accounts, echte Supabase, echte Google/Meta/Resend/Stripe | Zie §7 |

## 2. Gevonden en opgeloste problemen

### P2-1 Werkruimtegegevens konden buiten de servercontroles om worden geschreven

**Reproductie.** Tabel `business_profiles` had RLS-policy `business_write`: OWNER/ADMIN mogen de rij bijwerken (`202609250001_saas.sql:29`). `PUT /api/workspace` schreef óók met de sessie van de gebruiker (`workspace()` → `authClient`). Een ingelogde eigenaar kon dus met de publieke Supabase-sleutel en de eigen sessie direct `update business_profiles` aanroepen, buiten de route om. Daarmee werden alle controles van de route overgeslagen:
- geen door de client gezette status "gepubliceerd";
- Instagram- en e-mailbevestigingen alleen van Mavix;
- bescherming van afgemelde adressen;
- de contactlimiet van het abonnement;
- de geldigheid van afbeeldingen en carrousels.

De policy controleert bovendien `access_status` niet, dus ook een **gepauzeerde** werkruimte kon zo schrijven.

**Omvang.** Alleen de eigen werkruimte, geen andere tenant. Campagnes gaan alleen naar `newsletter_subscribers` met status `subscribed`, dus afgemelde mensen krijgen via dit pad géén mail. Wel kon de integriteit van de gegevens zo worden aangetast.

**Oorzaak.** De schrijfactie leunde op een RLS-policy die bedoeld lijkt voor de browser.

**Oplossing.**
- `src/app/api/workspace/route.ts` schrijft nu met de serviceclient, ná alle controles. Lezen gaat nog steeds via de sessie en RLS.
- Migratie `supabase/migrations/202610230002_business_profiles_server_writes.sql` verwijdert `business_write` en trekt insert, update en delete in voor `anon` en `authenticated`. De migratie bevat een rollback.

**Volgorde (belangrijk).** Eerst de code deployen, dán de SQL draaien. Wordt de SQL eerder gedraaid, dan faalt opslaan met een RLS-fout.

**Test.** `tests/security-boundaries.test.mjs` controleert dat de route met de serverclient schrijft, dat de migratie alleen de schrijfpolicy verwijdert (lezen blijft) en dat er een rollback in staat.

### P2-2 Een onderbroken e-mailverzending blokkeerde de campagne voor altijd

**Reproductie.** Stopt de server tijdens `sendCampaign` (herstart of time-out), dan blijft `email_campaign_runs.status = 'sending'` staan. Elke volgende poging gaf "Deze campagne wordt al verstuurd", zonder herstelmogelijkheid en zonder eerlijke status. De run werkte `updated_at` alleen aan het einde bij.

**Oplossing** (`src/lib/server/email-campaigns.ts`):
- Na elke batch wordt `updated_at` bijgewerkt (hartslag).
- Een `sending`-run zonder hartslag langer dan 15 minuten wordt afgesloten. De status (`partial`, `failed` of `sent`) volgt uit de door de provider bevestigde bezorgingen, met de foutmelding "Verzending onderbroken: N e-mail(s) niet verstuurd".
- Er wordt **niets opnieuw verstuurd**, dus niemand krijgt de campagne twee keer.
- Een run die nog loopt blijft ongemoeid.

**Test.** `tests/publishing.test.mjs`, test "a send interrupted half-way…". Die faalde eerst met "Deze campagne wordt al verstuurd" en slaagt nu.

### P2-3 Een onderbroken Instagram-publicatie blokkeerde de post voor altijd

**Reproductie.** Hetzelfde patroon: `instagram_publications.status = 'publishing'` bleef staan, met "Deze post wordt al gepubliceerd" als gevolg.

**Oplossing** (`src/lib/server/instagram-publish.ts`). Na 15 minuten zonder resultaat wordt de claim vrijgegeven, met de melding "Het publiceren is onderbroken. Controleer op Instagram of de post er al staat voordat je opnieuw publiceert". Die melding verschijnt ook als `failureReason` bij de post. Mavix publiceert **niet** zelf opnieuw: het kan niet weten of Meta de post al heeft geplaatst. De gebruiker beslist.

**Test.** `tests/publishing.test.mjs`, test "an interrupted publication…". Daarin wordt ook gecontroleerd dat er bij de eerste klik niets naar Meta gaat en dat een lopende publicatie ongemoeid blijft.

### P3-1 SSRF-filter herkende niet elke IPv6-notatie

**Reproductie.** `isPublicAddress("0:0:0:0:0:0:0:1")` gaf `true`, terwijl dit `::1` (loopback) is. Hetzelfde gold voor `::ffff:7f00:1` (IPv4-gemapt, hexvorm), `64:ff9b::…` (NAT64) en `2002:…` (6to4) met een privé IPv4-adres erin.

**Omvang.** Laag. De DNS-lookup normaliseert adressen meestal naar de korte vorm, en een letterlijk IPv6-adres in de URL werd al geweigerd. Het is wel de kernbeveiliging van de SEO-crawler en Brand-import.

**Oplossing** (`src/lib/server/safe-fetch.ts`). Elk IPv6-adres wordt genormaliseerd naar 8 groepen, en ingebedde IPv4-adressen (gemapt, compatibel, NAT64, 6to4) worden als IPv4 beoordeeld. Teredo, ULA, link-local, site-local en multicast worden geweigerd.

**Test.** `tests/security-boundaries.test.mjs` met 19 notaties. Die faalde eerst en slaagt nu.

### P3-2 Misleidende herstelknop bij een geweigerde opslag

**Reproductie.** Elke 409 van `PUT /api/workspace` toonde de knop "Nieuwste versie laden", ook bij regelweigeringen zoals "contact heeft zich afgemeld" of "publiceren vereist een echte provideractie". Klikken herlaadt en gooit de niet-opgeslagen wijziging weg, terwijl er geen versieconflict was. Zonder netwerk zag de gebruiker bovendien de Engelse browsermelding "Failed to fetch".

**Oplossing.**
- Alleen het echte versieconflict krijgt `code: "version_conflict"`, en alleen dan toont `workspace-provider.tsx` de herlaadknop.
- Een netwerkfout geeft nu: "Geen verbinding met Mavix. Je wijziging is niet opgeslagen; probeer het opnieuw."

**Test.** `tests/newsletter.test.mjs`, test "save errors: only a real version conflict…".

### Vals-positief (niet gewijzigd)

- **Contactformulier zonder labels.** De browsertool toonde de velden als naamloze "textbox". Een controle in de browser (`input.labels`) liet zien dat alle velden correct een label hebben (impliciet, via een omsluitend `<label>`). Dit is geen fout.
- **Vier "dode knoppen" uit de scan.** Het ging om een standaard-submit in een formulier, of om een `onClick` die verderop in de tag stond. Geen fout.

## 3. Featurematrix (geteste functies)

| Functie | Handler / endpoint | Verwacht resultaat | Bewijs |
|---|---|---|---|
| Contact aanmaken | `ContactFormDialog` → `save()` → `PUT /api/workspace` | 1 record, ook na herladen | Browser: 4 → 5, na herladen 5 |
| Dubbel klikken op opslaan | `busy`-slot in `save()` | Geen duplicaat | Browser: 2 klikken → 1 rij |
| Contact bewerken | idem | Wijziging blijft na herladen | Browser: bedrijf "QA Bedrijf BV" na herladen aanwezig |
| Contact verwijderen | `ConfirmDialog` → `save()` | Bevestiging; weg na herladen | Browser: dialoog getoond, 5 → 4, na herladen weg |
| Sessie verlopen | `workspace()`/middleware | Naar inloggen | Browser: verlopen testcookie → `/login` |
| Versieconflict | `PUT /api/workspace` | 409 met `version_conflict`, niets overschreven | Test |
| Regelweigering bij opslaan | idem | 409 zonder herlaadadvies | Test |
| E-mail verzenden | `sendCampaign` | Alleen aantoonbare toestemming, één keer | Bestaande test + nieuwe onderbrekingstest |
| Instagram publiceren | `publishPost` | Eén keer, eerlijk bij onderbreking | Bestaande test + nieuwe onderbrekingstest |
| Bestand downloaden | `/api/library/files/[id]/download` | Alleen eigen werkruimte, signed URL van 2 minuten | Nieuwe isolatietest |
| Research-rapport | `/api/research/[id]` | Alleen eigen werkruimte | Nieuwe isolatietest |
| Inbox-gesprek lezen en wijzigen | `/api/inbox/[id]` | Alleen eigen werkruimte; andere site → 403 | Nieuwe isolatietests |
| Contactensynchronisatie | zie contactsync-tests (27) | | Buiten deze fase gecommit, wel in de suite |

## 4. Database

- **RLS**: alle 45 tabellen in de migraties hebben RLS aan (43 in de gecommitte migraties + 2 in de nog niet gecommitte contactsync-migratie). In `202609250001_saas.sql` gebeurt dat via een lus over 14 tabellen. Tabellen met geheimen (`integration_connections`, `oauth_states`, `workspace_invites`, `rate_limits`, `billing_events`) hebben geen policies voor de browser, en de grants zijn ingetrokken.
- **Schrijfpolicy `business_write`**: zie P2-1. Na de migratie schrijft de browser nergens meer direct in werkruimtegegevens, op `read_at` in notificaties en de eigen meldingsvoorkeuren na.
- **Idempotentie**:
  - `instagram_publications_once` en `email_campaign_runs_once` zijn unieke indexen: één lopende of geslaagde publicatie of verzending per post/campagne.
  - `email_deliveries` heeft `unique (run_id, email_hash)`.
  - `billing_events.id` voorkomt dat een Stripe-event dubbel wordt verwerkt.
  - Resend-batches gebruiken een idempotentiesleutel per batch.
- **Werkruimte-isolatie in code**: elke query met een door de gebruiker gekozen ID wordt voorafgegaan door een leesactie die op `workspace_id` filtert (`ownAction`, `conversationRow`, `getReport`, `downloadUrl`). Ik heb 50 query's met `.eq("id")` zonder `workspace_id` nagelopen. Bij allemaal komt het ID uit zo'n eerdere, werkruimtegebonden leesactie of uit een interne cronroute.
- **Opslag**: de bucket `library` is privé. Downloads gaan alleen via een signed URL van 2 minuten, na een controle op de werkruimte (getest).
- **Soft delete**: werkruimte deactiveren zet `deleted_at` (geen harde verwijdering). Eerst moet een betaald abonnement worden opgezegd.
- **Niet geverifieerd**: schema-drift tussen de migraties en de echte productiedatabase. Ik heb geen toegang tot productie en heb niets gereset. Er staan nog niet-uitgevoerde migraties klaar (zie §8).

## 5. Beveiliging

| Onderwerp | Bevinding | Status |
|---|---|---|
| Authenticatie op routes | Alle 91 routes vragen een ingelogd lid of zijn bewust publiek (11, elk met een eigen bescherming) | ✔, vastgelegd in een test |
| Origin/CSRF | Elke schrijvende route controleert `Origin`, behalve ondertekende webhooks, cron en publieke formulieren | ✔, vastgelegd in een test |
| Rollen | `workspace([...roles])`; publiceren, opslaan en deactiveren alleen voor OWNER/ADMIN (bestaande tests) | ✔ |
| Platformbeheer | `platformAdmin()` via de service role, nooit via e-mail of een clientvlag | ✔ |
| Webhooks | Meta HMAC-SHA256; Resend/Svix met tijdcontrole; Stripe `constructEvent` (5 minuten) + dedup; Google Agenda token per kanaal | ✔ |
| OAuth-tokens | AES-256-GCM met werkruimte- en providercontext als AAD; PKCE; state eenmalig en gekoppeld aan gebruiker en werkruimte | ✔ |
| SSRF | Pinning op het gecontroleerde IP, poorten 80/443, redirects opnieuw gecontroleerd; IPv6-notaties | ✔ na P3-1 |
| XSS in e-mail | Inhoud ge-escaped, alleen `https:`-links en -afbeeldingen (bestaande test) | ✔ |
| Logs | Alleen eventnamen en tellers; geen tokens of adressen (meerdere tests controleren dit) | ✔ |
| Service-role-sleutel | Alleen in `server-only`-modules | ✔ |

## 6. Privacy (A geïmplementeerd · B procedure · C ontbreekt · D juridisch)

| Onderwerp | Stand |
|---|---|
| Toestemming nieuwsbrief | **A**: bewijs per aanmelding (tekst, versie, pagina, IP alleen als keyed hash); dubbele bevestiging optioneel |
| Afmelden | **A**: one-click (`List-Unsubscribe-Post`), adres op de suppressielijst als hash; opnieuw "Ingeschreven" zetten wordt geweigerd |
| Gegevensverwijdering | **B**: `POST /api/privacy/deletion` legt het verzoek vast in het auditlog; een beheerder voert het uit (bewust niet automatisch). Wissen van één abonnee gebeurt wel direct (**A**) |
| Gegevensexport | **C (gedeeltelijk)**: `GET /api/privacy` levert profiel en werkruimtegegevens, maar **niet** Inbox-berichten, bibliotheekbestanden, agentgesprekken en nieuwsbriefabonnees met toestemmingsbewijs. Voorstel: uitbreiden in een volgende fase |
| Bewaartermijnen | **D**: geen automatische opschoning van bijvoorbeeld Inbox-berichten of het auditlog gevonden; termijnen moeten juridisch worden bepaald |
| Verwerkers (Supabase, Google, Meta, Resend, Stripe, Hostinger) | **D**: of dit klopt met het privacybeleid en de verwerkersovereenkomsten vraagt een juridische controle; niet beoordeeld |

De juridische pagina's zijn er, maar dat bewijst geen volledige AVG-naleving. Hier wordt geen juridische conclusie getrokken.

## 7. Wat niet getest kon worden

- **Playwright/E2E met echte accounts.** Niet geïnstalleerd: het is een nieuwe dependency plus een browserdownload van ongeveer 150 MB. Volgens de opdracht moet ik dat eerst voorleggen. Ook nodig voor echte E2E: een aparte Supabase-testomgeving (niet productie) en testaccounts. Daardoor zijn niet end-to-end getest: registratie, goedkeuring door een beheerder, uitloggen, agentprojecten, kalenderevents, bestandsuploads, SEO-site-setup, reviews, beheer en Stripe in testmodus. Deze zijn wél gedekt door de bestaande route- en unittests waar die bestaan.
- **Echte providers.** Google, Meta, Resend en Stripe zijn alleen met gesimuleerde antwoorden getest. Er zijn geen echte berichten, posts of betalingen verstuurd.
- **Productiedatabase.** Niet benaderd en niet gereset.
- **Grote datasets en echte netwerkuitval.** Alleen in unittests gesimuleerd (429 met Retry-After, time-outs, 403, verlopen tokens), niet onder belasting.

## 8. Uitrol en rollback

1. Code deployen (deze commit).
2. **Daarna** in de Supabase SQL-editor draaien: `202610230002_business_profiles_server_writes.sql`. De rollback-SQL staat in het bestand zelf.
3. Rollback van de code: de commit terugdraaien. Dat is veilig zolang stap 2 nog niet is gedaan. Is stap 2 wel gedaan, draai dan eerst de rollback-SQL.

Nog openstaand uit eerdere opdrachten: `202610230001_contact_sync.sql` (alleen relevant als de contactsync wordt gecommit) en de eerdere `account_applications`-migratie.

## 9. Gewijzigde bestanden (fase 2)

- `src/app/api/workspace/route.ts`: schrijven met de serverclient en een eigen code voor versieconflicten. Alleen deze hunks zijn gecommit; de contactsync-wijzigingen in dit bestand niet.
- `src/components/workspace-provider.tsx`: herlaadknop alleen bij een versieconflict; Nederlandse melding bij een netwerkfout.
- `src/lib/server/email-campaigns.ts`: hartslag en eerlijk afsluiten van een onderbroken run.
- `src/lib/server/instagram-publish.ts`: onderbroken claim vrijgeven met waarschuwing.
- `src/lib/server/safe-fetch.ts`: IPv6-normalisatie.
- `supabase/migrations/202610230002_business_profiles_server_writes.sql` (nieuw, niet uitgevoerd).
- Tests: `tests/security-boundaries.test.mjs` (nieuw), `tests/workspace-isolation.test.mjs` (nieuw), `tests/publishing.test.mjs` (+2), `tests/newsletter.test.mjs` (+1).

## 10. Kwaliteitspoorten

- `npm run build` ✔ · `npx tsc --noEmit` ✔ · `npm run lint` 0 fouten (14 bestaande waarschuwingen) · `npm test` 447/447 ✔ met de contactsync erbij. Fase 2 alleen is los gecontroleerd vóór de commit (zie het commitbericht).
- Serverlogs van de dev-server tijdens de browsertests: geen fouten.
