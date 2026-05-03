---
name: google-ads-api
description: Google Ads REST API v17 integration for cloudless.gr — campaigns, ad groups, ads, GAQL search queries, and metrics. Use when working with src/lib/campaigns/google-ads.ts, scripts/google-ads-setup.ts, or /api/admin/campaigns/google.
---

# Google Ads API — cloudless.gr Skill

## Overview

Server-side Google Ads integration for the Marketing Hub. The app does NOT
use the official Node SDK — it talks REST + GAQL directly so it stays Lambda-friendly
and avoids the protobuf footprint.

**Implementation:**
- `src/lib/campaigns/google-ads.ts` — REST + GAQL client
- `scripts/google-ads-setup.ts` — first-run OAuth/customer-id wiring
- `src/app/api/admin/campaigns/google/route.ts` — admin route
- `src/app/[locale]/admin/campaigns/google/page.tsx` — UI

**Base URL:** `https://googleads.googleapis.com/v17`
**Auth:** Service-account JWT bearer (NOT user OAuth — see auth section below)
**Required scope:** `https://www.googleapis.com/auth/adwords`

## Auth — service-account JWT flow

The app uses the **same Google service account** for Calendar + GSC + Ads. There
is no static `GOOGLE_ADS_ACCESS_TOKEN` — tokens are minted at runtime by signing
a JWT and exchanging it at `https://oauth2.googleapis.com/token`. Cached
in-process for ~1h.

Required env / SSM:

```
GOOGLE_CLIENT_EMAIL          shared service account
GOOGLE_PRIVATE_KEY           PEM, with literal "\n" — replace before signing
GOOGLE_ADS_DEVELOPER_TOKEN   from Ads -> Tools & Settings -> API Center
GOOGLE_ADS_CUSTOMER_ID       no dashes, e.g. 1234567890
```

The service account email **must be added as a user to the Google Ads MCC**
(or the customer account directly) with at least Standard access. Setup is
in `scripts/google-ads-setup.ts`.

## Required headers (every request)

```
Authorization:        Bearer {minted access token}
developer-token:      {GOOGLE_ADS_DEVELOPER_TOKEN}
login-customer-id:    {GOOGLE_ADS_CUSTOMER_ID, no dashes}
Content-Type:         application/json
```

Skip ANY header → 400/401. The lib's `gadsFetch` injects all four — never
inline a `fetch` to googleads.googleapis.com.

## GAQL — Google Ads Query Language

Almost all reads go through `googleAds:search`. GAQL looks like SQL but has
strict rules.

```
POST /v17/customers/{customerId}/googleAds:search
{ "query": "SELECT ... FROM ... WHERE ..." }
```

### Common queries

**List active campaigns + budget:**
```sql
SELECT campaign.id, campaign.name, campaign.status,
       campaign.advertising_channel_type,
       campaign_budget.amount_micros,
       campaign.start_date, campaign.end_date
FROM campaign
WHERE campaign.status != 'REMOVED'
ORDER BY campaign.id DESC
LIMIT 20
```

**Account-level metrics over a date range:**
```sql
SELECT metrics.impressions, metrics.clicks,
       metrics.cost_micros, metrics.conversions, metrics.ctr
FROM customer
WHERE segments.date BETWEEN '2026-04-01' AND '2026-04-30'
```

**Keyword performance:**
```sql
SELECT ad_group_criterion.keyword.text,
       ad_group_criterion.keyword.match_type,
       metrics.impressions, metrics.clicks, metrics.conversions
FROM keyword_view
WHERE segments.date DURING LAST_30_DAYS
```

**Search terms (intent mining):**
```sql
SELECT search_term_view.search_term,
       metrics.impressions, metrics.clicks, metrics.cost_micros
FROM search_term_view
WHERE segments.date DURING LAST_7_DAYS
ORDER BY metrics.clicks DESC
LIMIT 50
```

### GAQL gotchas

- Field names are **snake_case** in GAQL (`campaign.advertising_channel_type`)
  but come back as **camelCase** in JSON (`advertisingChannelType`).
- `segments.*` and `metrics.*` only work on resources that have them.
  `FROM customer` is the catch-all for account totals.
- `LIMIT` works but no `OFFSET`. Paginate with `pageToken` from the response.
- `cost_micros` is millionths of the account currency. Divide by 1_000_000.
- Date predicates: `BETWEEN '2026-01-01' AND '2026-01-31'` or
  `DURING LAST_30_DAYS` / `LAST_7_DAYS` / `THIS_MONTH` / `LAST_MONTH`.
- No JOINs. The view determines what fields are queryable together.

## Mutating resources

Mutations use `:mutate` endpoints with one operation per resource:

```
POST /v17/customers/{customerId}/campaigns:mutate
POST /v17/customers/{customerId}/campaignBudgets:mutate
POST /v17/customers/{customerId}/adGroups:mutate
POST /v17/customers/{customerId}/adGroupAds:mutate
```

Each takes `{ operations: [{ create | update | remove: { ... } }] }`.

**Create flow for a search campaign** (3 calls, in order):
1. `campaignBudgets:mutate` — create. Get the resource_name.
2. `campaigns:mutate` — create with that budget resource_name.
3. `adGroups:mutate` → `adGroupAds:mutate` for ads.

Resource names look like `customers/123/campaigns/456` and are how resources
reference each other — store these, not numeric IDs alone.

## Common errors

| Code | Meaning | Fix |
|---|---|---|
| `DEVELOPER_TOKEN_NOT_APPROVED` | Token in test/pending state | Apply for Standard access; test tokens only work on test accounts |
| `USER_PERMISSION_DENIED` | Service account lacks access | Add SA email to Ads account (Tools -> Access -> Users) |
| `CUSTOMER_NOT_FOUND` | Customer ID wrong / has dashes | Strip dashes from `GOOGLE_ADS_CUSTOMER_ID` |
| `AUTHENTICATION_ERROR` | Missing `developer-token` header | All 3 headers required, every call |
| `INVALID_LOGIN_CUSTOMER_ID` | MCC vs leaf mismatch | If using MCC, set `login-customer-id` to MCC, customer in URL to leaf |

## Patterns to follow

1. **Always go through `gadsFetch`** — JWT minting + caching + headers are
   centralised. Never inline a fetch.
2. **Swallow errors, return empty/zero structures.** The dashboard must
   render even when Ads is down. See `getGoogleMetrics` empty default.
3. **Convert `cost_micros` at the edge**, not deep in the UI:
   `Number(costMicros) / 1_000_000`.
4. **`isGoogleAdsConfigured()` before rendering** Ads UI — gate features
   so unconfigured environments don't crash.
5. **Do not log access tokens.** They expire fast but still leak privilege.
   The fetch helper does not log them; keep it that way.

## Reference

- Official docs: https://developers.google.com/google-ads/api/docs/start
- REST guide: https://developers.google.com/google-ads/api/rest/overview
- GAQL: https://developers.google.com/google-ads/api/docs/query/overview
- Field reference: https://developers.google.com/google-ads/api/fields/v17/overview
- App code: [src/lib/campaigns/google-ads.ts](src/lib/campaigns/google-ads.ts)
- Setup script: [scripts/google-ads-setup.ts](scripts/google-ads-setup.ts)
