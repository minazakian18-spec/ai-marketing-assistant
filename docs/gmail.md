# Gmail integration

Gmail is a separate Mavix integration (provider key `gmail`). Signing in with
Google never grants Gmail access: the customer connects Gmail explicitly under
Integraties. Gmail threads appear in the existing unified Inbox under the
E-mail filter; there is no separate Gmail inbox.

**Production redirect URI** (register exactly this in the Google OAuth client):

```
https://mavix.webbo-solutions.nl/api/integrations/gmail/callback
```

## Scopes

`openid`, `email`, `https://www.googleapis.com/auth/gmail.readonly`,
`https://www.googleapis.com/auth/gmail.send`. No Calendar scopes, no full
mailbox access. `gmail.modify` is not requested: marking mail read/archived in
Gmail itself is not implemented (unread state is tracked inside Mavix).

## Flow and security

- Connect (OWNER/ADMIN): `POST /api/integrations/gmail/connect` returns the
  Google URL. OAuth state: 32 random bytes, HttpOnly cookie plus SHA-256 hash in
  `oauth_states`, bound to user, workspace, provider and connection generation;
  consumed once. PKCE S256, `access_type=offline`, `prompt=consent`.
- Callback `GET /api/integrations/gmail/callback`: exchanges the code
  server-side, requires both Gmail scopes and a refresh token, verifies the
  Google account (`email_verified`), re-checks membership, then stores the
  connection. Errors return to `/account/integraties?error=denied|permission|
  offline_access|expired|failed&provider=gmail` (never a raw error page).
- Storage: one `integration_connections` row per workspace: account ID, e-mail,
  connecting user, granted scopes, status, expiry, metadata and the credentials
  encrypted with AES-256-GCM (`crypto.ts`, `OAUTH_ENCRYPTION_KEY`, authenticated
  data `workspace_id:gmail`). Tokens are never returned to the browser or logged.
- Refresh: access tokens are refreshed 60 s before expiry; an omitted refresh
  token is preserved; a Google 401 refreshes once and retries once.
  `invalid_grant` or a second 401 marks `reconnect_required`; missing scopes mark
  `permission_missing`. Network, quota and 5xx failures never disconnect.
  Credential writes compare the connection generation and previous ciphertext,
  so a stale refresh cannot restore a disconnected or replaced connection.
- Tenancy: every route resolves the workspace from the session cookie via
  `workspace()` (membership checked server-side); a workspace ID from the
  browser is never trusted. Gmail is a shared team mailbox: all members of the
  workspace may read and answer it, like the rest of the Inbox.
- Disconnect (OWNER/ADMIN): clears credentials, account and scopes, rotates the
  generation, deletes pending OAuth state and the Gmail sync cursor. Nothing is
  deleted in Gmail; Google Calendar and Google sign-in are untouched. Cached
  Inbox conversations of a disconnected (or previously connected) mailbox are
  hidden, not deleted.

## Inbox sync

- Polling, not real-time: when the Inbox opens, every 60 s while it is visible
  and when the window regains focus (`POST /api/inbox/sync`, throttled to once
  per 25 s per workspace and serialised with a database lease).
- First sync: recent inbox mail (30 days, at most 100 messages, without the
  promotions/social/forums tabs). After that: incremental Gmail History API.
- "Oudere e-mails laden": `POST /api/inbox/gmail/backfill` imports the next page
  (50 messages) using Gmail's `nextPageToken`, stored in the connection metadata.
- Messages are stored as plain text: HTML mail is converted server-side, so no
  e-mail HTML (scripts, tracking pixels) is ever rendered in Mavix.
- Attachments: metadata is shown; downloads go through the authenticated proxy
  `GET /api/inbox/attachments/{messageId}/{index}`.

## Endpoints

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| POST | `/api/integrations/gmail/connect` | Start OAuth (returns `{url}`) |
| GET | `/api/integrations/gmail/callback` | OAuth callback |
| GET | `/api/integrations/gmail/status` | `{connected, accountEmail, status, lastSyncedAt}` |
| POST | `/api/integrations/gmail/disconnect` | Disconnect |
| POST | `/api/inbox/sync` | Incremental sync |
| POST | `/api/inbox/gmail/backfill` | Next page of older mail |
| POST | `/api/inbox/gmail/send` | New e-mail `{to, subject, body}` |
| POST | `/api/inbox/{id}/messages` | Reply in the same Gmail thread |
| GET | `/api/inbox/gmail/threads` | Live thread list (`q`, `pageToken`, `pageSize` ≤ 50) |
| GET | `/api/inbox/gmail/threads/{threadId}` | Live thread detail |
| POST | `/api/inbox/gmail/threads/{threadId}/reply` | Live reply |

Replies use the Gmail `threadId` plus `In-Reply-To`/`References` of the last
message, the original subject (`Re:`) and the Reply-To or sender address.
Header values are stripped of line breaks; addresses are validated server-side.

## Deployment

1. Supabase SQL Editor, in order, skipping what already ran:
   `202610050001_inbox.sql`, `202610070002_calendar_oauth_hardening.sql`,
   `202610070003_gmail_sync_lease.sql` (idempotent).
2. Google Cloud (same project/OAuth client as Calendar): enable the Gmail API,
   add the redirect URI above, add the two Gmail scopes on the consent screen
   (Data access), and while in Testing add each test account as a test user.
3. Hostinger: no new variables. `APP_URL`, `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET` and `OAUTH_ENCRYPTION_KEY` must be set.

`gmail.readonly` is a restricted scope: before offering Gmail to arbitrary
customers the app needs Google OAuth verification including the restricted-scope
security assessment. Until then only listed test users can connect.
