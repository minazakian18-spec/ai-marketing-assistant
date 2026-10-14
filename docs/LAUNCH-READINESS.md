# Mavix — klaar voor klanten: stand, keuzes en handmatige stappen

Bijgewerkt: 14 oktober 2026 · Branch `mavix-2.0` = `main`

Legenda: **[B]** bevestigd in de code of live getest · **[A]** aanname of nog door jou te controleren.

---

## 1. Aanvraagproces (demo → aanvraag → beoordeling → betaling → activering)

### Hoe het nu werkt [B]
1. **Demo aanvragen** (`/demo`, openbaar en vindbaar) of direct **account aanvragen** (`/aanvragen`, met pakketkeuze uit de bestaande prijzen). Beide sturen naar `/api/applications`.
   - De invoer wordt gecontroleerd, het aantal aanvragen is begrensd en er is een verborgen veld tegen bots.
   - Toestemming is verplicht.
   - Er wordt **geen account aangemaakt en geen toegang gegeven**.
2. Jij beoordeelt in **/beheer → Demo's en aanvragen**. Alle stappen controleert de server (`src/lib/applications.ts`):
   - **Demo gehouden:** vastleggen dat de demo is geweest. Zonder demo kun je niet goedkeuren.
   - **Goedkeuren:** de status wordt "wacht op betaling" en de klant krijgt een e-mail om een account aan te maken.
   - **Betaling:** "Betaling handmatig bevestigen" (bankoverschrijving) of "Zonder online betaling" (pilot of handmatige factuur). Beide worden vastgelegd.
   - **Account activeren:** kan alleen na een bevestigde betaling of vrijstelling, en alleen als de klant al een Mavix-account met hetzelfde e-mailadres heeft. De werkruimte van de klant krijgt dan toegang (`workspaces.access_status = approved`).
   - **Afwijzen** (met optionele reden), **Pauzeren** en **Opnieuw beoordelen**.
3. Elke statuswijziging staat in de geschiedenis (`account_application_events`). Activeren en pauzeren komen ook in `audit_logs`.
4. **Bestaande klanten loggen gewoon in.** Hun werkruimtes blijven `approved`.

### Volgorde van betalen en goedkeuren: advies
**Eerst beoordelen, dan betalen.** Wie afgewezen wordt, heeft dan nooit betaald: geen terugbetalingen, geen verwarring, geen boekhoudcorrecties. Dit is zo gebouwd, en de server dwingt het af: activeren kan pas na een bevestigde betaling.

### Nog te doen voor online betalen [B]
- Stripe is al ingebouwd: checkout, klantportaal, facturen en een webhook die de handtekening controleert en elke gebeurtenis maar één keer verwerkt (`/api/billing`, `/api/billing/webhook`, tabel `subscriptions`).
- **Er is een volgordeprobleem:** de checkout vraagt nu een *goedgekeurde* werkruimte, maar in het nieuwe proces krijgt een werkruimte pas toegang **na** betaling.
- **Voorgestelde oplossing (nog niet gebouwd, met opzet):**
  - Sta de checkout toe voor de eigenaar van een werkruimte waarvan de aanvraag de status `awaiting_payment` heeft.
  - Laat de Stripe-webhook bij `checkout.session.completed` of `invoice.paid` de aanvraag op `payment_confirmed` en `paid` zetten.
  - Activeren blijft daarna jouw beslissing.
- Tot die tijd gebruik je "Betaling handmatig bevestigen" of "Zonder online betaling".
- **Mollie of Stripe:** Stripe is al geïntegreerd en ondersteunt iDEAL, SEPA en kaarten voor Nederlandse abonnementen. Overstappen naar Mollie is alleen zinvol bij een zakelijke voorkeur, bijvoorbeeld voor lagere iDEAL-kosten of Nederlandse support **[A]**. Een overstap vraagt een nieuwe koppeling.
- Mavix slaat nooit kaartgegevens op (gehoste Stripe-checkout), en een succespagina na betalen geldt nooit als bewijs: alleen de webhook telt.

### Schakelaars (omgevingsvariabelen)
- `MAVIX_APPLICATIONS=closed`: het aanvraagformulier sluiten.
- `MAVIX_SIGNUP=closed`: nieuwe accounts helemaal blokkeren. Bestaande klanten loggen dan nog wel in.

---

## 2. Transactionele e-mails

- **Gebouwd [B]:** `src/lib/server/email.ts`, met Nederlandse HTML-templates in Mavix-stijl plus een platte-tekstversie voor:
  - demo ontvangen en demo ingepland;
  - aanvraag ontvangen, goedgekeurd en afgewezen;
  - betaling gelukt en mislukt;
  - account actief;
  - beveiligingsmelding.
- **Verzenden:**
  - Verzonden wordt via **Resend**, de provider die de nieuwsbriefbevestiging al gebruikt.
  - Elk bericht krijgt een vaste idempotency-sleutel, zodat het niet dubbel verstuurd wordt, en maximaal twee nieuwe pogingen.
  - Is e-mail niet ingesteld, dan wordt er niets verstuurd en staat in de geschiedenis van de aanvraag eerlijk "E-mail niet verstuurd".
- **Nu al verstuurd bij:** demo ontvangen, aanvraag ontvangen, goedgekeurd, afgewezen en account actief.
- **Templates klaar, nog niet aangeroepen:**
  - "betaling gelukt/mislukt": wacht op de Stripe-koppeling hierboven;
  - "demo ingepland": er is nog geen agendakoppeling voor demo's;
  - "beveiligingsmelding": er is nog geen detectie van nieuwe apparaten.
- **Supabase Auth** (e-mailadres bevestigen, wachtwoord resetten): die mails verstuurt Supabase zelf. De Mavix-templates staan in `docs/email-templates/`; plak ze in Supabase → Authentication → Emails.
- **Geen mail na elke login.** Dat is bewust: het leidt tot meldingsmoeheid.

### Wat jij instelt
1. Maak een Resend-account aan en voeg een verzenddomein toe, bijvoorbeeld `mail.webbo-solutions.nl` of je eigen Mavix-domein.
2. **DNS bij je domeinbeheerder:**
   - **SPF** (TXT) en **DKIM** (CNAME of TXT): Resend toont de exacte records.
   - **DMARC** (TXT `_dmarc`, begin met `p=none` en daarna `quarantine`).
   - Optioneel een **MX/return-path** voor bounces.
3. Zet bij Hostinger:
   - `EMAIL_API_KEY`;
   - `EMAIL_FROM` (bijvoorbeeld `Mavix <noreply@jouwdomein>`);
   - optioneel `EMAIL_REPLY_TO`.
4. **Aanbevolen:** zet in Supabase → Authentication → SMTP Settings dezelfde Resend-SMTP, zodat ook de Auth-mails van je eigen domein komen. Supabase heeft standaard een lage verzendlimiet.

---

## 3. Integraties: wat de klant ziet en wat jij eenmalig regelt

| Integratie | Koppelen voor de klant | Productie-OAuth | Externe goedkeuring nodig |
|---|---|---|---|
| Instagram (DM's in de Inbox) | Knop "Koppelen" → inloggen bij Meta → account kiezen [B] | ja | **Meta App Review** voor `instagram_business_manage_messages` (of `instagram_manage_messages`), **Business Verification** [A] |
| Facebook Messenger | Knop "Koppelen" → pagina kiezen [B] | ja | Meta App Review: `pages_messaging`, `pages_manage_metadata`, `pages_show_list`, `pages_read_engagement` [A] |
| WhatsApp Business | **Nog geen klik-koppeling.** Een technisch beheerder voert de gegevens in (verborgen onder "Handmatig koppelen") [B] | nee | Embedded Signup vraagt Meta **Tech Provider**-status en Business Verification [A] |
| Gmail | Knop "Koppelen" → Google-toestemming [B] | ja | `gmail.readonly` is een **restricted scope**: Google-verificatie **plus een jaarlijkse CASA-beveiligingsbeoordeling** door een externe partij. `gmail.send` is sensitive [A] |
| Google Agenda | Knop "Koppelen" [B] | ja | `calendar.events` is sensitive: Google-verificatie van de app [A] |
| Google Bedrijfsprofiel / reviews | Knop "Koppelen" → locatie kiezen [B] | ja | **Toegang tot de Business Profile API aanvragen** bij Google. Zonder goedkeuring toont Mavix "API-toegang moet eerst door Google worden goedgekeurd" [B] |
| Search Console | Knop "Koppelen" [B] | ja | `webmasters.readonly` is sensitive: Google-verificatie [A] |

Zolang een Google-app niet geverifieerd is, ziet een klant een waarschuwing ("Google heeft deze app niet geverifieerd") en geldt een limiet van 100 testgebruikers.

### Checklist Meta (eenmalig, door jou)
1. Meta Business Portfolio: voer **Business Verification** uit (KvK-uittreksel, domein).
2. Zet de Meta-app (Facebook Login for Business en/of Instagram Login) op **Live**. Vul de privacy-URL, de verwijder-URL voor gegevens en het app-icoon in.
3. Vraag via **App Review** de rechten uit de tabel aan. Voeg per recht een screencast toe van hoe Mavix het gebruikt.
4. Webhook: callback `https://mavix.webbo-solutions.nl/api/webhooks/meta`, verificatietoken = `META_WEBHOOK_VERIFY_TOKEN`. Abonneer je op `messages` (Instagram, Messenger, WhatsApp).
5. Voor WhatsApp met één klik: word **Tech Provider**, maak een Embedded Signup-configuratie aan en laat daarna de klik-koppeling bouwen. Die is nu bewust niet gebouwd.

### Checklist Google (eenmalig, door jou)
1. Google Cloud → OAuth-toestemmingsscherm:
   - app-naam **Mavix**, logo en support-e-mail;
   - de domeinen `webbo-solutions.nl` (en je toekomstige Mavix-domein) als geautoriseerde domeinen;
   - links naar de privacyverklaring en voorwaarden.
2. Domein verifiëren in Search Console, vereist voor verificatie van de OAuth-app.
3. **Verificatie aanvragen** voor de sensitive scopes (Agenda, Search Console, `gmail.send`). Voor `gmail.readonly` volgt ook de CASA-beoordeling. **Overweeg** Gmail eerst zonder lezen (alleen versturen) te lanceren, om de restricted scope te vermijden.
4. Business Profile API: vraag toegang aan via het formulier van Google (projectnummer, gebruik).
5. Redirect-URI's in de OAuth-client moeten precies overeenkomen met `APP_URL` en de callback-paden in de code.

---

## 4. Google-login met Mavix in plaats van een Supabase-domein

- **Oorzaak [B]:**
  - Inloggen met Google gaat via Supabase Auth (`signInWithOAuth`).
  - Google stuurt de gebruiker daarom terug naar `https://<project>.supabase.co/auth/v1/callback`.
  - Op het Google-scherm staat dan "doorgaan naar llwfsghipxkddwkgdsuy.supabase.co".
- **Drie aparte zaken:**
  1. **Custom domain voor Supabase Auth**, bijvoorbeeld `auth.mavix.nl` (betaalde add-on bij Supabase [A]). Daarmee toont Google je eigen domein in plaats van supabase.co.
  2. **Branding op het toestemmingsscherm:** de app-naam "Mavix" en het logo verschijnen pas na merkverificatie door Google.
  3. **App-verificatie** voor scopes. Voor gewoon inloggen met `openid email profile` is dat niet nodig, wel voor de integratiescopes hierboven.
- **Veilig migratieplan (nog niets gewijzigd):**
  1. Activeer het custom domain in Supabase. Het oude `supabase.co`-domein blijft werken.
  2. Voeg in Google Cloud de **nieuwe** redirect-URI `https://auth.<domein>/auth/v1/callback` toe **naast** de oude.
  3. Zet `NEXT_PUBLIC_SUPABASE_URL` en `SUPABASE_URL` op het custom domain en deploy.
  4. Test inloggen met wachtwoord en met Google.
  5. Verwijder de oude redirect-URI pas na een paar weken.
- Een **Google Bedrijfsprofiel** voor Mavix zelf verandert niets aan het inlogscherm.

### Komt Mavix in aanmerking voor een Google Bedrijfsprofiel?
- Google staat profielen toe voor bedrijven met **persoonlijk contact met klanten**: een fysieke locatie of een servicegebied waar je klanten bezoekt.
- Een puur online SaaS-bedrijf zonder klantlocatie **komt doorgaans niet in aanmerking** [A, volgens de richtlijnen van Google].
- Heeft Webbo Solutions een kantoor met openingstijden waar klanten langskomen, dan kan het wel. Gebruik de echte bedrijfsgegevens; verzin geen adres.

---

## 5. SEO en vindbaarheid

- **Gecontroleerd en in orde (live) [B]:**
  - de titel, beschrijving, canonical, Open Graph en gestructureerde gegevens (Organization, WebSite, SoftwareApplication met de echte prijzen);
  - `robots.txt` (app en API uitgesloten) en `sitemap.xml`;
  - `noindex` op login, registratie, aanvragen en de bedankpagina.
- **Verbeterd [B]:**
  - `www.` stuurt permanent door naar het canonieke domein (308). Voorheen gaf `www` dezelfde site met status 200, dus dubbele inhoud.
  - De prijspagina heeft een beschrijvende titel.
  - `/demo` is een nieuwe vindbare pagina en staat in de sitemap.
- **Waarom de site moeilijk te vinden is [A]:**
  - een nieuw subdomein van een ander bedrijf, met weinig externe links;
  - maar 3 indexeerbare pagina's;
  - waarschijnlijk nog niet aangemeld bij Google.
- **Wat jij doet:**
  1. Search Console → eigendom toevoegen. Bij voorkeur een **domeineigendom** via een DNS-TXT-record bij je domeinbeheerder; dat dekt alle subdomeinen.
  2. Dien `https://mavix.webbo-solutions.nl/sitemap.xml` in.
  3. Gebruik URL-inspectie → "Indexering aanvragen" voor `/`, `/pricing` en `/demo`.
  4. Lange termijn:
     - een eigen domein (bijvoorbeeld mavix.nl);
     - pagina's per branche en per functie, zoals "AI voor restaurants" en "Google-reviews beantwoorden";
     - vermeldingen en links vanaf partners (bijvoorbeeld de Telepizza-website);
     - na publicatie van de definitieve juridische teksten: `/legal/*` aan de sitemap toevoegen.
- Er is geen garantie op posities of snelle indexering.

---

## 6. Overig

- **"Mavi" versus "Mavix" [B]:**
  - Alle 124 vermeldingen van "Mavi" in de interface zijn **bewust**: het is de naam van de AI-assistent (avatar `components/mavi.tsx`, "Mavi is je marketingassistent", "Voorstel van Mavi").
  - Die zijn niet aangepast. Wil je de assistent ook "Mavix" noemen, dan is dat een productkeuze. Het gaat om ± 60 teksten in 30 bestanden plus de AI-instructies.
  - Eén inconsistentie om te beslissen: in Content Studio staat "Mavix AI past je tekst aan…" naast "Mavi" elders.
- **Projecten in Mavix Agent:**
  - "Mappen" heet nu "Projecten". Intern blijft het `agent_folders`.
  - Een project ordent **alleen gesprekken**. Het heeft (nog) geen eigen bestanden, instructies, geheugen of gedeelde rechten.
- **Social-kleur:** nu Mavix-paars (#6d28d9). E-mail, Reviews en Google Ads zijn ongewijzigd.

---

## 7. Handmatige acties in volgorde van prioriteit

1. **Voer migratie `202610140001_account_applications.sql` uit** in Supabase. Zonder deze migratie geven de demo- en aanvraagformulieren "Aanvragen is tijdelijk niet beschikbaar".
2. Resend en DNS instellen (§2), en de Supabase Auth-templates en SMTP.
3. Search Console en de sitemap (§5).
4. Google OAuth-toestemmingsscherm, domeinverificatie en de Business Profile API-aanvraag (§3, §4).
5. Meta Business Verification en App Review (§3).
6. Beslissen over het Supabase custom domain voor de Google-login (§4).
7. Beslissen en laten bouwen: online betalen in het aanvraagproces (§1).

## 8. Beslissingen die nog nodig zijn

- Restitutie- en opzegbeleid en de algemene voorwaarden. Online betalen blijft uit tot die zijn vastgesteld.
- Stripe houden of overstappen naar Mollie.
- Gmail lanceren met of zonder het lezen van mails (de restricted scope).
- Of de assistent "Mavi" blijft heten.
- Een contactadres voor klanten: wordt dat `EMAIL_REPLY_TO` en het supportadres in de templates?
