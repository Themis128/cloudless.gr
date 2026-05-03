---
name: windsor-ai
description: >
  Expert guidance for Windsor.ai marketing data aggregation — connecting data sources,
  querying analytics across Facebook Ads, Facebook Organic, Instagram, Google Ads, Google
  Analytics, LinkedIn, TikTok, X/Twitter, YouTube, and 315+ other connectors. Use this skill
  whenever the user mentions Windsor.ai, marketing data, ad spend, cross-channel analytics,
  connector setup, "pull my Facebook data", "how much did I spend on ads", "connect a new
  data source", blended marketing data, attribution, ROAS, or any request to retrieve or
  compare performance metrics across advertising and social media platforms. Also triggers on
  windsor, marketing analytics, ad performance, campaign data, cross-platform reporting,
  or "compare my channels". Even if the user doesn't say "Windsor" explicitly, use this skill
  when they want to pull marketing/advertising data from multiple platforms into one view.
---

# Windsor.ai Marketing Data Skill

You are an expert in using Windsor.ai's MCP tools and REST API to manage marketing data
connectors and retrieve cross-channel analytics for the cloudless.gr project.

## Architecture Overview

Windsor.ai has TWO interfaces:

1. **MCP Tools** (via Claude connector) — 6 tools for querying data and managing connectors
2. **REST API** (`connectors.windsor.ai`) — direct HTTP access for advanced queries, account
   management, and field discovery

The MCP tools wrap the REST API. For most tasks, use MCP tools. Fall back to REST API for
account management, custom fields, or co-user access.

## MCP Tool Reference

Windsor.ai MCP server UUID: `524df47a-0d69-4688-a635-c2bff4cd4065`

### Available MCP Tools

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `get_connectors` | List connected/available data sources | `include_not_yet_connected` (bool) |
| `get_connector_authorization_url` | Get OAuth URL to connect a new source | `connector` (string, required) |
| `get_data` | Query data from any connected source | `connector`, `fields`, `date_preset`, `accounts`, `filters`, `options` |
| `get_fields` | Get detailed field metadata (type, description) | `connector`, `fields` (list) |
| `get_options` | Get available fields, date filters, options for a connector | `connector`, `accounts` (both required) |
| `get_current_user` | Get authenticated Windsor.ai user info | (none) |

### Tool Parameter Details

#### `get_connectors`
- `include_not_yet_connected=false` (default): Only connectors with configured accounts
- `include_not_yet_connected=true`: All 315+ available connectors (most without accounts)

#### `get_data`
- `connector` (required): Connector ID (e.g., `"facebook"`, `"googleanalytics4"`, `"linkedin"`)
- `fields` (required): List of field IDs or comma-separated string
- `date_preset`: Predefined date range (see Date Presets below)
- `date_from` / `date_to`: Custom date range (YYYY-MM-DD format)
- `accounts`: List of account IDs to filter (from `get_connectors` response)
- `filters`: Nested array filter conditions (see Filter Syntax below)
- `options`: Connector-specific options object (e.g., `{"attribution_window": "7d_view,1d_click"}`)
- `date_filters`: Custom date field mapping (e.g., `{"orders": "created_at"}`)

#### `get_options`
- Both `connector` and `accounts` are **required**
- Returns available fields, date filters, and connector-specific options
- Use this BEFORE `get_data` to discover valid field IDs

#### `get_fields`
- `connector` (required): Connector ID
- `fields` (required): List of field IDs to get metadata for
- Returns type (metric/dimension), description, and connector info

## REST API Reference

Base URL: `https://connectors.windsor.ai`
Onboard API: `https://onboard.windsor.ai/api`

### Authentication
All REST requests require `api_key` parameter. Get your API key from the Windsor.ai
account dashboard at `https://onboard.windsor.ai/app/data-preview`.

### Key REST Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /{connector}?api_key={key}&fields={fields}` | Query data (same as MCP `get_data`) |
| `GET /list_connectors` | List all available connectors |
| `GET /{connector}/fields` | Get all fields for a connector |
| `GET /{connector}/fields?api_key={key}` | Get fields including custom fields |
| `GET /{connector}/options` | Get connector options |
| `GET /api/common/ds-accounts?datasource=all` | List all connected accounts (onboard API) |
| `GET /api/common/ds-accounts?datasource={source}` | List accounts for a specific source |
| `GET /api/custom-fields` | List custom fields |
| `GET /api/team/generate-co-user-url/?allowed_sources={source}&api_key={key}` | Generate co-user auth URL |
| `GET /api/team/co-user-linked-accounts/` | List co-user linked accounts |

### Rate Limits
- 600 requests per minute
- 10,000 requests per day
- HTTP 429 on exceed

### Error Codes
| Status | Meaning |
|--------|---------|
| 400 | Malformed request or missing parameters |
| 401 | Invalid API key |
| 403 | Insufficient access rights |
| 404 | Connector or resource unavailable |
| 429 | Rate limit exceeded |
| 500 | Server error |

## Workflow: Connecting a New Data Source

1. Call `get_connectors(include_not_yet_connected=true)` to list all available connectors
2. Find the connector ID for the platform (e.g., `facebook`, `instagram`, `googleanalytics4`)
3. Call `get_connector_authorization_url(connector=<id>)` to get the OAuth URL
4. Open the URL in the browser for the user to authenticate
5. **CRITICAL**: After OAuth, the user must complete the Windsor.ai onboard flow:
   - Step 1 "Add data": Select the connector and check the accounts to include
   - Step 2 "Preview and Destination": Check the account checkboxes in the **Accounts** section
   - The connector will NOT appear in `get_connectors()` until accounts are checked and saved
6. Call `get_connectors()` to verify the connection is active

### Important: Connector Persistence

OAuth alone does NOT save a connector. The Windsor.ai onboard page at
`https://onboard.windsor.ai/app` has a two-step flow:
- Step 1 ("Add data"): Select connector, grant OAuth access, choose accounts
- Step 2 ("Preview and Destination"): Configure fields, check accounts, set destinations

Both steps must be completed. The "Accounts" checkboxes on the Preview page must be
checked for the connector to persist to the API backend.

## Workflow: Querying Data

Always follow this sequence — skipping steps causes errors:

1. **Identify the connector ID**: Call `get_connectors()` to see what's connected
2. **Discover fields**: Call `get_options(connector=<id>, accounts=[<account_ids>])` to see available fields
3. **Build the query**: Call `get_data()` with the parameters above
4. If a query returns empty data, verify:
   - The connector has accounts configured (`get_connectors()` returns accounts array)
   - The field IDs are valid (from `get_options`)
   - The date range contains data
   - The account ID is correct

### Field-name discovery is mandatory for new connectors

The live `windsor.ai/data-field/{connector}/` pages render their field table
client-side — they are NOT machine-readable via curl or WebFetch. The only reliable source
of field IDs is `get_options(connector=<id>, accounts=[<account_ids>])`. Cache what you
learn in `references/connector-fields.md`.

Common mistakes that cause "field not recognized" errors:
- Using display labels instead of IDs (`"Impressions"` → correct ID may be `impressions`,
  `account_analytics_impression_count`, or `post_views` depending on connector)
- Guessing that a field exists on connector X because it exists on connector Y
- Missing a connector-specific prefix like `post_`, `profile_`, `account_analytics_`, or
  `organization_`
- Camel-casing what should be snake_case (GA4: `totalUsers` ❌ → `totalusers` ✅)

### Date Presets

Use these shortcuts instead of explicit dates when possible:
- `"last_7d"`, `"last_30d"`, `"last_90d"` — last X days (excluding today)
- `"last_7dT"`, `"last_30dT"` — last X days (including today)
- `"this_month"`, `"this_year"` — current period
- `"last_Xm"`, `"last_Xy"` — last X months/years
- `"last_Xw"` — last X weeks

### Filter Syntax

Filters use nested arrays with operators:
```
[["field", "operator", "value"]]
[["spend", "gt", 100], "and", ["campaign", "contains", "Sale"]]
[[[" campaign", "eq", "foobar"], "or", ["spend", "eq", 10]], "and", ["campaign", "eq", "abc"]]
```

Operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `ncontains`, `in`, `null`, `notnull`

### Blended / Cross-Platform Queries

Use `connector="all"` with the `Data Source` field to compare across platforms:
```
get_data(connector="all", fields=["datasource", "spend", "clicks", "impressions", "date"],
         date_preset="last_30d")
```

## Connected Accounts (cloudless.gr)

Always call `get_connectors()` to verify current state — connections can expire.

As of 2026-04-20:
- **GA4** (`googleanalytics4`): www.baltzakisthemis.com (500620492)
- **LinkedIn Ads** (`linkedin`): Baltzakis Ad Account (512642510)
- **LinkedIn Organic** (`linkedin_organic`): cloudless.gr (108614163)
- **Threads** (`threads`): Themistoklis Baltzakis / t_baltzakis (26733238892980904)

### Not Yet Connected (Need OAuth + Onboard Save)

These connectors need OAuth setup via `get_connector_authorization_url`:
- `facebook` — Facebook Ads (OAuth was granted but connector not saved in onboard flow)
- `facebook_organic` — Facebook Page Organic (same — OAuth granted, not saved)
- `instagram` — Instagram (blocked — IG not linked to FB Page)
- `tiktok` — TikTok Ads
- `tiktok_organic` — TikTok Organic
- `twitter` — X/Twitter Ads
- `x_organic` — X/Twitter Organic
- `youtube` — YouTube

## Connector IDs Quick Reference

| Platform | Connector ID | Field Reference |
|----------|-------------|-----------------|
| Facebook Ads | `facebook` | 561 metrics, 151 dimensions |
| Facebook Page | `facebook_organic` | 203 metrics, 115 dimensions |
| Instagram | `instagram` | windsor.ai/data-field/instagram/ |
| Instagram Public | `instagram_public` | windsor.ai/data-field/instagram_public/ |
| Google Analytics 4 | `googleanalytics4` | windsor.ai/data-field/googleanalytics4/ |
| Google Ads | `google_ads` | windsor.ai/data-field/google_ads/ |
| LinkedIn Ads | `linkedin` | windsor.ai/data-field/linkedin/ |
| LinkedIn Pages | `linkedin_organic` | windsor.ai/data-field/linkedin_organic/ |
| Threads | `threads` | windsor.ai/data-field/threads/ |
| TikTok Ads | `tiktok` | windsor.ai/data-field/tiktok/ |
| TikTok Organic | `tiktok_organic` | windsor.ai/data-field/tiktok_organic/ |
| X/Twitter Ads | `twitter` | windsor.ai/data-field/twitter/ |
| X Organic | `x_organic` | windsor.ai/data-field/x_organic/ |
| YouTube | `youtube` | windsor.ai/data-field/youtube/ |
| Blended/All | `all` | windsor.ai/data-field/all/ |

## Common Queries

> **Field-name gotcha**: Windsor returns connector-specific snake_case field IDs that often
> don't match the underlying platform's display names. Always verify with `get_options` first.
> See `references/connector-fields.md` for the cheatsheet of verified field IDs.

### GA4 website traffic
```
get_data(connector="googleanalytics4", accounts=["500620492"],
         fields=["date", "sessions", "totalusers", "newusers", "screen_page_views",
                 "engagement_rate", "average_session_duration", "bounce_rate"],
         date_preset="last_30d")
```
Note: GA4 uses `totalusers` / `newusers` (no underscore between words), but
`screen_page_views` / `engagement_rate` / `average_session_duration` (with underscores).

### LinkedIn Ads performance
```
get_data(connector="linkedin", accounts=["512642510"],
         fields=["campaign", "spend", "clicks", "impressions", "ctr", "cpc", "date"],
         date_preset="last_30d")
```

### LinkedIn Page organic insights
```
get_data(connector="linkedin_organic", accounts=["108614163"],
         fields=["date",
                 "account_analytics_impression_count",
                 "account_analytics_click_count",
                 "account_analytics_engagement",
                 "account_analytics_like_count",
                 "account_analytics_share_count",
                 "organization_follower_count",
                 "followers_gain_organic"],
         date_preset="last_30d")
```
Note: LinkedIn Organic page-level metrics are prefixed `account_analytics_`. Follower metrics
use `organization_follower_count` and `followers_gain_organic`. Old short names like
`page_impressions` / `page_followers` do NOT exist.

### Threads insights
```
get_data(connector="threads", accounts=["26733238892980904"],
         fields=["date", "post_id", "post_text", "post_permalink",
                 "post_views", "post_likes", "post_replies",
                 "post_reposts", "post_quotes", "post_shares",
                 "profile_followers_count", "profile_views"],
         date_preset="last_30d")
```
Note: Threads metrics are prefixed `post_` (post-level) or `profile_` (account-level). Bare
names like `views`, `likes`, `followers` will fail with "field not recognized".

### Cross-platform comparison (blended)
```
get_data(connector="all",
         fields=["datasource", "date", "spend", "clicks", "impressions"],
         date_preset="last_30d")
```

### Facebook Ads (when connected)
```
get_data(connector="facebook",
         fields=["account_name", "campaign", "spend", "clicks", "impressions", "ctr", "cpc", "date"],
         date_preset="last_30d")
```

### Facebook Page (when connected)
```
get_data(connector="facebook_organic",
         fields=["date", "page_impressions_unique", "page_engaged_users"],
         date_preset="last_7d")
```

## Troubleshooting

### "Account X is not available / not configured"
The connector's OAuth may have expired, or the onboard save step wasn't completed.
1. Check `get_connectors()` — does the connector have an `accounts` array?
2. If not, re-authenticate: `get_connector_authorization_url(connector=<id>)`
3. Complete the full onboard flow at `https://onboard.windsor.ai/app`

### Empty data returned
1. Verify the date range has data (try `last_90d` for wider range)
2. Check field IDs with `get_options(connector=<id>, accounts=[<account_ids>])`
3. Ensure the account ID matches `get_connectors()` output

### OAuth completed but connector not showing
The Windsor.ai onboard page has a save step that must be completed in the browser.
OAuth alone is not sufficient — see "Connector Persistence" above.

## Bundled References (read these when relevant)

- `references/connector-fields.md` — Verified field IDs for GA4, LinkedIn, LinkedIn Organic,
  Threads, Meta, TikTok, X, YouTube. Copy-paste-safe field lists.
- `references/destinations.md` — All 20+ Windsor destinations (Claude, BigQuery, Sheets,
  Postgres, Snowflake, etc.) with when-to-use guidance.
- `references/onboarding.md` — OAuth flow, lite-mode Page caveats, Business Portfolio
  prerequisites for Meta-family connectors.
- `scripts/windsor-api.sh` — REST API helper for `accounts`, `fields`, `options`, `query`.

## Important Notes

- Always call `get_connectors()` first if unsure which connector ID to use — never guess
- Windsor.ai is on a **TRIAL plan**: 10 connectors max, 15 accounts max
- Currently using 4/10 connectors and 4/15 accounts
- Account IDs come from `get_connectors()` response, not from the platform itself
- Field reference pages at `windsor.ai/data-field/{connector}/` list all available fields
- For monetary metrics, include a currency field if available
- The `get_data` response format: `{"data": [...], "meta": {"total_count": N, "returned_count": N}}`
- REST API can be used directly via bash/curl for advanced queries if MCP tools are insufficient
- Windsor.ai user: `baltzakisthemisgmailcom` / `baltzakis.themis@gmail.com`
