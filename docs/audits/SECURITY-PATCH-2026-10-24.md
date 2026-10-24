# Mavix — Securitypatch afhankelijkheden (24 oktober 2026)

Branch: `security/deps-2026-10-24` (vanaf `855d860`, de commit die nu op `main` en in productie staat). **Niet samengevoegd met `main`** zonder jouw akkoord.

## 1. Uitgangssituatie

- Hostinger rolt uit vanaf `main`. Lokaal `HEAD`, `origin/main` en `origin/mavix-2.0` stonden alle drie op `855d860`. Er hoeft dus niets van Mavix 2.0 te worden samengevoegd: de securitybranch bouwt rechtstreeks op wat live staat.
- In de werkmap staat nog de niet-gecommitte contactensynchronisatie. Die valt buiten deze patch en zit niet in de commit.
- `npm audit` vóór de patch: **14 advisories in 4 pakketten**: 3 kritiek, 5 hoog, 5 matig, 1 laag. Hostinger meldde 3/4/7; het verschil zit in de indeling van ernst, niet in het aantal. source-map-js stond op **1.2.1**, niet op 0.2.1 zoals gemeld.

## 2. Kwetsbaarheden en patches

| Pakket | Origineel | Gepatcht | Advisory | Ernst | Bereikbaar in Mavix? |
|---|---|---|---|---|---|
| next | 16.3.4 | **16.4.3** | GHSA-2464-fhr4-w9xw: RCE in Image Optimization API bij SVG | kritiek | **Ja, aanwezig.** `next/image` wordt gebruikt, standaardconfiguratie, `/_next/image` actief |
| next | | | GHSA-673q-mjm6-r5xr: RCE in `use cache` met typed arrays | kritiek | Nee: geen `use cache` in de code. Wel gepatcht |
| next | | | GHSA-vcvr-r3jv-pc5j: RCE in `next/og` ImageResponse | kritiek | Code aanwezig (`opengraph-image.tsx`), met alleen vaste inhoud. Gepatcht |
| next | | | GHSA-cjq9-62q9-8jv4: SSRF in Image Optimization | hoog | **Ja, aanwezig** (`/_next/image`) |
| next | | | GHSA-p3m5-59mp-jv5r: DoS in de App Router via Server Actions | hoog | Geen `use server` in de code. Gepatcht |
| next | | | GHSA-4jqv-mc3x-m676 / GHSA-mcj8-r9mp-w47p: cache poisoning SSG/ISR | matig | Statische pagina's aanwezig. Gepatcht |
| next | | | GHSA-f87g-xv8r-7p7x: lek in metadata-beeldroutes | matig | `opengraph-image` aanwezig. Gepatcht |
| next | | | GHSA-3w37-wq28-93x7 / GHSA-h694-7cp9-m8p3: lekken in `use cache` en Draft Mode | matig | Niet gebruikt. Gepatcht |
| next | | | GHSA-39w2-rjm5-chcv: info-lek in het MCP-eindpunt van de dev-server | laag | Alleen de dev-server, niet productie. Gepatcht |
| sharp | 0.35.4 (alleen via Next) | **0.35.5** (nu expliciet in `dependencies`) | GHSA-wq5f-xc86-pv6w: librsvg (CVE-2026-96889) | hoog | **Ja.** `image-input.ts` gaf de ruwe bytes van de gebruiker aan sharp vóór de controle op het formaat; een SVG ging zo door librsvg. Zie §3 |
| zod | 4.6.5 | **4.6.7** | GHSA-mrhx-c7xc-m3w5: geheugen uitputten bij te grote collecties | hoog | **Ja.** zod valideert de request-bodies van API-routes |
| source-map-js | 1.2.1 (via postcss) | **1.2.2** | GHSA-68fv-2mgg-jv7q: DoS via source-map-offsets | hoog | Alleen tijdens de build, niet tijdens het draaien. Gepatcht |

Ook bijgewerkt, voor gelijke versies: `eslint-config-next` 16.3.6 → 16.4.3 (devDependency).

**Werkwijze.** `npm install` met exacte versies binnen dezelfde hoofdversie. **Geen** `npm audit fix --force` en geen upgrade naar een nieuwe hoofdversie. De meegeleverde documentatie van Next 16.4 noemt alleen toevoegingen (`ensureStatic`, `navigation`, `next analyze`), geen breaking changes.

## 3. Extra verdediging (niet alleen bijwerken)

Ook gepatcht verwerkte sharp elk bestandsformaat dat het herkent. Mavix accepteert alleen JPEG, PNG en WebP, maar controleerde dat pas **na** `sharp(bytes).metadata()`.

- Nieuw: `src/lib/server/image-sniff.ts`. Het controleert de echte bestandshandtekening: de eerste bytes van JPEG, PNG en RIFF/WebP.
- `image-input.ts` (AI-beeldinvoer) en `instagram-publish.ts` (afbeeldingen van posts) weigeren nu alles wat geen echte JPEG, PNG of WebP is, **vóórdat** sharp de bytes ziet. Het opgegeven type (`data:image/png`) wordt niet vertrouwd.
- `sharp` staat nu expliciet in `dependencies` (`^0.35.5`). De app gebruikt het direct, en vertrouwde tot nu toe op de optionele afhankelijkheid van Next.js.

## 4. Tests

| Controle | Resultaat |
|---|---|
| `npm audit` na de patch | **0 vulnerabilities** |
| `npx tsc --noEmit` | ✔ |
| `npm run lint` | 0 fouten (14 bestaande waarschuwingen, ongewijzigd) |
| `npm test` | 456/456 met de contactsync in de werkmap; 429/429 voor de commit alleen |
| `npm run build` (Next 16.4.3) | ✔ |
| Nieuwe securitytests (`tests/security-boundaries.test.mjs`) | handtekeningen: SVG, PDF, TIFF, GIF en leeg geweigerd; een SVG vermomd als PNG wordt geweigerd **zonder dat sharp wordt aangeroepen**; de controle staat vóór elke `sharp(` |
| Rooktest op de productie-build (Next 16.4.3, sharp 0.35.5) | OG-afbeelding 200 `image/png`; `/_next/image` zet PNG en WebP om (200 `image/webp`); SVG via de optimizer 400; extern metadata-adres via de optimizer 400; `/`, `/pricing`, `/login`, `/aanvragen`, `/privacy` 200; Dashboard, Brand Hub, Contacten, Studio, Inbox, Kalender, SEO en Integraties renderen; geen serverfouten |
| Bestaande tests met een echte sharp-JPEG | Instagram-publicatie, beelden en carrousels ✔ |

Supabase-authenticatie, Google OAuth, Meta, OpenAI en de AI-limieten zijn niet aangepast. Hun bestaande tests (OAuth, isolatie, budgetten, webhooks) slagen. Echte providers zijn niet aangeroepen.

## 5. Resterende risico's

- **Periode tot de uitrol.** Productie draait nog op Next 16.3.4, met de kritieke RCE in `/_next/image`. Hoe sneller de uitrol, hoe beter.
- `next/dist/compiled/zod` is een kopie die Next.js zelf meelevert. Die valt onder de patch van Next en geeft geen audit-melding.
- npm 11 voerde het postinstall-script van `unrs-resolver` (een linter-hulpmiddel) niet uit, omdat het niet is goedgekeurd via `allowScripts`. Dat was vóór de patch al zo, en de lint werkt.
- De audit kijkt alleen naar bekende advisories. Advisories die later verschijnen vragen een nieuwe controle.

## 6. Klaar voor uitrol

**Technisch klaar.** Alle controles slagen en de audit is schoon. Uitrollen gebeurt pas na jouw akkoord, door de branch op `main` te zetten:

```
git push origin security/deps-2026-10-24:main
git push origin security/deps-2026-10-24:mavix-2.0
```

Hostinger draait bij de build `npm ci` met de bijgewerkte `package-lock.json`. Controleer de uitrol daarna zo: de `Last-Modified` van een `/_next/static`-chunk ligt na het tijdstip van de push, en `/` en `/login` geven 200.

**Rollback (zonder force-push).** `git revert <patch-commit>` op `main` en die revert pushen. Hostinger bouwt dan weer met de vorige lockfile (Next 16.3.4). Let op: daarmee komen de kwetsbaarheden ook terug, dus doe dit alleen bij een echte storing en patch daarna opnieuw. Er zijn geen databasewijzigingen, dus een rollback raakt geen gegevens.
