# Meta / Instagram Graph API — Cloudless MCP Skill

## Overview

This skill covers the complete Meta (Facebook/Instagram) setup for cloudless.gr's MCP server.
The MCP server enables Claude to post content, read analytics, manage audiences, and run Meta Ads.

**App credentials (already created):**
- App ID: `1936126137016578`
- App Secret: `2d77630ff18b1cea3e4e00ba2f9a7b73`
- App Dashboard: https://developers.facebook.com/apps/1936126137016578

**MCP server:** `D:\Nuxt Projects\Cloudless\.claude\mcp-servers\instagram\src\index.js`
**Config file:** `C:\Users\baltz\AppData\Roaming\Claude\claude_desktop_config.json`

---

## Current Status (last updated 2026-04-20)

| Credential | Status |
|-----------|--------|
| `META_ACCESS_TOKEN` | ✅ Set — 60-day token, expires ~2026-06-19 |
| `META_AD_ACCOUNT_ID` | ✅ Set — `657781691826702` (Themistoklis Baltzakis) |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | ❌ Blocked — see diagnosis below |

### Diagnosis: Why INSTAGRAM_BUSINESS_ACCOUNT_ID is unavailable

**Root cause confirmed (2026-04-20):** `GET /116436681562585?fields=instagram_business_account,connected_instagram_account` consistently returns `{"id": "116436681562585"}` with both IG fields null — using both User Token and Page Token.

The Facebook Page `116436681562585` IS connected to `@cloudless_gr` but only in **lite mode** (for ads only). The Graph API requires a **full OAuth connection** to expose the IG Business Account ID.

Attempts made:
- Clicked "Review connection" at `facebook.com/settings/?tab=linked_instagram`
- Steps 1 + 2 (permissions + messages) completed
- Flow failed at step 3 with: **"Business Account Not Allowed to Advertise — This business account didn't comply with our Advertising Policies or other standards."**

**Likely causes (in order of probability):**
1. **@cloudless_gr IS a Business Instagram account** (confirmed 2026-04-20 via Instagram Professional Account Tools page). However, the IG-to-FB-Page connection is in **lite mode** (ads only), not the full Graph API connection needed for the `instagram_business_account` field to resolve.
2. The Meta Business Portfolio (ID: `1558125105019725`) has an advertising policy issue blocking the full connection flow.

### Fix: Step-by-step to get the IG Business Account ID

**Step 1 — Confirm @cloudless_gr is Business account** ✅ DONE (2026-04-20)

@cloudless_gr is already a Business account. The Instagram Professional Account Tools page shows "Switch to personal account" and "Switch to creator account" options, confirming Business status.

**Step 2 — Complete the full Facebook–Instagram connection**

1. Go to `facebook.com/settings/?tab=linked_instagram` in a browser
2. You should see the cloudless.gr Instagram account listed
3. Click **"Review connection"**
4. When prompted, enter the **@cloudless_gr Instagram password**
5. Approve all permissions
6. If you see "Business Account Not Allowed to Advertise" — click Done and **ignore it** (it's about ads, not the API connection)

**Step 3 — Retrieve the IG Business Account ID**

After completing Step 2, run in Graph API Explorer (`developers.facebook.com/tools/explorer`):
```
GET /116436681562585?fields=instagram_business_account
```
Using the **cloudless.gr Page Access Token**.

It will return:
```json
{
  "instagram_business_account": { "id": "XXXXXXXXXXXXXXXXX" },
  "id": "116436681562585"
}
```

Copy that `id` value — that's your `INSTAGRAM_BUSINESS_ACCOUNT_ID`.

**Step 4 — Update the MCP config**

Edit `C:\Users\baltz\AppData\Roaming\Claude\claude_desktop_config.json`:
```json
"INSTAGRAM_BUSINESS_ACCOUNT_ID": "PASTE_THE_ID_HERE"
```
Restart Claude Desktop. Then verify with `get_account_info` tool.

---

## Required Permissions

All permissions have been added to the app and are "Ready for testing":

| Permission | Purpose | Status |
|-----------|---------|--------|
| `instagram_basic` | Read profile, media, followers | ✅ Added |
| `instagram_content_publish` | Post photos, Reels, carousels | ✅ Added |
| `instagram_manage_insights` | Account + post analytics | ✅ Added |
| `pages_show_list` | List Facebook Pages | ✅ Added |
| `pages_read_engagement` | Required for IG Business account access | ✅ Added |
| `ads_management` | Create/read Meta Ads campaigns | ✅ Added |
| `ads_read` | Read campaign insights | ✅ Added |

---

## Token Generation Flow

### Step 1 — Get Short-Lived Token from Graph API Explorer

1. Go to: https://developers.facebook.com/tools/explorer/
2. In the top-right dropdown, select your app: **cloudless-marketing** (App ID 1936126137016578)
3. Click **"Generate Access Token"** → approve all permissions listed above
4. Copy the short-lived User Access Token (valid ~1 hour)

### Step 2 — Exchange for Long-Lived Token (60 days)

Run this in a browser or curl — replace `{SHORT_TOKEN}` with the token from Step 1:

```
GET https://graph.facebook.com/v19.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id=1936126137016578
  &client_secret=2d77630ff18b1cea3e4e00ba2f9a7b73
  &fb_exchange_token={SHORT_TOKEN}
```

**Or use the helper script (recommended):**
```bash
cd "D:\Nuxt Projects\Cloudless\.claude\mcp-servers\instagram"
node setup-token.js <YOUR_SHORT_LIVED_TOKEN>
```

The script will:
1. Exchange the short-lived token for a 60-day long-lived token
2. Retrieve your Facebook Pages
3. Find the Instagram Business Account linked to each page
4. Print the exact values to paste into `claude_desktop_config.json`

### Step 3 — Get Instagram Business Account ID

After getting the long-lived token, make these two API calls:

**Get Facebook Pages:**
```
GET https://graph.facebook.com/v19.0/me/accounts?access_token={LONG_TOKEN}
```
Returns a list of pages. Find the cloudless.gr page and copy its `id`.

**Get Instagram Business Account:**
```
GET https://graph.facebook.com/v19.0/{PAGE_ID}?fields=instagram_business_account&access_token={LONG_TOKEN}
```
Returns `{ "instagram_business_account": { "id": "XXXXXXXXX" } }`. That `id` is your `INSTAGRAM_BUSINESS_ACCOUNT_ID`.

### Step 4 — Get Meta Ad Account ID

```
GET https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status&access_token={LONG_TOKEN}
```
The `id` field is in format `act_XXXXXXXXX`. Strip the `act_` prefix for `META_AD_ACCOUNT_ID`.

**Known ad accounts:**
- `657781691826702` — Themistoklis Baltzakis (use this for cloudless.gr)
- `2771400643144250` — Vera Symeonidou (client account, do not use)

---

## Config Update

Paste the values into `C:\Users\baltz\AppData\Roaming\Claude\claude_desktop_config.json`:

```json
"cloudless-instagram": {
  "command": "node",
  "args": ["D:/Nuxt Projects/Cloudless/.claude/mcp-servers/instagram/src/index.js"],
  "env": {
    "META_ACCESS_TOKEN": "PASTE_YOUR_60_DAY_TOKEN_HERE",
    "INSTAGRAM_BUSINESS_ACCOUNT_ID": "PASTE_YOUR_IG_ACCOUNT_ID_HERE",
    "META_AD_ACCOUNT_ID": "PASTE_YOUR_AD_ACCOUNT_ID_HERE"
  }
}
```

Then **restart Claude Desktop** for the MCP server to pick up the new credentials.

---

## Token Refresh (Every 60 Days)

Long-lived tokens expire after 60 days. To refresh before expiry:

```
GET https://graph.facebook.com/v19.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id=1936126137016578
  &client_secret=2d77630ff18b1cea3e4e00ba2f9a7b73
  &fb_exchange_token={CURRENT_LONG_LIVED_TOKEN}
```

You can also pass the **current** long-lived token as `fb_exchange_token` — Meta will return a fresh 60-day token.

---

## MCP Tools Reference

| Tool | Description |
|------|-------------|
| `get_account_info` | Profile, follower count, bio, website |
| `get_media_list` | Recent posts with likes/comments (default 12) |
| `get_media_insights` | Reach, impressions, saves, video views per post |
| `get_account_insights` | Account-level reach/impressions for date range |
| `create_photo_post` | Publish photo from URL with caption |
| `create_reel` | Publish Reel from video URL with caption |
| `create_carousel_post` | Publish 2–10 image carousel |
| `get_audience_demographics` | Age, gender, country, city breakdown |
| `get_ads_campaigns` | List Meta Ads campaigns (filter by status) |
| `create_ads_campaign` | Create campaign with objective + daily budget |
| `get_campaign_insights` | Spend, impressions, reach, CTR, CPM |

---

## API Reference

Base URL: `https://graph.facebook.com/v19.0`

**All requests require `?access_token={META_ACCESS_TOKEN}` or Bearer header.**

Key endpoints:
- `GET /{IG_USER_ID}` — account info
- `GET /{IG_USER_ID}/media` — list media
- `GET /{MEDIA_ID}/insights` — post analytics
- `GET /{IG_USER_ID}/insights` — account analytics
- `POST /{IG_USER_ID}/media` — create media container
- `POST /{IG_USER_ID}/media_publish` — publish container
- `GET /act_{AD_ACCOUNT}/campaigns` — list campaigns
- `POST /act_{AD_ACCOUNT}/campaigns` — create campaign

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `OAuthException code 190` | Token expired | Re-generate token via Graph API Explorer |
| `Invalid OAuth access token` | Wrong token in config | Check env var `META_ACCESS_TOKEN` |
| `Unsupported get request` on insights | Wrong permissions | Re-grant `instagram_manage_insights` |
| `Media not found` when posting | Image URL not publicly accessible | Use a public HTTPS URL |
| Ad account `act_` not found | Missing `ads_management` permission | Re-grant in Graph API Explorer |
| `instagram_business_account` returns null | IG account is Personal (not Business) OR connection is lite-mode only | Switch IG to Business account in the app, then complete "Review connection" at `facebook.com/settings/?tab=linked_instagram` |
| "Business Account Not Allowed to Advertise" | Meta Business Portfolio has no ad accounts set up | This is about **ads only** — ignore it and proceed. The Graph API connection for content/insights is separate. |
| `Object with ID 'CONNECT_IG_TO_FB_PAGE_FIRST'` | MCP config still has placeholder IG Account ID | Follow the fix steps above to get the real `INSTAGRAM_BUSINESS_ACCOUNT_ID` and update the config |
