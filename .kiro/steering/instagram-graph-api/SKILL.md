# Instagram Graph API — Complete Endpoint Reference

## Overview

The Instagram Graph API allows management of Instagram Professional (Business/Creator) accounts via the Meta Graph API. This skill documents every endpoint, parameter, and workflow for cloudless.gr's `@cloudless_gr` Instagram Business account.

**Graph API Version:** v25.0  
**Base URLs:**
- Facebook Login flow: `https://graph.facebook.com/v25.0`
- Instagram Login flow: `https://graph.instagram.com/v25.0`

**Cloudless Account IDs:**
- Facebook Page: `116436681562585`
- Instagram Business Account ID: **TBD** (see `meta-instagram/SKILL.md` for fix)
- Ad Account: `act_657781691826702`
- App ID: `1936126137016578`

---

## API Nodes

### 1. IG User (`/{ig-user-id}`)

Represents an Instagram Business or Creator Account.

**Read Fields:**
```
GET /{IG_USER_ID}?fields=
  id,
  username,
  name,
  biography,
  followers_count,
  follows_count,
  media_count,
  profile_picture_url,
  website,
  ig_id
```

**Edges:**
| Edge | Method | Description |
|------|--------|-------------|
| `/media` | GET | List published media objects |
| `/media` | POST | Create media container (for publishing) |
| `/media_publish` | POST | Publish a container |
| `/insights` | GET | Account-level metrics |
| `/content_publishing_limit` | GET | Check remaining publish quota |
| `/stories` | GET | List published stories |
| `/live_media` | GET | List live video media |
| `/tags` | GET | Media where user is tagged |
| `/recently_searched_hashtags` | GET | Recently searched hashtags |

---

### 2. IG Media (`/{ig-media-id}`)

Represents a photo, video, story, reel, or carousel album.

**Read Fields:**
```
GET /{MEDIA_ID}?fields=
  id,
  caption,
  media_type,           # IMAGE, VIDEO, CAROUSEL_ALBUM
  media_product_type,   # FEED, REELS, STORY
  media_url,
  thumbnail_url,        # video only
  permalink,
  timestamp,
  like_count,
  comments_count,
  is_shared_to_feed,
  username,
  children              # carousel children
```

**Edges:**
| Edge | Method | Description |
|------|--------|-------------|
| `/insights` | GET | Media-level metrics |
| `/comments` | GET | List comments |
| `/comments` | POST | Reply to/create comment |
| `/children` | GET | Carousel album children |

**Update (POST):**
- `comment_enabled` — Enable/disable comments

**Delete:**
- `DELETE /{MEDIA_ID}` — Delete a media object

---

### 3. IG Comment (`/{ig-comment-id}`)

**Read Fields:**
```
GET /{COMMENT_ID}?fields=
  id,
  text,
  username,
  timestamp,
  like_count,
  hidden,
  media,
  parent_id,
  from
```

**Edges:**
| Edge | Method | Description |
|------|--------|-------------|
| `/replies` | GET | Replies to this comment |
| `/replies` | POST | Reply to this comment |

**Update (POST):**
- `hide` — Hide/unhide a comment

**Delete:**
- `DELETE /{COMMENT_ID}` — Delete a comment

---

### 4. IG Container (`/{ig-container-id}`)

Used in the content publishing flow. Created via `POST /{IG_USER_ID}/media`.

**Read Fields:**
```
GET /{CONTAINER_ID}?fields=
  id,
  status,
  status_code    # EXPIRED | ERROR | FINISHED | IN_PROGRESS | PUBLISHED
```

---

### 5. IG Hashtag (`/{ig-hashtag-id}`)

**Available only with Facebook Login flow.**

**Read Fields:**
```
GET /{HASHTAG_ID}?fields=id,name
```

**Edges:**
| Edge | Method | Description |
|------|--------|-------------|
| `/top_media` | GET | Top 9 media for hashtag |
| `/recent_media` | GET | Most recent media for hashtag |

**Search:**
```
GET /ig_hashtag_search
  ?user_id={IG_USER_ID}
  &q={HASHTAG_TEXT}
```
Limit: 30 unique hashtag searches per 7 days per user.

---

### 6. Page (`/{page-id}`) — Instagram Context

**Read Fields (IG-relevant):**
```
GET /{PAGE_ID}?fields=
  instagram_business_account,
  connected_instagram_account
```

---

## Content Publishing — Detailed Reference

### Single Image Post

```bash
# Step 1: Create container
curl -X POST "https://graph.facebook.com/v25.0/{IG_USER_ID}/media" \
  -d "image_url=https://example.com/image.jpg" \
  -d "caption=Hello world! #cloudless" \
  -d "alt_text=Description for accessibility" \
  -d "access_token={TOKEN}"
# Returns: {"id": "{CONTAINER_ID}"}

# Step 2: Check status (poll every 60s, max 5 min)
curl "https://graph.facebook.com/v25.0/{CONTAINER_ID}?fields=status_code&access_token={TOKEN}"
# Returns: {"status_code": "FINISHED", "id": "{CONTAINER_ID}"}

# Step 3: Publish
curl -X POST "https://graph.facebook.com/v25.0/{IG_USER_ID}/media_publish" \
  -d "creation_id={CONTAINER_ID}" \
  -d "access_token={TOKEN}"
# Returns: {"id": "{MEDIA_ID}"}
```

### Reel

```bash
curl -X POST "https://graph.facebook.com/v25.0/{IG_USER_ID}/media" \
  -d "video_url=https://example.com/reel.mp4" \
  -d "media_type=REELS" \
  -d "caption=Check out this reel! #cloudless" \
  -d "share_to_feed=true" \
  -d "access_token={TOKEN}"
```

Additional Reel parameters:
- `cover_url` — Custom thumbnail URL
- `thumb_offset` — Thumbnail offset in milliseconds
- `share_to_feed` — Also appear in feed (default true)
- `collaborators` — Up to 3 collaborator usernames (array)
- `audio_name` — Custom audio name

### Story

```bash
curl -X POST "https://graph.facebook.com/v25.0/{IG_USER_ID}/media" \
  -d "image_url=https://example.com/story.jpg" \
  -d "media_type=STORIES" \
  -d "access_token={TOKEN}"
```

### Carousel

```bash
# Step 1: Create child containers (no caption on children)
curl -X POST "https://graph.facebook.com/v25.0/{IG_USER_ID}/media" \
  -d "image_url=https://example.com/slide1.jpg" \
  -d "is_carousel_item=true" \
  -d "access_token={TOKEN}"
# → Returns CHILD_1_ID

curl -X POST "https://graph.facebook.com/v25.0/{IG_USER_ID}/media" \
  -d "image_url=https://example.com/slide2.jpg" \
  -d "is_carousel_item=true" \
  -d "access_token={TOKEN}"
# → Returns CHILD_2_ID

# Step 2: Create carousel container
curl -X POST "https://graph.facebook.com/v25.0/{IG_USER_ID}/media" \
  -d "media_type=CAROUSEL" \
  -d "children={CHILD_1_ID},{CHILD_2_ID}" \
  -d "caption=Swipe through! #cloudless" \
  -d "access_token={TOKEN}"
# → Returns CAROUSEL_CONTAINER_ID

# Step 3: Publish
curl -X POST "https://graph.facebook.com/v25.0/{IG_USER_ID}/media_publish" \
  -d "creation_id={CAROUSEL_CONTAINER_ID}" \
  -d "access_token={TOKEN}"
```

### Resumable Video Upload (large files)

```bash
# For videos > 50MB, use rupload
curl -X POST "https://rupload.facebook.com/ig-api-upload/v25.0/{CONTAINER_ID}" \
  -H "Authorization: OAuth {TOKEN}" \
  -H "offset: 0" \
  -H "file_size: {BYTES}" \
  --data-binary "@video.mp4"
```

---

## Insights — Complete Metrics Reference

### Account Insights (`GET /{IG_USER_ID}/insights`)

| Metric | Description | Periods |
|--------|-------------|---------|
| `impressions` | Total times media objects seen | day |
| `reach` | Unique accounts that saw media | day |
| `profile_views` | Profile page views | day |
| `follower_count` | Net new followers | day |
| `email_contacts` | Email button taps | day |
| `phone_call_clicks` | Call button taps | day |
| `text_message_clicks` | Text button taps | day |
| `get_directions_clicks` | Directions taps | day |
| `website_clicks` | Website link taps | day |
| `online_followers` | Followers online by hour | lifetime |
| `audience_city` | Top cities | lifetime |
| `audience_country` | Top countries | lifetime |
| `audience_gender_age` | Gender/age breakdown | lifetime |
| `audience_locale` | Top locales | lifetime |

**Notes:**
- Demographic metrics require 100+ followers
- Empty data returns `[]` not `0`
- Ads-driven data excluded from aggregated fields

### Media Insights (`GET /{MEDIA_ID}/insights`)

| Metric | IMAGE | VIDEO | CAROUSEL | STORY | REEL |
|--------|-------|-------|----------|-------|------|
| `impressions` | yes | yes | yes | yes | yes |
| `reach` | yes | yes | yes | yes | yes |
| `engagement` | yes | yes | yes | - | - |
| `saved` | yes | yes | yes | - | yes |
| `video_views` | - | yes | - | - | yes |
| `shares` | - | - | - | - | yes |
| `plays` | - | - | - | - | yes |
| `total_interactions` | - | - | - | - | yes |
| `likes` | - | - | - | - | yes |
| `comments` | - | - | - | - | yes |
| `exits` | - | - | - | yes | - |
| `replies` | - | - | - | yes | - |
| `taps_forward` | - | - | - | yes | - |
| `taps_back` | - | - | - | yes | - |

---

## Mentions & Tags

### Get @Mentions

```
GET /{IG_USER_ID}/tags?fields=
  id,caption,media_type,media_url,permalink,timestamp,username
```

### Mentioned Media (Webhooks)

Subscribe to `mentions` webhook to get real-time notifications when your account is @mentioned.

---

## Comment Moderation

### List Comments
```
GET /{MEDIA_ID}/comments?fields=id,text,username,timestamp,like_count,replies
```

### Reply to Comment
```
POST /{COMMENT_ID}/replies
  ?message=Thanks for the comment!
  &access_token={TOKEN}
```

### Hide Comment
```
POST /{COMMENT_ID}
  ?hide=true
  &access_token={TOKEN}
```

### Delete Comment
```
DELETE /{COMMENT_ID}?access_token={TOKEN}
```

---

## Media Constraints

| Constraint | Value |
|-----------|-------|
| Image format | JPEG only (no MPO, JPS) |
| Image max file size | 8MB |
| Video max file size | 1GB (4GB for Reels) |
| Video max duration | 60s feed, 90s Reels, 60s Stories |
| Video min duration | 3s |
| Carousel max items | 10 |
| Caption max length | 2,200 characters |
| Hashtags per caption | 30 max |
| Alt text max length | 420 characters |
| Aspect ratio (feed) | 4:5 to 1.91:1 |
| Aspect ratio (stories) | 9:16 recommended |
| Aspect ratio (reels) | 9:16 recommended |

---

## Unsupported Features (via API)

These features are NOT available through the API:
- Shopping tags
- Branded content tags
- Filters and effects
- IGTV (deprecated)
- Direct Messages (use Messenger API instead)
- Boosted/promoted posts (use Marketing API)
- Account switching
- Follow/unfollow actions
- Like/unlike actions on others' posts

---

## Error Codes

| Code | Message | Fix |
|------|---------|-----|
| 190 | Invalid OAuth access token | Refresh token |
| 4 | Application request limit reached | Wait, reduce call frequency |
| 10 | Permissions error | Check permissions in App Dashboard |
| 24 | Too many containers created | Wait 24h, check publishing limit |
| 9007 | Media not found | Verify media URL is public HTTPS |
| 36003 | Container not ready | Poll status_code before publishing |

---

## References

- [Instagram Platform Overview](https://developers.facebook.com/docs/instagram-platform/)
- [Content Publishing Guide](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- [API Reference](https://developers.facebook.com/docs/instagram-platform/reference/)
- [Insights Documentation](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/insights/)
- [Instagram Business Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/)
