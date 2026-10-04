# Overdracht Mavix

Datum: 25 september 2026.
Repository: https://github.com/minazakian18-spec/ai-marketing-assistant
Lokale werkmap: C:\Documents\AIMI
Live (indien gekoppeld): https://mavix.webbo-solutions.nl/ — controleer of deze omgeving dezelfde broncode gebruikt als deze werkmap voordat je aannames doet over wat live staat.

## Publieke website vs. applicatie (25 september 2026)
Mavix heeft nu een routingstructuur met drie groepen onder `src/app/`:
- `(marketing)`: publieke marketingsite. `/` (homepage), `/pricing`, `/legal/*`. Gebruikt `src/components/marketing/*` en `src/app/marketing.css`. Geen `WorkspaceProvider`/sidebar.
- `(auth)`: `/login`, `/register`, `/forgot-password`, `/reset-password`. Eigen minimale layout (geen marketing-nav/footer). Formulieren zijn UI-only met echte clientvalidatie; er is bewust GEEN echte authenticatielogica — dat is expliciet werk voor de backend/"Codex"-kant. Submit-knoppen tonen eerlijke "nog niet aangesloten"-status in plaats van te doen alsof inloggen werkt.
- `(app)`: alle bestaande, al werkende functionaliteit (Dashboard nu op `/dashboard` in plaats van `/`, Instagram AI, Email AI, Review AI, Contentkalender, Brand Hub, Contacten, Inzichten, Library, Account). Ongewijzigde URL's, alleen verplaatst in de bestandsstructuur — bestaande interne links blijven werken.

Belangrijk: er is nog geen echte sessie/auth-gate. `(app)`-routes zijn technisch nog steeds direct benaderbaar zonder in te loggen (zoals voorheen); alleen de UI-navigatie stuurt een nieuwe bezoeker nu eerst naar de marketingsite in plaats van rechtstreeks de werkruimte in. Echte routebeveiliging is expliciet backend-werk.

Nog niet opgepakt in deze stap (bewust uitgesteld, niet vergeten): onboarding-wizard, Billing-pagina-uitbreiding (betaalmethodes, facturen, upgrade/downgrade), Integraties-pagina-uitbreiding (beperken tot Google Business Profile/Instagram/Gmail met gedetailleerde OAuth-states), Notificaties-uitbreiding (kanalen/ontvangers/quiet hours), Team & Gebruikers (nieuw), Privacy & Data-uitbreiding, en een brede design-system-consistentiepas. Zie de conversatie voor de volledige oorspronkelijke opdracht.

## Mavix Inbox (4 oktober 2026)
Omnichannel-inbox op `/inbox` (Gmail, Instagram DM, Messenger, WhatsApp Business). Migratie: `supabase/migrations/202610050001_inbox.sql` (moet nog in Supabase worden uitgevoerd).
- Pure logica en parsers: `src/lib/inbox/core.ts` (server) en `shared.ts` (client-veilig); tests in `tests/inbox.test.mjs`.
- Server: `src/lib/server/inbox.ts` (opslag, Gmail-sync via History API = polling, versturen, statussen), `meta.ts` (Instagram/Messenger OAuth, WhatsApp Cloud API), `ai.ts` (Mavi-antwoordvoorstellen via de Claude API; alleen concepten).
- Routes: `/api/inbox/*`, publieke webhook `/api/webhooks/meta` (handtekeningcontrole, verwerking na het 200-antwoord).
- Nieuwe omgevingsvariabelen staan in `.env.example` (alleen namen). Echte accounttests en Meta-/Google-configuratie moeten door de eigenaar worden gedaan.

## Huidige versie
Mavix is nog geen productie-SaaS, maar heeft sinds 23 september 2026 wel een echte backend-laag (zie hieronder). Next.js, React, TypeScript, Tailwind en gewone CSS. De package-lock.json legt de geïnstalleerde versies vast.

- Dashboard: rustige opdrachtbox, snelle acties, bedrijfskaart en Vandaag-items.
- Instagram AI: Overzicht, Assist, Auto Create en Full Autopilot; mockgeneratie, bewerken, media, goedkeuringen, planning en lokale simulaties. Assist-generatie loopt nu via `src/app/api/generate/instagram/route.ts` (echte server-aanroep), Auto Create/Full Autopilot simuleren nog client-side.
- Email AI: bestaande editor, lokaal opgeslagen campagnes, instellingen, goedkeuring en planning. Geen echte verzending. Assist-generatie loopt via `src/app/api/generate/email/route.ts`.
- Contentkalender: volledige maand/week/lijst-implementatie met drag-drop, zijpaneel, goedkeuring, sparkle-icoon voor AI-content, kanaalpillen (incl. Campagnes) en statusfilter. Zie `src/app/contentkalender/page.tsx` en `src/components/calendar/*`.
- Brand Hub en Bedrijfsprofiel: naast het bestaande profiel nu ook doelgroepsegmenten (`src/components/brand/segments-manager.tsx`), een gestructureerd productcatalogus (`products-manager.tsx`, met foto/prijs/categorie/actief-vlag) en een Merkstem-formulier (kleuren, emoji-gebruik, formaliteit, voorkeurs-/vermijdwoorden). Website-import toont eerlijk dat er nog geen backend-koppeling actief is (geen nepdata).
- Nieuwe AI-instructiearchitectuur in `src/lib/ai/` (brand-context, instagram-instruction, email-instruction, review-instruction): combineert Brand Hub-gegevens tot gestructureerde context vóór generatie. Instagram- en Email-creatieformulieren hebben nu Doel/Segment/CTA respectievelijk Toon/Lengte/CTA-velden die de gegenereerde tekst aantoonbaar beïnvloeden.
- Review AI: reacties worden nu gecategoriseerd (5★/4★/neutraal/klacht/ernstige klacht/geen tekst) en gebruiken de ingestelde tone/ondertekening. Reviews en instellingen worden nu persistent opgeslagen (`workspace.review`), niet meer gereset bij verversen.
- Library: assets worden nu persistent opgeslagen (`workspace.library`) in plaats van alleen in-memory state.
- Accountmenu en accountpagina's: lokale profielgegevens, demo-facturatie/integraties, meldingsvoorkeuren en JSON-export.
- Contacten en Inzichten bevatten grotendeels mockdata; Contacten-CRUD/import is wel echt.
- Branding, sidebar, subtiele animaties en toegankelijkheidsverbeteringen zijn aanwezig.
- **Hosting-impact:** door de twee API-routes (`src/app/api/generate/*`) is een pure statische export (`next export`) niet meer mogelijk. Voor hosting is nu een Node.js-omgeving nodig (bijv. Hostinger VPS/Cloud of een andere Node-host), niet langer gewone Hostinger shared hosting.
- Kleurcontrast: Primary #6D28D9, dark #4C1D95, hover #5B21B6, tekst #171717, secundair #3A3A3A, muted #6B7280, lavendel #F3E8FF.

## Belangrijkste bestanden
- src/app/page.tsx en home.css: huidig dashboard.
- src/app/contentkalender/page.tsx + src/components/calendar/*: volledige kalender (maand/week/lijst, drag-drop, zijpaneel).
- src/components/workspace-provider.tsx: gedeelde state, opslaan en toasts; save accepteert momenteel één Workspace-argument.
- src/lib/storage.ts en types.ts: opslagvalidatie en Workspace/Post-modellen (incl. review, library, brand-model velden).
- src/lib/instagram-model.ts, email-model.ts, review-model.ts, library-model.ts, brand-model.ts: kanaal-/domeinmodellen en validatie.
- src/lib/ai/*: AI-instructiearchitectuur (brand-context, instagram-instruction, email-instruction, review-instruction) — combineert Brand Hub-data tot gestructureerde context vóór generatie.
- src/components/brand/*: Brand Hub-onderdelen (segmenten, producten, merkstem, website-import).
- src/components/instagram en src/components/email: bestaande workflows.
- src/lib/providers: mockproviders (mock.ts, email-mock.ts), nog geen externe AI. Worden nu aangeroepen vanuit src/app/api/generate/*.
- src/app/api/generate/instagram/route.ts en .../email/route.ts: eerste echte backend-routes (Frontend → Backend → AI Service-patroon), draaien nog op de mockproviders.
- src/lib/api-client.ts: client-side fetch-wrappers naar bovenstaande routes.
- src/app/globals.css: tokens/basisstijlen; home.css, navigation.css, account.css, brand.css, brand-hub.css en interactions.css vullen die aan.
- tests/domain.test.mjs: domein- en opslagtests (20 tests).

## Data overnemen
Code en browserdata zijn gescheiden. Git bevat geen persoonlijke localStorage-inhoud. De volledige werkruimte staat onder marketing-ai.workspace.v1; de lokale uitlogstatus onder marketing-ai.signed-out.

Op dezelfde computer, met dezelfde browser en dezelfde origin http://localhost:3000, blijft de bestaande data beschikbaar. Een andere browser, poort of cloudpreview heeft andere opslag.

Maak voor een verhuizing een eigen backup via accountmenu > Privacy & data > Gegevens downloaden. Bewaar de JSON privé, buiten Git. Er is momenteel geen importknop. Laat Claude indien nodig een gevalideerde importfunctie maken op basis van src/lib/storage.ts, met backup en expliciete bevestiging vóór vervangen. Deel persoonlijke exports alleen als je dat bewust wilt.

## Starten en controleren
npm ci, npm test, npm run build, npm run typecheck, npm run dev.
Geen omgevingsvariabelen of API-sleutels nodig voor de MVP.
Historische browserchecks gebruikten tijdelijke Playwright-scripts buiten Git; claim geen nieuwe browservalidatie zonder opnieuw te testen.

## Context van de open opdracht
De volledige kalenderverfijning uit CONTENTKALENDER.md is geïmplementeerd (maand/week/lijst, drag-drop, zijpaneel, goedkeuring, Campagnes-filter, statusfilter). Kleine openstaande punten: geen apart tablet-standaardgedrag (gebruikt nu desktopgedrag), en de dagcel-"+"-knop biedt Instagram Post/Story/Reel en E-mail (geen aparte "Campagne"-optie, zie code-commentaar in contentkalender/page.tsx voor de onderbouwing).

Op 23 september 2026 is een volledige Mavix-audit uitgevoerd op verzoek van de gebruiker ("ben ik klaar om te hosten en een echte AI-API te koppelen"), gevolgd door implementatie van de CRITICAL/IMPORTANT-bevindingen: Review AI-logica gerepareerd, Library/Review persistent gemaakt, Brand Hub uitgebreid met doelgroepsegmenten/producten/merkstem, een herbruikbare AI-instructiearchitectuur (src/lib/ai/) en de eerste echte backend-routes (src/app/api/generate/*). Nog open (bewust niet opgepakt zonder nieuwe opdracht): een echte database/authenticatie/multi-tenant-laag, een gekozen hosting-/database-provider, en elke echte externe koppeling (AI-API, Google Business Profile, Instagram-publicatie, e-mailverzending).
