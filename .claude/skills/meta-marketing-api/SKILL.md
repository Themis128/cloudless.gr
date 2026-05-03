# Meta Marketing API (Ads) — Complete Endpoint Reference

## Overview

The Meta Marketing API enables creating, managing, and reporting on ad campaigns across Facebook, Instagram, Messenger, and Audience Network. This skill documents the full campaign hierarchy, targeting, optimization, and reporting for cloudless.gr's Meta Ads.

**Base URL:** `https://graph.facebook.com/v25.0`  
**Auth:** Bearer token (same as Graph API — needs `ads_management` + `ads_read` permissions)

**Cloudless Account IDs:**
- Ad Account: `act_657781691826702` (Themistoklis Baltzakis)
- Facebook Page: `116436681562585`
- App ID: `1936126137016578`
- Meta Business Portfolio: `1558125105019725`

---

## Campaign Hierarchy

```
Ad Account (act_657781691826702)
  └── Campaign (objective + budget strategy)
       └── Ad Set (targeting + schedule + budget + optimization)
            └── Ad (creative + format)
```

---

## Campaigns

### Create Campaign

```bash
curl -X POST "https://graph.facebook.com/v25.0/act_657781691826702/campaigns" \
  -d "name=Cloudless Brand Awareness Q2" \
  -d "objective=OUTCOME_AWARENESS" \
  -d "status=PAUSED" \
  -d "special_ad_categories=[]" \
  -d "buying_type=AUCTION" \
  -d "access_token={TOKEN}"
```

### Campaign Objectives (Outcome-Based)

| Objective | Description | Optimizations Available |
|-----------|-------------|------------------------|
| `OUTCOME_AWARENESS` | Brand awareness, reach | REACH, IMPRESSIONS, AD_RECALL_LIFT |
| `OUTCOME_TRAFFIC` | Drive website visits | LINK_CLICKS, LANDING_PAGE_VIEWS, REACH |
| `OUTCOME_ENGAGEMENT` | Post engagement, video views | POST_ENGAGEMENT, VIDEO_VIEWS, THRUPLAY |
| `OUTCOME_LEADS` | Lead generation | LEAD_GENERATION, CONVERSIONS |
| `OUTCOME_APP_PROMOTION` | App installs | APP_INSTALLS, APP_EVENTS |
| `OUTCOME_SALES` | Conversions, catalog sales | CONVERSIONS, VALUE, CATALOG_SALES |

### Read Campaigns

```bash
GET /act_657781691826702/campaigns
  ?fields=id,name,objective,status,daily_budget,lifetime_budget,
          start_time,stop_time,buying_type,bid_strategy,
          budget_remaining,spend_cap,created_time
  &filtering=[{"field":"status","operator":"IN","value":["ACTIVE","PAUSED"]}]
  &limit=50
  &access_token={TOKEN}
```

### Update Campaign

```bash
POST /{CAMPAIGN_ID}
  -d "name=Updated Campaign Name"
  -d "status=ACTIVE"
  -d "daily_budget=5000"
  -d "access_token={TOKEN}"
```

### Delete Campaign

```bash
DELETE /{CAMPAIGN_ID}?access_token={TOKEN}
```

---

## Ad Sets

### Create Ad Set

```bash
curl -X POST "https://graph.facebook.com/v25.0/act_657781691826702/adsets" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Web Developers Greece 25-45",
    "campaign_id": "{CAMPAIGN_ID}",
    "status": "PAUSED",
    "billing_event": "IMPRESSIONS",
    "optimization_goal": "LINK_CLICKS",
    "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
    "daily_budget": 2000,
    "start_time": "2026-04-21T00:00:00+0300",
    "end_time": "2026-05-21T00:00:00+0300",
    "targeting": {
      "geo_locations": {
        "countries": ["GR"],
        "location_types": ["home", "recent"]
      },
      "age_min": 25,
      "age_max": 45,
      "genders": [0],
      "publisher_platforms": ["facebook", "instagram"],
      "facebook_positions": ["feed", "story", "reels"],
      "instagram_positions": ["stream", "story", "reels", "explore"],
      "flexible_spec": [
        {
          "interests": [
            {"id": "6003139266461", "name": "Web development"},
            {"id": "6003384285439", "name": "JavaScript"}
          ]
        }
      ]
    },
    "access_token": "{TOKEN}"
  }'
```

### Targeting Structure

```json
{
  "targeting": {
    "geo_locations": {
      "countries": ["GR", "CY"],
      "regions": [{"key": "3847"}],
      "cities": [{"key": "1234", "radius": 25, "distance_unit": "kilometer"}],
      "zips": [{"key": "US:90210"}],
      "location_types": ["home", "recent", "travel_in"]
    },
    "excluded_geo_locations": {
      "countries": ["TR"]
    },
    "age_min": 18,
    "age_max": 65,
    "genders": [0, 1, 2],
    "locales": [6, 24],
    "publisher_platforms": ["facebook", "instagram", "audience_network", "messenger"],
    "facebook_positions": ["feed", "story", "reels", "right_hand_column", "instant_article", "marketplace", "video_feeds", "search"],
    "instagram_positions": ["stream", "story", "reels", "explore", "explore_home", "profile_feed"],
    "messenger_positions": ["messenger_home", "sponsored_messages", "story"],
    "device_platforms": ["mobile", "desktop"],
    "flexible_spec": [
      {
        "interests": [{"id": "ID", "name": "Name"}],
        "behaviors": [{"id": "ID", "name": "Name"}],
        "life_events": [{"id": "ID", "name": "Name"}],
        "industries": [{"id": "ID", "name": "Name"}],
        "income": [{"id": "ID", "name": "Name"}],
        "work_employers": [{"id": "ID", "name": "Name"}],
        "work_positions": [{"id": "ID", "name": "Name"}],
        "education_schools": [{"id": "ID", "name": "Name"}],
        "education_majors": [{"id": "ID", "name": "Name"}]
      }
    ],
    "exclusions": {
      "interests": [{"id": "ID", "name": "Name"}]
    },
    "custom_audiences": [{"id": "AUDIENCE_ID"}],
    "excluded_custom_audiences": [{"id": "AUDIENCE_ID"}],
    "connections": [{"id": "PAGE_ID"}],
    "excluded_connections": [{"id": "PAGE_ID"}]
  }
}
```

### Optimization Goals

| Goal | Best For | Billing Event |
|------|----------|---------------|
| `REACH` | Maximum unique users | IMPRESSIONS |
| `IMPRESSIONS` | Maximum impressions | IMPRESSIONS |
| `LINK_CLICKS` | Website traffic | IMPRESSIONS or LINK_CLICKS |
| `LANDING_PAGE_VIEWS` | Quality traffic | IMPRESSIONS |
| `POST_ENGAGEMENT` | Likes, comments, shares | IMPRESSIONS |
| `VIDEO_VIEWS` | Video views (2s+) | IMPRESSIONS |
| `THRUPLAY` | Video views (15s+ or completion) | THRUPLAY |
| `LEAD_GENERATION` | Lead form submissions | IMPRESSIONS |
| `CONVERSIONS` | Website conversions (pixel) | IMPRESSIONS |
| `VALUE` | Highest ROAS | IMPRESSIONS |
| `APP_INSTALLS` | App installations | IMPRESSIONS |
| `AD_RECALL_LIFT` | Brand recall | IMPRESSIONS |

### Bid Strategies

| Strategy | Description |
|----------|-------------|
| `LOWEST_COST_WITHOUT_CAP` | Spend budget to get most results (default) |
| `LOWEST_COST_WITH_BID_CAP` | Set max bid per result |
| `COST_CAP` | Target average cost per result |
| `MINIMUM_ROAS` | Target minimum return on ad spend |
| `LOWEST_COST_WITH_MIN_ROAS` | Combine lowest cost with ROAS floor |

### Budget

- `daily_budget` — Amount in account currency's minor unit (cents). Min varies by country (~$1/day for most).
- `lifetime_budget` — Total budget for ad set duration. Requires `end_time`.
- Only one of `daily_budget` or `lifetime_budget` can be set per ad set.

---

## Ads (Creatives)

### Create Ad

```bash
curl -X POST "https://graph.facebook.com/v25.0/act_657781691826702/ads" \
  -d "name=Cloudless Ad - Web Dev Audience" \
  -d "adset_id={ADSET_ID}" \
  -d "status=PAUSED" \
  -d "creative={\"creative_id\":\"{CREATIVE_ID}\"}" \
  -d "access_token={TOKEN}"
```

### Create Ad Creative

```bash
curl -X POST "https://graph.facebook.com/v25.0/act_657781691826702/adcreatives" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cloudless Services Creative",
    "object_story_spec": {
      "page_id": "116436681562585",
      "link_data": {
        "message": "Professional web development services in Crete",
        "link": "https://cloudless.gr/services",
        "name": "Cloudless Web Services",
        "description": "Next.js, AWS, full-stack development",
        "image_hash": "{IMAGE_HASH}",
        "call_to_action": {
          "type": "LEARN_MORE",
          "value": {"link": "https://cloudless.gr/services"}
        }
      }
    }
  }'
```

### CTA Types

`LEARN_MORE`, `SHOP_NOW`, `SIGN_UP`, `BOOK_TRAVEL`, `CONTACT_US`, `DOWNLOAD`, `GET_OFFER`, `GET_QUOTE`, `SUBSCRIBE`, `WATCH_MORE`, `APPLY_NOW`, `GET_DIRECTIONS`, `SEND_MESSAGE`, `CALL_NOW`, `WHATSAPP_MESSAGE`

### Upload Ad Image

```bash
curl -X POST "https://graph.facebook.com/v25.0/act_657781691826702/adimages" \
  -F "filename=@/path/to/image.jpg" \
  -F "access_token={TOKEN}"
# Returns: {"images": {"image.jpg": {"hash": "IMAGE_HASH", "url": "..."}}}
```

---

## Reporting / Insights

### Campaign Insights

```bash
GET /act_657781691826702/insights
  ?fields=campaign_name,impressions,reach,clicks,spend,
          cpc,cpm,ctr,actions,cost_per_action_type,
          frequency,video_thruplay_watched_actions
  &level=campaign
  &time_range={"since":"2026-04-01","until":"2026-04-20"}
  &time_increment=1
  &filtering=[{"field":"campaign.id","operator":"IN","value":["{CAMPAIGN_ID}"]}]
  &access_token={TOKEN}
```

### Key Metrics

| Metric | Description |
|--------|-------------|
| `impressions` | Times ad was shown |
| `reach` | Unique people who saw ad |
| `clicks` | All clicks |
| `spend` | Amount spent |
| `cpc` | Cost per click |
| `cpm` | Cost per 1000 impressions |
| `ctr` | Click-through rate |
| `frequency` | Average times each person saw ad |
| `actions` | Array of action types and counts |
| `conversions` | Conversion events |
| `cost_per_action_type` | Cost per each action type |
| `purchase_roas` | Return on ad spend |
| `video_thruplay_watched_actions` | ThruPlay video completions |

### Breakdown Dimensions

Add `&breakdowns=` with:
- `age`, `gender`, `age,gender`
- `country`, `region`
- `publisher_platform`, `platform_position`
- `device_platform`
- `impression_device`
- `product_id` (for catalog ads)

### Ad Set Insights

```bash
GET /{ADSET_ID}/insights
  ?fields=impressions,reach,clicks,spend,actions
  &time_range={"since":"2026-04-01","until":"2026-04-20"}
  &access_token={TOKEN}
```

### Ad-Level Insights

```bash
GET /{AD_ID}/insights
  ?fields=impressions,reach,clicks,spend,actions
  &time_range={"since":"2026-04-01","until":"2026-04-20"}
  &access_token={TOKEN}
```

---

## Custom Audiences

### Create Custom Audience (Website Traffic)

```bash
POST /act_657781691826702/customaudiences
  -d '{
    "name": "Website Visitors 30 Days",
    "subtype": "WEBSITE",
    "rule": {
      "inclusions": {
        "operator": "or",
        "rules": [{"event_sources": [{"id": "{PIXEL_ID}", "type": "pixel"}], "retention_seconds": 2592000}]
      }
    },
    "customer_file_source": "USER_PROVIDED_ONLY"
  }'
```

### Create Lookalike Audience

```bash
POST /act_657781691826702/customaudiences
  -d '{
    "name": "Lookalike - Website Visitors GR",
    "subtype": "LOOKALIKE",
    "origin_audience_id": "{SOURCE_AUDIENCE_ID}",
    "lookalike_spec": {
      "type": "similarity",
      "country": "GR",
      "ratio": 0.01
    }
  }'
```

---

## Meta Pixel

### Get Pixel Info

```bash
GET /act_657781691826702/adspixels
  ?fields=id,name,last_fired_time,is_created_by_business
  &access_token={TOKEN}
```

### Standard Events

`PageView`, `ViewContent`, `Search`, `AddToCart`, `InitiateCheckout`, `Purchase`, `Lead`, `CompleteRegistration`, `Subscribe`, `Contact`, `CustomizeProduct`, `FindLocation`, `Schedule`, `StartTrial`, `SubmitApplication`

---

## Rate Limits

| Tier | Limit |
|------|-------|
| Standard (dev) | 200 calls/user/hour |
| Standard (business) | 4800 calls/user/hour |
| Ads Insights | 60/hour per ad account |
| Batch requests | 50 calls per batch |

**BUC (Business Use Case) Rate Limiting:**
Higher limits granted per use case. Ad accounts are scored by spend level (tier 1-4).

---

## Budget Minimums (Selected Countries)

| Country | Currency | Min Daily Budget |
|---------|----------|-----------------|
| US | USD | $1.00 |
| Greece | EUR | €1.00 |
| UK | GBP | £1.00 |
| Cyprus | EUR | €1.00 |

Note: Actual minimums may vary by objective and bid strategy.

---

## DSA Compliance (EU Digital Services Act)

For ads targeting EU users, include:

```json
{
  "dsa_beneficiary": "cloudless.gr",
  "dsa_payor": "cloudless.gr"
}
```

Required when `is_dsa_region=true` for the targeted locations.

---

## Error Codes

| Code | Message | Fix |
|------|---------|-----|
| 100 | Invalid parameter | Check field names/values |
| 190 | Invalid OAuth access token | Refresh token |
| 200 | Permissions error | Need `ads_management` |
| 294 | Ad account disabled | Check account status |
| 1487390 | Ad set budget too low | Increase budget |
| 1815604 | Targeting spec too narrow | Broaden audience |
| 2446228 | Creative review failed | Check ad policies |
| 368 | Spam/policy violation | Wait, review content |

---

## Workflow: Create a Full Campaign

```bash
# 1. Create Campaign
POST /act_657781691826702/campaigns
  name=Cloudless Traffic Q2
  objective=OUTCOME_TRAFFIC
  status=PAUSED
  special_ad_categories=[]

# 2. Create Ad Set with targeting
POST /act_657781691826702/adsets
  campaign_id={CAMPAIGN_ID}
  name=Greek Web Devs
  optimization_goal=LINK_CLICKS
  billing_event=IMPRESSIONS
  bid_strategy=LOWEST_COST_WITHOUT_CAP
  daily_budget=2000
  targeting={...}
  status=PAUSED

# 3. Upload Ad Image
POST /act_657781691826702/adimages
  filename=@creative.jpg

# 4. Create Ad Creative
POST /act_657781691826702/adcreatives
  object_story_spec={page_id, link_data with image_hash}

# 5. Create Ad
POST /act_657781691826702/ads
  adset_id={ADSET_ID}
  creative={"creative_id": "{CREATIVE_ID}"}
  status=PAUSED

# 6. Review everything, then activate
POST /{CAMPAIGN_ID} status=ACTIVE
POST /{ADSET_ID} status=ACTIVE
POST /{AD_ID} status=ACTIVE

# 7. Monitor performance
GET /act_657781691826702/insights?level=campaign&fields=...
```

---

## References

- [Meta Marketing API Overview](https://developers.facebook.com/docs/marketing-apis/)
- [Campaign API Reference](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/)
- [Ad Set API Reference](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/)
- [Ad Creative Reference](https://developers.facebook.com/docs/marketing-api/reference/ad-creative/)
- [Targeting Specs](https://developers.facebook.com/docs/marketing-api/audiences/reference/basic-targeting/)
- [Ads Insights API](https://developers.facebook.com/docs/marketing-api/insights/)
- [Custom Audiences](https://developers.facebook.com/docs/marketing-api/audiences/)
