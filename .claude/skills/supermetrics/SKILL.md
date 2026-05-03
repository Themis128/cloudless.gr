---
name: supermetrics
description: >
  Expert guidance for Supermetrics marketing data platform — querying analytics
  across 167+ data sources, managing ad campaigns on Google Ads / Meta Ads /
  Microsoft Ads / TikTok Ads / LinkedIn Ads, discovering fields and accounts,
  and building cross-platform reports. Use this skill whenever the user mentions
  Supermetrics, marketing data query, campaign management, ad campaign creation,
  "pull data from Facebook Ads", "Google Ads performance", "create a campaign",
  "check campaign health", "keyword research", "audience targeting", "ad spend
  report", ROAS, CPA, CTR, impressions, or any request to query advertising
  data or manage ad campaigns programmatically. Also triggers on data source
  discovery, field discovery, cross-platform ad comparison, "how much did I
  spend", "campaign performance", "create an ad", or "pause a campaign". Even
  if the user doesn't say "Supermetrics" explicitly, use this skill when they
  want to query marketing/advertising platform data or manage ad campaigns
  across Google, Meta, Microsoft, TikTok, or LinkedIn.
---

# Supermetrics Marketing Data & Campaign Management Skill

You are an expert in using Supermetrics' MCP tools to query marketing data across
167+ sources and manage ad campaigns on 5 platforms for the cloudless.gr project.

## MCP Tool Reference

Supermetrics MCP server UUID: `d51fa0c7-528a-4fab-a916-551e27f73113`

### Available Tools

| Tool | Purpose |
|------|---------|
| `data_source_discovery` | List all data sources or get config for a specific source |
| `accounts_discovery` | List connected accounts for a data source |
| `field_discovery` | List available metrics and dimensions for a source |
| `data_query` | Run a data query (returns `schedule_id`) |
| `get_async_query_results` | Retrieve results from a data_query (poll until completed) |
| `campaign_and_resource_get` | Get campaigns, health checks, assets, keyword ideas, targeting, reach estimates, audiences, recommendations |
| `campaign_create` | Create a new ad campaign (always created as PAUSED) |
| `campaign_update` | Update an existing campaign (status, budget, targeting, ads) |
| `get_today` | Get current UTC date/time (use before custom date ranges) |
| `user_info` | Get authenticated user profile and license info |
| `contact_supermetrics` | Submit feedback, support tickets, or sales enquiries |

## Two Core Capabilities

### 1. Data Querying (167+ sources)

Query analytics data from any connected marketing platform.

### 2. Campaign Management (5 platforms)

Create and manage ad campaigns on:
- **AW** — Google Ads
- **FA** — Meta/Facebook Ads
- **AC** — Microsoft/Bing Ads
- **TIK** — TikTok Ads
- **LIA** — LinkedIn Ads

## Workflow: Querying Marketing Data

Always follow this sequence — skipping steps causes errors:

1. **Identify the source**: Call `data_source_discovery()` (no args) to list all sources
2. **Get source config**: Call `data_source_discovery(ds_id="FA")` for full config
   - Check `has_account_list`, `has_fields`, `has_report_type_selection`
   - Note `is_date_range_required` and available `report_types`
3. **Discover accounts** (if `has_account_list=true`):
   Call `accounts_discovery(ds_id="FA")` — never guess account IDs
4. **Discover fields** (if `has_fields=true`):
   Call `field_discovery(ds_id="FA")` — returns metrics, dimensions, monetary/currency fields
5. **Build the query**: Call `data_query()` with:
   - `ds_id`: data source ID
   - `ds_accounts`: account IDs from step 3 (comma-separated or array)
   - `fields`: metric and dimension IDs from step 4
   - `date_range_type`: `"custom"` with `start_date`/`end_date`, or relative like `"last_30_days"`
   - `filters`: optional filter expressions
   - `settings`: source-specific settings (report_type, etc.) — must be inside this object
   - `max_rows`: defaults to 1000, max 10000
6. **Get results**: Call `get_async_query_results(schedule_id=<id>)` immediately after
   - Poll until `status` is `completed` or failed

### Date Range Types

- `"custom"` + `start_date` / `end_date` (YYYY-MM-DD format)
- `"last_7_days"`, `"last_30_days"`, `"last_3_months"` — relative ranges
- Append `_inc` to include current period: `"last_7_days_inc"`
- Use `get_today()` to resolve relative references to exact dates

### Filter Syntax

```
"country == United States"
"sessions > 1000 AND deviceCategory == mobile"
"campaign_name =@ spring_sale"
"country [] United States,Canada"
```

Operators: `==`, `!=`, `>`, `>=`, `<`, `<=`, `=@` (contains), `!@` (not contains),
`=~` (regex match), `!~` (regex not match), `[]` (in list)

### Field Compatibility Rule

All selected fields must share at least one common `report_type`. If fields have
`report_types` metadata, ensure overlap — otherwise the query will fail.

When querying monetary metrics, include a currency dimension field if available.

## Workflow: Campaign Management

### Viewing campaigns and health

```
campaign_and_resource_get(ds_id="FA", account_id="act_657781691826702")
campaign_and_resource_get(ds_id="FA", account_id="act_657781691826702",
                          resource_type="health_check")
```

`campaign_detail_level` options for campaign view:
- `"full"`: everything (default) — campaign, ad groups, ads with creatives
- `"campaign"`: campaign-level only (fastest)
- `"ad_group"`: campaign + ad groups, no individual ads

### Resource types available

| resource_type | Purpose | Platforms |
|---------------|---------|-----------|
| `campaigns` | List/view campaigns (default) | All 5 |
| `health_check` | 30-day performance snapshot | All 5 |
| `assets` | List uploaded images/videos | AW, FA, TIK, LIA |
| `pages` | List Facebook Pages | FA only |
| `keyword_ideas` | Keyword suggestions with volume | AW, AC |
| `keyword_volumes` | Search volume for specific keywords | AW, AC |
| `targeting_search` | Search interests, behaviors, demographics | AW, FA, LIA, TIK |
| `reach_estimate` | Estimate audience size for targeting | FA, AC |
| `audiences` | List custom/lookalike audiences | FA, TIK |
| `recommendations` | Platform optimization suggestions | AW |
| `history` | Campaign change history | AW, FA |
| `conversions` | Conversion action setup | AW |

### Creating a campaign

Campaigns are always created as **PAUSED**. Use `campaign_update` to enable after review.

```
campaign_create(
  ds_id="FA",
  account_id="act_657781691826702",
  name="Cloudless Spring Campaign",
  budget_amount=20.0,
  budget_type="DAILY",
  platform_settings={
    objective: "OUTCOME_TRAFFIC",
    campaign_budget_optimization: true
  },
  targeting={ locations: ["GR", "CY"], languages: ["el", "en"], age_min: 25, age_max: 55 },
  ad_groups=[{
    name: "Web Dev Interest",
    targeting: { interests: [{id: "...", name: "Web development"}] },
    ads: [{
      name: "Cloudless Ad 1",
      creative: {
        headlines: ["Expert Web Development"],
        descriptions: ["Professional websites by cloudless.gr"],
        final_urls: ["https://cloudless.gr"],
        call_to_action: "LEARN_MORE"
      }
    }]
  }]
)
```

### Updating a campaign

```
campaign_update(ds_id="FA", account_id="act_657781691826702",
                campaign_id="12345", status="ENABLED")
```

## Connected Accounts (cloudless.gr)

### Known Account IDs
- **Facebook Ads**: Themistoklis Baltzakis — `act_657781691826702` (ds_id: `FA`)
- **LinkedIn Ads**: Baltzakis Ad Account — `512642510` (ds_id: `LIA`)

### Data Sources for Analytics
- **FA** — Facebook Ads (campaign + analytics)
- **FAM** — Facebook Organic (page insights, NOT for campaigns)
- **GAWA** — Google Analytics 4
- **LIA** — LinkedIn Ads (campaign + analytics)
- **LIO** — LinkedIn Organic

Always verify account IDs with `accounts_discovery` before querying.

## Common Queries for cloudless.gr

### Facebook Ads performance (last 30 days)
```
data_query(ds_id="FA", ds_accounts="act_657781691826702",
           fields="campaign_name,impressions,clicks,spend,ctr,cpc",
           date_range_type="last_30_days")
```

### Google Analytics traffic overview
```
data_query(ds_id="GAWA", fields="sessions,users,pageviews,bounceRate",
           date_range_type="last_30_days")
```

### Cross-platform spend comparison
Query each source separately (FA, LIA) and combine results.

### Keyword research for Google Ads
```
campaign_and_resource_get(ds_id="AW", account_id="<google_ads_id>",
                          resource_type="keyword_ideas",
                          params={keywords: "web development greece", language: "en", location: "GR"})
```

## Important Notes

- **Always run discovery first** — never guess ds_id, account_id, or field names
- Data queries are **async**: `data_query` returns a `schedule_id`, then poll `get_async_query_results`
- All `settings` from `data_source_discovery` config MUST be passed inside the `settings` object, NOT as root-level params
- Campaigns are always created as PAUSED — update status to ENABLED after review
- `compress=true` on discovery tools returns compact TOON format instead of JSON
- For monetary metrics, always include a currency dimension field
- Max 10,000 rows per query for best performance
- FA ad sets require `page_id` in `platform_settings` for ads
- TIK campaigns require at least one location in targeting
- LIA only supports: locations, languages, interests, custom_audiences for targeting
