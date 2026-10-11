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

## 4. AI (OpenAI)

- Provider: OpenAI via de officiële `openai` SDK en de Responses API, alleen op de server (`src/lib/server/openai.ts`). Sleutel: `OPENAI_API_KEY` in Hostinger; nooit `NEXT_PUBLIC_`, nooit gelogd of naar de browser gestuurd.
- Modellen (te wijzigen met `OPENAI_MODEL` / `OPENAI_ADVANCED_MODEL`):
  - `gpt-5.6-luna` (standaard: Instagram, tekst bewerken, Brand Hub, SEO, reviews, samenvattingen, Research-samenvatting) — $0,20 / $1,20 per 1M tokens in/uit.
  - `gpt-5.4-mini` (geavanceerd: e-mailcampagnes, Inbox-antwoorden, Mavix Agent) — $0,75 / $4,50 per 1M tokens.
  - Redeneren staat op `none` (standaard) of `low` (geavanceerd); redeneertokens worden als output betaald.
- Werkt via OpenAI: Content Studio (genereren, herschrijven, korter/langer, toon, duidelijker, sterkere CTA, 3 alternatieven), Inbox-antwoorden, -verfijningen en samenvattingen, reviewantwoorden, Brand Hub-voorbeeld/verbetering, SEO-teksten, Research en de Mavix Agent.
- Elke aanroep gaat langs `metered()` (`src/lib/server/ai-usage.ts`): beta-goedkeuring, werkruimte-autorisatie, rate limit, maandtegoed per werkruimte (standaard 300.000 tokens), daglimiet per gebruiker (standaard 40), max. 2 gelijktijdige verzoeken, idempotency-key, korte outputlimiet per functie, en een **globaal maandbudget** voor alle werkruimtes samen (`AI_GLOBAL_MONTHLY_BUDGET_USD`, standaard $8 van de $10 tegoed). Tokens en geschatte kosten (OpenAI-prijs van het gebruikte model) worden per verzoek vastgelegd, nooit prompts of antwoorden.
- Maximaal 1 herhaalpoging bij netwerkfouten; geen AI bij het laden van pagina's of op de achtergrond (alleen Research maakt na een door de gebruiker gestart onderzoek één samenvatting).
- Tegoed op bij OpenAI → gebruikers zien "Het AI-tegoed van Mavix is op"; er wordt niets gegenereerd.
- Zonder `OPENAI_API_KEY` wordt niets gegenereerd en ziet de gebruiker een eerlijke melding; de Agent valt dan terug op navigatiehulp zonder AI.

### Lokaal testen met een eigen ontwikkelsleutel

1. platform.openai.com → project **Mavix** (of een apart project "Mavix dev") → API keys → *Create new secret key*, met een eigen naam zoals `mavix-local`.
2. Zet in `C:\Documents\AIMI\.env.local` (staat in `.gitignore`, wordt nooit gecommit): `OPENAI_API_KEY=<je ontwikkelsleutel>` en eventueel `AI_GLOBAL_MONTHLY_BUDGET_USD=1`.
3. Herstart `npm run dev`. Plak de sleutel nooit in een chat.
## 5. Opslaan

Alle bedrijfsgegevens staan op de server (`business_profiles.data`, met versiecontrole tegen overschrijven vanaf een ander apparaat). Content Studio slaat bewerkingen automatisch op na 1,5 seconde; de status (Niet opgeslagen / Opslaan… / Opgeslagen / Opslaan mislukt) toont pas "Opgeslagen" na bevestiging van de server. Bij een conflict verschijnt "Nieuwste versie laden" in plaats van stil overschrijven.

## 6. Omgevingsvariabelen (Hostinger)

Nieuw: `OPENAI_API_KEY` (vereist voor AI). Optioneel: `OPENAI_MODEL`, `OPENAI_ADVANCED_MODEL`, `AI_GLOBAL_MONTHLY_BUDGET_USD`, `MAVIX_SIGNUP`, `AI_MONTHLY_TOKEN_LIMIT`, `AI_DAILY_REQUESTS_PER_USER`, `AI_PRICE_INPUT_PER_MTOK`, `AI_PRICE_OUTPUT_PER_MTOK`. Zie `.env.example`.
