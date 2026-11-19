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
| Google Ads | – (module in voorbereiding) | Google Ads API developer token, OAuth-scope `adwords` | Google Ads API-toegang (Basic access) |

WhatsApp, Facebook Messenger en TikTok zijn op 19 november 2026 uit Mavix verwijderd (zie docs/OVERDRACHT.md).

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
