# LinkedIn Marketing API — Complete Endpoint Reference

## Overview

The LinkedIn Marketing API enables publishing organic posts, managing company pages, running ad campaigns, and reading analytics for LinkedIn presence. This skill covers the Posts API (organic content), Organization API (page management), and Marketing API (ads).

**Base URL:** `https://api.linkedin.com/rest`  
**Auth:** OAuth 2.0 Bearer token  
**API Version:** `202504` (April 2025 — versioned monthly)  
**Required Headers:**
```
Authorization: Bearer {TOKEN}
LinkedIn-Version: 202504
X-Restli-Protocol-Version: 2.0.0
Content-Type: application/json
```

**Cloudless Account:**
- LinkedIn Organic Page: cloudless.gr (URN: `urn:li:organization:108614163`)
- LinkedIn Ads Account: Baltzakis Ad Account (ID: `512642510`)
- Connected via Windsor.ai ✅

---

## Authentication

### OAuth 2.0 (3-Legged)

**Step 1 — Authorization URL:**
```
https://www.linkedin.com/oauth/v2/authorization
  ?response_type=code
  &client_id={CLIENT_ID}
  &redirect_uri={REDIRECT_URI}
  &scope=r_liteprofile%20r_organization_social%20w_organization_social%20rw_organization_admin%20r_ads%20rw_ads%20r_ads_reporting
  &state={CSRF_TOKEN}
```

**Step 2 — Exchange code for token:**
```bash
curl -X POST "https://www.linkedin.com/oauth/v2/accessToken" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code={AUTH_CODE}" \
  -d "client_id={CLIENT_ID}" \
  -d "client_secret={CLIENT_SECRET}" \
  -d "redirect_uri={REDIRECT_URI}"
```

Returns: `{"access_token": "...", "expires_in": 5184000}` (60 days)

**Step 3 — Refresh token:**
```bash
curl -X POST "https://www.linkedin.com/oauth/v2/accessToken" \
  -d "grant_type=refresh_token" \
  -d "refresh_token={REFRESH_TOKEN}" \
  -d "client_id={CLIENT_ID}" \
  -d "client_secret={CLIENT_SECRET}"
```

---

## Permissions / Scopes

| Scope | Purpose |
|-------|---------|
| `r_liteprofile` | Read member profile |
| `r_organization_social` | Read org posts and comments |
| `w_organization_social` | Create/delete org posts and comments |
| `rw_organization_admin` | Manage organization page |
| `r_ads` | Read ad accounts and campaigns |
| `rw_ads` | Create/manage ads |
| `r_ads_reporting` | Read ad analytics |
| `w_member_social` | Post as member (personal posts) |

---

## Posts API (Organic Content)

### Create a Post

```bash
curl -X POST "https://api.linkedin.com/rest/posts" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "LinkedIn-Version: 202504" \
  -H "X-Restli-Protocol-Version: 2.0.0" \
  -H "Content-Type: application/json" \
  -d '{
    "author": "urn:li:organization:108614163",
    "commentary": "Excited to announce our latest blog post on Next.js performance! #webdev #nextjs",
    "visibility": "PUBLIC",
    "distribution": {
      "feedDistribution": "MAIN_FEED",
      "targetEntities": [],
      "thirdPartyDistributionChannels": []
    },
    "lifecycleState": "PUBLISHED",
    "isReshareDisabledByAuthor": false
  }'
```

Returns: `201 Created` with `x-restli-id` header containing the post URN.

### Content Types

#### Text Only
```json
{
  "author": "urn:li:organization:108614163",
  "commentary": "Your text here",
  "visibility": "PUBLIC",
  "distribution": {"feedDistribution": "MAIN_FEED"},
  "lifecycleState": "PUBLISHED"
}
```

#### Image Post
```json
{
  "author": "urn:li:organization:108614163",
  "commentary": "Check out this image!",
  "visibility": "PUBLIC",
  "distribution": {"feedDistribution": "MAIN_FEED"},
  "lifecycleState": "PUBLISHED",
  "content": {
    "media": {
      "title": "Image title",
      "id": "urn:li:image:{ASSET_ID}",
      "altText": "Description for accessibility"
    }
  }
}
```

#### Multi-Image Post
```json
{
  "author": "urn:li:organization:108614163",
  "commentary": "Multiple images!",
  "visibility": "PUBLIC",
  "distribution": {"feedDistribution": "MAIN_FEED"},
  "lifecycleState": "PUBLISHED",
  "content": {
    "multiImage": {
      "images": [
        {"id": "urn:li:image:{ASSET_1}", "altText": "First image"},
        {"id": "urn:li:image:{ASSET_2}", "altText": "Second image"}
      ]
    }
  }
}
```

#### Video Post
```json
{
  "author": "urn:li:organization:108614163",
  "commentary": "Watch our latest video",
  "visibility": "PUBLIC",
  "distribution": {"feedDistribution": "MAIN_FEED"},
  "lifecycleState": "PUBLISHED",
  "content": {
    "media": {
      "title": "Video title",
      "id": "urn:li:video:{ASSET_ID}"
    }
  }
}
```

#### Article/Link Post
```json
{
  "author": "urn:li:organization:108614163",
  "commentary": "Read our latest article",
  "visibility": "PUBLIC",
  "distribution": {"feedDistribution": "MAIN_FEED"},
  "lifecycleState": "PUBLISHED",
  "content": {
    "article": {
      "source": "https://cloudless.gr/blog/article",
      "title": "Article Title",
      "description": "Article description",
      "thumbnail": "urn:li:image:{ASSET_ID}"
    }
  }
}
```

#### Document/PDF Post
```json
{
  "author": "urn:li:organization:108614163",
  "commentary": "Download our guide",
  "visibility": "PUBLIC",
  "distribution": {"feedDistribution": "MAIN_FEED"},
  "lifecycleState": "PUBLISHED",
  "content": {
    "media": {
      "title": "Document title",
      "id": "urn:li:document:{ASSET_ID}"
    }
  }
}
```

#### Poll Post
```json
{
  "author": "urn:li:organization:108614163",
  "commentary": "What framework do you prefer?",
  "visibility": "PUBLIC",
  "distribution": {"feedDistribution": "MAIN_FEED"},
  "lifecycleState": "PUBLISHED",
  "content": {
    "poll": {
      "question": "Best JS framework for 2026?",
      "options": [
        {"text": "Next.js"},
        {"text": "Nuxt.js"},
        {"text": "SvelteKit"},
        {"text": "Remix"}
      ],
      "settings": {
        "duration": "THREE_DAYS"
      }
    }
  }
}
```

Poll durations: `ONE_DAY`, `THREE_DAYS`, `ONE_WEEK`, `TWO_WEEKS`

---

### Image/Video Upload Flow

#### Step 1 — Initialize Upload

**Image:**
```bash
curl -X POST "https://api.linkedin.com/rest/images?action=initializeUpload" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "LinkedIn-Version: 202504" \
  -H "Content-Type: application/json" \
  -d '{
    "initializeUploadRequest": {
      "owner": "urn:li:organization:108614163"
    }
  }'
```
Returns: `{"value": {"uploadUrl": "...", "image": "urn:li:image:..."}}`

**Video:**
```bash
curl -X POST "https://api.linkedin.com/rest/videos?action=initializeUpload" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "LinkedIn-Version: 202504" \
  -H "Content-Type: application/json" \
  -d '{
    "initializeUploadRequest": {
      "owner": "urn:li:organization:108614163",
      "fileSizeBytes": 52428800,
      "uploadCaptions": false,
      "uploadThumbnail": false
    }
  }'
```

#### Step 2 — Upload Binary

```bash
curl -X PUT "{UPLOAD_URL}" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@image.jpg"
```

#### Step 3 — Use Asset URN in Post

Use the `urn:li:image:{ID}` or `urn:li:video:{ID}` from Step 1 in the post's `content` field.

---

### Read Posts

```bash
# Get organization's posts
GET /rest/posts?author=urn:li:organization:108614163&q=author&count=20
  &sortBy=LAST_MODIFIED

# Get single post
GET /rest/posts/{POST_URN}
```

### Delete Post

```bash
DELETE /rest/posts/{POST_URN}
```

### Edit Post (limited — commentary only)

```bash
POST /rest/posts/{POST_URN}
  -d '{"patch": {"$set": {"commentary": "Updated text"}}}'
```

---

## Mentions & Hashtags

### Mention a person or organization in commentary:

```
"commentary": "Great work by @[Themistoklis Baltzakis](urn:li:person:XXXXX) at @[cloudless.gr](urn:li:organization:108614163)!"
```

Format: `@[Display Name](URN)`

### Hashtags:

Simply include in commentary text: `#webdev #nextjs #cloudless`

---

## Organization API (Page Management)

### Get Organization Info

```bash
GET /rest/organizations/108614163
  ?fields=id,localizedName,vanityName,localizedDescription,
          logoV2,coverPhotoV2,staffCountRange,locations,website
```

### Get Organization Statistics

```bash
GET /rest/organizationalEntityShareStatistics
  ?q=organizationalEntity
  &organizationalEntity=urn:li:organization:108614163
  &timeIntervals.timeGranularityType=DAY
  &timeIntervals.timeRange.start={EPOCH_MS}
  &timeIntervals.timeRange.end={EPOCH_MS}
```

Returns: `totalShareStatistics` (impressions, clicks, likes, comments, shares, engagement, followerCount)

### Get Follower Statistics

```bash
GET /rest/organizationalEntityFollowerStatistics
  ?q=organizationalEntity
  &organizationalEntity=urn:li:organization:108614163
```

Returns follower demographics: functions, seniorities, industries, locations, company sizes.

---

## Comments API

### Get Comments on a Post

```bash
GET /rest/socialActions/{POST_URN}/comments?start=0&count=20
```

### Create Comment

```bash
POST /rest/socialActions/{POST_URN}/comments
  -d '{
    "actor": "urn:li:organization:108614163",
    "message": {"text": "Thanks for sharing!"}
  }'
```

### Delete Comment

```bash
DELETE /rest/socialActions/{POST_URN}/comments/{COMMENT_URN}
```

---

## Ads API (Campaign Management)

### Account Structure

```
Ad Account (Sponsored Account)
  └── Campaign Group
       └── Campaign
            └── Creative (Ad)
```

### List Ad Accounts

```bash
GET /rest/adAccounts?q=search&search=(status:(values:List(ACTIVE)))
```

### Create Campaign Group

```bash
POST /rest/adCampaignGroups
  -d '{
    "account": "urn:li:sponsoredAccount:512642510",
    "name": "Cloudless Q2 2026",
    "status": "ACTIVE",
    "runSchedule": {
      "start": 1714521600000,
      "end": 1722384000000
    },
    "totalBudget": {"currencyCode": "EUR", "amount": "5000"}
  }'
```

### Create Campaign

```bash
POST /rest/adCampaigns
  -d '{
    "account": "urn:li:sponsoredAccount:512642510",
    "campaignGroup": "urn:li:sponsoredCampaignGroup:{GROUP_ID}",
    "name": "Brand Awareness - Web Dev",
    "type": "SPONSORED_UPDATES",
    "status": "ACTIVE",
    "costType": "CPM",
    "dailyBudget": {"currencyCode": "EUR", "amount": "50"},
    "unitCost": {"currencyCode": "EUR", "amount": "10"},
    "objectiveType": "BRAND_AWARENESS",
    "targetingCriteria": {
      "include": {
        "and": [
          {"or": {"urn:li:adTargetingFacet:locations": ["urn:li:geo:101165590"]}},
          {"or": {"urn:li:adTargetingFacet:interfaceLocales": ["urn:li:locale:en_US"]}},
          {"or": {"urn:li:adTargetingFacet:skills": ["urn:li:skill:321"]}}
        ]
      }
    }
  }'
```

### Campaign Objectives

| Objective | Description |
|-----------|-------------|
| `BRAND_AWARENESS` | Maximize impressions |
| `WEBSITE_VISITS` | Drive traffic to website |
| `ENGAGEMENT` | Maximize social actions |
| `VIDEO_VIEWS` | Maximize video views |
| `LEAD_GENERATION` | Collect leads via Lead Gen Forms |
| `WEBSITE_CONVERSIONS` | Optimize for conversion events |
| `JOB_APPLICANTS` | Drive job applications |
| `TALENT_LEADS` | Talent-focused lead generation |

### Get Campaign Analytics

```bash
GET /rest/adAnalytics
  ?q=analytics
  &pivot=CAMPAIGN
  &dateRange.start.day=1&dateRange.start.month=4&dateRange.start.year=2026
  &dateRange.end.day=20&dateRange.end.month=4&dateRange.end.year=2026
  &timeGranularity=DAILY
  &campaigns=urn:li:sponsoredCampaign:{CAMPAIGN_ID}
  &fields=impressions,clicks,costInLocalCurrency,conversions,
          likes,comments,shares,follows,videoViews
```

---

## Targeting Facets

| Facet | URN Prefix | Description |
|-------|-----------|-------------|
| `locations` | `urn:li:geo:` | Geographic targeting |
| `industries` | `urn:li:industry:` | Company industry |
| `skills` | `urn:li:skill:` | Member skills |
| `jobFunctions` | `urn:li:function:` | Job function |
| `seniorities` | `urn:li:seniority:` | Seniority level |
| `companySizes` | `urn:li:companySize:` | Company headcount range |
| `titles` | `urn:li:title:` | Job title |
| `degrees` | `urn:li:degree:` | Education level |
| `fieldsOfStudy` | `urn:li:fieldOfStudy:` | Academic field |
| `memberGroups` | `urn:li:group:` | LinkedIn group membership |
| `employers` | `urn:li:organization:` | Current employer |

---

## Rate Limits

| Operation | Limit | Window |
|-----------|-------|--------|
| API calls (per app) | 100,000/day | Rolling 24h |
| API calls (per member) | 100/day for most endpoints | Rolling 24h |
| Posts per org | 150/day | Rolling 24h |
| Image uploads | 5,000/day per org | Rolling 24h |
| Comments | 50/day per org | Rolling 24h |
| Ad Analytics queries | 30/minute | Rolling |

---

## Error Codes

| Status | Error | Fix |
|--------|-------|-----|
| 401 | `Unauthorized` | Token expired — refresh |
| 403 | `ACCESS_DENIED` | Missing permission/scope |
| 404 | `RESOURCE_NOT_FOUND` | Check URN format |
| 422 | `VALIDATION_ERROR` | Check request body |
| 429 | `RATE_LIMIT` | Back off and retry |
| 400 | `MISSING_FIELD` | Required param missing |
| 409 | `CONFLICT` | Duplicate resource |

---

## Important Notes

1. **Versioning:** LinkedIn API is versioned monthly. Always include `LinkedIn-Version` header. Older versions deprecated after 12 months.

2. **URN format:** All LinkedIn entities use URNs: `urn:li:{type}:{id}`. Posts, organizations, people, images, videos all use this format.

3. **No scheduling API:** LinkedIn doesn't offer native post scheduling via API. Use external tools (Buffer, IFTTT) or build custom scheduling.

4. **Webhook/real-time:** Limited — only available for specific partnership integrations.

5. **Community Management API:** For managing LinkedIn Groups, requires additional permissions not in standard marketing scope.

6. **Rich media caution:** Image/video URNs expire if not used in a post within 24 hours of upload.

---

## References

- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
- [LinkedIn Marketing API](https://learn.microsoft.com/en-us/linkedin/marketing/)
- [Organization API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/)
- [Ad Analytics API](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads-reporting/ads-reporting)
- [LinkedIn OAuth 2.0](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)
- [API Versioning](https://learn.microsoft.com/en-us/linkedin/marketing/versioning)
