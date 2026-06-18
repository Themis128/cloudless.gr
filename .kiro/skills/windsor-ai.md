---
inclusion: manual
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


## Reference: connector-fields.md

# Windsor.ai Connector Field Cheatsheet

Verified field IDs (snake_case) for the most-used connectors. Use these with
`get_data(connector=..., fields=[...])`. If a field you need isn't listed,
call `get_options(connector=<id>, accounts=[<account_ids>])` to discover it.

> **Why this file exists**: `windsor.ai/data-field/{connector}/` pages render
> their tables client-side and are not machine-readable via WebFetch. Field
> IDs verified here come from live MCP `get_options` calls or successful
> `get_data` queries against the cloudless.gr account.

## Naming convention overview

Each connector has its own prefix scheme. **Do not transfer field names between
connectors** — `impressions` exists on Meta and LinkedIn Ads but means
`account_analytics_impression_count` on LinkedIn Organic and `post_views` on
Threads.

| Connector            | Prefix scheme                                              |
|----------------------|------------------------------------------------------------|
| `googleanalytics4`   | snake_case, mixed (`totalusers` no underscore, `screen_page_views` with) |
| `linkedin`           | bare names (`spend`, `clicks`, `impressions`, `ctr`, `cpc`) |
| `linkedin_organic`   | `account_analytics_*`, `organization_*`, `followers_*`, `share_*` |
| `threads`            | `post_*` (post-level), `profile_*` (account-level)         |
| `facebook`           | bare names + `account_*`, `campaign_*`, `adset_*`, `ad_*`  |
| `facebook_organic`   | `page_*` prefix                                            |
| `instagram`          | `media_*`, `account_*`, `reel_*`, `story_*`                |
| `tiktok`             | bare names + `campaign_*`                                  |
| `tiktok_organic`     | `video_*`, `account_*`                                     |
| `twitter` / `x_organic` | `tweet_*`, `account_*`                                  |
| `youtube`            | `video_*`, `channel_*`                                     |
| `all` (blended)      | Use `datasource` dimension + the union of bare metrics     |

## Google Analytics 4 — `googleanalytics4`

**Account ID for cloudless.gr**: `500620492` (www.baltzakisthemis.com)

### Common dimensions

| Field ID                  | Description                              |
|---------------------------|------------------------------------------|
| `date`                    | Date (YYYY-MM-DD)                        |
| `source`                  | Traffic source                           |
| `medium`                  | Traffic medium                           |
| `campaign`                | Campaign name                            |
| `country`                 | Country                                  |
| `device_category`         | mobile / desktop / tablet                |
| `landing_page`            | First page in the session                |
| `page_title`              | Page title                               |
| `page_path`               | URL path                                 |
| `screen_name`             | Screen / page name                       |

### Common metrics

| Field ID                          | Description                          |
|-----------------------------------|--------------------------------------|
| `sessions`                        | Sessions                             |
| `totalusers`                      | Total users (no underscore!)         |
| `newusers`                        | New users (no underscore!)           |
| `screen_page_views`               | Pageviews                            |
| `screen_page_views_per_session`   | Pages per session                    |
| `engaged_sessions`                | Engaged sessions                     |
| `engagement_rate`                 | Engagement rate                      |
| `bounce_rate`                     | Bounce rate                          |
| `average_session_duration`        | Avg session duration (seconds)       |
| `conversions`                     | Conversion events                    |
| `totalrevenue`                    | Total revenue (no underscore!)       |

### Quick query

```python
get_data(
    connector="googleanalytics4",
    accounts=["500620492"],
    fields=["date", "sessions", "totalusers", "newusers",
            "screen_page_views", "engagement_rate",
            "average_session_duration", "bounce_rate"],
    date_preset="last_30d",
)
```

## LinkedIn Ads — `linkedin`

**Account ID for cloudless.gr**: `512642510` (Baltzakis Ad Account)

### Dimensions

| Field ID            | Description                      |
|---------------------|----------------------------------|
| `date`              | Date                             |
| `account_name`      | Ad account name                  |
| `campaign`          | Campaign name                    |
| `campaign_group`    | Campaign group                   |
| `creative`          | Creative name                    |

### Metrics

| Field ID            | Description                      |
|---------------------|----------------------------------|
| `spend`             | Spend (account currency)         |
| `impressions`       | Impressions                      |
| `clicks`            | Clicks                           |
| `ctr`               | Click-through rate               |
| `cpc`               | Cost per click                   |
| `cpm`               | Cost per 1000 impressions        |
| `conversions`       | Conversions                      |
| `cost_per_conversion`| Cost per conversion             |
| `video_views`       | Video views                      |
| `landing_page_clicks`| LinkedIn LP clicks              |

### Quick query

```python
get_data(
    connector="linkedin",
    accounts=["512642510"],
    fields=["date", "campaign", "spend", "clicks",
            "impressions", "ctr", "cpc"],
    date_preset="last_30d",
)
```

## LinkedIn Organic / Pages — `linkedin_organic`

**Account ID for cloudless.gr**: `108614163` (cloudless.gr Page)

The most counter-intuitive connector — *bare* names like `impressions`,
`page_followers`, `clicks` do NOT work here. Page-level metrics are prefixed
`account_analytics_`. Follower metrics are organisation-level.

### Dimensions

| Field ID            | Description                      |
|---------------------|----------------------------------|
| `date`              | Date                             |
| `organization_id`   | Organization (Page) ID           |

### Page analytics metrics (prefix `account_analytics_`)

| Field ID                              | Description           |
|---------------------------------------|-----------------------|
| `account_analytics_impression_count`  | Impressions           |
| `account_analytics_click_count`       | Clicks                |
| `account_analytics_engagement`        | Engagements           |
| `account_analytics_like_count`        | Likes                 |
| `account_analytics_share_count`       | Shares                |
| `account_analytics_comment_count`     | Comments              |

### Page surface metrics

| Field ID            | Description                      |
|---------------------|----------------------------------|
| `careers_page_views`| Careers page views               |
| `all_page_views`    | All page views                   |
| `life_at_page_views`| Life-at-company page views       |

### Follower / org metrics

| Field ID                   | Description                          |
|----------------------------|--------------------------------------|
| `organization_follower_count` | Total followers                  |
| `followers_gain_organic`   | Organic follower gains               |
| `followers_gain_paid`      | Paid follower gains                  |

### Share-level metrics

| Field ID              | Description                        |
|-----------------------|------------------------------------|
| `share_count`         | Number of shares                   |
| `share_engagement_rate`| Share engagement rate             |
| `ctr`                 | CTR on shares                      |

### Quick query

```python
get_data(
    connector="linkedin_organic",
    accounts=["108614163"],
    fields=["date",
            "account_analytics_impression_count",
            "account_analytics_click_count",
            "account_analytics_engagement",
            "account_analytics_like_count",
            "account_analytics_share_count",
            "organization_follower_count",
            "followers_gain_organic"],
    date_preset="last_30d",
)
```

## Threads — `threads`

**Account ID for cloudless.gr**: `26733238892980904` (@t_baltzakis)

All metrics are prefixed with `post_` (post-level granularity) or `profile_`
(account-level totals). Bare names like `views` / `likes` / `followers` will
fail with "field not recognized".

### Dimensions

| Field ID         | Description                |
|------------------|----------------------------|
| `date`           | Date                       |
| `post_id`        | Thread post ID             |
| `post_text`      | Thread text content        |
| `post_permalink` | Permalink URL              |

### Post-level metrics

| Field ID         | Description                |
|------------------|----------------------------|
| `post_views`     | Post views                 |
| `post_likes`     | Likes                      |
| `post_replies`   | Replies                    |
| `post_reposts`   | Reposts                    |
| `post_quotes`    | Quote-posts                |
| `post_shares`    | Shares                     |

### Profile-level metrics

| Field ID                    | Description           |
|-----------------------------|-----------------------|
| `profile_followers_count`   | Total followers       |
| `profile_views`             | Profile views         |
| `profile_likes`             | Profile likes         |
| `profile_replies`           | Profile reply count   |
| `profile_quotes`            | Profile quote count   |
| `profile_reposts`           | Profile repost count  |

### Quick query

```python
get_data(
    connector="threads",
    accounts=["26733238892980904"],
    fields=["date", "post_id", "post_text", "post_permalink",
            "post_views", "post_likes", "post_replies",
            "post_reposts", "post_quotes",
            "profile_followers_count", "profile_views"],
    date_preset="last_30d",
)
```

## Facebook Ads — `facebook` (pending OAuth)

> Connector NOT yet active for cloudless.gr — OAuth granted but not saved in
> onboard flow. See `references/onboarding.md`.

### Common dimensions

| Field ID         | Description           |
|------------------|-----------------------|
| `date`           | Date                  |
| `account_name`   | Ad account name       |
| `campaign`       | Campaign name         |
| `adset`          | Ad set name           |
| `ad`             | Ad name               |

### Common metrics

| Field ID                   | Description           |
|----------------------------|-----------------------|
| `spend`                    | Spend                 |
| `impressions`              | Impressions           |
| `clicks`                   | Clicks                |
| `ctr`                      | CTR                   |
| `cpc`                      | CPC                   |
| `cpm`                      | CPM                   |
| `reach`                    | Unique reach          |
| `frequency`                | Frequency             |
| `actions_link_click`       | Link clicks           |
| `actions_purchase`         | Purchases             |
| `action_values_purchase`   | Purchase value        |
| `roas`                     | ROAS                  |

## Facebook Page Organic — `facebook_organic` (pending)

| Field ID                          | Description           |
|-----------------------------------|-----------------------|
| `date`                            | Date                  |
| `page_id`                         | Page ID               |
| `page_impressions_unique`         | Unique impressions    |
| `page_engaged_users`              | Engaged users         |
| `page_post_engagements`           | Post engagements      |
| `page_views_total`                | Page views            |
| `page_fans`                       | Total page likes      |
| `page_fan_adds`                   | New page likes        |

## Instagram — `instagram` (pending — IG-Page link issue)

Field name patterns once connected:

| Field ID                    | Description           |
|-----------------------------|-----------------------|
| `date`                      | Date                  |
| `media_id`                  | Media ID              |
| `media_caption`             | Caption text          |
| `media_permalink`           | Permalink             |
| `media_type`                | IMAGE / VIDEO / CAROUSEL_ALBUM / REELS |
| `media_impressions`         | Impressions           |
| `media_reach`               | Unique reach          |
| `media_likes`               | Likes                 |
| `media_comments`            | Comments              |
| `media_saves`               | Saves                 |
| `media_video_views`         | Video views           |
| `account_followers_count`   | Total followers       |
| `account_follows_count`     | Accounts followed     |
| `account_media_count`       | Total posts           |

## TikTok Ads — `tiktok` (pending)

| Field ID            | Description                      |
|---------------------|----------------------------------|
| `date`              | Date                             |
| `campaign_name`     | Campaign name                    |
| `adgroup_name`      | Ad group name                    |
| `spend`             | Spend                            |
| `impressions`       | Impressions                      |
| `clicks`            | Clicks                           |
| `ctr`               | CTR                              |
| `conversions`       | Conversions                      |
| `video_play_actions`| Video plays                      |
| `video_views_p100`  | Video 100% views                 |

## TikTok Organic — `tiktok_organic` (pending)

| Field ID            | Description                      |
|---------------------|----------------------------------|
| `date`              | Date                             |
| `video_id`          | TikTok video ID                  |
| `video_title`       | Title                            |
| `video_share_url`   | Share URL                        |
| `video_views`       | Views                            |
| `video_likes`       | Likes                            |
| `video_comments`    | Comments                         |
| `video_shares`      | Shares                           |
| `account_followers` | Total followers                  |
| `account_profile_views` | Profile views                |

## X / Twitter — `twitter` (Ads) and `x_organic` (Organic, pending)

### `twitter` (Ads)

| Field ID            | Description                      |
|---------------------|----------------------------------|
| `date`              | Date                             |
| `campaign_name`     | Campaign name                    |
| `spend`             | Spend                            |
| `impressions`       | Impressions                      |
| `engagements`       | Engagements                      |
| `engagement_rate`   | Engagement rate                  |
| `link_clicks`       | Link clicks                      |
| `conversion_purchases`| Purchases                      |

### `x_organic` (Organic)

| Field ID            | Description                      |
|---------------------|----------------------------------|
| `date`              | Date                             |
| `tweet_id`          | Tweet ID                         |
| `tweet_text`        | Tweet text                       |
| `tweet_impressions` | Impressions                      |
| `tweet_likes`       | Likes                            |
| `tweet_retweets`    | Retweets                         |
| `tweet_replies`     | Replies                          |
| `account_followers` | Total followers                  |

## YouTube — `youtube` (pending)

| Field ID            | Description                      |
|---------------------|----------------------------------|
| `date`              | Date                             |
| `video_id`          | Video ID                         |
| `video_title`       | Title                            |
| `video_views`       | Views                            |
| `video_likes`       | Likes                            |
| `video_comments`    | Comments                         |
| `video_shares`      | Shares                           |
| `video_average_view_duration`| Avg view duration       |
| `channel_subscribers_gained`| Subscribers gained        |
| `channel_subscribers_lost`| Subscribers lost            |

## Blended / cross-channel — `connector="all"`

Use the `datasource` dimension to break results down by source. The union of
*bare* metric names works across paid platforms.

```python
get_data(
    connector="all",
    fields=["datasource", "date", "spend", "clicks",
            "impressions", "conversions"],
    date_preset="last_30d",
)
```

## When in doubt

```python
# Discover available fields for a connector you've never queried
get_options(connector="<connector_id>", accounts=["<account_id>"])
```

The response includes a `fields` array with `id`, `type` (metric/dimension),
and `description`. Add anything new to this file when you discover it.


## Reference: destinations.md

# Windsor.ai — Data Destinations Reference

Windsor pulls data from 25+ sources and pushes it to 20+ destinations. This doc exists to pick the right destination for a given task — especially for cloudless.gr where most reporting ends up in Notion / Next.js dashboards, not in a BI tool.

## Destination categories

### AI & Assistants

For Claude-driven analysis and chat workflows.

- **Claude** — direct MCP integration (what this whole skill is built on). Query via `get_data()` tool calls, synthesize in chat.
- **ChatGPT** — GPT-Actions integration, similar to MCP but for OpenAI
- **Gemini** — Google's AI assistant
- **Perplexity** — AI search
- **Copilot Agent** (Microsoft) — for Teams/Copilot Studio workflows
- **Cursor** — IDE integration for AI coding assistants
- **Manus AI** — agentic workflow tool

**When to use for cloudless.gr:** Claude is already wired in. Don't bother with the others unless a specific workflow requires them.

### Business Intelligence (BI) tools

Drag-and-drop dashboards for non-technical stakeholders.

- **Looker Studio** (formerly Data Studio) — free, Google-native, easy for GA4 crossovers. Best for shareable link-based dashboards.
- **Power BI** — Microsoft stack, great if the org runs on Microsoft 365
- **Tableau** — enterprise BI, premium polish, paid
- **Microsoft Fabric** — Microsoft's unified analytics platform (combines Power BI + data lake)

**When to use for cloudless.gr:** **Looker Studio** is the only BI tool that makes sense for a solo/small operation — free, hosted, shareable. Reach for it when a client or investor wants a polished link they can check themselves.

### Data warehouses

For long-term storage, historical analysis, joining with other business data.

- **BigQuery** — Google Cloud, pay-per-query, scales well, native to GA4
- **Snowflake** — enterprise-grade, separation of compute and storage
- **Azure SQL** — Microsoft managed SQL
- **Amazon Redshift** — AWS equivalent
- **Databricks** — Spark-based lakehouse

**When to use for cloudless.gr:** Overkill for current scale. Only consider BigQuery if you need >2 years of historical data or want to join Windsor data with other GA4 exports.

### Cloud object storage

Raw data dump for archival or custom downstream processing.

- **Amazon S3** — AWS blob storage
- **Azure Blob Storage** — Azure equivalent

**When to use:** Only for data-lake architectures. Skip for cloudless.gr.

### Spreadsheets & files

Lightweight, flat-file outputs.

- **Google Sheets** — native collab spreadsheet; perfect for ad-hoc analysis
- **Microsoft Excel** — offline spreadsheets

**When to use for cloudless.gr:** Google Sheets is ideal for one-off analyses or sharing raw numbers with a collaborator. Set up a Sheets destination for a connector + fields + date range, and Windsor refreshes the sheet on a schedule.

### Transactional databases

For applications that need marketing data in real-ish time.

- **MySQL** — commodity SQL
- **PostgreSQL** — richer SQL features
- **Azure SQL** — managed flavor

**When to use for cloudless.gr:** If the Next.js admin dashboard at cloudless.gr should pull marketing metrics from its own DB instead of calling Windsor's MCP live, pipe Windsor → Postgres → Next.js. But the MCP path is simpler for low QPS, so keep Postgres as a future optimization.

### Programming environments

For custom analysis, ML models, notebooks.

- **Python** — direct Python SDK / REST calls

**When to use for cloudless.gr:** For ad-hoc Jupyter analyses. The `./scripts/windsor-api.sh` helper already covers 80% of this.

## Choosing the right destination for a task

| Task | Destination | Why |
|------|-------------|-----|
| Ad-hoc question in chat | Claude (via MCP) | Already wired, no setup |
| Polished client/investor dashboard | Looker Studio | Free, shareable, easy branding |
| Raw numbers to share with a collaborator | Google Sheets | Zero friction, collaborative |
| Metric embedded in cloudless.gr admin dashboard | Next.js API calls MCP directly (no destination) | Destination would add latency + drift |
| Long-term historical analysis | BigQuery | Cheap storage, SQL queryable |
| Compare marketing to CRM/sales data | BigQuery + QuickBooks export → join with SQL | One warehouse, one source of truth |
| Daily automated report email | Google Sheets + a sheet-based automation (Apps Script or IFTTT) | Simpler than standing up a BI tool |

## Setting up a destination

Destinations are configured on the Windsor dashboard (not via MCP):

1. Log in to <https://onboard.windsor.ai>
2. Go to "Destinations" in the sidebar
3. Click the destination tile (e.g., Google Sheets)
4. Authenticate if needed (Google OAuth for Sheets, API key for Postgres, etc.)
5. **Pick the connector + account(s) + fields + date range** that should flow to this destination
6. **Set a refresh schedule** — hourly, daily, weekly
7. Save

Each destination = one data pipeline. If you want two GA4 reports with different field sets, create two destinations.

## Destinations vs. MCP

The MCP tools (`get_data`, `get_connectors`, etc.) are a **read-on-demand** API — Claude pulls fresh data every time you ask.

Destinations are **push-on-schedule** — Windsor writes data to an external system at a set cadence regardless of whether anyone is looking.

For cloudless.gr:

- Use **MCP** for interactive chat analysis, agent-driven Cowork workflows, and anything that feeds Next.js API routes
- Use **destinations** for scheduled sync to Sheets/Looker Studio where a stakeholder opens the tool at their own cadence

## Cost implications

- Most destinations bill **per destination slot**, not per row — a Sheets pipe and a Looker pipe are two slots
- MCP access does NOT count against destination slots
- TRIAL plan typically includes 1-2 destination slots; check <https://onboard.windsor.ai/billing> for current plan limits

## Current cloudless.gr destinations (2026-04-21)

None configured yet. All data access is via MCP (Claude) or the REST helper script. Next likely destination: **Google Sheets** for a weekly social-performance roll-up that non-technical clients can open.


## Reference: onboarding.md

# Windsor.ai — Onboarding & OAuth Reference

Authoritative guide to connecting data sources on **onboard.windsor.ai**.

This doc exists because the onboard flow has non-obvious UX quirks that caused 4+ failed connection attempts during cloudless.gr setup. Follow these steps verbatim.

---

## 1. Getting to the right page

The public-facing onboarding URLs follow this pattern:

```
https://onboard.windsor.ai/app/{connector_id}
```

Examples:

- `https://onboard.windsor.ai/app/facebook`
- `https://onboard.windsor.ai/app/instagram`
- `https://onboard.windsor.ai/app/linkedin_organic`
- `https://onboard.windsor.ai/app/threads`
- `https://onboard.windsor.ai/app/googleanalytics4`
- `https://onboard.windsor.ai/app/tiktok`
- `https://onboard.windsor.ai/app/twitter`
- `https://onboard.windsor.ai/app/youtube`

You can also fetch an authorization URL programmatically via the MCP:

```
get_connector_authorization_url(connector="<connector_id>")
```

This returns a pre-signed OAuth URL that starts the flow in the right place.

**Canonical connector IDs** (use these — not display names):
`facebook`, `facebook_organic`, `instagram`, `linkedin`, `linkedin_organic`, `threads`, `googleanalytics4`, `googleads`, `tiktok`, `tiktok_organic`, `twitter`, `x_organic`, `youtube`, `bluesky`, `pinterest`, `pinterest_organic`, `mailchimp`, `klaviyo`, `snapchat`, `all` (blended).

If you're unsure, call `get_connectors()` and grep the response for the platform name.

---

## 2. The two-step gotcha (critical)

Windsor's onboard UI has **two steps** and users routinely miss the second one:

**Step 1 — "Add data"**
You authenticate with the third-party provider (Meta, Google, LinkedIn, etc.), then Windsor shows a list of available accounts (Pages, Ad Accounts, Properties, Channels). **You tick the checkboxes for the accounts you want to pull data from.**

**Step 2 — "Preview and Destination"**
You MUST click **Next** (or "Continue") to advance. On this page, Windsor actually persists the connector. If you close the tab after Step 1, the OAuth token is captured but the connector record is NOT saved — calling `get_connectors()` afterward will show the connector missing.

**Symptom of skipping Step 2:** The third-party app shows Windsor as an authorized integration (in Meta Business Settings, LinkedIn Security, etc.) but Windsor has no connector for that platform.

**Fix:** Re-run onboarding from the start and make sure to click through to the preview page. A green "Connected" banner or a data preview table confirms success.

---

## 3. Verifying a connection

After onboarding, verify through one of these methods (in increasing detail):

1. **MCP:** `get_connectors()` — returns a list of all active connectors + account IDs
2. **REST:** `./scripts/windsor-api.sh accounts <connector_id>` — same info via curl
3. **Dashboard:** <https://onboard.windsor.ai/app/data-preview> — UI showing all connectors and status
4. **Smoke-test query:** `get_data(connector="<id>", accounts=["<id>"], fields=["date"], date_preset="last_7d")` — if rows come back, the pipeline is live

If `get_connectors()` doesn't list the connector but OAuth succeeded, you hit Step 2 skip — re-onboard.

---

## 4. Per-platform prerequisites

### Meta family (Facebook Ads, Facebook Organic, Instagram, Threads)

These share a **Meta Business Portfolio** (formerly Business Manager). Before onboarding:

- The Meta user must be an **admin** on the Portfolio.
- The Portfolio must contain the Page, Instagram Business account, and/or ad account you want to connect. An EMPTY portfolio (no assets) will give OAuth success but zero selectable accounts in Step 1.
- Pages connected in **lite mode** (shared into the portfolio via "Request access" rather than "Add") will NOT expose Insights API data. Check at <https://business.facebook.com/settings/pages> — pages must show "Added" not "Requested".
- Instagram accounts need to be:
  1. Converted to **Business** or **Creator** account (in the IG app: Settings → Account → Switch to Professional Account)
  2. **Linked to a Facebook Page** via the Page's Instagram tab — NOT via the IG app's "Linked accounts" because that produces a lite-mode link
  3. Visible under Meta Business Settings → Accounts → Instagram accounts with "Full control"
- Review the list of **permissions** the OAuth popup requests and accept all; unchecking any scope will cause certain fields to silently return null.

**cloudless.gr status (2026-04-21):**

- Portfolio `1526956002406847` — EMPTY (no Pages/IG/ad account) — do not try to onboard through this
- Portfolio `1558125105019725` — has Page `cloudless.gr` (116436681562585) but no ad account yet; next step is to create ad account inside this portfolio

### LinkedIn (Ads + Organic)

Two separate connectors:

- `linkedin` — Campaign Manager (ads)
- `linkedin_organic` — Company Page posts and follower analytics

Prerequisites:

- LinkedIn user must be a **Page Admin** (Super admin or Content admin) on the Company Page for `linkedin_organic`
- For `linkedin` (ads), user must have access to the LinkedIn Ad Account
- Both connectors use different OAuth scopes — authorizing one does not authorize the other

### Google family (GA4, Google Ads, YouTube)

- GA4: user must have at least **Viewer** role on the GA4 property
- Google Ads: user must have access to the Google Ads customer account; **MCC (manager) accounts** show up as selectable parents — pick the child account for data
- YouTube: user must own or be a manager of the YouTube channel; **Brand channels** need the Google account to be in the channel's access list

### TikTok (Ads + Organic)

- `tiktok` (Ads) requires a TikTok For Business account with at least one Ad Account
- `tiktok_organic` requires a TikTok account — personal accounts work but **Creator** or **Business** accounts expose more fields
- TikTok OAuth uses short-lived tokens (24h); Windsor refreshes automatically but if the user revokes app access in TikTok settings, re-onboarding is required

### X / Twitter

- Free tier of X API has severe rate limits — data pulls may show gaps
- Paid tier (Basic/Pro) recommended for daily refresh
- `x_organic` and `twitter` (ads) both require **Developer account** provisioning on <https://developer.twitter.com> — this can take 1-2 business days

### Threads

- Meta's Threads API requires `threads_basic` + `threads_content_publish` scopes
- Threads account must be linked to a Meta user that can see it in the app
- No Facebook Page/Business Portfolio dependency — purely tied to the IG/Threads identity

---

## 5. Windsor account limits

**TRIAL plan (cloudless.gr current):**

- 10 connectors maximum
- 15 accounts total (one connector can pull from multiple accounts — each counts separately)
- **Status 2026-04-21:** 4/10 connectors, 4/15 accounts used

Paid plans raise these limits. Check `subscription-info-limits-and-usage` on the Ahrefs MCP (unrelated but conveniently named) OR log into the Windsor dashboard billing page.

---

## 6. Troubleshooting OAuth failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| "No accounts found" after login | User's role on the third-party platform doesn't grant data access | Elevate user permissions (admin on Page, editor on GA4 property, etc.) |
| Connector disappears after 24h | Step 2 of onboarding skipped | Re-onboard, click Next through preview |
| Data preview empty but connector "active" | Date range chosen has no data (e.g., brand-new account) | Widen date range to `last_90d` or `last_year` |
| "Token expired" error on `get_data` | Refresh token invalidated (password change, manual revoke) | Re-onboard via the same connector URL |
| Meta onboard shows "No Pages" | Portfolio empty OR user not portfolio admin | Verify at business.facebook.com/settings |
| GA4 shows property but zero metrics | GA4 property has no data streams configured | Fix in GA4 admin, then re-query |
| Instagram connected but no posts | IG-FB Page link in lite mode | Complete "Review connection" at facebook.com/settings/?tab=linked_instagram |

---

## 7. Revoking / removing a connector

To fully disconnect:

1. Windsor side: onboard.windsor.ai/app/data-preview → find connector → "Delete connection"
2. Third-party side: revoke Windsor's OAuth grant in the provider's security settings
   - Meta: <https://accounts.meta.com/security/business-apps>
   - LinkedIn: <https://www.linkedin.com/psettings/permitted-services>
   - Google: <https://myaccount.google.com/permissions>
   - TikTok: TikTok app → Settings → Security → Connected Apps
   - X: <https://twitter.com/settings/connected_apps>

**Both sides required** — deleting Windsor's record without revoking at the provider leaves the grant dangling, and revoking at the provider without deleting the Windsor record leaves a stale (broken) connector in Windsor's list that will eat against your plan quota.

---

## 8. Auth URL fast path (scripted)

To kick off a new connection from the CLI:

```bash
# Get the OAuth URL
./scripts/windsor-api.sh connectors | jq '.[] | select(.id == "instagram")'

# Or via MCP
# get_connector_authorization_url(connector="instagram")
```

Then open the URL in a regular browser (not the Cowork sidebar) so that password managers and 2FA work normally. Claude cannot complete OAuth flows on the user's behalf per the user_privacy rules.
