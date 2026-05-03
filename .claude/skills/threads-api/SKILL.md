# Threads API — Complete Endpoint Reference

## Overview

The Threads API enables publishing content, reading profiles, retrieving media, and accessing insights for Threads accounts. It uses the same Meta infrastructure as Instagram but with its own OAuth flow and endpoints.

**Base URL:** `https://graph.threads.net/v1.0`  
**Auth:** OAuth 2.0 via Instagram (Bearer token)  
**Required Scopes:** `threads_basic`, `threads_content_publish`, `threads_manage_insights`, `threads_manage_replies`

**Cloudless Account:**
- Threads username: `t_baltzakis`
- Threads User ID: `26733238892980904` (from Windsor.ai)
- App ID: `1936126137016578` (shared Meta app)

---

## Authentication

### OAuth 2.0 Flow (via Instagram)

**Step 1 — Authorization URL:**
```
https://threads.net/oauth/authorize
  ?client_id={APP_ID}
  &redirect_uri={REDIRECT_URI}
  &scope=threads_basic,threads_content_publish,threads_manage_insights,threads_manage_replies
  &response_type=code
  &state={CSRF_TOKEN}
```

**Step 2 — Exchange code for short-lived token:**
```bash
curl -X POST "https://graph.threads.net/oauth/access_token" \
  -d "client_id={APP_ID}" \
  -d "client_secret={APP_SECRET}" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri={REDIRECT_URI}" \
  -d "code={AUTH_CODE}"
```
Returns: `{"access_token": "...", "user_id": 12345}`

**Step 3 — Exchange for long-lived token (60 days):**
```bash
curl "https://graph.threads.net/access_token
  ?grant_type=th_exchange_token
  &client_secret={APP_SECRET}
  &access_token={SHORT_LIVED_TOKEN}"
```
Returns: `{"access_token": "...", "token_type": "bearer", "expires_in": 5184000}`

**Step 4 — Refresh long-lived token:**
```bash
curl "https://graph.threads.net/refresh_access_token
  ?grant_type=th_refresh_token
  &access_token={LONG_LIVED_TOKEN}"
```

---

## Permissions / Scopes

| Scope | Purpose |
|-------|---------|
| `threads_basic` | Read profile info and media |
| `threads_content_publish` | Create and publish posts |
| `threads_manage_insights` | Read account and media insights |
| `threads_manage_replies` | Read, reply to, hide, and unhide replies |
| `threads_read_replies` | Read replies (subset of manage_replies) |

---

## Endpoints

### 1. User Profile

```bash
GET /v1.0/{USER_ID}
  ?fields=id,username,threads_profile_picture_url,threads_biography
  &access_token={TOKEN}
```

**Available fields:**
- `id` — Threads user ID
- `username` — Handle (without @)
- `threads_profile_picture_url` — Avatar URL
- `threads_biography` — Bio text

---

### 2. Content Publishing (Two-Step Process)

#### Step 1 — Create Media Container

**Text post:**
```bash
curl -X POST "https://graph.threads.net/v1.0/{USER_ID}/threads" \
  -d "media_type=TEXT" \
  -d "text=Hello from cloudless.gr! #webdev" \
  -d "access_token={TOKEN}"
# Returns: {"id": "{CONTAINER_ID}"}
```

**Image post:**
```bash
curl -X POST "https://graph.threads.net/v1.0/{USER_ID}/threads" \
  -d "media_type=IMAGE" \
  -d "image_url=https://example.com/photo.jpg" \
  -d "text=Check this out!" \
  -d "access_token={TOKEN}"
```

**Video post:**
```bash
curl -X POST "https://graph.threads.net/v1.0/{USER_ID}/threads" \
  -d "media_type=VIDEO" \
  -d "video_url=https://example.com/video.mp4" \
  -d "text=Watch this!" \
  -d "access_token={TOKEN}"
```

**Carousel post:**
```bash
# Step A: Create child containers
curl -X POST "https://graph.threads.net/v1.0/{USER_ID}/threads" \
  -d "media_type=IMAGE" \
  -d "image_url=https://example.com/slide1.jpg" \
  -d "is_carousel_item=true" \
  -d "access_token={TOKEN}"
# → Returns CHILD_1_ID

curl -X POST "https://graph.threads.net/v1.0/{USER_ID}/threads" \
  -d "media_type=IMAGE" \
  -d "image_url=https://example.com/slide2.jpg" \
  -d "is_carousel_item=true" \
  -d "access_token={TOKEN}"
# → Returns CHILD_2_ID

# Step B: Create carousel container
curl -X POST "https://graph.threads.net/v1.0/{USER_ID}/threads" \
  -d "media_type=CAROUSEL" \
  -d "children={CHILD_1_ID},{CHILD_2_ID}" \
  -d "text=Swipe through!" \
  -d "access_token={TOKEN}"
# → Returns CAROUSEL_CONTAINER_ID
```

#### Step 2 — Publish Container

```bash
curl -X POST "https://graph.threads.net/v1.0/{USER_ID}/threads_publish" \
  -d "creation_id={CONTAINER_ID}" \
  -d "access_token={TOKEN}"
# Returns: {"id": "{MEDIA_ID}"}
```

#### Check Container Status (for videos — poll before publishing)

```bash
GET /v1.0/{CONTAINER_ID}
  ?fields=status,error_message
  &access_token={TOKEN}
```

**Status values:** `EXPIRED`, `ERROR`, `FINISHED`, `IN_PROGRESS`, `PUBLISHED`

---

### 3. Reply / Quote Post

**Reply to a thread:**
```bash
curl -X POST "https://graph.threads.net/v1.0/{USER_ID}/threads" \
  -d "media_type=TEXT" \
  -d "text=Great point!" \
  -d "reply_to_id={MEDIA_ID}" \
  -d "access_token={TOKEN}"
```

**Quote post:**
```bash
curl -X POST "https://graph.threads.net/v1.0/{USER_ID}/threads" \
  -d "media_type=TEXT" \
  -d "text=This is so relevant!" \
  -d "quote_post_id={MEDIA_ID}" \
  -d "access_token={TOKEN}"
```

---

### 4. Read Media

**List user's threads:**
```bash
GET /v1.0/{USER_ID}/threads
  ?fields=id,media_product_type,media_type,media_url,permalink,
          text,timestamp,shortcode,thumbnail_url,children,
          is_quote_post,alt_text,link_attachment_url
  &limit=25
  &access_token={TOKEN}
```

**Get single thread:**
```bash
GET /v1.0/{MEDIA_ID}
  ?fields=id,media_type,media_url,permalink,text,timestamp,
          username,is_quote_post
  &access_token={TOKEN}
```

---

### 5. Reply Management

**Get replies to a thread:**
```bash
GET /v1.0/{MEDIA_ID}/replies
  ?fields=id,text,username,timestamp,media_type,media_url,
          shortcode,has_replies,hide_status
  &access_token={TOKEN}
```

**Get conversation (all nested replies):**
```bash
GET /v1.0/{MEDIA_ID}/conversation
  ?fields=id,text,username,timestamp,media_type,has_replies
  &access_token={TOKEN}
```

**Hide/unhide a reply:**
```bash
POST /v1.0/{REPLY_ID}/manage_reply
  ?hide=true
  &access_token={TOKEN}
```

---

### 6. Insights

#### Media Insights

```bash
GET /v1.0/{MEDIA_ID}/insights
  ?metric=views,likes,replies,reposts,quotes
  &access_token={TOKEN}
```

| Metric | Description |
|--------|-------------|
| `views` | Number of times the thread was viewed |
| `likes` | Number of likes |
| `replies` | Number of replies |
| `reposts` | Number of reposts |
| `quotes` | Number of quote posts |

#### Account Insights

```bash
GET /v1.0/{USER_ID}/threads_insights
  ?metric=views,likes,replies,reposts,quotes,followers_count,follower_demographics
  &since={UNIX_TIMESTAMP}
  &until={UNIX_TIMESTAMP}
  &access_token={TOKEN}
```

| Metric | Description | Period |
|--------|-------------|--------|
| `views` | Total views across all threads | date range |
| `likes` | Total likes | date range |
| `replies` | Total replies | date range |
| `reposts` | Total reposts | date range |
| `quotes` | Total quotes | date range |
| `followers_count` | Current follower count | point-in-time |
| `follower_demographics` | Breakdown by country, city, age, gender | point-in-time |

**Demographic breakdowns (pass as `breakdown` param):**
- `country`
- `city`
- `age`
- `gender`

---

### 7. Publishing Limit

```bash
GET /v1.0/{USER_ID}/threads_publishing_limit
  ?fields=quota_usage,config
  &access_token={TOKEN}
```

Returns current usage against the 250 posts/24h limit.

---

## Media Constraints

| Constraint | Value |
|-----------|-------|
| Text max length | 500 characters |
| Image formats | JPEG, PNG |
| Image max size | 8MB |
| Video max size | 1GB |
| Video max duration | 5 minutes |
| Video min duration | 0 seconds (GIFs allowed) |
| Carousel max items | 20 |
| Hashtags | No explicit limit (within 500 char text limit) |
| Links | Auto-detected in text, or use `link_attachment_url` |
| Alt text | Supported via `alt_text` parameter |

---

## Rate Limits

| Limit | Value |
|-------|-------|
| Posts per 24 hours | 250 |
| API calls | Standard Meta Graph API limits (200/user/hour) |
| Container creation | No separate limit beyond post limit |

---

## Error Codes

| Code | Message | Fix |
|------|---------|-----|
| 190 | Invalid OAuth access token | Refresh token |
| 4 | Application request limit reached | Wait and retry |
| 10 | Permission denied | Check scopes |
| 100 | Invalid parameter | Check field names/values |
| 2207026 | Cannot reply to this thread | Thread has replies disabled |
| 2207001 | Media container expired | Create new container (24h expiry) |

---

## Workflow: Post a Text Thread

```bash
# Step 1: Create container
curl -X POST "https://graph.threads.net/v1.0/{USER_ID}/threads" \
  -d "media_type=TEXT" \
  -d "text=Just launched a new feature on cloudless.gr! Check it out 🚀 #webdev #nextjs" \
  -d "access_token={TOKEN}"
# Returns: {"id": "CONTAINER_123"}

# Step 2: Publish
curl -X POST "https://graph.threads.net/v1.0/{USER_ID}/threads_publish" \
  -d "creation_id=CONTAINER_123" \
  -d "access_token={TOKEN}"
# Returns: {"id": "MEDIA_456"}

# Step 3: Check insights (after some time)
curl "https://graph.threads.net/v1.0/MEDIA_456/insights?metric=views,likes,replies&access_token={TOKEN}"
```

---

## References

- [Threads API Overview](https://developers.facebook.com/docs/threads/)
- [Threads Publishing](https://developers.facebook.com/docs/threads/posts)
- [Threads Replies](https://developers.facebook.com/docs/threads/reply-management)
- [Threads Insights](https://developers.facebook.com/docs/threads/insights)
- [Threads API Changelog](https://developers.facebook.com/docs/threads/changelog)
