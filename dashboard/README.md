# Sales & Ads dashboard: Swiss Citizen + Swiss Gymi

A lightweight dashboard for both products: plain HTML, CSS and JS, no build step, no libraries.
Hosted on Netlify (project `swiss-sales-dashboard`). The analysis it is based on is in [ANALYSIS.md](ANALYSIS.md).

```
Browser (Netlify, static)  ──Bearer token──▶  Supabase edge fn  sales-dashboard  (swiss-citizen project)
                                         └──▶  Supabase edge fn  gymi-dashboard   (swiss-gymi project)
Google Ads Script (daily) ──ingest token──▶  sales-dashboard/ingest  → public.ad_spend
```

- The functions return **aggregates only**: no emails, no names. SQL lives in `dashboard_citizen()` / `dashboard_gymi()`. These are `security definer` functions that only `service_role` can execute.
- Tokens are never stored. `public.dashboard_access` holds their SHA-256 hashes. The **dashboard token** reads everything and can import a CSV. The **ingest token** can only write ad stats.
- CORS only allows `https://swiss-sales-dashboard.netlify.app` (plus localhost). To change that, set `DASHBOARD_ORIGINS` on the functions.

## What it shows
- **Alerts:** days since the last sale, traffic drops, ads above break-even cost per click, weak French paywall, open Gymi reports, missing or stale ad data.
- **Swiss Citizen:** revenue, sales, visits, visit-to-sale rate, revenue per visit, ad spend and return on ad spend (ROAS), break-even cost per click; daily revenue; daily visits split into Google Ads and other; funnel; per-campaign Google Ads table; language table; traffic sources.
- **Swiss Gymi:** sales, revenue (needs a Stripe key), trial opens, open-to-start rate, families, open reports, trial funnel, Google Ads; days until the ZAP exam.
- 7, 30 and 90 day views, each compared with the previous period of the same length. Supports light and dark mode.

## Google Ads data (pick one)
1. **Google Ads Script (recommended):** `google-ads-script.js`. In Google Ads, go to Tools → Bulk actions → Scripts → +, paste the file, insert the ingest token, click Authorize → Preview → Save, and set it to run daily at 06:00. The first run loads 90 days.
2. **CSV:** on the dashboard, use "Import a Google Ads CSV export". Download a campaign report segmented by Day; English, German and French exports all work.

Campaign → product mapping is by name: *Gymi / ZAP / Mathe* → Swiss Gymi; *Citizen / Einbürgerung / naturalisation* → Swiss Citizen. Anything else counts as "other".

## Optional: real Stripe checkout numbers
Create a Stripe **restricted key** with only *Checkout Sessions: Read*, and store it as the edge function secret `STRIPE_READ_KEY` in the swiss-citizen Supabase project. The dashboard then shows how many checkouts were opened, completed and abandoned for both products, and Swiss Gymi revenue.

## Development
```
node --test test/*.mjs        # handler + CSV parser tests
```
To change the functions, edit `functions/*/handler.js` and redeploy them with the Supabase MCP or CLI (`verify_jwt = false`; the functions do their own token check).

## Rotating the tokens
Generate a new random token, then run
`update public.dashboard_access set token_hash = encode(sha256('<token>'::bytea), 'hex')` in **both** projects
(for the ingest token, set `ingest_hash` in swiss-citizen only).
