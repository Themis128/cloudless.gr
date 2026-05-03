# Ad Account — Creation, Billing, Spend Limits

Everything you need to go from "I have a Business Portfolio" to "I can launch ads and get charged for them." Solves the blocker on Task #9.

## 1. Create an ad account inside a Business Portfolio

### Direct URL

```
https://business.facebook.com/latest/settings/ad_accounts?business_id=1558125105019725
```

### Steps

1. Click **Add** → **Create a new ad account**
2. Fill the modal:
   - **Ad account name** — descriptive (e.g., "cloudless.gr — primary")
   - **Time zone** — `(GMT+02:00) Europe/Athens`
   - **Currency** — `EUR - Euro`
   - **Payment method** — you can skip for now and set later
3. Click **Next** → on "Choose a business portfolio" page, confirm `1558125105019725`
4. **Assign the account to a user** — pick yourself as Admin. Add backup Admin if relevant.
5. **Attach a Page** — select cloudless.gr Page (116436681562585). This becomes the "Business info" shown on ads.
6. **Create**

**Currency + timezone are immutable** once set. Pick carefully — you can't change them later, you'd have to create a new ad account.

### After creation

- Note the new ad account ID (shown as `act_XXXXXXXXX`). Save it to auto-memory.
- Old ad account `act_657781691826702` (Themistoklis Baltzakis) is NOT moved in — it's a separate personal ad account. You can either:
  - (A) Leave both, use the new one inside the portfolio for all new campaigns
  - (B) Try to migrate the old one into the portfolio via Settings → Accounts → Ad accounts → Add → Add an ad account (you must be its admin on your personal profile)

Recommendation: (A) — migrating a used ad account sometimes triggers review flags. Use the new one for clean reporting.

## 2. Add a payment method

### Direct URL
```
https://www.facebook.com/ads/manager/account_settings/account_billing/?act=<NEW_AD_ACCOUNT_ID>
```

Or: Ads Manager → top-right gear icon → Billing & Payments

### Supported methods (Greece / EU)

| Method | Notes |
|--------|-------|
| Credit/Debit Card | Visa, Mastercard, Amex. Most common. 3D Secure required. |
| PayPal | OK but not accepted for all campaign types; recommended as backup |
| Direct Debit (SEPA) | EU only, requires IBAN. Monthly invoicing. Best for predictable spend. |
| Google Pay / Apple Pay | Mobile Business Suite only |
| Online banking (iDEAL / etc.) | Not available in GR |

### Credit card gotchas

- Card must support **3D Secure / Verified by Visa / Mastercard SecureCode**
- Greek bank-issued cards sometimes fail 3DS on the first attempt; retry from Business Suite mobile app as a fallback
- Prepaid/gift cards are rejected
- If the card's issuing country differs from the ad account's country, Meta may ask for additional verification

### Adding a card

1. Enter card number, expiry, CVV, cardholder name
2. Meta pre-authorizes €1.00 (shows as "Meta Platforms Ireland") and refunds within 3-5 days
3. Complete 3DS challenge in the popup (OTP from bank)
4. Card shows as "Active" — ads can now spend against it

### Backup payment method

Always add a second method. When primary fails (e.g., expiry, block), ads pause until billing is resolved. A backup can auto-take-over to keep campaigns live.

## 3. Billing thresholds and cycles

Meta uses **billing thresholds** (not monthly invoices) for most new accounts.

### How thresholds work

- Your account has a threshold starting at $25 / €25 (varies by region)
- Every time your spend hits the threshold, Meta charges your card
- If the charge succeeds and spend is "trusted", the threshold auto-raises: €25 → €50 → €100 → €250 → €500 → €750 (approximate)
- On the 1st of each month, any remaining balance is also charged regardless of threshold

### Moving to monthly invoicing

Requires:
- €/$ 2500+ monthly spend for 3+ months
- Good payment history (no declined charges)
- EU businesses: VAT ID registered

Request via: Ads Manager → Billing → Invoicing → "Apply for monthly invoicing"

Approval: 2-4 weeks. Includes credit-check.

### Spend limits (hard cap)

Separate from threshold — this is a MAXIMUM you'll spend.

**Account-level spend limit:** Ads Manager → Billing → Payment settings → Account spending limit

Useful for:
- Preventing runaway spend from misconfigured campaigns (especially auto-placements)
- Client work where you pre-bill and have a fixed budget

When hit, ALL campaigns pause until you raise or reset the limit.

**Campaign-level spend limit:** Set during campaign creation or edit.

## 4. Ad account roles

Manage at: Business Portfolio → Settings → Ad accounts → select the account → People

| Role | Can do |
|------|--------|
| **Admin** | Everything including billing, roles, account-level settings |
| **Advertiser** | Create/edit/delete ads, campaigns, ad sets. CANNOT edit billing. |
| **Analyst** | Read-only — see insights, download reports. Cannot create/edit ads. |
| **Creative Collaborator** | Can upload creative assets and draft ads but not publish (must be approved by Admin/Advertiser) |

Assign self as Admin. Add at least one backup Admin if working with a partner/team.

## 5. Ad account status

Check: Ads Manager → Account Overview (top) + Account Quality dashboard.

### Common statuses

| Status | What it means | What to do |
|--------|--------------|------------|
| **Active** | Normal operation | Nothing |
| **Warning** | Recent policy issue or billing decline | Read notification, resolve |
| **Disabled** | Serious policy violation or billing failure | Appeal via Account Quality |
| **Payment required** | Charge failed | Update payment method, retry |
| **In review** | New ad waiting for Meta review | Wait (usually 24h) |
| **Unsettled** | Balance not charged yet | Usually clears within 24h of threshold hit |

### If disabled

1. Check Account Quality (`business.facebook.com/business/accountquality`) for the exact reason
2. Fix the underlying issue (e.g., remove policy-violating ad, update billing)
3. Submit appeal — be specific about what was fixed
4. Response typically 48h; if repeatedly rejected, request human review

**Do NOT create a new ad account while one is disabled** — Meta's system will disable the new one too and may escalate to the portfolio.

## 6. Pixel + Conversions API

Before launching any campaign with conversion objectives, install tracking.

### Pixel installation for cloudless.gr (Next.js)

1. Create Pixel: Business Portfolio → Data Sources → Pixels → Add → name it "cloudless.gr pixel"
2. Copy the Pixel ID (numeric, 15-16 digits)
3. In `app/layout.tsx`, add the base code using `next/script`:

```tsx
import Script from 'next/script';

// In the <head>:
<Script id="meta-pixel" strategy="afterInteractive">
  {`
    !function(f,b,e,v,n,t,s){...}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${process.env.NEXT_PUBLIC_META_PIXEL_ID}');
    fbq('track', 'PageView');
  `}
</Script>
```

4. Add `NEXT_PUBLIC_META_PIXEL_ID=<your_pixel_id>` to `.env.local` and production env
5. Verify installation: open the site → Meta Pixel Helper (Chrome extension) → should show green checkmark
6. In Events Manager, verify the Pixel is receiving PageView events

### Standard events worth tracking for cloudless.gr

| Event | When to fire | Code |
|-------|--------------|------|
| `PageView` | Every page load | Automatic with base code |
| `Lead` | Contact form submission | `fbq('track', 'Lead')` on submit |
| `CompleteRegistration` | Newsletter signup | `fbq('track', 'CompleteRegistration')` |
| `Contact` | Chat opened or consultation booked | `fbq('track', 'Contact')` |
| `Purchase` | Stripe payment success | `fbq('track', 'Purchase', {value, currency})` |

### Conversions API (server-side)

Browser Pixel is increasingly blocked by ad-blockers and ITP. Meta's Conversions API sends the same events server-side for better accuracy.

For cloudless.gr Next.js:
- Install `@meta/conversions-api` or use raw Graph API calls in a Lambda/API route
- Send events from the server at the same time as the browser Pixel
- Meta dedupes using `event_id` — same ID on both browser + server = one event

Store CAPI access token in SSM at `/cloudless/production/META_CAPI_ACCESS_TOKEN`. Reference `aws-ssm-config/SKILL.md` for the pattern.

## 7. Monthly budget planning

For a small business like cloudless.gr:

| Monthly budget | Realistic outcome |
|----------------|------------------|
| < €100 | Very limited. Boost a top-performing organic post; don't run full campaigns. |
| €100-500 | 1-2 simple campaigns (retargeting website visitors, lookalike of IG followers). Learnings, not scale. |
| €500-2000 | Proper campaign structure: awareness + consideration + conversion funnel. Some statistical significance. |
| €2000+ | Dedicated daily management, A/B testing, enough data for algorithmic optimization |

Meta's learning phase requires ~50 optimization events per ad set per week to exit — at €10 CPA you need €500/week/ad set, at €2 CPA you only need €100.

## 8. Closing the loop: Reporting

After campaigns run, data flows through:
- **Ads Manager** — native Meta UI, real-time but can only see Meta data
- **Windsor.ai** `facebook` connector → MCP → Claude for cross-platform blended analysis
- **Supermetrics** → Google Sheets / Looker Studio for polished reports

For cloudless.gr the MCP path is already wired. After creating the ad account, go to `windsor-ai/SKILL.md` → re-run Facebook connector OAuth → query with `get_data(connector="facebook", ...)`.

## 9. Ad account creation checklist

Run through this when executing Task #9:

- [ ] Portfolio 1558125105019725 has no existing ad account (or I've chosen not to reuse it)
- [ ] I'm Admin on the portfolio
- [ ] I have a payment card ready that supports 3DS
- [ ] Decided currency = EUR, timezone = Europe/Athens
- [ ] Created the ad account via Settings → Accounts → Ad accounts → Add → Create new
- [ ] Attached cloudless.gr Page as Business Info
- [ ] Added payment method, verified 3DS works
- [ ] Added self as Admin on the ad account
- [ ] Noted new ad account ID in auto-memory
- [ ] Pixel created and installed in Next.js app
- [ ] (Optional) Set account-level spend limit to cap risk
- [ ] (Optional) Request monthly invoicing if spend will exceed €2500/mo
