# Google Business Profile + Google Reviews

One connection (provider `google_business`) powers both the business profile and
Google Reviews. There is no separate Reviews OAuth flow. Google stays the source
of truth for accounts, locations, reviews and replies; Mavix stores only the
encrypted credentials and the chosen account/location.

**Production redirect URI** (register exactly this in the Google OAuth client):

```
https://mavix.webbo-solutions.nl/api/integrations/google_business/callback
```

**Scopes:** `openid`, `email`, `https://www.googleapis.com/auth/business.manage`.

## APIs used

| Purpose | API | Endpoint |
| ------- | --- | -------- |
| Accounts | My Business Account Management API | `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts` |
| Locations | My Business Business Information API | `GET https://mybusinessbusinessinformation.googleapis.com/v1/{account}/locations?readMask=name,title,storefrontAddress,openInfo,metadata` |
| Reviews | Google My Business API (v4) | `GET https://mybusiness.googleapis.com/v4/{account}/{location}/reviews` and `/reviews/{id}` |
| Replies | Google My Business API (v4) | `PUT` / `DELETE .../reviews/{id}/reply` |

## Flow

1. `POST /api/integrations/google_business/connect` (OWNER/ADMIN): PKCE S256,
   single-use state (HttpOnly cookie + hash in `oauth_states`, bound to user,
   workspace, provider and connection generation), `access_type=offline`,
   `prompt=consent`.
2. `GET /api/integrations/google_business/callback`: server-side code exchange;
   requires `business.manage` and a refresh token (reused only for the same
   Google account), verifies the Google account, re-checks membership, stores
   AES-256-GCM encrypted credentials (`OAUTH_ENCRYPTION_KEY`, context
   `workspace_id:google_business`).
3. Location discovery: one usable location is selected automatically; an
   earlier choice is kept when Google still returns it; several locations send
   the user to `/account/integraties?select=google_business` (picker opens).
   Results: `connected=`, `select=`, `error=no_locations|api_access|permission|
   offline_access|denied|expired|failed&provider=google_business`.
4. `POST /api/integrations/google_business/select {account, location}`: IDs are
   format-checked and then looked up live at Google for this connection; only a
   pair Google returns is stored in `metadata` (`account`, `location`,
   `locationTitle`, `locationAddress`).
5. `GET .../status` (any member): status, e-mail and location name only.
   `GET .../locations` (OWNER/ADMIN): live list. `POST .../disconnect`
   (OWNER/ADMIN): clears credentials, scopes, account and location, rotates the
   generation and pending OAuth state. Nothing at Google is deleted; Gmail,
   Google Calendar and Google sign-in are untouched.

Statuses: `disconnected`, `selection_required`, `connected`,
`api_access_required`, `reconnect_required`, `permission_missing`.

## Reviews endpoints

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| GET | `/api/reviews?pageSize=1-50&pageToken=` | Page of reviews (Google `averageRating` and `totalReviewCount` on page 1) |
| GET | `/api/reviews/{id}` | One review |
| PUT | `/api/reviews/{id}/reply` | Create/update reply `{comment}` (max 4096) |
| DELETE | `/api/reviews/{id}/reply` | Delete reply |
| POST | `/api/reviews/{id}/suggest` | AI draft (needs `ANTHROPIC_API_KEY`; never posts) |

All routes resolve the workspace from the session cookie (membership checked
server-side); the location always comes from the stored connection, never from
the browser. Only replies Google accepted are shown.

## Tokens and errors

- Access tokens refresh 60 s before expiry; an omitted refresh token is kept.
  A 401 refreshes once and retries once; `invalid_grant` or a second 401 →
  `reconnect_required`. Network, 429 and 5xx errors never disconnect.
- API access not granted to the Cloud project (quota limit 0,
  `SERVICE_DISABLED`, "API has not been used in project … or it is disabled")
  → `api_access_required` with the message "Google Bedrijfsprofiel is nog niet
  beschikbaar voor dit Mavix-project. API-toegang moet eerst door Google worden
  goedgekeurd." Credentials are kept; the first successful call restores the
  normal status.
- Missing `business.manage` → `permission_missing`. Other 403s (no access to a
  location), 404 (review deleted), 400 (reply rejected) and 429 return Dutch
  messages without provider internals.

## Deployment

No new migration: it uses `integration_connections` and `oauth_states` with
`connection_generation`/`account_email` from
`202610070002_calendar_oauth_hardening.sql`.

Google Cloud (same project and OAuth client as Calendar and Gmail):

1. Request Business Profile API access (Google's "GBP API contact form",
   choose "Application for Basic API Access") for this Cloud project and wait
   for approval. Without it the quota is 0 and Mavix shows
   `api_access_required`.
2. Enable: My Business Account Management API, My Business Business
   Information API and Google My Business API.
3. Check quota in APIs & Services → (API) → Quotas & System Limits: 0
   "requests per minute" means not yet approved; after approval it is 300.
4. Add the redirect URI above and the `business.manage` scope; while in
   Testing, add test users. `business.manage` is a sensitive scope: OAuth app
   verification is needed before public launch.
