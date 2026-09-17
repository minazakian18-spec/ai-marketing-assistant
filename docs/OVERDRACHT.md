# Overdracht Mavix

Datum: 18 september 2026.
Repository: https://github.com/minazakian18-spec/ai-marketing-assistant
Lokale werkmap: C:\Documents\AIMI

## Huidige versie
Mavix is een lokale, Nederlandstalige marketingwerkruimte, geen productie-SaaS. Next.js, React, TypeScript, Tailwind en gewone CSS. De package-lock.json legt de geïnstalleerde versies vast.

- Dashboard: rustige opdrachtbox, snelle acties, bedrijfskaart en Vandaag-items.
- Instagram AI: Overzicht, Assist, Auto Create en Full Autopilot; mockgeneratie, bewerken, media, goedkeuringen, planning en lokale simulaties.
- Email AI: bestaande editor, lokaal opgeslagen campagnes, instellingen, goedkeuring en planning. Geen echte verzending.
- Contentkalender: nog de oorspronkelijke lijst/planning met statusfilters en geplande e-mails. Geen nieuwe maand/week/drawer/drag-drop implementatie.
- Brand Hub en Bedrijfsprofiel delen profielgegevens en lokale merkmedia.
- Accountmenu en accountpagina's: lokale profielgegevens, demo-facturatie/integraties, meldingsvoorkeuren en JSON-export.
- Campagnes bevat een voorbeeld voor meerdere kanalen, geen volwaardige campagne-editor. Contacten en Inzichten bevatten mockdata.
- Branding, sidebar, subtiele animaties en toegankelijkheidsverbeteringen zijn aanwezig.
- Laatste afgeronde wijziging: alleen kleurcontrast verbeterd. Primary #6D28D9, dark #4C1D95, hover #5B21B6, tekst #171717, secundair #3A3A3A, muted #6B7280, lavendel #F3E8FF. Geen layoutwijziging bij deze kleurupdate.

## Belangrijkste bestanden
- src/app/page.tsx en home.css: huidig dashboard.
- src/app/contentkalender/page.tsx: bestaande kalender, startpunt vervolgwerk.
- src/components/workspace-provider.tsx: gedeelde state, opslaan en toasts; save accepteert momenteel één Workspace-argument.
- src/lib/storage.ts en types.ts: opslagvalidatie en Workspace/Post-modellen.
- src/lib/instagram-model.ts en email-model.ts: kanaalmodellen en validatie.
- src/components/instagram en src/components/email: bestaande workflows.
- src/lib/providers: mockproviders, geen externe AI.
- src/app/globals.css: tokens/basisstijlen; home.css, navigation.css, account.css, brand.css en interactions.css vullen die aan.
- tests/domain.test.mjs: domein- en opslagtests.

## Data overnemen
Code en browserdata zijn gescheiden. Git bevat geen persoonlijke localStorage-inhoud. De volledige werkruimte staat onder marketing-ai.workspace.v1; de lokale uitlogstatus onder marketing-ai.signed-out.

Op dezelfde computer, met dezelfde browser en dezelfde origin http://localhost:3000, blijft de bestaande data beschikbaar. Een andere browser, poort of cloudpreview heeft andere opslag.

Maak voor een verhuizing een eigen backup via accountmenu > Privacy & data > Gegevens downloaden. Bewaar de JSON privé, buiten Git. Er is momenteel geen importknop. Laat Claude indien nodig een gevalideerde importfunctie maken op basis van src/lib/storage.ts, met backup en expliciete bevestiging vóór vervangen. Deel persoonlijke exports alleen als je dat bewust wilt.

## Starten en controleren
npm ci, npm test, npm run build, npm run typecheck, npm run dev.
Geen omgevingsvariabelen of API-sleutels nodig voor de MVP.
Historische browserchecks gebruikten tijdelijke Playwright-scripts buiten Git; claim geen nieuwe browservalidatie zonder opnieuw te testen.

## Context van de open opdracht
De gebruiker vroeg een volledige kalenderverfijning. De analyse was gedaan, maar het schrijfcommando werd geblokkeerd door de gebruikslimiet. De voorgestelde kalendercode is dus niet geïmplementeerd. De huidige overdracht publiceert de bestaande versie, niet een afgeronde nieuwe kalender. De concrete eisen staan in CONTENTKALENDER.md.
