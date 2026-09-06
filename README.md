# Marketing AI

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
