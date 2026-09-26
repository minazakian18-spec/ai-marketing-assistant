# Mavix SaaS: installatie en huidige status

## Audit en implementatiekeuze
De aangetroffen toepassing is Next.js 16 / React 19 met App Router en lokale mockdata. Er was geen database, authprovider of betaalprovider ingericht. De bestaande marketing-, auth- en app-routegroepen en gebruikersinterface zijn behouden. Supabase is toegevoegd voor Auth/Postgres/RLS; Stripe voor abonnementen. Hostinger blijft de beoogde Node.js-host.

Plan: (1) serverauth en workspace-isolatie, (2) echte opslag/accountschermen, (3) providerkoppelingen en billing, (4) securitytests en migratievalidatie, (5) configuratie op staging en pas daarna productie. Deze branch is een implementatie in uitvoering, geen vrijgave van een volledig operationele SaaS.

## Wat al in code staat
- Email/wachtwoordregistratie, Google-login via Supabase, bevestiging/reset/logout; beschermde routes en server-side lidmaatschap/rollen.
- Automatisch profiel, werkruimte en OWNER-lidmaatschap; werkruimtewisseling met opnieuw gecontroleerd lidmaatschap.
- Business-data in een workspace-gebonden JSON-document met versienummer tegen verloren updates. Persoonlijk profiel apart. Geen automatische import van oude browserdata.
- Server-only Google OAuth met eenmalige state, PKCE, versleutelde tokens, locatiekeuze voor GBP, Gmail send-only adapter. Statussen worden niet uit frontend-toggles afgeleid.
- Stripe Checkout (kaart), klantportaal, echte factuurmetadata en signature-gecontroleerde webhooks.
- Meldingsvoorkeuren en in-app records, Resend/Twilio adapters, teamuitnodigingen, export en owner-only werkruimtedeactivatie.
- Rate limiting in Postgres. Geen productie-AI-provider: mockgeneratie is in productie geblokkeerd.

## Nog niet gereed / niet gevalideerd
- Supabase-project bestaat en de publieke sleutel is lokaal ingesteld. Email-auth en bevestiging staan aan; Google staat uit. De workspaces-tabel ontbreekt bij de live controle. Migraties/RLS zijn nog NIET gevalideerd. Service-role key ontbreekt; geen owneraccount aangemaakt.
- Instagram OAuth is nog bewust geblokkeerd; adapter/Meta-validatie en app review ontbreken.
- GBP/Gmail OAuth is nog niet live getest; Google Business Profile API-toegang en eventuele scopeverificatie vereisen externe goedkeuring.
- Reviewsync/opslag en publicatie vanuit Review AI, Gmail-verzending vanuit goedgekeurde campagnes en Instagram-publicatie zijn nog niet volledig aangesloten. Lokale legacyworkflows moeten verder worden vervangen. Planning is nog geen achtergrondpublicatiescheduler.
- Notificatierouter, betrouwbare delivery queue/retries, SMS-verificatie en recipient-beheer zijn nog niet volledig aangesloten. Alleen voorkeuren opslaan verstuurt geen bericht.
- Username-login alias ontbreekt. Login werkt met email. Actieve-apparatenlijst is niet geïmplementeerd en wordt niet verzonnen.
- Teamrollen aanpassen/verwijderen en eigendom overdragen ontbreken. MEMBER heeft nu alleen leesrechten op bedrijfsdata.
- Persoonlijk-accountverwijdering, selectieve verwijdering en automatische grace-period-purge ontbreken. Werkruimte deactiveren zet deleted_at; handmatig herstel door beheerder. Abonnement eerst apart opzeggen.
- iDEAL→SEPA recurring en PayPal recurring zijn niet ingeschakeld. Kaartbetalingen zijn de enige huidige Checkout-methode.
- Geen hostingdeployment uitgevoerd. Een GitHub-push is geen bewijs van succesvolle Hostinger-deployment.

## Supabase instellen (vereist voor echte login)
1. Maak op https://supabase.com/dashboard een project aan; bewaar het databasewachtwoord in je wachtwoordmanager.
2. Open SQL Editor. Voer bestanden in supabase/migrations in bestandsnaamvolgorde uit op een NIEUW testproject. Maak vooraf een backup bij een bestaande database. Niet opnieuw blind uitvoeren: de eerste migratie is niet idempotent.
3. Kopieer .env.example naar .env.local. Vul NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en SUPABASE_SERVICE_ROLE_KEY uit projectinstellingen in. Dit project gebruikt deze uitsluitend server-side. Zet nooit service_role in NEXT_PUBLIC-variabelen.
4. Auth → URL Configuration: Site URL productie https://mavix.webbo-solutions.nl. Voeg redirect URLs toe: http://localhost:3000/auth/callback, http://localhost:3000/auth/callback?next=/reset-password en dezelfde twee paden op productie.
5. Zet email-confirmation aan, stel een echte SMTP-provider voor authmails in, controleer provider rate limits en abuse/CAPTCHA-instellingen. Supabase beheert wachtwoordhashes en sessies.
6. Optioneel Auth → Providers → Google: client ID/secret instellen; Google Cloud gebruikt hiervoor de callback die SUPABASE toont (https://PROJECT.supabase.co/auth/v1/callback). Dit is een andere callback dan GBP/Gmail. Alleen openid/email/profile.
7. Genereer OAUTH_ENCRYPTION_KEY lokaal met `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Bewaar veilig en backup: wisselen zonder migratie maakt bestaande tokens onleesbaar.
8. Start `npm install` en `npm run dev`. Open /register, bevestig email, log in. Zonder configuratie geeft login een configuratiefout en blijven app-routes afgeschermd.

## Owner veilig aanmaken en resetten
Gebruik GEEN standaardwachtwoord. Zet tijdelijk OWNER_EMAIL, OWNER_PASSWORD (minimaal 16 willekeurige tekens), OWNER_NAME, OWNER_BUSINESS_NAME in de genegeerde .env.local, naast Supabase serverkeys. Voer uit:

    node --env-file=.env.local scripts/bootstrap-owner.mjs

Het script maakt via Supabase Admin een bevestigd authaccount; de databasetrigger maakt diens OWNER-werkruimte. Het script overschrijft nooit bestaande accounts. Log in en roteer direct via /forgot-password → resetmail → /reset-password. Verwijder daarna OWNER_PASSWORD uit bestand/proces. Gebruik voor productie dezelfde procedure vanaf een vertrouwde beheermachine met productieprojectkeys, of het Supabase Auth-adminpaneel. Wachtwoord kwijt: gebruik de resetflow/het provideradminpaneel. OWNER is een werkruimterol, geen geheime bypass van tenantisolatie. Er zijn geen tijdelijke inloggegevens aangemaakt zolang de provider ontbreekt.

## Hostinger
Gebruik een hostingproduct dat een blijvende Next.js Node-server en serverroutes ondersteunt, geen statische HTML-export. Node-versie moet overeenkomen met package.json. Build `npm ci && npm run build`; start `npm start` met de door Hostinger toegewezen poort. Voeg alle benodigde .env.example-variabelen als geheime hostingvariabelen toe. APP_URL=https://mavix.webbo-solutions.nl (geen trailing slash). HTTPS en dezelfde callbackdomeinen zijn verplicht. Herstart na envwijzigingen. Laat /api/billing/webhook bereikbaar en configureer geen CDN-cache voor gepersonaliseerde responses. Gebruik staging en een aparte Supabase/Stripe-testomgeving vóór productie.

## Testen vóór vrijgave
1. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
2. Onbekende bezoeker: /dashboard, /account, /brand-hub → login; / en /pricing blijven publiek. Verlopen sessie/logout geeft geen toegang meer.
3. Registreer A en B met verschillende emails: elk eigen lege werkruimte. Sla bedrijfsgegevens op bij A; B ziet ze niet. Test rechtstreeks via Supabase REST met B's usertoken dat A's workspaces/business_profiles ontoegankelijk zijn; service_role nooit voor deze test gebruiken.
4. Laat A een MEMBER uitnodigen; verkeerde email/verlopen of hergebruikte link afwijzen. Juiste account accepteert en wisselt via /account/team. MEMBER kan opslaan/billing/integraties/uitnodigen/verwijderen niet uitvoeren; ADMIN kan geen owneracties uitvoeren.
5. Open twee tabs, wijzig dezelfde bedrijfsdata: de tweede verouderde save moet 409 geven. Refresh moet serverdata behouden.
6. Test OAuth volgens de losse providerhandleidingen. Vervalste state/andere browser/hergebruikte callback moeten falen. Geen tokens in API-responses, browserstorage of logs.
7. Stripe-testomgeving: checkout, webhook, status, facturen, upgrade/downgrade/cancel via portal; vervalste webhook en ?payment=success veranderen geen status.
8. Meldingsvoorkeuren opslaan en refresh. Zonder email/SMS-config blijft setup required zichtbaar. In-app records van andere gebruiker/werkruimte zijn niet leesbaar of markeerbaar.
9. Export bevat geen providercredentials. Werkruimte deactiveren alleen als OWNER met exacte bevestiging; anderen verliezen toegang. Test herstel via provideradmin voordat je dit in productie aanbiedt.

Unit-tests bewijzen geen live OAuth, RLS of providergoedkeuring. Deze handmatige/integratietests zijn nog verplicht.

Zonder service-role key gebruikt alleen lokale developmentauth een beperkte in-memory limiter bovenop Supabase Auth-limits. Productieauth blijft geblokkeerd totdat de gedeelde database-limiter/serverkey is ingesteld. Zet de service-role key zelf in .env.local/Hostinger, nooit in chat of Git.
