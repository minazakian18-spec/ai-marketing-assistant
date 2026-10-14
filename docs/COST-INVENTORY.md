# Mavix — kosteninventaris (voorbereiding op de prijsanalyse)

Bijgewerkt: 14 oktober 2026. Dit is een **inventaris**, nog geen prijsanalyse.

Legenda:
- **[B]** bevestigd in de code;
- **[C]** een prijs die in de code is vastgelegd (`src/lib/server/ai-usage.ts`; controleer bij de leverancier);
- **[S]** een schatting op basis van openbare tarieven (controleren);
- **[?]** onbekend (jouw contract of plan).

## 1. Waar kosten ontstaan

| Bron | Waar in Mavix | Hoe het kost | Status |
|---|---|---|---|
| **OpenAI** | alle AI-functies, zie §2 | per token, input en output | [B] in gebruik |
| **Hostinger** | hosting van Next.js | vast per maand | [?] plan onbekend |
| **Supabase** | database, Auth, Storage (mediabibliotheek), rate limits | gratis tier of Pro (± $25/mnd [S]) plus gebruik (opslag, egress, MAU) | [B] in gebruik |
| **Supabase custom domain** | Google-login met eigen domein | add-on per maand [S] | nog niet actief |
| **Resend** | nieuwsbriefbevestiging en accountmails | gratis tier (± 3.000/mnd, 100/dag) en daarboven Pro [S] | [B] code klaar, sleutel [?] |
| **Stripe** | abonnementen, facturen | per transactie (EU-kaart ± 1,5% + €0,25; iDEAL vast bedrag) [S]; geen vaste kosten | [B] code klaar, niet actief in het aanvraagproces |
| **Meta (Instagram, Messenger)** | Inbox, berichten | API gratis | [B] |
| **WhatsApp Business Platform** | Inbox | per bericht: servicegesprekken (binnen 24 uur, door de klant gestart) gratis; templateberichten betaald [S] | [B] handmatig koppelen |
| **Google APIs** (Gmail, Agenda, Business Profile, Search Console) | Inbox, kalender, reviews, SEO | gratis binnen quota [S] | [B] |
| **Google-verificatie** | `gmail.readonly` (restricted) | jaarlijkse CASA-beoordeling door een externe partij: honderden tot enkele duizenden dollars per jaar [S] | nog te beslissen |
| **PageSpeed Insights API** | SEO-scans | gratis quota; eigen sleutel optioneel (`PAGESPEED_API_KEY`) | [B] |
| **Google Ads API** | — | API gratis, ontwikkelaarstoken met goedkeuring | niet gebouwd (placeholder) |
| **Twilio SMS** | meldingen (code aanwezig) | per sms [S] | [B] code, niet in gebruik [?] |
| **Domein en DNS** | eigen domein, SPF/DKIM | jaarlijks [?] | — |

## 2. AI: modellen, functies en limieten [B]

**Modellen:**

| Model | Gebruik | Prijs per 1M tokens |
|---|---|---|
| `gpt-5.6-luna` | standaard | in $0,20 / uit $1,20 [C] |
| `gpt-5.4-mini` | geavanceerd: Agent, inbox, e-mailteksten | in $0,75 / uit $4,50 [C] |

Reasoning: "none" (standaard) of "low" (geavanceerd). Reasoning-tokens worden als output gerekend.

**Outputlimiet per functie (tokens):**

| Functie | Limiet |
|---|---|
| Instagram | 1.000 |
| E-mail | 1.800 |
| Tekst bewerken | 1.400 |
| Marketingtekst | 1.200 |
| Brand Hub | 600 tot 700 |
| SEO | 700 |
| Reviewantwoord | 600 |
| Inbox | 500 tot 900 |
| Onderzoek | 900 |
| Agent | 900 per stap |

**Mavix Agent:**
- Maximaal 4 modelaanroepen en 6 tool-aanroepen per vraag.
- De reservering vooraf is de worst case: 4 × (12.000 in + 900 uit) ≈ **$0,052**.
- Een typische vraag kost naar schatting **$0,01–0,02** [S].

**Bewaking (ongewijzigd):**
- maandquotum per werkruimte: 300.000 tokens;
- 40 verzoeken per gebruiker per dag;
- globaal maandbudget: $8 (`AI_GLOBAL_MONTHLY_BUDGET_USD`);
- maximaal 2 tegelijk per gebruiker;
- een kostenregister per verzoek (`ai_usage`).

**Ruwe orde van grootte per actieve klant [S]:** 300.000 tokens per maand, als mix van luna en mini, kost ongeveer **$0,10–0,80 per maand**, afhankelijk van hoeveel Agent en e-mail ze gebruiken. Dit moet gemeten worden in Beheer → AI-gebruik.

### Advies modelkeuze (nog niets gewijzigd)

| Taak | Advies |
|---|---|
| Korte teksten (caption, reviewantwoord, SEO-titel, tekst bewerken) | klein model (luna): kwaliteit genoeg, laagste prijs |
| Agent met tools, e-mailcampagnes, inbox-antwoorden met context | sterker model (mini), reasoning laag |
| Titels van gesprekken, tellingen, planning, statussen, onderzoeksregels, SEO-controles | **geen AI**: dat is nu al regelgebaseerd (bijvoorbeeld de titel van een agentgesprek) |
| Zware analyses (maandrapport, campagneplan) | pas een groter model overwegen als metingen laten zien dat mini tekortschiet |

## 3. Gesimuleerd of niet echt geïntegreerd [B]

Deze functies kosten nu niets, maar wel zodra ze echt worden:
- Instagram publiceren en statistieken;
- e-mailcampagnes versturen ("Verzonden (gesimuleerd)");
- Auto Create / Full Pilot (Social en E-mail);
- Auto Reply bij Reviews;
- de cijfers bij Inzichten;
- Google Ads.

Bij echt verzenden van e-mailcampagnes komen er kosten bij voor het verzenden zelf (bijvoorbeeld Resend per 1.000 mails [S]) en voor de reputatie van het verzenddomein.

## 4. Nog te meten voor de prijsanalyse
- Het echte tokengebruik per klant per functie over 30 dagen (Beheer → AI-gebruik).
- Supabase: opslag per klant (de mediabibliotheek heeft een quotum, `LIBRARY_QUOTA_BYTES`) en egress.
- Het aantal accountmails per klant per maand.
- De kosten van Stripe bij de gekozen betaalmethoden.
