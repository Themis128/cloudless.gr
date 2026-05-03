# TikTok Content Posting API — Complete Endpoint Reference

## Overview

The TikTok Content Posting API enables publishing videos and photos to TikTok on behalf of authorized users. This skill covers the full posting workflow, status monitoring, and creator info retrieval for cloudless.gr's social media strategy.

**Base URL:** `https://open.tiktokapis.com/v2`  
**Auth:** Bearer token (`act.{TOKEN}`) via OAuth 2.0  
**Required Scope:** `video.publish` + `video.upload`

---

## Endpoints

### 1. Creator Info Query

```
POST /v2/post/publish/creator_info/query/
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

**Purpose:** Get creator's posting capabilities and constraints before publishing.

**Response includes:**
- `max_video_post_duration_sec` (usually 300s)
- `privacy_level_options` — available privacy levels for this user
- `stitch_disabled`, `duet_disabled`, `comment_disabled` — feature availability
- `creator_avatar_url`, `creator_username`, `creator_nickname`

### 2. Direct Post — Video

```
POST /v2/post/publish/video/init/
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

**Request body:**
```json
{
  "post_info": {
    "title": "Video caption with #hashtags and @mentions",
    "privacy_level": "PUBLIC_TO_EVERYONE",
    "disable_duet": false,
    "disable_comment": false,
    "disable_stitch": false,
    "video_cover_timestamp_ms": 1000
  },
  "source_info": {
    "source": "FILE_UPLOAD",
    "video_size": 50000000,
    "chunk_size": 10000000,
    "total_chunk_count": 5
  }
}
```

**`source` options:**
| Source | Description | Additional Fields |
|--------|-------------|-------------------|
| `FILE_UPLOAD` | Upload from local file | `video_size`, `chunk_size`, `total_chunk_count` |
| `PULL_FROM_URL` | Pull from hosted URL | `video_url` (must be on verified domain) |

**Response:**
```json
{
  "data": {
    "publish_id": "v_pub_file~xxx",
    "upload_url": "https://open-upload.tiktokapis.com/video/upload/..."
  },
  "error": { "code": "ok", "message": "" }
}
```

### 3. File Upload (chunked)

After getting `upload_url` from init:

```
PUT {upload_url}
Content-Range: bytes {start}-{end}/{total}
Content-Type: video/mp4

<binary video data>
```

**Chunk constraints:**
- Minimum chunk: 5 MB
- Maximum chunk: 64 MB
- Final chunk: up to 128 MB (for trailing bytes)

### 4. Direct Post — Photo

```
POST /v2/post/publish/content/init/
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

**Request body:**
```json
{
  "post_info": {
    "title": "Photo post caption",
    "description": "Photo description",
    "privacy_level": "PUBLIC_TO_EVERYONE",
    "disable_comment": false,
    "auto_add_music": true
  },
  "source_info": {
    "source": "PULL_FROM_URL",
    "photo_cover_index": 0,
    "photo_images": [
      "https://example.com/photo1.jpg",
      "https://example.com/photo2.jpg"
    ]
  },
  "post_mode": "DIRECT_POST",
  "media_type": "PHOTO"
}
```

**Photo requirements:**
- URLs must be on verified domains
- Multiple images create a photo carousel
- `photo_cover_index` selects the cover image

### 5. Check Post Status

```
POST /v2/post/publish/status/fetch/
Authorization: Bearer {TOKEN}
Content-Type: application/json

{
  "publish_id": "v_pub_file~xxx"
}
```

**Status values:**
| Status | Description |
|--------|-------------|
| `PROCESSING_UPLOAD` | Video being uploaded |
| `PROCESSING_DOWNLOAD` | Video being downloaded from URL |
| `SEND_TO_USER_INBOX` | Sent to creator's inbox (for review) |
| `PUBLISH_COMPLETE` | Successfully published |
| `FAILED` | Publishing failed |

---

## Privacy Levels

| Level | Description |
|-------|-------------|
| `PUBLIC_TO_EVERYONE` | Visible to all users |
| `MUTUAL_FOLLOW_FRIENDS` | Only mutual followers |
| `FOLLOWER_OF_CREATOR` | Only creator's followers |
| `SELF_ONLY` | Private to creator only |

**Note:** Available levels depend on creator's account settings. Query `creator_info` first to check.

---

## Rate Limits

| Limit | Value |
|-------|-------|
| Requests per user per minute | 6 |
| Daily post limit | Varies by account tier |
| API calls (global) | Standard TikTok rate limits |

---

## Video Specifications

| Spec | Value |
|------|-------|
| Format | MP4 + H.264 |
| Max duration | 300 seconds (5 min) |
| Max file size | 4 GB |
| Min resolution | 360p |
| Recommended resolution | 1080x1920 (9:16) |
| Audio codec | AAC |

---

## Important Limitations

1. **Unaudited clients:** All content posted by unaudited clients is restricted to **private viewing mode**. Your app must pass TikTok's audit to post publicly.

2. **Domain verification:** For `PULL_FROM_URL`, video/photo URLs must be on domains you've verified in the TikTok Developer Portal.

3. **No scheduling:** The API does not support scheduled posts natively. Use external scheduling (IFTTT, custom cron).

4. **No editing:** Published posts cannot be edited via API. Must delete and re-post.

5. **No analytics API (separate):** The Content Posting API doesn't include analytics. TikTok Business API or Windsor.ai/Supermetrics needed for insights.

---

## Authentication Flow

1. Register app at [TikTok Developer Portal](https://developers.tiktok.com/)
2. Request `video.publish` + `video.upload` scopes
3. User authorizes via OAuth 2.0 redirect
4. Exchange auth code for access token
5. Use Bearer token in API calls

**Token endpoint:**
```
POST https://open.tiktokapis.com/v2/oauth/token/
Content-Type: application/x-www-form-urlencoded

client_key={APP_KEY}
&client_secret={APP_SECRET}
&code={AUTH_CODE}
&grant_type=authorization_code
&redirect_uri={REDIRECT_URI}
```

**Token refresh:**
```
POST https://open.tiktokapis.com/v2/oauth/token/
Content-Type: application/x-www-form-urlencoded

client_key={APP_KEY}
&grant_type=refresh_token
&refresh_token={REFRESH_TOKEN}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `ok` | Success |
| `access_token_invalid` | Token expired or invalid |
| `scope_not_authorized` | Missing required scope |
| `rate_limit_exceeded` | Too many requests |
| `spam_risk_too_many_posts` | Daily post limit exceeded |
| `unaudited_client_can_only_post_to_private_accounts` | App not audited |
| `privacy_level_option_mismatch` | Invalid privacy level for this creator |
| `video_file_too_large` | Exceeds max file size |

---

## Workflow: Post a Video from URL

```bash
# Step 1: Get creator info
curl -X POST "https://open.tiktokapis.com/v2/post/publish/creator_info/query/" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json"

# Step 2: Init video post
curl -X POST "https://open.tiktokapis.com/v2/post/publish/video/init/" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "post_info": {
      "title": "New cloudless.gr video! #webdev #crete",
      "privacy_level": "PUBLIC_TO_EVERYONE"
    },
    "source_info": {
      "source": "PULL_FROM_URL",
      "video_url": "https://example.com/video.mp4"
    }
  }'

# Step 3: Check status (poll)
curl -X POST "https://open.tiktokapis.com/v2/post/publish/status/fetch/" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"publish_id": "v_pub_url~xxx"}'
```

---

## References

- [TikTok Content Posting API - Get Started](https://developers.tiktok.com/doc/content-posting-api-get-started)
- [Direct Post Reference](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post)
- [Media Transfer Guide](https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide)
- [Post Status Reference](https://developers.tiktok.com/doc/content-posting-api-reference-get-video-status)
- [TikTok Developer Portal](https://developers.tiktok.com/)
