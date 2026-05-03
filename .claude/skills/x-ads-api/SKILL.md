---
name: x-ads-api
description: X (Twitter) Ads API v12 integration for cloudless.gr — campaigns, line items, stats, and OAuth1 HMAC-SHA1 signing. Use when working with src/lib/campaigns/x-ads.ts, scripts/x-ads-setup.ts, or /api/admin/campaigns/x.
---

# X (Twitter) Ads API — cloudless.gr Skill

## Overview

Server-side X Ads integration for the Marketing Hub. Distinct from the public
X / Twitter v2 API: ads runs on its own host with **OAuth1.0a** signing
(not bearer tokens).

**Implementation:**
- `src/lib/campaigns/x-ads.ts` — REST client with manual OAuth1 signing
- `scripts/x-ads-setup.ts` — first-run env wiring
- `src/app/api/admin/campaigns/x/route.ts` — admin route
- `src/app/[locale]/admin/campaigns/x/page.tsx` — UI

**Base URL:** `https://ads-api.x.com/12`
**Auth:** OAuth1.0a (HMAC-SHA1 per request — no token refresh)
**Sandbox:** `https://ads-api-sandbox.x.com/12` (use for first integration test)

## Required env / SSM

```
X_API_KEY            consumer key (the app's)
X_API_SECRET         consumer secret
X_ACCESS_TOKEN       account-level access token (the ad account owner's)
X_ACCESS_SECRET      access token secret
X_AD_ACCOUNT_ID      not the user id; from /accounts list
```

Setup flow in `scripts/x-ads-setup.ts`. The four credentials come from
developer.x.com → app → Keys and tokens. Note: the **account holder must
have Ads API access approved** — apply at ads.x.com/api.

## OAuth1 signing — DO NOT skip this

X Ads is the only integration in this app using OAuth1. The `buildOAuthHeader`
helper in `src/lib/campaigns/x-ads.ts` is **not optional** — every request
needs a per-request signature.

Signing recipe (already implemented):

1. Collect oauth_* params: `consumer_key`, `nonce` (random), `signature_method`
   = `HMAC-SHA1`, `timestamp` (unix seconds), `token`, `version` = `1.0`.
2. Sort by key, percent-encode keys + values, join with `&`.
3. Build base string: `METHOD&{percent-encoded URL}&{percent-encoded params}`.
4. Build signing key: `{percent-encoded api_secret}&{percent-encoded access_secret}`.
5. HMAC-SHA1 → base64. That's `oauth_signature`.
6. Header: `OAuth oauth_consumer_key="...", oauth_nonce="...", ...` —
   percent-encoded values, double-quoted, comma+space separated.

**Pitfalls:**
- The URL in the base string must NOT include the query string. Query params
  go into the param-collection step alongside the oauth_* params (we don't
  currently send query params in the body of POSTs — sticking to URL-only is
  fine for the GETs the app does).
- Use percent-encoding (RFC 3986), NOT `encodeURIComponent` defaults — the
  helper uses `encodeURIComponent` which is close enough for the chars X
  expects in our payloads. If you ever need `*`, `'`, `(`, `)`, hand-roll it.
- **Body of POST doesn't get signed** for `application/json`. Only for
  `application/x-www-form-urlencoded`.

## Endpoint cheatsheet

All paths are appended to `/12`. `{accountId}` = `X_AD_ACCOUNT_ID`.

### Accounts

| Method | Path | Purpose |
|---|---|---|
| GET | `/accounts` | List ad accounts the user can access |
| GET | `/accounts/{id}` | Single account info |
| GET | `/accounts/{id}/funding_instruments` | Cards + balances |

### Campaigns

| Method | Path | Notes |
|---|---|---|
| GET | `/accounts/{id}/campaigns?count=20&sort_by=created_at-desc` | List |
| GET | `/accounts/{id}/campaigns/{campaign_id}` | Single |
| POST | `/accounts/{id}/campaigns` | Create. Form-encoded body. |
| PUT | `/accounts/{id}/campaigns/{campaign_id}` | Update |
| DELETE | `/accounts/{id}/campaigns/{campaign_id}` | Delete |

Create body fields (form-encoded):
`name`, `funding_instrument_id`, `daily_budget_amount_local_micro`,
`total_budget_amount_local_micro` (optional), `start_time`, `end_time`,
`entity_status` (`ACTIVE` / `PAUSED` / `DRAFT`).

### Line items (= ad groups, where targeting + bid live)

| Method | Path |
|---|---|
| GET | `/accounts/{id}/line_items` |
| POST | `/accounts/{id}/line_items` |

Required: `campaign_id`, `objective` (`ENGAGEMENTS`, `WEBSITE_CLICKS`,
`VIDEO_VIEWS`, `FOLLOWERS`, etc.), `product_type` (`PROMOTED_TWEETS`),
`placements` (e.g. `["ALL_ON_TWITTER"]`), `bid_amount_local_micro`.

### Tweets / promoted tweets

| Method | Path | Purpose |
|---|---|---|
| POST | `/accounts/{id}/tweet` | Create a Promoted-only Tweet (nullcasted) |
| POST | `/accounts/{id}/promoted_tweets` | Promote to a line item |
| GET | `/accounts/{id}/promoted_tweets` | List promoted |

### Stats — the analytics endpoint

```
GET /accounts/{id}/stats?
  entity={ACCOUNT|CAMPAIGN|LINE_ITEM|PROMOTED_TWEET}
  &entity_ids={comma-list, optional for ACCOUNT}
  &granularity={DAY|HOUR|TOTAL}
  &metric_groups={ENGAGEMENT,BILLING,VIDEO,WEB_CONVERSION,...}
  &start_time=2026-04-01T00:00:00Z
  &end_time=2026-04-25T23:59:59Z
```

Or for the account roll-up (what `getXStats` does):
```
GET /stats/accounts/{id}?granularity=DAY&metric_groups=ENGAGEMENT,BILLING&...
```

Response shape:
```
{ "data": { "id_data": [{ "id_data": [{ impressions, clicks, billed_charge_local_micro, engagements }] }] } }
```

Yes, `id_data` is nested twice. Yes, that's intentional. Don't refactor the
flatten in `getXStats`.

### Common metric groups

| Group | Includes |
|---|---|
| `ENGAGEMENT` | impressions, clicks, engagements, retweets, likes, replies |
| `BILLING` | billed_charge_local_micro, billed_engagements |
| `VIDEO` | video_total_views, video_3s100pct_views, video_25/50/75/100pct_views |
| `MEDIA` | media_views, media_engagements |
| `WEB_CONVERSION` | conversion_purchases, conversion_sign_ups, conversion_site_visits |

## Money fields — micros

Every monetary field is in **micros of the account's local currency**:
`daily_budget_amount_local_micro`, `bid_amount_local_micro`,
`billed_charge_local_micro`. Divide by 1_000_000 for display. Multiply user
input by 1_000_000 before sending.

## Common errors

| HTTP | Code-ish | Fix |
|---|---|---|
| 401 | `Could not authenticate you` | Wrong signing — check the base string starts with `GET&` or `POST&`, URL is percent-encoded, params sorted alphabetically |
| 401 | `Timestamp out of bounds` | Clock skew > 5 min. Use `Math.floor(Date.now()/1000)` — not ms |
| 403 | `Your credentials do not allow access` | Ads API not approved for the app, or account not linked |
| 404 | `Account not found` | Wrong `X_AD_ACCOUNT_ID` — get from `GET /accounts` |
| 429 | Rate limit | App-level limits ~ 200/15min. Backoff with `Retry-After` |

## Patterns to follow

1. **Always go through `xFetch`** — signing is hard to get right; one
   helper, one place. Never inline a `fetch` to ads-api.x.com.
2. **Swallow errors, return empty/zero structures.** Same dashboard-resilience
   pattern as Google Ads / ActiveCampaign helpers.
3. **Test against the sandbox first** when adding mutating endpoints.
   Switch base URL via env if needed.
4. **Don't migrate to oauth2** — Ads API does not support OAuth2 user-context
   auth. The bearer-token endpoints on developer.x.com (v2) are a different
   API entirely.
5. **`isXConfigured()` before render** — gates the UI.

## Reference

- Official docs: https://developer.x.com/en/docs/x-ads-api
- API endpoints: https://developer.x.com/en/docs/x-ads-api/api-reference-index
- OAuth1 spec: https://datatracker.ietf.org/doc/html/rfc5849
- App code: [src/lib/campaigns/x-ads.ts](src/lib/campaigns/x-ads.ts)
- Setup script: [scripts/x-ads-setup.ts](scripts/x-ads-setup.ts)
