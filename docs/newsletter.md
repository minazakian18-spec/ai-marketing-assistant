# Newsletter signups and Contacts

Visitors subscribe through a Mavix signup form (hosted page or HTML embedded on
the business website). Every signup is stored per workspace with consent
evidence and merged into Contacts automatically.

Migration: `supabase/migrations/202610100001_newsletter.sql` (tables
`newsletter_forms`, `newsletter_subscribers`, `newsletter_consent_events`,
`email_suppressions`; RLS: members read their own workspace, writes server-only).

## Forms

Contacts → **Aanmeldformulieren** (OWNER/ADMIN): consent text, privacy policy
URL and version, allowed websites (exact origins; empty = any), own thank-you
page, double opt-in, active. Each form has a random public key.

- Hosted page: `https://mavix.webbo-solutions.nl/nieuwsbrief/<key>`
- Embed: plain HTML form posting to `/api/newsletter/subscribe` (no script).
- JSON: `POST /api/newsletter/subscribe` `{form, email, name?, consent: true}`
  with CORS; answers `{ok, status}`.

Validation: e-mail, explicit consent checkbox (required), hidden honeypot field
`website`, allowed origin, rate limits per IP hash (10/min) and per form
(120/min). The response never reveals whether an address was already known.

## Consent and compliance

- A subscriber only exists after an explicit opt-in on a form. Receiving an
  e-mail, a customer relation or an import never creates consent. Imported and
  manually added contacts are "Niet bevestigd" unless the user confirms consent.
- Consent events store the exact consent text, privacy policy version and URL,
  page URL, method, time, user agent and a keyed hash of the IP (never the IP).
- Double opt-in (needs `EMAIL_API_KEY` + `EMAIL_FROM`, Resend): status
  `pending`; the e-mail links to `/nieuwsbrief/bevestigen` where a button
  confirms (link scanners cannot). Token: random, stored hashed, 7 days, single
  use. Without e-mail configuration double opt-in cannot be enabled.
- Unsubscribe link: `/nieuwsbrief/afmelden?token=<id>.<mac>` (button, POST),
  plus RFC 8058 one-click (`POST /api/newsletter/unsubscribe?token=…`, body
  `List-Unsubscribe=One-Click`). Tokens are MACs (key derived from
  `OAUTH_ENCRYPTION_KEY`) and do not expire.
- Suppression list: keyed hash of the normalized address. Added on unsubscribe,
  on "Uitgeschreven" in Contacts and on erasure; lifted only by a new explicit
  opt-in on a form. Contacts cannot be set back to "Ingeschreven" while
  suppressed (409).
- GDPR erasure (Contacts → Toestemming bekijken → Gegevens wissen): deletes the
  subscriber and its consent records; only the hashed suppression stays.

## Contacts synchronisation

When the workspace loads (`GET /api/workspace`), subscriber changes not yet
merged (`synced_at` null) are merged into the stored contacts with the normal
optimistic version check: same normalized e-mail → existing contact updated
(status + newsletter details), otherwise a new contact (source `newsletter`,
group "Nieuwsbrieflezers"). Contacts shows the segment **Nieuwsbriefabonnees**.
If the tables are missing or anything fails, the workspace loads unchanged.

## External newsletter services

Mailchimp, Brevo and similar services are not connected: their signups do not
reach Mavix. `subscribe()` in `src/lib/server/newsletter.ts` is the single entry
point (with `source`), so an adapter for a provider webhook can reuse it.
Sending newsletters from Mavix is not live yet; use `unsubscribeUrl()` for the
link in every e-mail once it is.
