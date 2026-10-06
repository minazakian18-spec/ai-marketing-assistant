# Google Calendar backend

This integration reuses Supabase Auth, `workspace_members`, the active workspace
cookie and the generic `integration_connections` / `oauth_states` tables.
Provider key: `google_calendar`. Google remains the source of
truth; events are fetched for the requested date range and are not persisted.
Existing optional marketing-content mirroring keeps only event mappings, hashes,
sync cursors and watch-channel metadata.

**Production redirect URI** (register exactly this in the Google OAuth client):

```
https://mavix.webbo-solutions.nl/api/integrations/google_calendar/callback
```

## Deployment

1. Apply existing migrations in order, then
   `supabase/migrations/202610070002_calendar_oauth_hardening.sql` before deploying
   the new backend. It adds `account_email`, a connection generation UUID, and
   the matching generation on OAuth state records. RLS and revoked browser
   grants protect both tables. Existing provider support is preserved (Gmail,
   Business Profile, Instagram, Messenger and WhatsApp).
2. Configure the server environment on Hostinger:
   - `APP_URL=https://mavix.webbo-solutions.nl`
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for the integration OAuth client
   - `OAUTH_ENCRYPTION_KEY`: 32 cryptographically random bytes, base64 encoded
   - Existing `NEXT_PUBLIC_SUPABASE_URL`,
     `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
     All variable names already exist in `.env.example`; no new variables were added.
     Never prefix OAuth credentials or the encryption key with `NEXT_PUBLIC_`.
3. Add this **exact authorized redirect URI** to the Google OAuth web client:

   `https://mavix.webbo-solutions.nl/api/integrations/google_calendar/callback`

   Keep the existing Supabase Google sign-in callback registered and unchanged.
   Local development uses `APP_URL` plus the same callback path, registered
   separately in Google Cloud.

4. Configure the Google consent screen for the intended production audience and
   complete Google's applicable verification. Google OAuth apps left in external
   Testing mode generally issue seven-day refresh tokens for Calendar access.
   See [Google's OAuth documentation](https://developers.google.com/identity/protocols/oauth2#expiration).
5. Run the live acceptance checks below with a test workspace/account after deployment.

## Scopes and OAuth

Requested scopes are exactly:

- `openid` and `email` to identify the connected Google account
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
- `https://www.googleapis.com/auth/calendar.events`

These allow subscribed-calendar listing and event read/create/update/delete.
No Gmail or Business Profile access is requested. See
[Google's scope definitions](https://developers.google.com/workspace/calendar/api/auth).

Start requests require authenticated OWNER/ADMIN membership in a non-deleted
workspace. A workspace ID in a request body/query is never used as authorization.
The selected workspace cookie is checked against `workspace_members` server-side.
POST requires the configured application Origin; GET start requires same-origin
Fetch Metadata or Origin. The callback independently rechecks membership.

State uses 32 random bytes, a ten-minute HttpOnly/Secure/SameSite=Lax cookie and a
SHA-256 hash in Postgres, bound to user, workspace, provider and connection
generation. Atomic DELETE RETURNING consumes the state once. Authorization uses
PKCE S256; code exchange and Google account verification happen server-side.
All callback responses are no-store/no-referrer redirects or sanitized errors.
Code exchange failure requires restarting consent; consumed state cannot be replayed.

Offline access and consent are requested. A successful callback must have both
Calendar scopes and a refresh token. If Google omits the refresh token, an
existing one can be reused only for the same provider account. A different
Google account never inherits a previous account's token or mirror settings.
The callback never reports success before credentials are persisted.

## Storage, encryption and refresh

`integration_connections` has one row per workspace/provider. It stores account
ID/email, connecting user, granted scopes, status, expiry, metadata and an
encrypted JSON credential envelope. The existing `crypto.ts` helper uses
AES-256-GCM, a fresh random 12-byte IV, and the environment's 32-byte key.
Authenticated additional data binds ciphertext to `workspace_id:google_calendar`.
Access and refresh tokens are never selected into frontend response objects.
Keep the encryption key backed up; replacing it without re-encrypting stored
credentials requires reconnecting affected integrations.

Before Calendar calls, access tokens expiring within 60 seconds are refreshed.
Refresh responses retain the existing refresh token unless Google rotates it.
A Google 401 triggers one refresh and one retry; a second 401 marks reconnect
required. `invalid_grant` also marks reconnect required. Temporary network,
rate-limit or configuration failures do not incorrectly revoke the connection.
Google requests have a 15-second timeout. Errors are mapped to safe messages;
provider payloads, authorization codes and tokens are not logged.

Credential writes compare the connection generation and previous ciphertext.
This prevents an old refresh from overwriting a newer connection or restoring a
disconnected one. Callback writes also compare the generation captured when
consent started. No process-local lock is relied upon, so guards work across
Hostinger server instances. Concurrent refresh requests may contact Google more
than once; only a matching credential version can be saved.

Calendar data retains the existing personal-access rule: only the user who
connected Calendar can read/write its events, after workspace membership is
validated. Other workspace members receive 403 for calendars/events. Owners and
admins can manage/reconnect/disconnect the workspace integration.

Disconnect stops watch channels where possible, removes sync state/mappings,
clears credentials/account metadata, changes the connection generation and
invalidates pending OAuth state. It does not delete events from Google. It is a
local disconnect: it does not call Google's grant-wide revocation endpoint,
which could revoke other Google integrations using the same OAuth client.
Users can separately revoke app access in their Google account if desired.

## Frontend API contract

Use existing underscore-provider routes. `google-calendar` is also accepted as
an alias for integration actions; the registered callback always uses the underscore.
All requests use the existing session cookies; mutation requests must be same-origin.

| Method | Endpoint                                               | Behavior                                                               |
| ------ | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| POST   | `/api/integrations/google_calendar/connect`            | Returns `{url}`; navigate browser to it                                |
| GET    | `/api/integrations/google_calendar/connect`            | Same-origin navigation redirects to Google                             |
| GET    | `/api/integrations/google_calendar/callback`           | OAuth callback; not called manually                                    |
| GET    | `/api/integrations/google_calendar/status`             | `{connected, accountEmail, status, mine?, settings}`                   |
| GET    | `/api/integrations/google_calendar/calendars`          | `{calendars:[{id,summary,color,accessRole,primary}]}`                  |
| GET    | `/api/calendar`                                        | Existing combined status/settings/calendars contract retained          |
| GET    | `/api/calendar/events?start=...&end=...&calendars=...` | `{events}` for RFC3339 range; comma-separated IDs or `primary`         |
| POST   | `/api/calendar/events`                                 | `{calendarId,input}` → `{event}`                                       |
| PATCH  | `/api/calendar/events`                                 | `{calendarId,eventId,scope,input,etag?,targetCalendarId?}` → `{event}` |
| DELETE | `/api/calendar/events`                                 | `{calendarId,eventId,scope}` → `{ok:true}`                             |
| POST   | `/api/integrations/google_calendar/disconnect`         | `{ok:true}`                                                            |

`scope` for event editing is `this`, `following` or `all` (recurring events).
The existing event input shape is:

```json
{
  "title": "Meeting",
  "description": "Optional",
  "location": "Optional",
  "allDay": false,
  "startDate": "2026-10-10",
  "startTime": "10:00",
  "endDate": "2026-10-10",
  "endTime": "11:00",
  "timeZone": "Europe/Amsterdam",
  "reminder": "default",
  "repeat": null,
  "attendees": []
}
```

Times are optional for all-day events; all-day `endDate` is inclusive in this
frontend contract. `reminder` accepts `default`, `none`, or minutes.
`repeat` accepts `{freq:"DAILY"|"WEEKLY"|"MONTHLY"|"YEARLY",interval:1}`.
Range must be increasing and at most 100 days, with at most 20 calendar IDs.
Calendar listing follows pagination. An event range exceeding 1,000 results per
calendar returns 422 requesting a narrower range, never silently truncated data.

Status reflects the persisted connection state, not a live health probe on
every status request. Expiration alone is refreshed on use. Revoked consent is
detected on the next Google API/refresh request. `connected` is false for another
member's personal connection, missing credentials or missing required scopes.

Errors: 400 invalid input/state; 401 no session; 403 membership/ownership/Google
permissions; 404 calendar/event not found; 409 reconnect or concurrent change;
422 too many results; 429 rate limit; 502/503 provider/configuration/database
failure. Responses contain only a safe `error` message. Callback consent errors
redirect to `/calendar?calendar_error=denied|permission|offline_access`.

## Validation

Local verification: production `npm run build` passed; `npm run typecheck`
passed; targeted ESLint on Calendar services and the event route passed;
`npm test` passed all 87 tests, including 19 Calendar backend/login tests.
The migration has not been applied to a live database and this change has not
been deployed. Live consent/API acceptance checks remain to be performed.

`npm test` includes mocked tests executing the real route/service modules for
OAuth start/callback/state replay and expiry, encryption, missing scopes/offline
tokens, token refresh/revocation/retry, concurrent disconnect guards, membership,
CSRF, pagination, event CRUD, safe errors, disconnect and existing Google login.
The tests mock Supabase and Google; they do not claim to exercise a live database
or an actual Google consent grant.

After applying the migration and deploying, use a test account to sign in with
the existing Google login, connect Calendar, list calendars and a date range,
create/edit/delete a disposable event, verify refresh after token expiry, revoke
consent in Google and verify reconnect behavior, reconnect, then disconnect.
Also verify a second workspace/member cannot read the first account's events.
Do not exercise CRUD against customer calendars during deployment validation.

## Changed files

- `src/lib/server/calendar-oauth.ts` — dedicated Calendar OAuth and integration actions
- `src/lib/server/calendar-credentials.ts` — token validation, refresh and guarded credential updates
- `src/lib/server/calendar.ts` — status, ownership, retries, pagination and cleanup hardening
- `src/lib/server/integrations.ts` — delegate Calendar token access to the hardened service
- `src/app/api/integrations/[provider]/[action]/route.ts` — Calendar action dispatch and alias
- `src/app/api/calendar/events/route.ts` — authenticated range requests and input validation
- `supabase/migrations/202610070002_calendar_oauth_hardening.sql` — metadata and lifecycle generation fields
- `tests/calendar-backend.test.mjs` — backend and login regression tests
- `tests/helpers/server-loader.mjs` — mocked boundary test harness
- `docs/google-calendar.md` — deployment, security and API documentation

Frontend (uses only the endpoints above; never calls Google from the browser):

- `src/components/account/google-calendar-card.tsx` — Integrations card: loading, not connected, connecting, connected (email, Beheren, Ontkoppelen with confirmation), team member, reconnect/permission and load-error states
- `src/app/(app)/account/integraties/page.tsx` — renders that card for Google Agenda
- `src/app/(app)/calendar/page.tsx` — calendar loading/empty states, reconnect banner, event-load error with retry, consent-error notices
- `src/components/calendar/event-editor.tsx` — calendar choice grouped into Mavix and the connected Google account (writable calendars only)
