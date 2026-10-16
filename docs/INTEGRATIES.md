# Integraties en externe inrichting

Stand: oktober 2026 (fase 4 en 5). Per koppeling staat hier wat de klant doet, wat
Mavix als platformeigenaar moet inrichten, en wat van een externe goedkeuring afhangt.
In de app toont `/account/integraties` dit per werkruimte (bovenaan, "Status van je
koppelingen", via `GET /api/integrations/health`).

## Overzicht

| Koppeling | Klant | Platformeigenaar (Mavix) | Externe goedkeuring |
|---|---|---|---|
| Gmail | Eén klik "Koppelen", Google-toestemming geven | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OAUTH_ENCRYPTION_KEY`; redirect-URI in Google Cloud | Google OAuth-verificatie voor `gmail.readonly`/`gmail.send` (restricted scopes) |
| Google Agenda | Eén klik, toestemming | idem | OAuth-verificatie (sensitive scope) |
| Google Bedrijfsprofiel | Eén klik, daarna locatie kiezen | idem | Toegang tot de Business Profile API (aanvraag bij Google); tot dan status "Wacht op toegang van Google" |
| Google Search Console | Eén klik, property kiezen in SEO | idem | OAuth-verificatie |
| Instagram (berichten) | Koppelen via Facebook Login for Business, account kiezen | `META_CLIENT_ID`, `META_CLIENT_SECRET`, `META_INSTAGRAM_CONFIG_ID`, `META_WEBHOOK_VERIFY_TOKEN` | Meta App Review voor `instagram_manage_messages` e.a. |
| Instagram (publiceren, fase 4) | Na goedkeuring één keer opnieuw koppelen | `instagram_content_publish` toevoegen aan de Login-configuratie (of `INSTAGRAM_PUBLISH_SCOPE=1` bij Business Login for Instagram) | Meta App Review voor `instagram_content_publish` |
| Instagram (bereik/interacties) | – | `instagram_manage_insights` aanvragen | Meta App Review; nog niet aangevraagd |
| Facebook Messenger | Koppelen, pagina kiezen | `META_CLIENT_ID`, `META_CLIENT_SECRET` | Meta App Review voor `pages_messaging` |
| WhatsApp Business | Nu: technisch beheerder vult Phone Number ID, WABA ID en systeemgebruiker-token in | `META_CLIENT_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` | zie hieronder |
| Google Ads | – (module in voorbereiding) | Google Ads API developer token, OAuth-scope `adwords` | Google Ads API-toegang (Basic access) |

## WhatsApp: wat Embedded Signup vraagt

Een klantvriendelijke "koppel met één klik"-flow voor WhatsApp is Meta's
**Embedded Signup**. Dat vraagt aan de kant van Mavix:

1. Mavix-app als **Tech Provider** (of Solution Partner) bij Meta, met
   **bedrijfsverificatie** van de eigenaar van de app.
2. App Review voor `whatsapp_business_management` en `whatsapp_business_messaging`.
3. Een **Facebook Login for Business-configuratie** voor WhatsApp Embedded Signup
   (configuratie-ID) en de Facebook JavaScript SDK op de integratiepagina.
4. Server-side: de `code` uit de popup omwisselen voor een business-token, het
   WABA- en telefoonnummer-ID uit de sessie-events opslaan, het nummer registreren
   (`/register` met pin) en de app op de WABA abonneren (`subscribed_apps`).
5. Facturatie: per WABA een betaalmethode (door de klant in Meta, of via Mavix als
   Solution Partner met eigen kredietlijn).

Tot dat rond is, blijft de huidige handmatige koppeling (versleuteld opgeslagen
token, gecontroleerd tegen de WABA) beschikbaar onder "Bekijken" bij WhatsApp,
met uitleg voor een technisch beheerder. De klant ziet niets van ontwikkelaarsinstellingen
tenzij hij die stap opent.

## Fase 4: verzenden, publiceren en automatiseren

| Variabele | Doel |
|---|---|
| `EMAIL_API_KEY` | Resend API-sleutel (al in gebruik voor accountmail) |
| `EMAIL_MARKETING_FROM` | Afzender op een **geverifieerd verzenddomein**, bijv. `Naam <nieuwsbrief@mail.domein.nl>`; zonder dit geen testmails of campagnes |
| `EMAIL_MARKETING_ENABLED=1` | Schakelaar voor echte campagnes (testmails werken zonder) |
| `RESEND_WEBHOOK_SECRET` | `whsec_…` voor `/api/webhooks/resend` (afgeleverd, bounces, klachten, opens, kliks) |
| `CRON_SECRET` | Planner: Hostinger-cron elke 5 minuten `POST /api/automation/cron` met `Authorization: Bearer …` |
| `INSTAGRAM_PUBLISHING=off` | Noodschakelaar om publiceren uit te zetten |

Migraties die in Supabase moeten draaien (in volgorde):
`202610170001_agent_actions_projects.sql`, `202610180001_publishing_sending_automation.sql`.
