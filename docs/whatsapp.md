# WhatsApp Business (Cloud API)

WhatsApp messages arrive in the Mavix Inbox through the shared Meta webhook.
A workspace connects one number with its Phone Number ID, WhatsApp Business
Account ID (WABA ID) and a system-user token (Embedded Signup is not built yet).

## Meta webhook

| Field in Meta | Value |
| ------------- | ----- |
| Callback URL | `https://mavix.webbo-solutions.nl/api/webhooks/meta` |
| Verify Token | the value of `META_WEBHOOK_VERIFY_TOKEN` |
| Webhook field | `messages` (WhatsApp Business Account) |

- `GET` handshake: `hub.mode=subscribe` and a matching `hub.verify_token`
  (constant-time compare) echo `hub.challenge` as text/plain; otherwise 403.
  Without `META_WEBHOOK_VERIFY_TOKEN` the endpoint answers 503.
- `POST`: `X-Hub-Signature-256` (HMAC-SHA256 of the raw body) must match
  `META_CLIENT_SECRET`, the App Secret of the Meta app that holds the WhatsApp
  product. Invalid or missing signature → 401, invalid JSON → 400, body over
  1 MB → 413, secret not configured → 503 (Meta retries). Valid deliveries get
  200 immediately and are processed afterwards. Logs contain event names and
  variable names only, never secrets or message content.
- Instagram, Messenger and WhatsApp share this endpoint; Instagram events are
  signed with `INSTAGRAM_APP_SECRET`.

## Environment (Hostinger)

| Variable | Purpose |
| -------- | ------- |
| `META_CLIENT_SECRET` | Meta App Secret: webhook signatures (WhatsApp, Messenger) |
| `META_WEBHOOK_VERIFY_TOKEN` | Random string, also entered in the Meta webhook settings |
| `OAUTH_ENCRYPTION_KEY` | Encrypts the stored WhatsApp token (already set) |
| `META_GRAPH_VERSION` | Optional, default `v25.0` |

If one is missing, connecting answers 503 with a generic Dutch message and the
server logs `whatsapp_not_configured` with the missing variable names.

## Connecting a number

`POST /api/integrations/whatsapp/connect` (OWNER/ADMIN, same origin):

1. IDs and token are format-checked.
2. Ownership: `GET /{wabaId}/phone_numbers` with the supplied token must list
   the Phone Number ID. Otherwise 400; nothing is subscribed or stored.
3. Uniqueness: a number that is active (not `disconnected`) in another
   workspace → 409 "Dit WhatsApp-nummer is al gekoppeld aan een andere
   Mavix-werkruimte. Ontkoppel het daar eerst." The unique index from
   `supabase/migrations/202610080001_whatsapp_unique_number.sql` enforces this
   under concurrent requests (also 409).
4. `POST /{wabaId}/subscribed_apps`, then the token is stored AES-256-GCM
   encrypted (context `workspace_id:whatsapp`).

Temporary Meta errors (429, 5xx) are reported as temporary, not as wrong IDs.

## Routing and isolation

Incoming events are routed by `metadata.phone_number_id` to the workspace whose
connection has that number with status `connected` or `permission_missing`.
Unknown or disconnected numbers are dropped. Should an old duplicate still
exist, the event is delivered to no workspace (`inbox_webhook_ambiguous_account`).

## Deployment checklist

1. Run `202610080001_whatsapp_unique_number.sql` in the Supabase SQL editor. It
   stops with a list if a number is already active in more than one workspace;
   resolve by disconnecting it there and run it again. It never deletes data.
2. Set the environment variables above and redeploy.
3. Meta app → WhatsApp → Configuration: Callback URL and Verify Token as above,
   "Verify and save", subscribe to `messages`.
4. In Mavix: Integraties → WhatsApp Business → enter Phone Number ID, WABA ID
   and a system-user token with `whatsapp_business_messaging` and
   `whatsapp_business_management`.
