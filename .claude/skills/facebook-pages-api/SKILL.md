# Facebook Pages API — Complete Endpoint Reference

## Overview

The Facebook Pages API enables management of the cloudless.gr Facebook Page — publishing content, reading insights, moderating comments, managing settings, and receiving real-time updates via webhooks.

**Graph API Version:** v25.0  
**Base URL:** `https://graph.facebook.com/v25.0`

**Cloudless Account IDs:**
- Facebook Page: `116436681562585` (cloudless.gr)
- Meta Business Portfolio: `1558125105019725`
- Ad Account: `act_657781691826702`
- App ID: `1936126137016578`

---

## Authentication

All requests require a **Page Access Token** (not just a User Access Token).

### Getting a Page Access Token

```bash
# Step 1: Get user token from Graph API Explorer
# Step 2: Exchange for long-lived user token (see meta-business-suite skill)
# Step 3: Get Page token
curl "https://graph.facebook.com/v25.0/me/accounts?access_token={LONG_LIVED_USER_TOKEN}"
# Returns page tokens for all pages you manage
```

The Page Access Token returned inherits the lifetime of the user token used to generate it.

### Required Permissions

| Permission | Purpose | Task Level |
|-----------|---------|-----------|
| `pages_show_list` | List user's Pages | — |
| `pages_read_engagement` | Read posted content, fan count | MODERATE |
| `pages_manage_posts` | Create, edit, delete posts | CREATE_CONTENT |
| `pages_manage_engagement` | Moderate comments, hide/delete | MODERATE |
| `pages_read_user_content` | Read user-generated content | MODERATE |
| `pages_manage_metadata` | Update Page settings | MANAGE |
| `pages_manage_ads` | Create/manage ads | ADVERTISE |
| `pages_manage_cta` | Manage CTA buttons | MANAGE |
| `pages_messaging` | Send messages as Page | MESSAGING |
| `read_insights` | Read Page and Post analytics | ANALYZE |
| `business_management` | Control business portfolio assets | — |

---

## Content Publishing

### Text Post

```bash
curl -X POST "https://graph.facebook.com/v25.0/{PAGE_ID}/feed" \
  -d "message=Hello from cloudless.gr!" \
  -d "access_token={PAGE_TOKEN}"
# Returns: {"id": "{PAGE_ID}_{POST_ID}"}
```

### Link Post

```bash
curl -X POST "https://graph.facebook.com/v25.0/{PAGE_ID}/feed" \
  -d "message=Check out our latest article" \
  -d "link=https://cloudless.gr/blog/article" \
  -d "access_token={PAGE_TOKEN}"
```

### Photo Post

```bash
# Single photo
curl -X POST "https://graph.facebook.com/v25.0/{PAGE_ID}/photos" \
  -d "url=https://example.com/photo.jpg" \
  -d "message=Beautiful sunset from Crete" \
  -d "access_token={PAGE_TOKEN}"

# Multi-photo post (unpublished photos → batch publish)
# Step 1: Upload photos as unpublished
curl -X POST "https://graph.facebook.com/v25.0/{PAGE_ID}/photos" \
  -d "url=https://example.com/photo1.jpg" \
  -d "published=false" \
  -d "access_token={PAGE_TOKEN}"
# → Returns: {"id": "PHOTO_1_ID"}

curl -X POST "https://graph.facebook.com/v25.0/{PAGE_ID}/photos" \
  -d "url=https://example.com/photo2.jpg" \
  -d "published=false" \
  -d "access_token={PAGE_TOKEN}"
# → Returns: {"id": "PHOTO_2_ID"}

# Step 2: Create post with attached photos
curl -X POST "https://graph.facebook.com/v25.0/{PAGE_ID}/feed" \
  -d "message=Multiple photos!" \
  -d "attached_media[0]={\"media_fbid\":\"PHOTO_1_ID\"}" \
  -d "attached_media[1]={\"media_fbid\":\"PHOTO_2_ID\"}" \
  -d "access_token={PAGE_TOKEN}"
```

### Video Post

```bash
# Method 1: URL-based (simple, for publicly accessible video URLs)
curl -X POST "https://graph.facebook.com/v25.0/{PAGE_ID}/videos" \
  -d "file_url=https://example.com/video.mp4" \
  -d "title=My Video" \
  -d "description=Video description" \
  -d "access_token={PAGE_TOKEN}"

# Method 2: Resumable upload (for large files)
# See meta-business-suite skill for full resumable upload flow
```

### Scheduled Post

```bash
curl -X POST "https://graph.facebook.com/v25.0/{PAGE_ID}/feed" \
  -d "message=This will be published later" \
  -d "published=false" \
  -d "scheduled_publish_time={UNIX_TIMESTAMP}" \
  -d "access_token={PAGE_TOKEN}"
```

**Scheduling constraints:**
- Minimum: 10 minutes from now
- Maximum: 6 months from now
- Format: UNIX timestamp (seconds) or ISO 8601 string

### Unpublished/Draft Post

```bash
curl -X POST "https://graph.facebook.com/v25.0/{PAGE_ID}/feed" \
  -d "message=Draft post" \
  -d "published=false" \
  -d "access_token={PAGE_TOKEN}"
# Publish later by updating: POST /{POST_ID} with published=true
```

---

## Reading Content

### Page Feed

```bash
curl "https://graph.facebook.com/v25.0/{PAGE_ID}/feed?fields=
  id,message,created_time,full_picture,permalink_url,shares,
  likes.summary(true),comments.summary(true)
  &limit=25
  &access_token={PAGE_TOKEN}"
```

### Single Post

```bash
curl "https://graph.facebook.com/v25.0/{POST_ID}?fields=
  id,message,created_time,full_picture,permalink_url,
  shares,reactions.summary(true),comments.summary(true),
  attachments
  &access_token={PAGE_TOKEN}"
```

### Published Posts vs All Posts

```bash
# Only published posts
GET /{PAGE_ID}/published_posts

# All posts (including unpublished/scheduled)
GET /{PAGE_ID}/feed
```

---

## Comment Moderation

### Read Comments

```bash
curl "https://graph.facebook.com/v25.0/{POST_ID}/comments?fields=
  id,message,from,created_time,like_count,comment_count,
  attachment,parent
  &order=reverse_chronological
  &access_token={PAGE_TOKEN}"
```

### Reply to Comment

```bash
curl -X POST "https://graph.facebook.com/v25.0/{COMMENT_ID}/comments" \
  -d "message=Thanks for your comment!" \
  -d "access_token={PAGE_TOKEN}"
```

### Hide Comment

```bash
curl -X POST "https://graph.facebook.com/v25.0/{COMMENT_ID}" \
  -d "is_hidden=true" \
  -d "access_token={PAGE_TOKEN}"
```

### Delete Comment

```bash
curl -X DELETE "https://graph.facebook.com/v25.0/{COMMENT_ID}?access_token={PAGE_TOKEN}"
```

### Private Reply (DM a commenter)

```bash
curl -X POST "https://graph.facebook.com/v25.0/{COMMENT_ID}/private_replies" \
  -d "message=Hi! Let me help you privately." \
  -d "access_token={PAGE_TOKEN}"
```

---

## Page Insights

### Endpoint Format

```bash
# Multiple metrics
GET /{PAGE_ID}/insights?metric={metric1},{metric2}&period={period}&since={start}&until={end}

# Single metric
GET /{PAGE_ID}/insights/{metric_name}?period={period}
```

### Active Metrics (as of 2026)

| Metric | Description | Periods |
|--------|-------------|---------|
| `page_impressions_unique` | Unique people who saw any content | day, week, days_28 |
| `page_impressions_paid` | Impressions from paid distribution | day, week, days_28 |
| `page_impressions_organic` | Impressions from organic distribution | day, week, days_28 |
| `page_fans` | Total page likes/followers | lifetime |
| `page_fan_adds` | New likes | day |
| `page_fan_removes` | Unlikes | day |
| `page_views_total` | Total page views | day |
| `page_engaged_users` | People who engaged with content | day, week, days_28 |
| `page_post_engagements` | Post engagements (reactions, comments, shares) | day, week, days_28 |
| `page_video_views` | Total video views | day |
| `page_actions_post_reactions_total` | Total reactions on posts | day |

### Post-Level Insights

```bash
GET /{POST_ID}/insights?metric=
  post_impressions,
  post_impressions_unique,
  post_engaged_users,
  post_clicks,
  post_reactions_like_total,
  post_reactions_love_total,
  post_reactions_wow_total
```

| Metric | Description | Period |
|--------|-------------|--------|
| `post_impressions` | Times post was seen | lifetime |
| `post_impressions_unique` | Unique people who saw post | lifetime |
| `post_engaged_users` | People who clicked/reacted/commented/shared | lifetime |
| `post_clicks` | Total clicks on post | lifetime |
| `post_reactions_like_total` | Like reactions | lifetime |
| `post_reactions_love_total` | Love reactions | lifetime |
| `post_reactions_wow_total` | Wow reactions | lifetime |
| `post_reactions_haha_total` | Haha reactions | lifetime |
| `post_reactions_sorry_total` | Sad reactions | lifetime |
| `post_reactions_anger_total` | Angry reactions | lifetime |

### Important Deprecation Notice

**By June 15, 2026:** Many legacy Page Insights metrics will be deprecated for all API versions. Check the [deprecation guide](https://developers.facebook.com/docs/graph-api/reference/insights/) for the full list and replacements.

### Data Retention
- Public Pages: 2 years
- Unpublished Pages: 5 days only

---

## Page Management

### Read Page Info

```bash
curl "https://graph.facebook.com/v25.0/{PAGE_ID}?fields=
  id,name,about,category,fan_count,followers_count,
  description,website,phone,emails,hours,location,
  cover,picture,link,instagram_business_account
  &access_token={PAGE_TOKEN}"
```

### Update Page Info

```bash
curl -X POST "https://graph.facebook.com/v25.0/{PAGE_ID}" \
  -d "about=New about text" \
  -d "description=Updated description" \
  -d "website=https://cloudless.gr" \
  -d "access_token={PAGE_TOKEN}"
```

### Update Cover Photo

```bash
curl -X POST "https://graph.facebook.com/v25.0/{PAGE_ID}" \
  -d "cover={\"source\":\"https://example.com/cover.jpg\"}" \
  -d "access_token={PAGE_TOKEN}"
```

---

## Webhooks (Real-time Updates)

### Subscribable Fields

| Field | Triggers On |
|-------|-------------|
| `feed` | New post, comment, or reaction on Page |
| `mentions` | Page @mentioned in a post |
| `messages` | New message to Page inbox |
| `message_deliveries` | Message delivered confirmation |
| `message_reads` | Message read confirmation |
| `messaging_postbacks` | Quick reply or postback button click |
| `ratings` | New Page review/rating |

### Setup

```bash
# Subscribe app to page webhooks
curl -X POST "https://graph.facebook.com/v25.0/{PAGE_ID}/subscribed_apps" \
  -d "subscribed_fields=feed,messages,mentions" \
  -d "access_token={PAGE_TOKEN}"
```

### Webhook Verification

Your endpoint must handle a GET request with:
- `hub.mode=subscribe`
- `hub.challenge={CHALLENGE_TOKEN}`
- `hub.verify_token={YOUR_VERIFY_TOKEN}`

Return the `hub.challenge` value to verify.

---

## Reactions

### Read Reactions on a Post

```bash
curl "https://graph.facebook.com/v25.0/{POST_ID}/reactions?summary=total_count&access_token={PAGE_TOKEN}"
```

### Reaction Types

`LIKE`, `LOVE`, `WOW`, `HAHA`, `SAD`, `ANGRY`, `THANKFUL`, `PRIDE`, `CARE`

---

## Page Messaging

### Send Message as Page

```bash
curl -X POST "https://graph.facebook.com/v25.0/{PAGE_ID}/messages" \
  -d "recipient={\"id\":\"{PSID}\"}" \
  -d "message={\"text\":\"Hello!\"}" \
  -d "access_token={PAGE_TOKEN}"
```

Requires: `pages_messaging` permission and 24-hour messaging window.

---

## Rate Limits

| Operation | Limit | Window |
|-----------|-------|--------|
| Graph API calls | 200 calls/user/hour | Rolling |
| Page posts | 250 posts/24h | Rolling |
| Comment replies | 50/hour per Page | Rolling |
| Video uploads | Varies by account tier | Daily |
| Insights queries | Standard Graph API limits | Per-hour |

---

## Error Codes

| Code | Message | Fix |
|------|---------|-----|
| 100 | Invalid parameter | Check parameter names/values |
| 190 | Invalid OAuth access token | Refresh token |
| 200 | Permissions error | Request missing permission |
| 368 | Temporarily blocked for policies | Wait, review content policies |
| 506 | Duplicate post | Change message content slightly |
| 1609005 | Error posting link | Verify URL is accessible |

---

## New Pages Experience (2026)

Meta is migrating Pages to the "New Pages Experience" with updated endpoints:
- Profile-style layout for Pages
- Unified inbox across FB + IG + Messenger
- Separate professional and personal profiles
- New Page roles system (replacing legacy roles)

Check the [Pages API Release Notes](https://releasebot.io/updates/meta/pages-api) for the latest changes.

---

## References

- [Facebook Pages API](https://developers.facebook.com/docs/pages-api/)
- [Graph API Post Reference](https://developers.facebook.com/docs/graph-api/reference/post/)
- [Page Insights](https://developers.facebook.com/docs/platforminsights/page/)
- [Video API Publishing](https://developers.facebook.com/docs/video-api/guides/publishing/)
- [Page Videos Endpoint](https://developers.facebook.com/docs/graph-api/reference/page/videos/)
