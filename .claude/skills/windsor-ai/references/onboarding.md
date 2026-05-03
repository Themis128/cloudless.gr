# Windsor.ai — Onboarding & OAuth Reference

Authoritative guide to connecting data sources on **onboard.windsor.ai**.

This doc exists because the onboard flow has non-obvious UX quirks that caused 4+ failed connection attempts during cloudless.gr setup. Follow these steps verbatim.

---

## 1. Getting to the right page

The public-facing onboarding URLs follow this pattern:

```
https://onboard.windsor.ai/app/{connector_id}
```

Examples:
- `https://onboard.windsor.ai/app/facebook`
- `https://onboard.windsor.ai/app/instagram`
- `https://onboard.windsor.ai/app/linkedin_organic`
- `https://onboard.windsor.ai/app/threads`
- `https://onboard.windsor.ai/app/googleanalytics4`
- `https://onboard.windsor.ai/app/tiktok`
- `https://onboard.windsor.ai/app/twitter`
- `https://onboard.windsor.ai/app/youtube`

You can also fetch an authorization URL programmatically via the MCP:

```
get_connector_authorization_url(connector="<connector_id>")
```

This returns a pre-signed OAuth URL that starts the flow in the right place.

**Canonical connector IDs** (use these — not display names):
`facebook`, `facebook_organic`, `instagram`, `linkedin`, `linkedin_organic`, `threads`, `googleanalytics4`, `googleads`, `tiktok`, `tiktok_organic`, `twitter`, `x_organic`, `youtube`, `bluesky`, `pinterest`, `pinterest_organic`, `mailchimp`, `klaviyo`, `snapchat`, `all` (blended).

If you're unsure, call `get_connectors()` and grep the response for the platform name.

---

## 2. The two-step gotcha (critical)

Windsor's onboard UI has **two steps** and users routinely miss the second one:

**Step 1 — "Add data"**
You authenticate with the third-party provider (Meta, Google, LinkedIn, etc.), then Windsor shows a list of available accounts (Pages, Ad Accounts, Properties, Channels). **You tick the checkboxes for the accounts you want to pull data from.**

**Step 2 — "Preview and Destination"**
You MUST click **Next** (or "Continue") to advance. On this page, Windsor actually persists the connector. If you close the tab after Step 1, the OAuth token is captured but the connector record is NOT saved — calling `get_connectors()` afterward will show the connector missing.

**Symptom of skipping Step 2:** The third-party app shows Windsor as an authorized integration (in Meta Business Settings, LinkedIn Security, etc.) but Windsor has no connector for that platform.

**Fix:** Re-run onboarding from the start and make sure to click through to the preview page. A green "Connected" banner or a data preview table confirms success.

---

## 3. Verifying a connection

After onboarding, verify through one of these methods (in increasing detail):

1. **MCP:** `get_connectors()` — returns a list of all active connectors + account IDs
2. **REST:** `./scripts/windsor-api.sh accounts <connector_id>` — same info via curl
3. **Dashboard:** https://onboard.windsor.ai/app/data-preview — UI showing all connectors and status
4. **Smoke-test query:** `get_data(connector="<id>", accounts=["<id>"], fields=["date"], date_preset="last_7d")` — if rows come back, the pipeline is live

If `get_connectors()` doesn't list the connector but OAuth succeeded, you hit Step 2 skip — re-onboard.

---

## 4. Per-platform prerequisites

### Meta family (Facebook Ads, Facebook Organic, Instagram, Threads)

These share a **Meta Business Portfolio** (formerly Business Manager). Before onboarding:

- The Meta user must be an **admin** on the Portfolio.
- The Portfolio must contain the Page, Instagram Business account, and/or ad account you want to connect. An EMPTY portfolio (no assets) will give OAuth success but zero selectable accounts in Step 1.
- Pages connected in **lite mode** (shared into the portfolio via "Request access" rather than "Add") will NOT expose Insights API data. Check at https://business.facebook.com/settings/pages — pages must show "Added" not "Requested".
- Instagram accounts need to be:
  1. Converted to **Business** or **Creator** account (in the IG app: Settings → Account → Switch to Professional Account)
  2. **Linked to a Facebook Page** via the Page's Instagram tab — NOT via the IG app's "Linked accounts" because that produces a lite-mode link
  3. Visible under Meta Business Settings → Accounts → Instagram accounts with "Full control"
- Review the list of **permissions** the OAuth popup requests and accept all; unchecking any scope will cause certain fields to silently return null.

**cloudless.gr status (2026-04-21):**
- Portfolio `1526956002406847` — EMPTY (no Pages/IG/ad account) — do not try to onboard through this
- Portfolio `1558125105019725` — has Page `cloudless.gr` (116436681562585) but no ad account yet; next step is to create ad account inside this portfolio

### LinkedIn (Ads + Organic)

Two separate connectors:
- `linkedin` — Campaign Manager (ads)
- `linkedin_organic` — Company Page posts and follower analytics

Prerequisites:
- LinkedIn user must be a **Page Admin** (Super admin or Content admin) on the Company Page for `linkedin_organic`
- For `linkedin` (ads), user must have access to the LinkedIn Ad Account
- Both connectors use different OAuth scopes — authorizing one does not authorize the other

### Google family (GA4, Google Ads, YouTube)

- GA4: user must have at least **Viewer** role on the GA4 property
- Google Ads: user must have access to the Google Ads customer account; **MCC (manager) accounts** show up as selectable parents — pick the child account for data
- YouTube: user must own or be a manager of the YouTube channel; **Brand channels** need the Google account to be in the channel's access list

### TikTok (Ads + Organic)

- `tiktok` (Ads) requires a TikTok For Business account with at least one Ad Account
- `tiktok_organic` requires a TikTok account — personal accounts work but **Creator** or **Business** accounts expose more fields
- TikTok OAuth uses short-lived tokens (24h); Windsor refreshes automatically but if the user revokes app access in TikTok settings, re-onboarding is required

### X / Twitter

- Free tier of X API has severe rate limits — data pulls may show gaps
- Paid tier (Basic/Pro) recommended for daily refresh
- `x_organic` and `twitter` (ads) both require **Developer account** provisioning on https://developer.twitter.com — this can take 1-2 business days

### Threads

- Meta's Threads API requires `threads_basic` + `threads_content_publish` scopes
- Threads account must be linked to a Meta user that can see it in the app
- No Facebook Page/Business Portfolio dependency — purely tied to the IG/Threads identity

---

## 5. Windsor account limits

**TRIAL plan (cloudless.gr current):**
- 10 connectors maximum
- 15 accounts total (one connector can pull from multiple accounts — each counts separately)
- **Status 2026-04-21:** 4/10 connectors, 4/15 accounts used

Paid plans raise these limits. Check `subscription-info-limits-and-usage` on the Ahrefs MCP (unrelated but conveniently named) OR log into the Windsor dashboard billing page.

---

## 6. Troubleshooting OAuth failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| "No accounts found" after login | User's role on the third-party platform doesn't grant data access | Elevate user permissions (admin on Page, editor on GA4 property, etc.) |
| Connector disappears after 24h | Step 2 of onboarding skipped | Re-onboard, click Next through preview |
| Data preview empty but connector "active" | Date range chosen has no data (e.g., brand-new account) | Widen date range to `last_90d` or `last_year` |
| "Token expired" error on `get_data` | Refresh token invalidated (password change, manual revoke) | Re-onboard via the same connector URL |
| Meta onboard shows "No Pages" | Portfolio empty OR user not portfolio admin | Verify at business.facebook.com/settings |
| GA4 shows property but zero metrics | GA4 property has no data streams configured | Fix in GA4 admin, then re-query |
| Instagram connected but no posts | IG-FB Page link in lite mode | Complete "Review connection" at facebook.com/settings/?tab=linked_instagram |

---

## 7. Revoking / removing a connector

To fully disconnect:
1. Windsor side: onboard.windsor.ai/app/data-preview → find connector → "Delete connection"
2. Third-party side: revoke Windsor's OAuth grant in the provider's security settings
   - Meta: https://accounts.meta.com/security/business-apps
   - LinkedIn: https://www.linkedin.com/psettings/permitted-services
   - Google: https://myaccount.google.com/permissions
   - TikTok: TikTok app → Settings → Security → Connected Apps
   - X: https://twitter.com/settings/connected_apps

**Both sides required** — deleting Windsor's record without revoking at the provider leaves the grant dangling, and revoking at the provider without deleting the Windsor record leaves a stale (broken) connector in Windsor's list that will eat against your plan quota.

---

## 8. Auth URL fast path (scripted)

To kick off a new connection from the CLI:

```bash
# Get the OAuth URL
./scripts/windsor-api.sh connectors | jq '.[] | select(.id == "instagram")'

# Or via MCP
# get_connector_authorization_url(connector="instagram")
```

Then open the URL in a regular browser (not the Cowork sidebar) so that password managers and 2FA work normally. Claude cannot complete OAuth flows on the user's behalf per the user_privacy rules.
