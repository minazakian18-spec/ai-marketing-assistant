# Mavix

Actuele projectstatus en overdracht naar Claude: [docs/OVERDRACHT.md](docs/OVERDRACHT.md). De nog openstaande kalenderopdracht staat in [docs/CONTENTKALENDER.md](docs/CONTENTKALENDER.md). Onderstaande ontwikkelnotities bevatten ook oudere versies.

Een lokale SaaS-MVP met Next.js, TypeScript, Tailwind CSS en de App Router. Er zijn geen externe API-koppelingen, accounts of betalingen. De app doet geen externe netwerkverzoeken voor content, afbeeldingen of lettertypen.

## Lokaal starten

Installeer Node.js 22.6 of nieuwer (Node.js 22 of 24 LTS aanbevolen), inclusief npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Stop de server met Ctrl+C.

```bash
npm run build
npm start
```

`npm run typecheck` controleert de TypeScript-types.

`npm test` controleert mockgeneratie en lokale opslag, inclusief ongeldige gegevens en opslagfouten. `npm run format` formatteert de broncode.

## Functionaliteit

- Dashboard: echte lokale aantallen, recente content en aankomende planning. Een nieuwe werkruimte begint leeg.
- Bedrijfsprofiel: bedrijfsnaam, branche, doelgroep, omschrijving en tone of voice opslaan.
- AI Content: mockpost genereren, caption/hashtags bewerken, opnieuw maken en goedkeuren. De invoer wordt letterlijk in een vaste voorbeeldtekst verwerkt; dit is geen echte AI. Alleen de bedrijfsnaam wordt in het sjabloon gebruikt.
- Contentkalender: filteren op status, goedgekeurde posts inplannen en planning wijzigen. Datums gebruiken de tijdzone van de browser. Publicatie gebeurt niet automatisch.
- Bij bewerken of opnieuw maken gaat een bestaande post terug naar concept en vervalt de planning. Een nieuwe generatie maakt een nieuw concept.

Gegevens staan onder `marketing-ai.workspace.v1` in localStorage. Ze blijven beschikbaar na verversen, maar zijn gekoppeld aan deze browser en dit domein. Geen synchronisatie tussen apparaten of tabbladen; wissen van browseropslag verwijdert de gegevens. Opslagfouten worden in de interface getoond.

## Projectstructuur

```text
src/
  app/
    layout.tsx                  # Metadata en gedeelde applicatieshell
    page.tsx                    # Dashboard
    ai-content/page.tsx         # Mockgenerator en editor
    bedrijfsprofiel/page.tsx    # Profiel
    contentkalender/page.tsx    # Planning en statusfilters
    globals.css                 # Tailwind en visuele componentstijlen
  components/
    app-shell.tsx               # Responsive sidebar en navigatie
    ui.tsx                      # Gedeelde koppen, status en beeldplaceholder
    workspace-provider.tsx      # Centrale werkruimtestatus en opslagfouten
  lib/
    types.ts                    # Domeinmodellen
    storage.ts                  # Versiebeheerde lokale opslagadapter
    content-generator.ts        # Losse mockgenerator
```

## Later uitbreiden

Vervang de opslagadapter door een Supabase-repository en voeg authenticatie toe. Vervang de mockgenerator door een server-side service met een App Router Route Handler. Voeg Instagram-publicatie, e-mail en Stripe afzonderlijk als server-side integratiemodules toe. Bewaar toekomstige API-sleutels uitsluitend server-side in omgevingsvariabelen; nooit in localStorage of `NEXT_PUBLIC_*`. Deze MVP bevat bewust geen integratiecode, SDK's of API-sleutels.

## Handmatige controle

1. Sla een profiel op en ververs: de velden blijven ingevuld.
2. Genereer een post: het dashboard telt één concept.
3. Bewerk en sla op; heropen de post via het dashboard.
4. Maak opnieuw: dezelfde post krijgt een nieuwe variant.
5. Keur goed en plan in op een toekomstig tijdstip.
6. Controleer de kalenderfilters en de dashboardaantallen.
7. Controleer de mobiele navigatie bij een smal scherm.

## Lokale accountomgeving

Klik rechtsboven op de avatar voor Mijn account, Facturatie, Integraties, Meldingen, Privacy & data en Uitloggen. Het menu en de accountpagina's zijn ook op mobiel beschikbaar.

- Persoonlijke gegevens en een JPG/PNG/WebP-profielfoto (maximaal 1 MB) worden lokaal opgeslagen na Opslaan.
- Bedrijfsnaam en branche gebruiken dezelfde `profile`-velden als Bedrijfsprofiel. Adres en BTW-nummer worden ook door Facturatie gelezen. Er is geen tweede bedrijfsrecord.
- Bestaande MVP-opslag wordt bij laden aangevuld met lege accountvelden en standaardvoorkeuren. Bestaande content blijft behouden.
- Facturatie toont expliciet fictieve bedragen, datums, gebruik en een voorbeeldbetaalmethode. Downloadknoppen leveren een als demo gemarkeerd tekstbestand, geen echte factuur.
- Instagram en E-mail ondersteunen alleen een lokale, gesimuleerde verbindingsstatus. Verbinden vraagt geen inloggegevens; Beheren laat je de demo ontkoppelen.
- Meldingsvoorkeuren worden direct opgeslagen; er worden geen meldingen verzonden.
- Gegevens downloaden exporteert de volledige werkruimte als JSON, inclusief profielfoto en instellingen.
- Account verwijderen vraagt expliciete bevestiging en verwijdert alleen `marketing-ai.workspace.v1`, zonder andere browseropslag te wissen.
- Uitloggen verbergt de werkruimte en bewaart de lokale gegevens. De demostatus staat onder `marketing-ai.signed-out`. Je kunt terugkeren zonder wachtwoord: dit is geen echte authenticatie of beveiliging.

### Accountomgeving lokaal testen

1. Open het menu rechtsboven en loop de vijf accountpagina's langs.
2. Vul Mijn account in, voeg een foto toe, sla op en ververs.
3. Verander de bedrijfsnaam in Bedrijfsprofiel en controleer deze in Mijn account. Controleer adres en BTW-nummer in Facturatie.
4. Download een voorbeeldfactuur; verbind en ontkoppel een demo-integratie.
5. Wijzig meldingsvoorkeuren en ververs.
6. Download je gegevens en controleer de JSON. Test eerst Annuleren bij account verwijderen; bevestig verwijderen alleen met testgegevens.
7. Log uit, ververs en keer terug naar je werkruimte. Controleer ook het mobiele menu.

Accountcomponenten staan in `src/components/account`, routes in `src/app/account` en de toegevoegde stijlen in `src/app/account.css`.

## Nieuwe navigatie

- Overzicht: Dashboard, met conceptgoedkeuringen en recente activiteit.
- Content: Instagram AI (`/instagram-ai`), Email AI (`/email-ai`) en Campagnes (`/campagnes`).
- Planning: Contentkalender, met Kalender en Automatiseringen als interne weergaven.
- Klanten & resultaten: Contacten (`/contacten`) en Inzichten (`/inzichten`).
- Merk: Brand Hub (`/brand-hub`), met dezelfde opgeslagen bedrijfsgegevens.

De oorspronkelijke routes `/ai-content` (inclusief `?post=...`) en `/bedrijfsprofiel` blijven werken. De opslagstructuur is voor deze navigatiewijziging niet aangepast. Het accountmenu blijft hetzelfde.

Email AI is voorlopig een tijdelijke voorbeeldeditor: geen opslag, echte AI of verzending. Campagnes, automatiseringen, toekomstige merkmedia en inzichten zijn placeholders. Contacten gebruikt uitsluitend fictieve mockdata.

Gecontroleerd op desktop (1440 px) en mobiel (390 px): alle acht navigatielinks, actieve pagina-indicatie, sluiten met Escape, geen horizontale overflow, oorspronkelijke routes, dashboardgoedkeuringen, behoud van profiel- en postgegevens, accountmenu en kalenderweergaven. De browsertest gebruikte een geïsoleerde context met testgegevens. Productiebuild en vijf opslag-/domeintests slagen.

## Dashboard als dagelijkse marketingwerkplek

Het vernieuwde Dashboard toont vier compacte KPI’s, aandachtspunten, voorbeeldadvies, een interactieve SVG-prestatiegrafiek, kanaalprestaties, de komende zeven dagen en recente content. De knop Nieuwe content maken biedt drie interne bestemmingen.

De standaardweergave gebruikt expliciete voorbeeldcontent. Via Mijn content lees je bestaande posts uit de lokale werkruimte; lokale concepten zijn via Bekijken goed te keuren. Voorbeeldcontent wordt nooit naar localStorage geschreven. Prestaties en advies blijven ook in Mijn content duidelijk gemarkeerde mockdata.

De mockdata en datumfilters staan in `src/lib/dashboard-data.ts`, de componenten in `src/components/dashboard` en de stijlen in `src/app/dashboard.css`. De opslagstructuur, sidebar en accountnavigatie zijn voor deze dashboardwijziging niet aangepast. Gepland deze week gebruikt de kalenderweek (maandag–zondag); Komende 7 dagen bevat uitsluitend toekomstige geplande content.

De grafiek heeft filters voor 7/30/90 dagen, Overzicht/Instagram/E-mail en één geselecteerde metric. Alle grafiekwaarden zijn illustratief, zonder externe API of nieuwe chart-library.

Validatie: productiebuild met TypeScript, zes domein-/opslagtests en een geïsoleerde browsertest op 1440, 1024, 768, 390 en 320 pixels. Getest: grafiekfilters, menu’s, details, navigatielinks, lege toestanden en lokale goedkeuring met behoud van opgeslagen gegevens.

## Instagram AI workspace

Instagram AI en de oorspronkelijke route `/ai-content` gebruiken nu dezelfde workspace: Create, Autopilot, Approvals en Scheduled. De bijbehorende styling is ondergebracht in `src/app/globals.css`, afgebakend met `ig-*`-klassen. Er is geen import naar een ontbrekende `instagram.css`.

- Assist maakt alleen op verzoek mockcontent. Auto Create en Full Autopilot zijn lokale simulaties; er draaien geen achtergrondtaken en er wordt niets echt gepubliceerd.
- Autopilot-instellingen worden opgeslagen in het optionele `instagram`-veld van de bestaande werkruimte. Oude gegevens blijven leesbaar. Posts hebben optionele type-, bron-, foto- en videovelden; de bestaande postvelden blijven behouden.
- Simuleer volgende week maakt één expliciete batch volgens dagen, tijden, frequenties en toegestane onderwerpen. Auto Create levert concepten. Full Autopilot plant bekende broncontent lokaal in. Ontbrekende broninformatie leidt tot goedkeuring of overslaan, afhankelijk van Bij twijfel.
- De contentmix blijft 100% door herverdeling. Regels zijn lokaal instelbaar; onbekende informatie publiceren is altijd verboden. De mockgenerator verzint geen prijzen, reviews of andere nieuwe bedrijfsfeiten. Eerdere-contentanalyse is nog niet geïmplementeerd.
- Vakantiemodus gebruikt alternatieve instellingen binnen de datums en herstelt daarna automatisch de normale instellingen. Publicatie- en notificatiekeuzes worden bewaard, niet extern uitgevoerd.
- Brand readiness wordt berekend uit echte lokale Brand Hub-velden. Producten, logo, contentvoorkeuren en bedrijfsfoto’s kunnen daar worden aangevuld. Websitegebruik leest alleen opgeslagen informatie en haalt geen website op.
- Foto’s: JPG/PNG/WebP, maximaal vier bestanden van elk 500 KB. Animate Image vereist een foto; Photos to Reel minimaal twee. Video geeft uitsluitend een storyboard van 5 of 10 seconden met 9:16-richting, geen echt videobestand.
- Via Voorbeeldcontent toevoegen kun je zelf mockitems aan je lokale werkruimte toevoegen. Concepten kun je bewerken, afwijzen en goedkeuren. Goedgekeurde content met een toekomstige datum gaat naar Scheduled en de bestaande kalender.

Providercontracten voor tekst, beeld en video staan in `src/lib/providers/contracts.ts`; de implementatie in `mock.ts` is verwisselbaar. Er zijn geen externe providers, SDK’s, API-sleutels of nieuwe runtimeafhankelijkheden toegevoegd.

Gecontroleerd: build/TypeScript, zeven domein-/opslagtests, create/edit/approve/reject, uploads, Auto Create/Full Autopilot, vakantieopslag, legacy-route, navigatie en alle vier tabs op 1440/1024/768/390/320 pixels. De browsertest gebruikt geïsoleerde testgegevens, niet de browseropslag van de gebruiker.

## Email AI workspace

Email AI heeft dezelfde vier werkruimtetabs als Instagram AI, met eigen e-mailfuncties: Create, Autopilot, Approvals en Scheduled. De editor bewaart onderwerp, preview text, afzender, segment, body, CTA, optionele Brand Hub-hero en footer. De afmeldlink en CTA zijn previewacties; er worden geen e-mails verzonden. Genereren maakt een nieuw concept; Opnieuw maken vervangt het huidige concept. Bewerken maakt goedkeuring ongedaan. Inplannen bevestigt de inhoud en vereist een toekomstige datum en een segment met ingeschreven contacten.

- Opslag: optioneel `email: { settings, campaigns }` in de bestaande `marketing-ai.workspace.v1`-werkruimte. Oude profiel-, account- en Instagram-data blijven behouden. Foutieve e-mailinstellingen worden bij laden gemeld.
- `src/lib/contact-data.ts` is de gedeelde bron voor Contacten en Email AI. Aantallen zijn gebaseerd op de bestaande fictieve contacten, niet op een verzonnen contactdatabase. Uitgeschreven en onbevestigde contacten zijn uitgesloten. Daarom zijn enkele segmenten in deze demo leeg.
- Producten, bedrijfsgegevens, website, foto's en bevestigde aanbiedingen komen uit dezelfde Brand Hub. Websitegebruik leest alleen opgeslagen bedrijfsinformatie; er wordt niets opgehaald.
- De mockplanner simuleert expliciet vier weken, met maandfrequenties eenmaal in dat venster. De contentmix wordt gebruikt voor onderwerpkeuze en blijft 100%. Workflows hebben een aparte triggersimulatie: één item per actieve workflow, geen echte eventbewaking. Follow-ups volgen de workflowinstelling.
- Auto Create maakt concepten; Full Autopilot plant lokale mockcampagnes als brongegevens en ontvangers beschikbaar zijn. Ontbrekende broninformatie vraagt goedkeuring of wordt overgeslagen. Lege segmenten blokkeren planning. Onbekende feiten, verzonnen klantgegevens en uitgeschreven contacten blijven beschermd.
- Vakantiedatums passen tijdelijk het ritme en de goedkeuringskeuze aan; daarna gelden de normale instellingen. Auto Create vereist ook op vakantie goedkeuring. Er draait geen achtergrondtaak en er worden geen notificaties verzonden.
- Email readiness gebruikt lokale merkgegevens en gedeelde voorbeeldcontacten. De performancekaart is expliciete mockdata.
- Dashboard / Mijn content bevat nu ook lokale e-mailcampagnes. Geplande e-mails verschijnen in de contentkalender en openen de juiste e-maileditor.

E-mailmodel: `src/lib/email-model.ts`. Providercontracten voor tekst, contacten, verzending en analytics plus de lokale tekstsimulatie: `src/lib/providers/email-mock.ts`. UI: `src/components/email`. Geen externe providers of nieuwe dependencies toegevoegd.

Gecontroleerd: tien domein-/opslagtests, productiebuild/TypeScript en een geïsoleerde browsertest voor genereren, bewerken, afwijzen, goedkeuren, datumvalidatie, planning, workflows, vakantiedata, lokale opslag en alle vier tabs op 1440/1024/768/390/320 pixels.

## Visuele verfijning en toegankelijkheid

`src/app/interactions.css` bevat de gedeelde CSS-interactielaag: subtiele schaduwen, korte hover-/press-states, actieve tab-indicatoren, korte pagina- en resultaatintro's, KPI-fades en focus-visible. Alleen echte interactieve kaarten krijgen een lift-effect. Statische panelen blijven staan; hover onthult geen essentiële informatie. Animaties gebruiken hoofdzakelijk transform en opacity, zonder animatielibrary.

Accountmenu en Nieuwe content-dropdown blijven tijdens hun sluitanimatie kort gemount, maar zijn dan inert. De bevestigingsdialoog behoudt zijn inhoud tijdens sluiten, ondersteunt Escape, houdt toetsenbordfocus binnen de dialoog en herstelt focus daarna. Alle effecten respecteren `prefers-reduced-motion`; hoververplaatsingen en skeleton-pulses worden dan uitgeschakeld.

Opslaan geeft een rustige, sluitbare toast (vijf seconden; pauze bij hover/focus). Beide creatiestudio's tonen een skeleton tijdens de korte lokale mockgeneratie van minimaal 450 ms. Er worden geen netwerkacties toegevoegd.

Getest in een geïsoleerde browser: toetsenbordbediening en focusherstel, modals/dropdowns, reduced motion, stabiele omliggende layout tijdens hover, skeleton/resultaat/toast, mobiele navigatie en alle hoofd- en accountpagina's op vijf schermbreedtes. De eigen browserdata van de gebruiker is niet aangepast.

## Vereenvoudigde kanaalnavigatie

Instagram AI en Email AI openen standaard op **Overzicht**. De gedeelde subnavigatie bestaat uit Overzicht, Assist, Auto Create en Full Autopilot. De bestaande editors, regels, workflows, goedkeuringsacties, planning en vakantievoorkeuren zijn verplaatst en blijven beschikbaar.

- Overzicht toont de huidige modus, lokale aantallen, laatste/komende content en compacte mockprestaties. Moduskaarten openen een onderdeel zonder de actieve modus te veranderen. Uitklapbare secties geven toegang tot goedkeuringen, planning en alle content, inclusief afgewezen concepten.
- Assist bevat handmatige generatie en bewerken. De actieve automatische modus verandert alleen via de expliciete actie Assist activeren.
- Auto Create bevat het ritme, uitklapbare contentmix/regels en de goedkeuringswachtrij. Ook met een eerder opgeslagen automatische vakantievoorkeur vereist Auto Create altijd goedkeuring.
- Full Autopilot bevat planning, veiligheidsregels, vakantie-instellingen en de wachtrij voor twijfelgevallen. Alle automatische acties blijven lokale simulaties.
- Instellingen worden per kanaal gedeeld en behouden. Navigeren wijzigt niets in localStorage. Activeren en opslaan gebruikt de gekozen modus; de formulieruitleg maakt dit expliciet.
- Email AI ondersteunt nieuwsbrieven per week of per maand (eenmalig binnen de bestaande vierwekensimulatie), plus een lokale notificatievoorkeur. Ontbrekende nieuwe velden behouden het oude weekgedrag.
- Oude `tab=create`, `tab=autopilot`, `tab=approvals`, `tab=scheduled` en bewerklinks blijven werken. Nieuwe inhoudsacties openen direct Assist. De oude `/ai-content?post=...`-route blijft een bewerkroute.

Gedeelde navigatie en overzichtscomponenten staan in `src/components/channel/workspace-ui.tsx`; compatibele routekeuze in `src/lib/workspace-navigation.ts`. Gecontroleerd met dertien domein-/opslagtests, productiebuild/TypeScript en browsertests van beide kanalen op vijf breedtes, inclusief moduswissels, mockgeneratie, goedkeuring en bestaande lokale gegevens.

### Motion-verfijning

De bestaande CSS-motionlaag is uitgebreid met 220 ms pagina-intro's (8 px), KPI-stagger van 55 ms, een kort intekenende grafieklijn, subtiele thumbnailzoom (1.025) en een toegankelijke actie-overlay. Laadfeedback combineert bestaande skeletons met shimmer tijdens mockgeneratie. Actieve Full Autopilot gebruikt een dot die kort pulseert, zonder eindeloze decoratieve animatie.

Accordions gebruiken native `details` en CSS `::details-content` met `interpolate-size` voor openen én sluiten. Browsers zonder ondersteuning houden de gewone, functionele details-weergave. Toasts sluiten na vier seconden of handmatig met een korte reverse-animatie; hover/focus pauzeert de timer. Reduced motion schakelt niet-essentiële beweging uit.

Geen animatielibrary, nieuwe API's of veranderingen aan de opslagstructuur toegevoegd. Browsercontroles omvatten accordion-sluiten, grafiekintro, modal/media-interactie, skeleton/toast, reduced motion, stabiele omliggende layout bij hover en desktop/tablet/mobile.

### Testen zonder account

Start `npm run dev` en open `/login`. Kies **Testen zonder account**. De demo gebruikt voorbeeldgegevens en bewaart wijzigingen in de browser. AI-generatie is gesimuleerd; backendfuncties zoals koppelingen, accountbeheer en facturatie vereisen een echt account. Via **Testmodus verlaten** keer je terug naar de login. De testmodus is uitsluitend beschikbaar tijdens development, niet in een productiebuild.
