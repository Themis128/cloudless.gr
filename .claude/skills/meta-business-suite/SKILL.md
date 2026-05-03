# Meta Business Suite — Orchestration Skill

## Overview

This skill is the **central hub** for all Meta platform operations for cloudless.gr. It covers Facebook Pages, Instagram (Graph API), Meta Ads, and the unified Business Suite workflows. Use this skill whenever the user asks about Meta, Facebook, Instagram, publishing, scheduling, insights, ads, or audience management.

**Related skills (deep-dive):**
- `meta-instagram/SKILL.md` — MCP server config, token generation, existing tool reference
- `instagram-graph-api/SKILL.md` — Full Instagram API endpoint reference
- `facebook-pages-api/SKILL.md` — Full Facebook Pages API endpoint reference

---

## Account Inventory

| Asset | ID | Notes |
|-------|-----|-------|
| Meta App | `1936126137016578` | "cloudless-marketing" |
| Facebook Page | `116436681562585` | cloudless.gr |
| Meta Business Portfolio | `1558125105019725` | |
| Ad Account | `act_657781691826702` | Themistoklis Baltzakis |
| Instagram Account | `@cloudless_gr` | Business account (confirmed 2026-04-20) |
| IG Business Account ID | **TBD** | Blocked — lite-mode connection; see fix steps in `meta-instagram/SKILL.md` |
| Access Token | 60-day token | Expires ~2026-06-19; refresh via token exchange flow |

---

## Authentication Architecture

### Token Types

| Token | How to Get | Lifetime | Use For |
|-------|-----------|----------|---------|
| Short-lived User Token | Graph API Explorer → Generate | ~1 hour | Bootstrap only |
| Long-lived User Token | Exchange short-lived via `/oauth/access_token` | 60 days | API calls, config |
| Page Access Token | `GET /me/accounts` with user token | Same as user token | Page publishing, insights |
| System User Token | Business Manager → System Users | Never expires | Production automation |

### Token Exchange Endpoint

```
GET https://graph.facebook.com/v25.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id=1936126137016578
  &client_secret=2d77630ff18b1cea3e4e00ba2f9a7b73
  &fb_exchange_token={SHORT_TOKEN}
```

### Required Permissions (all approved)

| Permission | Purpose |
|-----------|---------|
| `instagram_basic` | Read IG profile, media, followers |
| `instagram_content_publish` | Post photos, Reels, carousels to IG |
| `instagram_manage_insights` | IG account + post analytics |
| `pages_show_list` | List Facebook Pages |
| `pages_read_engagement` | Read page content, IG business account field |
| `pages_manage_posts` | Publish and schedule FB content |
| `pages_manage_engagement` | Moderate comments, delete posts |
| `pages_read_user_content` | Read user-generated Page content |
| `pages_manage_metadata` | Configure Page settings |
| `ads_management` | Create/manage Meta Ads campaigns |
| `ads_read` | Read campaign insights |
| `business_management` | Control business assets |
| `read_insights` | Read Page Insights |

---

## Publishing Workflows

### Instagram Publishing (Container-based)

All IG publishing uses a 3-step container flow:

**Step 1 — Create Container**
```
POST /{IG_USER_ID}/media
  ?image_url={URL}           # or video_url for video/reels
  &media_type=IMAGE           # IMAGE | VIDEO | REELS | STORIES | CAROUSEL
  &caption={text}
  &access_token={TOKEN}
```

**Step 2 — Check Status** (poll every 60s, max 5 min)
```
GET /{CONTAINER_ID}?fields=status_code
```
Status values: `IN_PROGRESS` → `FINISHED` → ready to publish

**Step 3 — Publish**
```
POST /{IG_USER_ID}/media_publish
  ?creation_id={CONTAINER_ID}
  &access_token={TOKEN}
```

#### Content Types

| Type | `media_type` | Key Params | Notes |
|------|-------------|------------|-------|
| Photo | `IMAGE` | `image_url`, `caption`, `alt_text` | JPEG only |
| Video | `VIDEO` | `video_url`, `caption` | |
| Reel | `REELS` | `video_url`, `caption` | Returns `media_type=VIDEO`; check `media_product_type` |
| Story | `STORIES` | `image_url` or `video_url` | 24h lifetime |
| Carousel | `CAROUSEL` | `children` (up to 10 container IDs), `caption` | Create child containers first |
| Trial Reel | `REELS` | `trial_params` with `graduation_strategy` | MANUAL or SS_PERFORMANCE |

#### IG Rate Limits
- 100 API-published posts per 24h (carousels count as 1)
- 50 carousel posts per 24h
- 200 API calls per user per hour (Graph API global)
- Check usage: `GET /{IG_USER_ID}/content_publishing_limit`

### Facebook Page Publishing

**Text Post**
```
POST /{PAGE_ID}/feed
  ?message={text}
  &access_token={PAGE_TOKEN}
```

**Photo Post**
```
POST /{PAGE_ID}/photos
  ?url={IMAGE_URL}
  &message={caption}
  &access_token={PAGE_TOKEN}
```

**Video Post** (resumable upload)
```
# Step 1: Initiate upload session
POST /{APP_ID}/uploads
  ?file_name=video.mp4
  &file_length={bytes}
  &file_type=video/mp4

# Step 2: Upload file
POST /upload:{SESSION_ID}
  Header: file_offset: 0
  Body: binary file data
  → Returns: file handle

# Step 3: Publish
POST /{PAGE_ID}/videos
  ?fbuploader_video_file_chunk={FILE_HANDLE}
  &title={title}
  &description={description}
  &access_token={PAGE_TOKEN}
```

**Scheduled Post**
```
POST /{PAGE_ID}/feed
  ?message={text}
  &published=false
  &scheduled_publish_time={UNIX_TIMESTAMP}
  &access_token={PAGE_TOKEN}
```
Schedule window: 10 minutes to 6 months from now.

**Link Post**
```
POST /{PAGE_ID}/feed
  ?message={text}
  &link={URL}
  &access_token={PAGE_TOKEN}
```

---

## Insights & Analytics

### Instagram Account Insights

```
GET /{IG_USER_ID}/insights
  ?metric=impressions,reach,profile_views
  &period=day
  &since={UNIX_START}
  &until={UNIX_END}
```

| Metric | Description | Period |
|--------|-------------|--------|
| `impressions` | Total times media objects seen | day |
| `reach` | Unique accounts that saw media | day |
| `profile_views` | Users who viewed profile | day |
| `follower_count` | New followers (requires 100+ followers) | day |
| `email_contacts` | Email button taps | day |
| `phone_call_clicks` | Call button taps | day |
| `text_message_clicks` | Text button taps | day |
| `get_directions_clicks` | Directions button taps | day |
| `website_clicks` | Website link taps | day |
| `online_followers` | Followers online by hour | lifetime |
| `audience_city` | Follower city breakdown | lifetime |
| `audience_country` | Follower country breakdown | lifetime |
| `audience_gender_age` | Follower gender/age breakdown | lifetime |

### Instagram Media Insights

```
GET /{MEDIA_ID}/insights
  ?metric=engagement,impressions,reach,saved
```

| Metric | Description | Available On |
|--------|-------------|-------------|
| `engagement` | Likes + comments | IMAGE, VIDEO, CAROUSEL |
| `impressions` | Times media seen | IMAGE, VIDEO, CAROUSEL |
| `reach` | Unique views | IMAGE, VIDEO, CAROUSEL, STORY, REEL |
| `saved` | Unique saves | IMAGE, VIDEO, CAROUSEL |
| `video_views` | Video views (3s+) | VIDEO, REEL |
| `shares` | Times shared | REEL |
| `plays` | Total plays | REEL |
| `total_interactions` | All interactions | REEL |
| `exits` | Story exits | STORY |
| `replies` | Story replies | STORY |
| `taps_forward` | Story tap forward | STORY |
| `taps_back` | Story tap back | STORY |

### Facebook Page Insights

```
GET /{PAGE_ID}/insights
  ?metric=page_impressions_unique,page_fans
  &period=day
  &since={START}&until={END}
```

| Metric | Description | Period |
|--------|-------------|--------|
| `page_impressions_unique` | Unique people who saw content | day, week, days_28 |
| `page_impressions_paid` | Paid distribution impressions | day, week, days_28 |
| `page_fans` | Total page likes | lifetime |
| `page_fan_adds` | New page likes | day |
| `page_fan_removes` | Page unlikes | day |
| `page_views_total` | Total page views | day |
| `page_engaged_users` | People who engaged | day, week, days_28 |

**Important:** By June 15, 2026, many legacy Page Insights metrics will be deprecated. Use the new metrics format.

### Facebook Post Insights

```
GET /{POST_ID}/insights
  ?metric=post_reactions_like_total,post_impressions,post_engaged_users
```

### Marketing API Insights (Ads)

```
GET /act_{AD_ACCOUNT_ID}/insights
  ?fields=impressions,reach,clicks,spend,cpm,ctr
  &level=campaign                    # campaign | adset | ad
  &date_preset=last_7d               # or time_range
  &action_attribution_windows=7d_click,1d_view
```

Available at 4 levels: `act_{ID}/insights`, `{CAMPAIGN_ID}/insights`, `{ADSET_ID}/insights`, `{AD_ID}/insights`

---

## Webhooks

Meta supports real-time webhooks for:
- **Page**: feed updates, mentions, messages, ratings
- **Instagram**: comments, mentions, story insights
- **WhatsApp**: messages, status updates

Webhook URL must be HTTPS with valid SSL. Verification uses a challenge token.

---

## Common Workflows

### Daily Social Media Post (IG + FB)

1. Create IG container → check status → publish
2. Post same content to FB Page `/feed` with photo
3. Log insights after 24h

### Weekly Analytics Report

1. Pull IG account insights for last 7 days
2. Pull FB page insights for last 7 days
3. Pull ad campaign insights
4. Combine with Windsor.ai data for cross-platform view

### Content Calendar Automation

1. Create posts with `published=false` on FB
2. Set `scheduled_publish_time` for desired publish time
3. For IG: use external scheduler (no native API scheduling yet — use container creation at publish time)

---

## Rate Limits Summary

| Platform | Limit | Window |
|----------|-------|--------|
| Graph API (global) | 200 calls/user/hour | Rolling |
| IG Content Publishing | 100 posts/24h | Rolling 24h |
| IG Carousels | 50 posts/24h | Rolling 24h |
| FB Page Posts | 250 posts/24h | Rolling 24h |
| Marketing API | Tier-based (varies by spend) | Hourly |
| Page Insights | 2 years retention (public pages) | N/A |
| Unpublished Page Insights | 5 days retention | N/A |

---

## Decision Tree

```
User wants to...
├── Publish to Instagram
│   ├── Photo → instagram-graph-api skill → container flow with IMAGE
│   ├── Video/Reel → instagram-graph-api skill → container flow with REELS
│   ├── Story → instagram-graph-api skill → container flow with STORIES
│   └── Carousel → instagram-graph-api skill → create children then CAROUSEL
├── Publish to Facebook
│   ├── Text → POST /{PAGE_ID}/feed
│   ├── Photo → POST /{PAGE_ID}/photos
│   ├── Video → Resumable upload then /{PAGE_ID}/videos
│   └── Scheduled → POST /{PAGE_ID}/feed?published=false&scheduled_publish_time=X
├── View Analytics
│   ├── IG Account → GET /{IG_USER_ID}/insights
│   ├── IG Post → GET /{MEDIA_ID}/insights
│   ├── FB Page → GET /{PAGE_ID}/insights
│   ├── FB Post → GET /{POST_ID}/insights
│   └── Ads → GET /act_{AD_ACCOUNT}/insights
├── Manage Ads
│   ├── List campaigns → GET /act_{AD_ACCOUNT}/campaigns
│   ├── Create campaign → POST /act_{AD_ACCOUNT}/campaigns
│   └── Campaign insights → GET /{CAMPAIGN_ID}/insights
└── Manage Comments
    ├── IG → GET /{MEDIA_ID}/comments, POST /{MEDIA_ID}/comments
    └── FB → GET /{POST_ID}/comments, POST /{POST_ID}/comments
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|---------|
| `OAuthException code 190` | Token expired | Refresh via token exchange endpoint |
| `instagram_business_account` is null | Lite-mode connection or Personal account | Complete full IG-FB Page connection (see `meta-instagram/SKILL.md`) |
| "Business Account Not Allowed to Advertise" | Ad policy issue on Business Portfolio | Ignore for content/insights — only affects ads |
| IG publish returns `EXPIRED` | Container not published within 24h | Create new container |
| IG publish returns `ERROR` | Bad media URL or unsupported format | Use public HTTPS URL, JPEG for images |
| FB post returns `(#200) Permissions error` | Missing `pages_manage_posts` | Re-grant permission in Graph API Explorer |
| Insights return empty data | Too few followers or no data in range | Need 100+ followers for demographic insights |
| Page metrics deprecated error | Using pre-June 2026 deprecated metrics | Switch to new metrics format per deprecation guide |

---

## References

- [Instagram Platform Documentation](https://developers.facebook.com/docs/instagram-platform/)
- [Instagram Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- [Facebook Pages API](https://developers.facebook.com/docs/pages-api/)
- [Marketing API Insights](https://developers.facebook.com/docs/marketing-api/insights/)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Page Insights Reference](https://developers.facebook.com/docs/platforminsights/page/)
