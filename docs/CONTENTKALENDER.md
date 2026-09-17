# Open opdracht: Contentkalender verfijnen

Doel: moderne, visuele, eenvoudige planning geïnspireerd door de UX-principes van Later/Buffer, zonder letterlijk design te kopiëren. Behoud Mavix-branding, functionaliteit en bestaande data. Geen externe API's. Eerst lokaal testen; vervolgwerk nog niet committen/pushen zonder opdracht.

## Weergaven en navigatie
- Desktop standaard Maand; tablet maand/week; mobiel standaard Lijst. Maand blijft mobiel bruikbaar zonder piepkleine kaartjes.
- Toolbar: Vandaag, vorige/volgende periode, maand/jaar; rechts Maand | Week | Lijst en Content plannen.
- Maandag t/m zondag; rustige witte cellen, duidelijke dagnummers, subtiel paars voor vandaag, zachtere dagen buiten de maand.
- Week: zeven kolommen, items op tijd gesorteerd, geen 24-uursraster.
- Lijst: per datum gegroepeerd, Vandaag/Morgen of volledige datum; thumbnail, tijd, titel, kanaal, status.
- Compacte samenvatting: aantallen gepland, wachten op goedkeuring, concepten. Geen KPI-kaarten.
- Kanaalpills Alles / Instagram / E-mail / Campagnes; eventueel compacte statusfilter.
- Maximaal circa drie items per dag in maand, daarna +N meer waarmee alle items van die dag openen.

## Content en interacties
- Compacte items: thumbnail/icoon, tijd, type/kanaal, korte titel, status. Geen volledige captions.
- Ondersteun Instagram Post/Story/Reel, E-mail en Campagne. De huidige Campagnes-route is een placeholder; maak een expliciete consistente keuze voor campagnedata zonder bestaande e-mails te dupliceren.
- Native of lichte drag/drop: datum aanpassen met behoud van tijd, subtiele drag-state, toast 'Content verplaatst naar 14 september'. Zorg ook voor toegankelijk alternatief via Verplaatsen.
- Klik item: rechterzijpaneel, geen paginanavigatie. Media, titel, kanaal, type, korte caption/onderwerp, datum/tijd/status, gemaakt door gebruiker/Mavix AI.
- Paneelacties: Bewerken, Dupliceren, Verplaatsen, Verwijderen; waar nodig Goedkeuren. Behoud bestaande validatie en planningregels.
- Goedkeuringsitems zichtbaar in kalender met amberbadge; paneel: 'Wacht op jouw goedkeuring', Afwijzen / Bewerken / Goedkeuren.
- Dagcel: subtiele plus bij hover én bereikbaar via toetsenbord/touch. Nieuwe content-keuze voor de vijf types. Gekozen datum daadwerkelijk voorinvullen in bestaande workflow; alleen queryparameters toevoegen zonder ze te verwerken is onvoldoende.
- Automatische content heeft subtiel sparkle-icoon. Handmatige content geen speciaal icoon.
- Ongeplande content moet bereikbaar blijven, zonder gefingeerde publicatiedatum.

## Styling
- Nieuwe centrale Mavix-tokens gebruiken: donkere paarse titels, zwarte leesbare tekst, lichte achtergrond, witte kalender, radius 12–16px, dunne borders, witruimte.
- Instagram zacht roze/violet; e-mail zacht blauw; campagne lavendel/indigo.
- Status: concept neutraal/lichtpaars, review amber, goedgekeurd groen, gepland blauw, gepubliceerd groen, mislukt/geblokkeerd rood.
- Zachte backgrounds, geen felle massieve vlakken. Geen analytics/grafieken/Brand Hub/uitgebreide autopilot-instellingen in de kalender.
- Hover item: lichte lift, border, shadow. Daghover zeer subtiel; drawer korte slide-in. 150–220ms, prefers-reduced-motion respecteren.

## Architectuur
Gebruik één consistente kalenderstructuur/adapter met id, title, channel, contentType, status, date, time, mediaUrl, caption, createdBy. Verbind deze met bestaande posts en email.campaigns; geen parallelle losstaande opslag die uit sync raakt. Behoud oude records en bronvelden. Native datums in lokale tijd; voorkom UTC-dagverschuivingen. Geen zware dependency zonder noodzaak.

## Acceptatie
Test maandwissel (incl. jaargrens), Vandaag, kanaal/statusfilters, drie weergaven, paneel openen/sluiten/focus/Escape, drag/drop, verplaatsen via formulier, nieuwe content vanaf dag met werkelijke datumoverdracht, goedkeuren/afwijzen, bewerken/dupliceren/verwijderen, overflow, ongeplande items, desktop/tablet/mobiel, localStorage en refresh. Test met geïsoleerde data. npm test, npm run build en TypeScript moeten slagen. Start npm run dev voor lokale review.
