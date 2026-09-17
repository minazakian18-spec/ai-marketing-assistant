@AGENTS.md

# Mavix — instructies voor Claude Code

Lees eerst docs/OVERDRACHT.md en docs/CONTENTKALENDER.md. README.md bevat ook historische ontwikkelnotities; de overdracht beschrijft de huidige stand.

## Project
Nederlandstalige marketing-SaaS-MVP: Next.js App Router, React, TypeScript en Tailwind/CSS. Behoud de bestaande Mavix-branding en opgeslagen gegevens. Geen echte AI, publicatie, betalingen of externe API-koppelingen toevoegen zonder opdracht.

## Werkwijze
- Lees AGENTS.md en de relevante documentatie in node_modules/next/dist/docs voordat je Next.js-code wijzigt; deze versie wijkt af van oudere versies.
- Gebruik de bestaande WorkspaceProvider en opslagadapter. Behoud marketing-ai.workspace.v1 en bestaande records.
- Centrale contrasttokens staan in src/app/globals.css. Donkerpaars voor hoofdtitels, donkere bodytekst, lichte achtergronden. Respecteer reduced motion.
- Test met een geïsoleerde browsercontext; overschrijf nooit de bestaande browserdata van de gebruiker.
- Valideer wijzigingen met npm test, npm run build en passende browsercontroles; start lokaal met npm run dev.
- Geen zware dependencies zonder noodzaak. Geen commit/push voor nieuwe vervolgwijzigingen zonder nieuwe opdracht. De GitHub-overdracht van de huidige versie is wel geautoriseerd.

## Commando's
Node >=22.6; gebruik de meegeleverde package-lock.json.

```sh
npm ci
npm run dev
npm test
npm run build
npm run typecheck
```

## Volgende opdracht
De gevraagde volledige Contentkalender-verfijning staat nog open. Zie docs/CONTENTKALENDER.md. Er is hiervoor nog geen nieuwe implementatie opgeslagen; begin bij de bestaande kalender en hergebruik de Instagram- en e-mailworkflows.
