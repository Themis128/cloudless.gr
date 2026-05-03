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
