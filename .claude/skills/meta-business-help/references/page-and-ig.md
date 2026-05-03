# Facebook Page + Instagram — Roles, Ownership, Linking

Everything about managing the cloudless.gr Facebook Page, the @cloudless_gr Instagram account, and the link between them. Directly addresses the lite-mode blocker that prevents Windsor's Instagram connector from seeing Insights data.

## 1. Page ownership model

A Facebook Page can exist in exactly one of three states:

1. **Personally-owned** — the Page lives on a person's Facebook profile. Admin role is managed via classic Page Roles (the legacy UI under Page Settings → Page Roles).
2. **Portfolio-owned** — the Page is an asset inside a Business Portfolio. Admin role is managed via Portfolio Settings → People + Assets.
3. **Requested (lite mode)** — a portfolio has been granted access to a Page it does NOT own. The Page's actual owner is someone else (another portfolio or a personal profile).

The cloudless.gr Page `116436681562585` is currently **portfolio-owned by `1558125105019725`** — the functional state.

### Why ownership matters

- Only the owning entity can add/remove admins, change Page name, or move it elsewhere
- Ads can only run from the owning portfolio's ad accounts
- Instagram Insights API requires the IG account to be connected via the OWNING portfolio's Page — a requested/lite Page won't work
- Revoking partner access deletes agency workflows but ownership stays put

## 2. Page roles

Classic Page Roles (personal-profile Pages) and Portfolio-based Page access have different role names. Here they are side-by-side:

| Classic Page Role | Portfolio-based Task Access | Can do |
|------------------|--------------------------|--------|
| Admin | Full control (Manage Page) | Everything — roles, settings, name, delete |
| Editor | Create content + Moderate messages + Community activity + Ads + Insights | Post, message, boost, see analytics |
| Moderator | Moderate messages + Community activity + Ads + Insights | Reply to messages/comments, boost posts |
| Advertiser | Ads + Insights | Boost posts, run ads only |
| Analyst | Insights | Read-only analytics |
| Jobs Manager | Create content + Moderate messages + Insights + Jobs | (Jobs posting deprecated in 2023 for most regions) |

### Managing Page access in a Portfolio

URL pattern:
```
https://business.facebook.com/latest/settings/pages?business_id=1558125105019725
```

Click the Page → "People" tab → Add People → select user → check the task boxes you want to grant.

Tasks you can grant individually:
- **Manage Page** (= Admin)
- **Create content**
- **Messages and community activity** (reply to comments, DMs)
- **Community activity** (separate from messages, narrower scope)
- **Ads** (boost + Ads Manager access for this Page)
- **Insights** (analytics access)

Assign "Manage Page" to yourself. Add at least one backup person with Manage Page for continuity.

## 3. Moving a Page between portfolios

Two scenarios:

### 3a. Page currently in your personal profile → move to a portfolio you own

This is an **Add**, not a Move.

1. Go to `https://business.facebook.com/latest/settings/pages?business_id=<target_portfolio_id>`
2. Click **Add** → **Add a Page**
3. Enter Page name or URL
4. Meta checks: are you admin of the Page on your personal profile? If yes → instant transfer. The Page's owner field becomes the portfolio; your personal admin role is automatically preserved via the portfolio's People mapping.
5. Done. The Page no longer appears under classic Page Roles on your personal profile.

### 3b. Page in Portfolio A → move to Portfolio B

This is a **Claim + Release** sequence.

1. First, remove the Page from Portfolio A: Portfolio A Settings → Pages → select Page → Remove. (You must be admin on Portfolio A.)
2. Wait 48 hours — Meta enforces a cool-down after removal before the Page can be re-added elsewhere. (This undocumented delay catches people off guard.)
3. Go to Portfolio B Settings → Pages → Add → Add a Page → enter Page name/URL
4. Since you're still admin on your personal profile (the Page reverts to personal admin on removal), this becomes a standard Add flow per 3a.

**Alternative:** If you can't access Portfolio A, file a **Page access request** via `https://business.facebook.com/business/pages/request-access`. This triggers a workflow where the current Page owner gets a notification and can approve/deny within 30 days. If denied or no response → Meta support can arbitrate with proof of legitimate business ownership (e.g., matching email domain, trademark registration).

### 3c. Page NOT owned by you, but you need access

Use the "Request access" flow — this creates a lite-mode link, NOT ownership transfer. See section 5.

## 4. Instagram Business vs. Creator vs. Personal

IG accounts come in three flavors:

| Type | Who it's for | Access to business APIs |
|------|-------------|------------------------|
| Personal | Normal users | No API access, no ads, no insights beyond basic |
| Creator | Influencers, public figures, creators | Partial API, category labels, some insights, can run ads |
| Business | Companies, brands, product sellers | Full Graph API, Insights, Shops, Commerce, Conversions API |

**For cloudless.gr, use Business.** Creator is attractive for content-first accounts but Business is required for Commerce, full Insights depth, and some third-party integrations.

### Switching to a Business account

In the IG mobile app (not web):
1. Tap your profile → hamburger menu → Settings and privacy → Account type and tools
2. Tap "Switch to professional account"
3. Pick category (e.g., "Digital creator" or "Business services")
4. Select **Business**
5. Connect to a Facebook Page — this is critical (see section 5 below)

@cloudless_gr is already a Business account. No action needed here.

## 5. Linking Instagram to a Facebook Page — full vs. lite mode

This is THE distinction that matters. Two ways to link, producing different results.

### 5a. Lite-mode link (via IG app's "Linked Accounts")

**How to identify:** You went to IG app → Settings → Account Center → Connected experiences (or historically "Linked accounts" → Facebook)

**What you get:**
- Your IG posts can auto-cross-post to the linked FB Page
- Basic cross-profile identity
- Maybe the IG inbox shows in Business Suite

**What you DON'T get:**
- Full Insights API access
- Ability to manage IG ads from Ads Manager with full objective support
- Commerce features
- Third-party integrations (Windsor, Sprout Social, Hootsuite) can authenticate but get partial data — the telltale sign is "connected but no posts/metrics visible"

This is the current cloudless.gr state — the account is linked via the IG app, which is why Windsor sees Threads + some FB stuff but can't fully read IG Insights.

### 5b. Full-mode link (via the Facebook Page's Instagram tab)

**How to do it:**
1. Go to the FB Page on desktop — **use classic layout, not Pages Experience**. If your Page has been force-upgraded to Pages Experience, go to `https://www.facebook.com/<pageusername>` directly.
2. Page → Settings → Linked Accounts → Instagram
3. Click "Connect account" → log in with @cloudless_gr credentials
4. After OAuth, Meta prompts: "Do you want to allow message access and Instagram Insights?" → **Yes to both**
5. Confirm — the Page should now show the IG account in its Linked Accounts list with "Full access"

**What you get:**
- Everything from lite-mode
- Full Insights API (media insights, account insights, story insights)
- Ads Manager can target the IG account directly for all objectives
- Business Suite shows IG DMs, comments, scheduled posts natively
- Third-party integrations get complete data

### 5c. Converting lite → full

You can't "upgrade" in place. You must:

1. In the IG app: Settings → Account Center → Connected experiences → **Remove Facebook connection** (yes, even though you want to stay connected — the lite link blocks the full link)
2. Wait 10-15 minutes (propagation)
3. On the FB Page: Settings → Linked Accounts → Instagram → Connect (per 5b)
4. Inside the Portfolio after reconnection, verify at:
   ```
   https://business.facebook.com/latest/settings/instagram_accounts?business_id=1558125105019725
   ```
   The account should now appear with "Full control" (not "Shared" or "Lite").

**This is the step that unblocks Windsor.ai Instagram connector + proper ads targeting for cloudless.gr.**

### 5d. cloudless.gr specifics

Per `meta_business_portfolio_diagnosis.md`:
- @cloudless_gr IG currently appears in Portfolio `1526956002406847` (the bogus/empty one) under People → business users
- This is because of a historical connection path Meta silently migrated
- Need to: remove from Portfolio 1526956002406847 AND from any lite-mode link, then re-add via Page 116436681562585 (which lives in Portfolio 1558125105019725)

Sequence:
1. Portfolio 1526956002406847 → Settings → Instagram accounts (or People → business users) → Remove @cloudless_gr
2. IG app → Account Center → Remove any remaining FB connection
3. FB Page (under Portfolio 1558125105019725) → Linked Accounts → Instagram → Connect → login as @cloudless_gr
4. Verify in Portfolio 1558125105019725 Instagram accounts list → "Full control"
5. Re-onboard Windsor Instagram connector
6. Run smoke-test query against IG Insights fields

## 6. Two-factor authentication before linking

Meta requires 2FA enabled on both the FB account AND the IG account before full-mode linking works. If 2FA is off:

- FB: `https://accounts.meta.com/security/two-factor-authentication`
- IG: in the app → Settings → Accounts Center → Password and security → Two-factor authentication

Use SMS or an authenticator app (Google Authenticator, 1Password, Authy). SMS is acceptable but authenticator apps are more reliable for Meta's recovery flows.

## 7. Common Page/IG problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Can't see Page in Ads Manager | Page not attached to the ad account | Ad account settings → Page → select |
| IG connector "connected" but no data | Lite-mode link | Remove lite link, re-link via Page (section 5c) |
| Page posts don't appear in Business Suite | Page owned by different portfolio than the one Suite is viewing | Switch portfolios in Suite top-left |
| "This account is already associated with another Facebook Page" when linking IG | IG was previously linked to a different FB Page and the unlink didn't propagate | Wait 24h, try again; or contact Meta support |
| Lost admin access to a Page | Someone removed you OR the sole admin left | Request access via `business.facebook.com/business/pages/request-access` with proof of ownership |
| "Admin role can't be assigned" error | Target user hasn't accepted the portfolio invitation yet | User accepts invite first, then re-try role assignment |
| Can't switch IG to Business | IG account is under 13 (age-gated) OR shadow-banned | Contact IG support via the app |

## 8. Page + IG setup checklist for cloudless.gr

Use this list to get from current state to "Windsor-ready and ads-capable":

- [ ] FB Page `116436681562585` owned by Portfolio `1558125105019725` (✅ already done per memory)
- [ ] I am Admin (Manage Page) on this Page
- [ ] @cloudless_gr is a Business account on Instagram (✅ already done)
- [ ] Any existing lite-mode link removed (IG app → Account Center → Remove FB)
- [ ] IG removed from Portfolio `1526956002406847` if still listed there
- [ ] 2FA enabled on both @cloudless_gr and personal FB account
- [ ] IG re-linked to Page via Page Settings → Linked Accounts → Instagram
- [ ] "Full control" visible in Portfolio 1558125105019725 Instagram accounts list
- [ ] Test: make a test post, confirm Page Insights shows it, Ads Manager sees it as targetable
- [ ] Re-onboard Windsor.ai Instagram connector
- [ ] Smoke-test Windsor: `get_data(connector="instagram", fields=["date", "impressions"], date_preset="last_7d")` returns rows

## 9. Content posting permissions summary

After full setup, you can post from:

| Tool | Can post to FB Page | Can post to IG | Can schedule |
|------|---------------------|----------------|--------------|
| FB Page UI (desktop web) | Yes | No | Yes (basic) |
| Instagram app | No | Yes | No (only "scheduled" via Pro dashboard) |
| Meta Business Suite (web + app) | Yes | Yes | Yes (recommended) |
| Creator Studio (deprecated → merging into Suite) | Yes | Yes | Yes |
| Graph API / third-party tools (Buffer, Hootsuite) | Yes with page access token | Yes with IG user access token | Depends on tool |
| Claude via MCP (meta-business-suite skill) | Yes with token | Yes with token | Yes |

**For daily ops use Business Suite.** For scripted/automated posts from the cloudless.gr Next.js admin dashboard, use the Graph API per `meta-business-suite/SKILL.md`.
