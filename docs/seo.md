# SEO Intelligence

Sidebar: **SEO Intelligence** (`/seo`). Analyses a business website the way a
search engine reads it, measures speed with Google PageSpeed Insights and
optionally shows private Google Search Console data.

Migration: `supabase/migrations/202610110001_seo.sql` (`seo_sites`,
`seo_scans`; adds provider `google_search_console`). RLS: members read their own
workspace; writes server-only.

## Analysis (public audit)

`POST /api/seo/sites/{id}/scans` creates a scan and answers 202; the crawl runs
after the response (`next/server` `after`). The browser polls
`GET /api/seo/scans/{id}` (progress: stage, pages). A scan row with no heartbeat
for 4 minutes counts as interrupted.

Crawler (`src/lib/server/seo.ts`, `crawlSite`):

1. robots.txt first (RFC 9309 groups, MavixBot else `*`, longest match, Allow
   wins ties, wildcards; 5xx = disallow all). If the start page is disallowed,
   no page is fetched.
2. Start page: status, redirects, HTTPS, HSTS, nosniff; http:// → https:// test.
3. XML sitemap (robots.txt references, /sitemap.xml, /sitemap_index.xml,
   /wp-sitemap.xml; one child of an index), same site only, used as seeds.
4. Breadth-first crawl of the same host (www and non-www), skipping files.
5. Link check: internal links not crawled (max 30) and external links (max 15).
   404/410/5xx/DNS = broken; 401/403/405/429/timeouts = not verifiable.

Limits: 10 pages (30 after verification), ≥ 500 ms between requests (or the
crawl-delay, max 5 s), 8 s / 1.5 MB per page, crawl budget 100 s, total 150 s,
10 scans per workspace per 24 h, 5 websites per workspace, one active scan per
website. Every request goes through `safe-fetch.ts`: http(s) on 80/443 only,
all resolved addresses public (no private, loopback, link-local, CGNAT,
metadata), connection pinned to the validated address, redirects re-validated.

Analysed per page: status and redirect chain, title, meta description,
canonical, meta robots / X-Robots-Tag, lang, viewport, H1 and heading order,
images without alt, internal/external links, links without text, JSON-LD and
microdata types (invalid JSON-LD flagged), mixed content, word count, and the
focus keyword (title, H1, description, text).

## Scores

`src/lib/seo/checks.ts`. Each check is a measured share (0-100 %) or "not
measured". Category score = weighted average of its measured checks. Overall =
weighted average of measured categories: technical 30, content 25, performance
20, mobile 10, security 10, accessibility 5. Unmeasured categories are left out
(the others weigh proportionally more). Labelled as a Mavix score, not a Google
score; bands 90/50 like Lighthouse. The dashboard shows every check, its weight
and result ("Hoe berekenen we dit?").

### Completeness (`src/lib/seo/completeness.ts`)

Because unmeasured categories are left out, a site without a PageSpeed result
could show e.g. 91. The dashboard and the printable report therefore show how
much of the score weight was measured ("73% gemeten") and the reasons (the real
PageSpeed error), and call the score "voorlopig" until every category is
measured. Mobile font size and the Lighthouse accessibility score also come
from PageSpeed, so those categories count as "partial" without it. Derived from
the stored report, so it also works for historical scans.

### Page classification (`src/lib/seo/classify.ts`)

Evidence-based kinds: home, page, archive (author/category/tag/date/pagination
/search/feed), sample (WordPress "Hello world!", "Voorbeeldpagina", /test),
legal (privacy, cookies, terms), utility (login, account, cart, checkout),
error. Content checks (titles, descriptions, H1, word count, uniqueness, focus
keyword, canonical, viewport, lang) use the home page and ordinary indexable
pages; a noindex on archive/legal/utility/sample pages counts as deliberate and
is never reported as a problem. All pages stay visible under "Alle pagina's".
Check changes in this version: "H1" passes with one or more H1s (several H1s
are fine for Google); canonical and the 250-word rule are presented as
recommendations; new low-weight check `sample-content` (indexable default or
test pages).

### Action plan

Recommendations are the action plan: highest severity first, with a team status
per item (te doen, bezig, opgelost, genegeerd) stored per website in
`seo_task_states` (migration `202610160001_seo_tasks.sql`; `GET/PUT
/api/seo/sites/{id}/tasks`, any member of the workspace). A status is the team's
note; whether a problem is really gone is shown separately by comparing the
latest analysis with the previous one (`src/lib/seo/compare.ts`: fixed, new,
improved, worse; unmeasured values are never "fixed"). Without the migration the
plan works and the status picker is hidden.

## Google PageSpeed Insights

Mobile and desktop per scan, in parallel with the crawl (Google fetches the
page). Stored: Lighthouse category scores, lab metrics (FCP, LCP, TBT, CLS, SI),
field data (CrUX: LCP, INP, CLS, FCP, TTFB) for the page or, when Google has too
few page visits, the origin, and top opportunities. Failures are stored as
failures; nothing is estimated.

`PAGESPEED_API_KEY` (server-only): without a key Google's shared anonymous quota
is normally exhausted. Confirmed on 16 Oct 2026: an anonymous request answers
429 "Quota exceeded … Queries per day". This is why the dashboard showed
"Niet gemeten" for performance. Set a key: Google Cloud → APIs & Services →
enable "PageSpeed Insights API" → Credentials → API key (restrict it to that
API) → Hostinger environment variable `PAGESPEED_API_KEY` → redeploy. The free
quota with a key is about 25,000 requests per day (Mavix uses 2 per analysis).

Errors are classified (`psiFailure` in `src/lib/seo/psi.ts`): quota, config
(invalid key / API not enabled), page (Google could not load the page),
unavailable/timeout. Only temporary errors (5xx, timeout) are retried once after
3 s; quota and configuration errors are never retried. Nothing is estimated.

## Recommendations

`src/lib/seo/recommendations.ts`: one per failed check with problem, why it
matters, severity (critical/high/medium/low), affected URLs, action and steps.
Ordered by severity. AI alternatives (OpenAI via `src/lib/server/openai.ts`,
metered as `seo_suggest`, Brand Hub context) for titles, meta descriptions and
heading structure via `POST /api/seo/scans/{id}/suggest`; the dashboard shows
the character count against the guideline and whether the focus keyword is in
each suggestion;
the page facts come from the stored scan, website text is treated as untrusted
data, and nothing is changed on the website. Copy buttons for suggestions and
recommendations; CSV export and a printable report (`/seo/rapport/{id}`).

## Verification

Meta tag `<meta name="mavix-site-verification" content="TOKEN">` on the start
page or file `/mavix-verification.txt` containing the token. Unlocks 30 pages
per scan and scheduled scans.

## Scheduled scans

Weekly or monthly per verified website. There is no built-in scheduler on the
hosting: an external cron must call

```
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://mavix.webbo-solutions.nl/api/seo/cron
```

for example every hour (Hostinger hPanel → Advanced → Cron Jobs). Each call
starts at most 3 due scans. Without `CRON_SECRET` the endpoint always refuses.

## Google Search Console (private data)

Provider `google_search_console`, scopes `openid email
https://www.googleapis.com/auth/webmasters.readonly` (read-only), same token
model as the other Google connections (PKCE, single-use state, encrypted
credentials, refresh, reconnect on revoked access).

- Redirect URI: `https://mavix.webbo-solutions.nl/api/integrations/google_search_console/callback`
- Google Cloud: enable "Google Search Console API"; add the scope to the OAuth
  consent screen (sensitive scope → verification before public launch).
- Data: last 7/28/90 days of final data (Google lags ~3 days): clicks,
  impressions, CTR, average position, daily series, top 20 queries and pages.
  Only for properties the connected account can read (domain property matched
  first, then URL prefix; the owner can choose). Fetched live, not stored.
