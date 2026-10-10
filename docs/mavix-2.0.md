# Mavix 2.0 — besloten beta, AI-beheer en vormgeving

Deze pagina beschrijft wat er in de Mavix 2.0-upgrade is veranderd en wat er nodig is om het live te zetten.

## 1. Database (verplicht vóór deployment)

De nieuwe code verwacht tabellen en kolommen die nog niet in de productiedatabase staan. Draai daarom **eerst** het bestand
`supabase/apply-pending-2026-10.sql` in de Supabase SQL-editor van het project dat de live site gebruikt:

1. Supabase dashboard → kies het project dat in Hostinger als `NEXT_PUBLIC_SUPABASE_URL` staat.
2. SQL Editor → New query → plak de volledige inhoud van `supabase/apply-pending-2026-10.sql` → Run.
3. Het script draait in één transactie: bij een fout wordt niets gewijzigd. Alles is idempotent (twee keer draaien is veilig) en er wordt niets verwijderd.

Inhoud: Bibliotheek (tabellen, functie, privé storage-bucket), Research, unieke WhatsApp/Instagram-koppeling,
Nieuwsbrief, SEO Intelligence en **202610120001_private_beta_ai_usage** (besloten beta, platformbeheerders, AI-gebruik).

Zonder deze migratie geldt: de toegangscontrole faalt veilig dicht (gebruikers zien "Mavix wordt bijgewerkt") en AI-verzoeken worden geweigerd. Deploy dus nooit vóór de migratie.

## 2. Jezelf platformbeheerder maken (eenmalig)

Na de migratie in de SQL-editor (vervang het e-mailadres door dat van jouw Mavix-account):

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'jouw@email.nl'
on conflict do nothing;
```

Daarna is `/beheer` voor jou beschikbaar. Beheerrechten staan alleen in de database en worden op de server gecontroleerd; er staat geen e-mailadres in de code.

## 3. Besloten beta

- Bestaande werkruimtes krijgen bij de migratie de status `approved`; jij houdt dus gewoon toegang.
- Nieuwe registraties (ook via Google) krijgen een werkruimte met status `pending` en zien een wachtscherm.
- Goedkeuren, pauzeren en een AI-limiet per werkruimte instellen doe je op `/beheer`.
- `MAVIX_SIGNUP=closed` in Hostinger zet registreren helemaal uit.
- Uitgenodigde teamleden komen in de goedgekeurde werkruimte terecht, ook al krijgen ze zelf een (pending) werkruimte.

## 4. AI

- Provider: Claude via de officiële Anthropic SDK, alleen op de server (`ANTHROPIC_API_KEY` in Hostinger).
- Werkt nu echt: Content Studio (Instagram en e-mail genereren, herschrijven, korter/langer, toon, duidelijker, sterkere CTA, 3 alternatieven), Inbox-antwoorden en -verfijningen, samenvattingen, reviewantwoorden, Brand Hub-voorbeeld/verbetering, SEO-teksten, Research.
- Elke AI-aanroep gaat langs `metered()` (`src/lib/server/ai-usage.ts`): beta-goedkeuring, maandtegoed per werkruimte, daglimiet per gebruiker, maximaal 2 gelijktijdige verzoeken per gebruiker, idempotency-key tegen dubbel klikken, outputlimiet per functie en een registratie van tokens (nooit prompts of antwoorden).
- Kosten worden alleen getoond als `AI_PRICE_INPUT_PER_MTOK` en `AI_PRICE_OUTPUT_PER_MTOK` zijn ingesteld met de prijzen uit je Anthropic-account.
- Zonder `ANTHROPIC_API_KEY` wordt niets gegenereerd en ziet de gebruiker een eerlijke melding.

## 5. Opslaan

Alle bedrijfsgegevens staan op de server (`business_profiles.data`, met versiecontrole tegen overschrijven vanaf een ander apparaat). Content Studio slaat bewerkingen automatisch op na 1,5 seconde; de status (Niet opgeslagen / Opslaan… / Opgeslagen / Opslaan mislukt) toont pas "Opgeslagen" na bevestiging van de server. Bij een conflict verschijnt "Nieuwste versie laden" in plaats van stil overschrijven.

## 6. Omgevingsvariabelen (Hostinger)

Nieuw (optioneel): `MAVIX_SIGNUP`, `AI_MONTHLY_TOKEN_LIMIT`, `AI_DAILY_REQUESTS_PER_USER`, `AI_PRICE_INPUT_PER_MTOK`, `AI_PRICE_OUTPUT_PER_MTOK`. Zie `.env.example`.
