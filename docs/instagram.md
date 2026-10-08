# Instagram (Instagram API with Facebook Login)

Instagram DMs reach the Mavix Inbox through **Facebook Login for Business**,
using the existing Meta app. The Instagram professional account (Business or
Creator) must be linked to a Facebook Page the user can manage. Publishing
(posts, Reels) is phase 2; the permission can already be granted.

## Meta configuration

**Facebook Login for Business → Configurations:** the configuration in
`META_INSTAGRAM_CONFIG_ID` must use the token type **User access token**.
Mavix inspects every token with `debug_token` and refuses anything that is not
a `USER` token for this app (for example a System-user token): nothing is
stored and the user sees `error=token_type`; the server logs
`instagram_config_token_type`.

Permissions in the configuration:

| Permission | Why |
| ---------- | --- |
| `instagram_basic` | Account id/username (required) |
| `instagram_manage_messages` | Read and answer DMs (required) |
| `pages_show_list` | Find the linked Page (required) |
| `pages_manage_metadata` | Install the app on the Page for message webhooks (required) |
| `pages_read_engagement` | Recommended (Page data used with the Instagram API) |
| `business_management` | Recommended when the Page lives in a Business Portfolio |
| `instagram_content_publish` | Phase 2 (publishing) |

**Valid OAuth Redirect URIs** (Facebook Login for Business → Settings):

```
https://mavix.webbo-solutions.nl/api/integrations/instagram/callback
```

**Webhooks** (Instagram product, and the Messenger "Instagram settings"):
callback `https://mavix.webbo-solutions.nl/api/webhooks/meta`, verify token
`META_WEBHOOK_VERIFY_TOKEN`, field `messages`.

## Flow

1. `POST /api/integrations/instagram/connect` (OWNER/ADMIN, same origin):
   `https://www.facebook.com/v25.0/dialog/oauth?client_id&config_id&redirect_uri&response_type=code&state`
   (no `scope`: the configuration decides). State: HttpOnly cookie + hash in
   `oauth_states`, bound to user and workspace, single use, 10 minutes.
2. Callback: code → user token (server-side, with the app secret) →
   `debug_token` (valid, this app, type `USER`, required permissions) →
   long-lived user token (60 days) → `GET /me/accounts?fields=id,name,
   access_token,tasks,instagram_business_account{id,username,name}`. Only Pages
   with a linked professional account and the `MESSAGING`/`MANAGE` task count.
3. One account: selected automatically. Several: `select=instagram`, the picker
   on Integraties uses `GET .../accounts` (no tokens) and
   `POST .../select {account}`; the id is looked up again live with this
   workspace's own user token. None: `error=no_instagram_account`, any existing
   connection stays as it was.
4. Selecting: duplicate check (409, see below), `POST /{page-id}/subscribed_apps
   ?subscribed_fields=messages` with the Page token, then storage:
   `provider_account_id` = Instagram account id, `encrypted_credentials`
   (AES-256-GCM, context `workspace_id:instagram`) = Page token + user token,
   `metadata` = `{authMode:"facebook", pageId, pageName, username}`,
   `expires_at` = Meta's `data_access_expires_at`.

## Tokens

The Page token derived from a long-lived user token does not expire by itself.
At `expires_at` (data access expiry) or on Meta error 190/401 the connection
becomes `reconnect_required`; nothing is sent with expired access. Temporary
errors (429, 5xx) never disconnect. Tokens never reach the browser or logs.

## Messaging

- Incoming: webhook `object: "instagram"`, `entry.id` = Instagram account id →
  the single workspace whose active connection has that id. Signed with the
  Meta App Secret (`META_CLIENT_SECRET`); `INSTAGRAM_APP_SECRET` is also
  accepted for Instagram events so older Instagram Login connections keep
  working. Unknown, disconnected or (legacy) duplicate accounts: not stored.
- Reply: `POST https://graph.facebook.com/v25.0/{page-id}/messages` with the
  Page token, `{recipient:{id:IGSID}, messaging_type:"RESPONSE",
  message:{text}}`. Meta allows replies within 24 hours of the customer's last
  message.
- Contact name: `GET https://graph.facebook.com/v25.0/{IGSID}?fields=name,username`.

## One account per workspace

`supabase/migrations/202610080002_instagram_unique_account.sql`: partial unique
index on the Instagram account id for active connections. It first lists any
existing duplicates and stops without changing data. Connecting an account that
is active elsewhere returns 409 "Dit Instagram-account is al gekoppeld aan een
andere Mavix-werkruimte. Ontkoppel het daar eerst."

## Environment (Hostinger)

| Variable | Value |
| -------- | ----- |
| `META_CLIENT_ID` | Meta App ID |
| `META_CLIENT_SECRET` | App Secret of that app |
| `META_INSTAGRAM_CONFIG_ID` | Configuration id (User access token type) |
| `META_WEBHOOK_VERIFY_TOKEN` | As for WhatsApp |
| `OAUTH_ENCRYPTION_KEY` | Already set |

`INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` are not needed. If
`INSTAGRAM_APP_ID` is set and `META_INSTAGRAM_CONFIG_ID` is not, new
connections use the older Instagram Login flow.

## Meta limitations

- Development mode: only people with a role on the app can connect, and
  webhooks are only sent for them. Other customers need App Review (Advanced
  Access) for each permission and, for Instagram messaging, a verified business.
- Instagram app setting "Allow access to messages" (Settings → Messages →
  Connected tools) must be on.
- No first messages to people who did not write first; 24-hour reply window.
