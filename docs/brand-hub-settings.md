# Brand Hub en instellingen

De bestaande Brand Hub-implementatie is aangevuld met een werkende pagina voor AI-voorkeuren, een responsieve instellingennavigatie en extra controles voor opslag, uploads en AI-context.

## Gedrag

- Brand Hub biedt vier stappen, een samenvatting en een bewerkbaar overzicht. Bestaande profielen en eigen merkstemmen blijven bruikbaar zonder opnieuw een toonpreset te kiezen.
- Concepten worden tijdens het typen in `sessionStorage` bewaard, gescheiden per gebruiker en werkruimte. Herladen in hetzelfde tabblad herstelt voortgang; afsluiten van het tabblad kan het concept verwijderen. Opslaan en verder bewaart de gegevens in de werkruimte. Opslagproblemen worden zichtbaar gemeld.
- Een concept wordt alleen hersteld als het onderliggende opgeslagen profiel nog overeenkomt. Een oud concept overschrijft daardoor geen wijzigingen die elders zijn opgeslagen.
- Een AI-voorbeeld wordt alleen als actueel getoond zolang het profiel overeenkomt met de invoer waarmee het voorbeeld is gemaakt.
- `/account/ai` wijzigt dezelfde taal, toon en contentvoorkeuren als Brand Hub. Kanaalinstellingen worden niet overschreven; links leiden naar de bestaande configuratie van goedkeuring en automatisering.
- Instellingen hebben gegroepeerde navigatie, focusindicatoren, compacte mobiele navigatie en animaties die verminderde beweging respecteren.

## Opslag en autorisatie

De gegevens blijven in de bestaande `business_profiles.data.profile` JSON-kolom. Er is geen nieuwe database-migratie nodig. Bestaande Supabase RLS, OWNER/ADMIN-controle, same-origin-controle, limieten en versiecontrole blijven actief. De API levert een conceptscope met de werkruimte- en gebruikers-ID; dit is geen autorisatietoken.

Nieuwe afbeeldingen worden in de browser gedecodeerd, verkleind en opnieuw gecodeerd. De server controleert formaat, lengte en bestandssignatuur; SVG wordt niet geaccepteerd. Bestaande opgeslagen logo- en foto-URL's blijven bruikbaar. Afbeeldingen worden in de beveiligde profielgegevens opgeslagen, niet in een publieke bucket. De bestaande maximale werkruimteomvang van 5 MB blijft gelden.

## AI-integratie en grenzen

De gedeelde context bevat taal, merkstem, USP's, interesses, persoonlijkheid, producten, contentvoorkeuren, marketingdoelen en standaard-CTA's. Adres, telefoon, btw-nummer, logo en productfoto's worden niet meegestuurd. Eigen CTA's en e-mailtoon gaan voor; reviewreacties behouden de kanaaltoon en de taal van de klant.

De bestaande Instagram- en e-mailgeneratoren zijn mockproviders. Hun gestructureerde instructies ontvangen de merkcontext, maar ze zijn hiermee niet vervangen door live generatieve AI. Brand Hub-voorbeelden, verbetersuggesties en de bestaande serverfuncties voor Inbox/reviews gebruiken de geconfigureerde AI-service. Live modelgedrag vereist geldige configuratie en is niet met een echte provider getest. Referentiebeelden blijven huisstijlreferenties en gaan niet naar de tekst-AI.

## Verificatie

`tests/brand-hub.test.mjs` controleert legacy-profielen, validatie, AI-context zonder privévelden, CTA- en toonoverrides, uploadsignaturen en autorisatie van previews. TypeScript en de volledige testsuite worden daarnaast uitgevoerd. Browsercontrole via localhost was in deze omgeving niet bereikbaar; responsive gedrag is in CSS geïmplementeerd maar niet visueel bevestigd.
