# Runbook: Fix & Activate Meta Business Account (cloudless.gr)

**Owner:** Themistoklis Baltzakis
**Frequency:** One-time remediation (some steps are ongoing after completion)
**Last Updated:** 2026-04-21
**Last Run:** Not yet executed

---

## Purpose

Close the three outstanding gaps in the cloudless.gr Meta footprint so that:

1. Windsor.ai Instagram connector can read @cloudless_gr Insights (blocked today by lite-mode link)
2. You can run ads from Portfolio `1558125105019725` (blocked today — no ad account exists)
3. Conversion events from the Next.js site flow back to Meta for ads optimization (blocked today — no Pixel/CAPI installed)

Work through phases in order. Do not skip Phase A — Phase B's ad account cannot properly target @cloudless_gr until the IG link is full-mode.

---

## Known State (as of 2026-09-14, Tailscale Graph + BM UI)

| Asset | ID | State |
|-------|----|-------|
| Primary Portfolio | `1558125105019725` (`cloudless.gr`) | **No advertising issues** on BM; **0 owned ad accounts**; only admin = Themistoklis |
| FB Page (env `META_PAGE_ID`) | `1163886186808102` | Cloudless.gr — published, **not verified**; ads blocked (“Page isn't allowed to advertise”) |
| FB Page (BM owned_pages) | `116436681562585` | cloudless.gr — `promotion_eligible: false` |
| Personal ad account | `act_657781691826702` | **DISABLED since 2021-01-24** — **cannot be reviewed**. Do **not** use for production. |
| Vera ad account | `act_2771400643144250` | DISABLED; **not** ours — do **not** advertise from it |
| Personal Facebook user | `10239451610085137` | **Account restricted** (Advertising Standards, Feb 12, 2021). Blocks create-ad-account (`error_subcode: 2859015`) and Remove user on ad accounts |
| Pixel / CAPI | prod pod + old personal act | Events can still post; **no BM-owned Pixel yet** — create under BM after new act exists |
| Token | long-lived USER, app `1936126137016578` | Valid; scopes include `ads_management`, `ads_read`, pages + IG |

**Policy (operator decision 2026-09-14):** run ads **only** under BM `1558125105019725`. Never point `META_AD_ACCOUNT_ID` at `act_657781691826702` or Vera’s account again.

**Blocker:** Themistoklis cannot create the BM ad account while his Facebook advertising restriction is active (UI + Graph both return “Your account is restricted right now”). Meta offers **no Request review** on that 2021 user restriction (only court / EU dispute settlement).

VAT/`tax_id_status=3` (submitted) and `amount_spent=0` — not a billing failure.

---

## Prerequisites

- [ ] Admin on Portfolio `1558125105019725` (confirmed)
- [ ] Admin on Portfolio `1526956002406847` (needed to remove @cloudless_gr)
- [ ] Credentials for @cloudless_gr Instagram account at hand
- [ ] 2FA enabled on both personal FB account AND @cloudless_gr (verify before starting — see A.1)
- [ ] A credit/debit card supporting 3D Secure (for Phase B payment method)
- [ ] Chrome with [Meta Pixel Helper extension](https://chrome.google.com/webstore/detail/meta-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc) installed (for Phase C verification)
- [ ] ~2 hours of focused time (Phases A+B), plus a dev session for Phase C

---

# PHASE A — Convert IG to full-mode link

Goal: @cloudless_gr shows "Full control" in Portfolio `1558125105019725` Instagram accounts. Unblocks Windsor + ads.

## Step A.1 — Verify 2FA on both accounts

Personal Facebook:

```
https://accounts.meta.com/security/two-factor-authentication
```

Confirm at least one method (Authenticator app preferred; SMS acceptable).

@cloudless_gr Instagram (in the IG mobile app, logged in as @cloudless_gr):

```
Settings and privacy → Accounts Center → Password and security → Two-factor authentication
```

**Expected result:** Both accounts show 2FA enabled.
**If it fails:** Turn on 2FA before continuing. Full-mode linking will silently fail without 2FA on both sides.

## Step A.2 — Remove @cloudless_gr from Portfolio 1526956002406847

Direct URL:

```
https://business.facebook.com/latest/settings/instagram_accounts?business_id=1526956002406847
```

If @cloudless_gr is not listed there, check:

```
https://business.facebook.com/latest/settings/people?business_id=1526956002406847
```

Look under "Business users" or "Instagram accounts" — remove it anywhere it appears.

**Expected result:** @cloudless_gr no longer shows under Portfolio 1526956002406847.
**If it fails:** If you lack admin on that portfolio, use `https://business.facebook.com/business/pages/request-access` with proof of ownership; Meta arbitration can take 7–30 days.

## Step A.3 — Break the lite-mode link in the IG app

In the @cloudless_gr IG mobile app (NOT web):

```
Profile → hamburger menu → Settings and privacy
  → Accounts Center
  → Connected experiences (or "Linked accounts" on older app versions)
  → Facebook
  → Remove
```

Confirm the removal.

**Expected result:** @cloudless_gr no longer shows a connected Facebook account in Account Center.
**If it fails:** Force-close the app and retry. If you see "Can't disconnect — managed by a business", you likely need to remove it from Business Suite first; go to Business Suite → Settings → Instagram accounts.

**Wait 10–15 minutes** after A.3 before starting A.4. This is an undocumented propagation delay; skipping it causes A.4 to silently re-create a lite link.

## Step A.4 — Re-link via the FB Page's Linked Accounts

Open the Facebook Page on **desktop web** (mobile Business Suite doesn't expose this option reliably):

```
https://www.facebook.com/cloudless.gr
```

Then:

```
Page Settings → Linked Accounts → Instagram → Connect account
```

Log in as @cloudless_gr when prompted. After OAuth, Meta asks:

> "Do you want to allow message access and Instagram Insights?"

Answer **Yes to both**.

**Expected result:** FB Page shows @cloudless_gr under Linked Accounts with a green "Full access" indicator.
**If it fails:**

- "This account is already associated with another Page" → A.3 didn't propagate. Wait another hour, retry.
- "We couldn't connect" with no detail → 2FA likely missing on one side (re-check A.1).
- Page Settings menu has no "Linked Accounts" → your Page was force-migrated to Pages Experience. Instead, go to: `https://business.facebook.com/latest/settings/instagram_accounts?business_id=1558125105019725` and click Add → Connect Instagram.

## Step A.5 — Verify "Full control" in Portfolio 1558125105019725

```
https://business.facebook.com/latest/settings/instagram_accounts?business_id=1558125105019725
```

**Expected result:** @cloudless_gr appears with access type "Full control" (not "Shared" or "Partial").
**If it fails:** If it shows "Shared", the link came through but without Insights permission. Click the account → Settings → request additional permissions → re-confirm as @cloudless_gr.

## Step A.6 — Re-onboard Windsor.ai Instagram connector

In Windsor.ai dashboard:

```
Data sources → Instagram → Reconnect (or add new)
```

OAuth prompt appears. Log in as the personal FB account that is Admin on Portfolio 1558125105019725. Grant all requested permissions.

**Expected result:** Windsor shows the Instagram connector as "Connected" with @cloudless_gr listed.

## Step A.7 — Smoke test

Run from this Claude session:

```
get_data(connector="instagram", fields=["date", "impressions", "reach"], date_preset="last_7d")
```

**Expected result:** Returns rows (even if impressions are low — the point is getting non-empty data).
**If it fails:** If result is empty for 7 days, try `last_30d`. If still empty, re-check A.5 permission level; "Shared" access returns no insights.

### Phase A Verification

- [ ] Portfolio 1526956002406847 no longer lists @cloudless_gr
- [ ] Portfolio 1558125105019725 shows @cloudless_gr with "Full control"
- [ ] Windsor returns non-empty IG data
- [ ] **Update auto-memory:** edit `meta_business_portfolio_diagnosis.md` to reflect new state

---

# PHASE B — Create the ad account (BM-only)

Goal: `act_XXXXXXXXX` exists **owned by** Portfolio `1558125105019725` with working payment method.

## Step B.0 — Unblock create (required first)

If the person clicking **Create ad account** sees `2859015` / “Your account is restricted right now”, **stop**. Creating as a restricted user will not work and can look like evasion.

**Working path while Themistoklis stays restricted:**

1. Business Settings → [People](https://business.facebook.com/latest/settings/people?business_id=1558125105019725) → **Add** a trusted person as **Admin** (full control).
2. That person must **not** be advertising-restricted (new/clean FB ads access).
3. They create the ad account (B.1) while logged in as themselves.
4. Assign Themistoklis **Admin** on the new ad account after it exists (if Meta allows; otherwise keep him BM Admin and use a system user / their token for Ads API).
5. Optional later: EU DSA dispute settlement / court to lift Themistoklis’s personal restriction (Account Quality → Other actions). Do **not** open a second personal ad account.

## Step B.1 — Create the ad account

```
https://business.facebook.com/latest/settings/ad_accounts?business_id=1558125105019725
```

Click **Add → Create a new ad account**. Fill:

| Field | Value |
|-------|-------|
| Ad account name | `cloudless.gr — primary` |
| Time zone | `(GMT+03:00) Europe/Athens` (summer) / Europe/Athens |
| Currency | `EUR — Euro` |
| Usage | **My business** (cloudless.gr) |
| Payment method | Skip (set in B.4) |

Click Next → Confirm → accept Meta Commercial Terms → **Create ad account**.

**Verified 2026-09-14:** wizard filled correctly (name / Athens / EUR / My business) then Meta rejected create with personal restriction — BM still shows **No ad accounts added**.

**⚠️ Currency and timezone are IMMUTABLE after creation.** Double-check before clicking Create.

**Expected result:** New ad account created, you land on its overview page. Note the ID (`act_XXXXXXXXX`).

## Step B.2 — Assign yourself as Admin + add Page

Still in the ad account creation flow (or via Settings → Ad accounts → \[new account\] → People):

- Assign yourself **Admin**
- Under "Business info / Page": attach Page `116436681562585` (cloudless.gr)

**Expected result:** You appear in the ad account's People list with Admin access. Page is attached.

## Step B.3 — Add payment method

```
https://www.facebook.com/ads/manager/account_settings/account_billing/?act=<NEW_AD_ACCOUNT_ID>
```

Add card. Complete 3DS challenge. Meta pre-authorizes €1.00 (refunded in 3–5 days).

**Expected result:** Card shows as "Active".
**If it fails:**

- Greek-issued card 3DS failure → retry from Business Suite mobile app.
- Card rejected → prepaid/virtual cards are blocked. Use a standard Visa/Mastercard debit or credit.
- Stuck in verification → add PayPal as a secondary backup method in parallel.

## Step B.4 — (Recommended) Set account-level spend limit

```
Ads Manager → Billing → Payment settings → Account spending limit
```

Set initial cap — suggest **€200** to prevent runaway spend while you're still learning the system. You can raise it any time.

**Expected result:** Spend limit shows under Billing.

## Step B.5 — Record the new account ID

Append to `/sessions/brave-epic-shannon/mnt/.auto-memory/meta_business_portfolio_diagnosis.md`:

```
Ad account created 2026-04-XX: act_XXXXXXXXX
Currency EUR, timezone Europe/Athens, attached to Page 116436681562585.
Initial spend cap: €200/month.
```

### Phase B Verification

- [ ] Ad account appears in Portfolio 1558125105019725 settings with status "Active"
- [ ] Billing dashboard shows card as "Active"
- [ ] Account Quality (`business.facebook.com/business/accountquality`) shows no warnings
- [ ] Auto-memory updated with new `act_XXXX` ID

---

# PHASE C — Install Pixel + Conversions API in Next.js

Goal: Contact form submissions + Stripe purchases fire both browser Pixel events AND server-side CAPI events, deduped by `event_id`. Enables conversion-objective campaigns in Phase D.

## Step C.1 — Create the Pixel

```
https://business.facebook.com/latest/settings/data_sources?business_id=1558125105019725
```

→ **Add → Pixel → name it `cloudless.gr pixel`** → Connect to your new ad account. Copy the 15–16 digit Pixel ID.

## Step C.2 — Add environment variables

In `.env.local` (development):

```
NEXT_PUBLIC_META_PIXEL_ID=<pixel_id_from_c1>
```

For production, add to SSM per `aws-ssm-config/SKILL.md`:

```
aws ssm put-parameter \
  --name /cloudless/production/NEXT_PUBLIC_META_PIXEL_ID \
  --value <pixel_id> \
  --type String \
  --region us-east-1
```

(SSM region is us-east-1 per Sentry setup memory.)

## Step C.3 — Install Pixel in `app/layout.tsx`

Add at the top of the file:

```tsx
import Script from 'next/script';
```

Inside the `<body>` (before `{children}`):

```tsx
<Script id="meta-pixel" strategy="afterInteractive">
  {`
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
      n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${process.env.NEXT_PUBLIC_META_PIXEL_ID}');
    fbq('track', 'PageView');
  `}
</Script>
<noscript>
  <img
    height="1"
    width="1"
    style={{ display: 'none' }}
    src={`https://www.facebook.com/tr?id=${process.env.NEXT_PUBLIC_META_PIXEL_ID}&ev=PageView&noscript=1`}
    alt=""
  />
</noscript>
```

Commit and deploy to staging.

## Step C.4 — Verify browser Pixel

1. Open the staging URL in Chrome with Meta Pixel Helper installed
2. Click the extension icon
3. Expected: "1 pixel found" with a `PageView` event, ID matching C.1

**If it fails:**

- Extension shows 0 pixels → `NEXT_PUBLIC_` env var not bundled. Restart `pnpm dev` / redeploy.
- Pixel found but "No events fired" → Script strategy is wrong; confirm `afterInteractive`.
- CSP error in console → add `https://connect.facebook.net` to `script-src` in middleware.

## Step C.5 — Fire `Lead` event on contact form submit

In `app/api/contact/route.ts` (or wherever the contact form submits), add a client-side fire on successful submit. Simplest: in the form component's `onSubmit` success branch:

```tsx
if (typeof window !== 'undefined' && (window as any).fbq) {
  (window as any).fbq('track', 'Lead', {
    content_name: 'Contact form',
    value: 0.0,
    currency: 'EUR',
  });
}
```

Verify with Pixel Helper after submitting a test form — should show `PageView` + `Lead`.

## Step C.6 — Generate CAPI access token

In Events Manager:

```
Data sources → cloudless.gr pixel → Settings → Conversions API → Generate access token
```

Copy the token. Store in SSM (us-east-1):

```
aws ssm put-parameter \
  --name /cloudless/production/META_CAPI_ACCESS_TOKEN \
  --value <token> \
  --type SecureString \
  --region us-east-1
```

## Step C.7 — Add server-side Lead event with dedup

Create `lib/meta-capi.ts`:

```ts
import crypto from 'crypto';

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID!;
const TOKEN = process.env.META_CAPI_ACCESS_TOKEN!; // loaded from SSM at boot

const hash = (v: string) =>
  crypto.createHash('sha256').update(v.trim().toLowerCase()).digest('hex');

export async function sendLeadEvent(opts: {
  eventId: string;      // same ID used on client for dedup
  email?: string;
  phone?: string;
  clientIp?: string;
  userAgent?: string;
  fbp?: string;         // _fbp cookie
  fbc?: string;         // _fbc cookie
}) {
  const userData: Record<string, string> = {};
  if (opts.email) userData.em = hash(opts.email);
  if (opts.phone) userData.ph = hash(opts.phone.replace(/\D/g, ''));
  if (opts.clientIp) userData.client_ip_address = opts.clientIp;
  if (opts.userAgent) userData.client_user_agent = opts.userAgent;
  if (opts.fbp) userData.fbp = opts.fbp;
  if (opts.fbc) userData.fbc = opts.fbc;

  const body = {
    data: [
      {
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: opts.eventId,
        action_source: 'website',
        event_source_url: 'https://cloudless.gr/contact',
        user_data: userData,
      },
    ],
  };

  const res = await fetch(
    `https://graph.facebook.com/v26.0/${PIXEL_ID}/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, access_token: TOKEN }),
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Meta CAPI error: ${res.status} ${txt}`);
  }
  return res.json();
}
```

In the contact API route, generate an `event_id` server-side (UUID), return it to the client, and have the client include it in its `fbq('track', 'Lead', …, { eventID })` call:

```tsx
// client
fbq('track', 'Lead', { ... }, { eventID: serverProvidedEventId });
```

## Step C.8 — Verify CAPI and dedup

Submit a test form in production.

Events Manager:

```
Data sources → cloudless.gr pixel → Overview
```

**Expected result:**

- Event appears within ~1 minute
- "Event Match Quality" > 5/10
- "Deduplication" tab shows the browser + server events matched by `event_id`

**If it fails:**

- Event appears from server only → client-side `fbq` isn't firing; check C.5.
- Event appears from browser only → CAPI returning 4xx; check token + SSM fetch.
- Duplicate events not deduped → `event_id` mismatch client↔server.

### Phase C Verification

- [ ] Meta Pixel Helper shows `PageView` + `Lead` on staging
- [ ] Events Manager shows Lead events from both browser AND server
- [ ] Deduplication tab shows matched pairs
- [ ] Event Match Quality ≥ 5/10

---

# PHASE D — First conversion-objective campaign (optional, after A+B+C all green)

Once Phase C has ~7 days of Lead events accumulated, run the first real campaign per `references/ads-manager.md` §12: Leads objective, €15/day CBO, 2 ad sets (Custom Audience "All IG/FB engagers 90d" + LAL 1%). Keep stack-ranking against Windsor blended data.

---

## Troubleshooting (cross-phase)

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Portfolio 1526956002406847 disappears after A.2 | Meta auto-archived an empty portfolio | Fine — that's desirable. If not: request deletion via Business Help. |
| After A.4, Ads Manager still doesn't see IG | Propagation delay | Wait 1h and refresh. |
| B.3 card declined repeatedly | Bank blocks cross-border EU merchant | Call bank, authorize "Meta Platforms Ireland"; or add PayPal. |
| C.4 Pixel Helper says "Pixel but no base code" | Script tag inside `<head>` instead of `<body>` or strategy wrong | Move to `<body>`, strategy="afterInteractive". |
| C.8 Event Match Quality < 5 | Not sending email/phone hash | Include hashed email `em` and phone `ph` in `user_data`. |

---

## Rollback

| Phase | Rollback action |
|-------|----------------|
| A | Re-adding a lite link is a click in IG app → Account Center → Add Facebook. Does NOT restore the Full-mode link — you'd need to repeat A.3–A.5 to get back to clean state. |
| B | Ad accounts can be deactivated (Settings → Ad accounts → \[account\] → Deactivate) but not deleted. Leave deactivated if unused. |
| C | Remove the Pixel `<Script>` tag, unset env vars, revoke CAPI token in Events Manager. Pixel itself can stay — no harm in an unused one. |

---

## Escalation

| Situation | Contact | Method |
|-----------|---------|--------|
| A.2 blocked — can't remove IG from Portfolio 1526956002406847 | Meta Business Help | `https://business.facebook.com/business/pages/request-access` with proof of ownership |
| A.4 "This account is already associated with another Page" persists > 24h | Meta Business Support Chat | Business Suite → Help → Contact Support → Chat |
| B.3 card declined after bank authorization | Card issuer first, then Meta Billing Support | Via Ads Manager → Billing → Contact Support |
| Ad account disabled after creation | Meta Account Quality | `business.facebook.com/business/accountquality` → Appeal |

---

## History

| Date | Run By | Notes |
|------|--------|-------|
| 2026-04-21 | (runbook authored) | Initial version; none of the phases executed yet |
| 2026-09-14 | agent + Tailscale | Diagnosed DISABLED + Page advertise block; paused campaign `23846705231200535`; documented Phase D |
| 2026-09-14 | Account Quality UI | Confirmed appeal **closed** (disabled Jan 2021); Phase D → new BM ad account |

---

## Post-completion: update memory

After the whole runbook succeeds, update `/sessions/brave-epic-shannon/mnt/.auto-memory/`:

- `meta_business_portfolio_diagnosis.md` → mark as RESOLVED; note new ad account ID + IG full-mode confirmed
- `social_media_integration.md` → Phase 1 Windsor IG marked complete; Phase 2 Meta Graph API in Next.js note Pixel+CAPI live
- Add a new `meta_ads_pixel_setup.md` capturing the Pixel ID, CAPI token SSM path, and event list

## Phase D — Ad account / Page advertising restriction (ops)

Live Graph + Account Quality UI (2026-09-14):

| Field | Value |
|-------|-------|
| Account | `act_657781691826702` “Themistoklis Baltzakis” |
| Disabled since | **2021-01-24** |
| `account_status` | `2` DISABLED |
| `disable_reason` | `1` `ADS_INTEGRITY_POLICY` |
| Campaign | `Nouvelle campagne` (`23846705231200535`) → **PAUSED** via API |
| Ads | still `DISAPPROVED`; review text: **Page isn't allowed to advertise** |
| Appeal | **CLOSED** — Meta: decision cannot be reviewed |

### Verdict (Account Quality, 2026-09-14)

Meta Account Quality for this ad account:

> This ad account, its ads and some of its advertising assets are disabled because it didn't comply with our policy on Advertising Standards affecting business assets. **Too much time has passed since this account was disabled, so this decision can't be reviewed.**

Restrictions on **this** account (permanent for `act_657781691826702`):

- Can't create or run ads
- Can't use or share audiences
- Can't use Meta Pixel, offline event sets or custom conversions (on this account)
- Can't use app SDKs to send app events

Meta’s prescribed path:

> To continue advertising, **use another ad account**. You can add new ad accounts in Business Settings.

Do **not** keep appealing `act_657781691826702`. Partner Appeals API and Meta AI “review disabled asset” cannot override this.

### Path forward (new ad account)

1. Business Settings → **cloudless.gr** BM `1558125105019725` → Ad accounts → **Add** a new ad account (own it under this BM; do not reuse the personal 2021 account).
2. Confirm Page **Cloudless.gr** (`1163886186808102`) is `promotion_eligible: true` (or clear Page advertise restrictions in Account Quality). A new ad account still cannot advertise from a blocked Page.
3. Assign the new ad account ADMIN to the token user; link Pixel + Page to the new account.
4. Update Pi / D1 config: `META_AD_ACCOUNT_ID` → new `act_…` (or numeric ID). Redeploy / restart so Integrations + `meta-ads` read the new ID.
5. Verify:

   ```bash
   curl -sS -H "Authorization: Bearer $META_ACCESS_TOKEN" \
     "https://graph.facebook.com/v26.0/act_<NEW_ID>?fields=account_status,disable_reason,name"
   ```

   Expect `account_status=1`. Admin → Integrations Meta card should leave `degraded`.

6. Leave the old account paused/archived; do not point production at `657781691826702` again.

### Dual Page note

The user token lists both Pages. Confirm Account Quality covers the Page tied to ads; consolidate to one Page in Business Manager when possible.
