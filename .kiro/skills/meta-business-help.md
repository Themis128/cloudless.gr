---
inclusion: manual
---

# Meta Business Help — UI Playbook for cloudless.gr

This skill covers **business-user operations** in Meta's UI surfaces:

- **business.facebook.com** (Meta Business Suite / Business Portfolio / Settings)
- **adsmanager.facebook.com** (Ads Manager)
- **business.facebook.com/commerce** (Commerce Manager, Catalog)
- **Meta Business Suite** mobile app

It is the companion to `meta-business-suite/SKILL.md` which covers the **Graph API** for the same systems. If the user wants to click buttons in a browser, use THIS skill. If they want to write code against the API, use the other one.

---

## When to reach for this skill

- "How do I create an ad account under my Business Portfolio?"
- "Why does Meta say I can't advertise from this Business Portfolio?"
- "How do I add @cloudless_gr to my Business Portfolio?"
- "How do I move my Facebook Page from my personal account to a portfolio?"
- "I want to boost a post / run my first ad"
- "How do I schedule content for Instagram + Facebook at once?"
- "How do I add another user as an admin on my Page?"
- "Meta billing — how do I set up a payment method?"
- "Where do I find my ad performance / insights?"

---

## Current cloudless.gr setup (2026-04-21)

From `meta_business_portfolio_diagnosis.md` in auto-memory:

- **Meta App**: `1936126137016578` (cloudless-marketing) — used for Graph API token generation
- **Business Portfolio "Themistoklis Baltzakis"** (functional): `1558125105019725`
  - Owns Facebook Page cloudless.gr (FB Page ID `116436681562585` — also seen as `61553018019998` from some API surfaces)
  - Needs ad account created inside it (Task #9, pending)
- **Business Portfolio "cloudless.gr"** (bogus / empty asset shell): `1526956002406847`
  - Has @cloudless_gr IG linked under People → business users with full control
  - Blocked from advertising (shows warning "You can't use this business portfolio to advertise")
  - Strategic decision made: do NOT try to move assets TO this portfolio; keep them in 1558125105019725
- **Instagram** `@cloudless_gr`: Business account, currently in lite-mode relative to FB Page. Full connection pending.
- **Ad Account** `act_657781691826702`: Legacy personal ad account, NOT inside the Business Portfolio. Can be used standalone but complicates reporting.

**Main blocker:** No ad account inside portfolio 1558125105019725 — can't launch campaigns until this is created.

---

## Decision tree

```
User wants to...
├── Set up billing / create ad account
│   → references/ad-account.md
│
├── Work with the Business Portfolio (add assets, fix "can't advertise" error, manage people)
│   → references/business-portfolio.md
│
├── Manage the Facebook Page OR link it to Instagram
│   → references/page-and-ig.md
│
├── Plan / launch / optimize an ad campaign
│   → references/ads-manager.md
│
├── Publish / schedule / analyze organic content
│   → references/business-suite-app.md
│
└── Set up online store / Catalog / Shops
    → references/commerce.md
```

---

## Bundled references

| File | Topic | When to open |
|------|-------|--------------|
| `references/business-portfolio.md` | Business Portfolio structure, asset types, People roles, "can't advertise" fixes | Any Portfolio-level question, OAuth/ads-sync issues |
| `references/ad-account.md` | Creating ad accounts, payment methods, billing thresholds, spend limits | Before launching first ad, when billing issues surface |
| `references/page-and-ig.md` | Page roles, moving Pages, IG Business setup, IG-FB linking modes | Fix lite-mode IG, change Page ownership, add Page admins |
| `references/ads-manager.md` | Campaign structure (Campaign → Ad Set → Ad), audiences, bidding, attribution | Planning or debugging a specific ad campaign |
| `references/business-suite-app.md` | Unified inbox, post scheduling, creator studio, insights | Daily content ops |
| `references/commerce.md` | Catalog, Shops, tagged products | Only if we start selling products through FB/IG |

All references are designed so you can open ONE file for a specific task and have the full checklist — no need to read multiple files sequentially.

---

## Key URLs (bookmark these)

| Thing | URL |
|-------|-----|
| Business Portfolio home (ID-locked) | `https://business.facebook.com/latest/home?business_id=1558125105019725` |
| Portfolio settings (assets, people, billing) | `https://business.facebook.com/latest/settings/?business_id=1558125105019725` |
| Ad account billing | `https://www.facebook.com/ads/manager/account_settings/account_billing/` |
| Ads Manager | `https://adsmanager.facebook.com/` |
| Meta Business Suite (web) | `https://business.facebook.com/latest/home` |
| Page roles | `https://business.facebook.com/latest/settings/page_access` (click the Page name) |
| Instagram account settings in portfolio | `https://business.facebook.com/latest/settings/instagram_accounts` |
| Commerce Manager | `https://business.facebook.com/commerce` |
| Help Center (generic) | `https://www.facebook.com/business/help/` |
| Developer portal (for API tokens) | `https://developers.facebook.com/apps/1936126137016578/` |

---

## Workflow: "I want to run my first ad on cloudless.gr"

High-level sequence tying the references together:

1. **Business Portfolio readiness** (`references/business-portfolio.md`)
   - Verify portfolio `1558125105019725` has the Page attached ✅ (already done)
   - Verify IG is attached and in full mode (not lite) — currently blocked
2. **Create ad account** (`references/ad-account.md`)
   - Inside portfolio 1558125105019725: Settings → Accounts → Ad accounts → Add → Create new
   - Fill: name, country (Greece), currency (EUR), timezone (Europe/Athens)
   - Attach Page as the "Business info" for the ad account
   - Assign yourself Admin + add payment method
3. **Set a daily/lifetime spend limit** (`references/ad-account.md` → Spend limits)
4. **Install Pixel + Conversions API** (`references/ads-manager.md` → Tracking)
   - Already have a Pixel? Attach it to the ad account
   - Next.js app: install Meta Pixel via next/script
5. **Create the campaign** (`references/ads-manager.md` → Campaign setup)
   - Pick an objective matching the business goal (Traffic, Leads, Sales, Awareness)
   - Define audience (Custom Audience from website visitors is highest-intent)
   - Set budget + schedule
   - Build the ad creative (image/video + copy + CTA)
6. **Launch, monitor, optimize** (`references/ads-manager.md` → Optimization loop)

---

## Troubleshooting lookup

| Symptom | Likely cause | File with fix |
|---------|-------------|---------------|
| "You can't use this business portfolio to advertise" | Portfolio flagged by Meta's automated systems or missing payment | `business-portfolio.md` |
| Can't find the "Create ad account" button | Insufficient role in portfolio (need admin) | `business-portfolio.md` → People roles |
| Payment method rejected | Card country mismatch, declined issuer, missing 3DS | `ad-account.md` → Billing |
| Page not showing in ad account | Page not attached to portfolio, or not assigned to the ad account | `page-and-ig.md` |
| IG doesn't appear in Business Suite | Lite-mode connection, wrong account type | `page-and-ig.md` → IG modes |
| Ad rejected immediately | Policy violation, disapproved creative | `ads-manager.md` → Ad review |
| "Ad account disabled" overnight | Unusual activity flag or policy strike | `ad-account.md` → Account status |
| Posting fails in Business Suite | Token scope issue, Page role issue, scheduled time in past | `business-suite-app.md` |

---

## Related skills

- `meta-business-suite/SKILL.md` — Graph API reference (programmatic access)
- `meta-instagram/SKILL.md` — IG-specific API + MCP server config
- `instagram-graph-api/SKILL.md` — IG Graph API full endpoint reference
- `facebook-pages-api/SKILL.md` — FB Pages API full endpoint reference
- `meta-marketing-api/SKILL.md` — Marketing API (programmatic campaign management)
- `windsor-ai/SKILL.md` — Reading Meta data through Windsor's MCP (alternative to Graph API for read-only analytics)
- `marketing-data-hub/SKILL.md` — Cross-platform orchestration (when to use which tool)


## Reference: ad-account.md

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


## Reference: ads-manager.md

# Ads Manager — Campaign Structure, Audiences, Optimization

End-to-end playbook for launching and running ads in `adsmanager.facebook.com`. Assumes `ad-account.md` has been completed (ad account exists with billing + Pixel).

## 1. The three-level hierarchy

Meta organizes ads as **Campaign → Ad Set → Ad**:

| Level | Defines | Key settings |
|-------|--------|-------------|
| **Campaign** | The goal | Objective (Sales, Leads, Traffic, etc.), campaign budget optimization (CBO), A/B test setup, special ad categories |
| **Ad Set** | The WHO, WHERE, WHEN, HOW MUCH | Audience, placements, budget, schedule, optimization event, bid strategy |
| **Ad** | The WHAT | Creative (image/video/carousel), copy, headline, CTA button, landing URL |

One Campaign can contain many Ad Sets, each with its own audience/placements/budget. Each Ad Set can contain many Ads (creative variations). This is how you A/B test at every level.

### Flat structure for cloudless.gr (small accounts)

For a solo/small business under €1000/mo spend:

- 1 Campaign per objective (e.g., one for "Leads", one for "Traffic")
- 1-2 Ad Sets per Campaign (e.g., one broad, one retargeting)
- 2-3 Ads per Ad Set (different creative variants)

Resist creating 10 ad sets; Meta's learning phase requires ~50 optimization events per ad set per week — fragment your budget and nothing will exit learning.

## 2. Campaign objectives

Meta consolidated from 11 objectives down to 6 in the ODAX update:

| Objective | Optimization events | When to use |
|-----------|---------------------|-------------|
| **Awareness** | Reach, impressions, ad recall lift | Brand launches, broad exposure — not for direct response |
| **Traffic** | Link clicks, landing page views | Drive people to a page; cheap clicks but often junky traffic |
| **Engagement** | Post engagement, page likes, video views, messages | Build community, grow followers, warm up an audience |
| **Leads** | Form submissions (Meta Lead Forms), calls, messages | Service businesses, B2B, consultations — best for cloudless.gr primary objective |
| **App promotion** | App installs, in-app events | Mobile apps only |
| **Sales** | Purchases, add to cart, initiate checkout | E-commerce — requires Pixel + Purchase events firing |

### Objective choice for cloudless.gr

- Primary: **Leads** with optimization for "Contact form submission" (Pixel `Lead` event)
- Secondary: **Traffic** driving to blog posts / case studies for top-of-funnel
- Re-engagement: **Engagement** optimizing for IG post engagements on existing content

## 3. Ad sets — audiences in depth

### Audience types

1. **Saved Audience** (Core) — built from demographic + interest + behavior targeting
2. **Custom Audience** — built from your OWN data (website visitors, customer list, IG engagers, etc.)
3. **Lookalike Audience** — Meta finds people similar to a Custom Audience source
4. **Advantage+ Audience** — Meta picks automatically with minimal targeting input

### Custom Audiences for cloudless.gr

Best sources in priority order:

| Source | How to build | Typical quality |
|--------|-------------|-----------------|
| Website visitors (Pixel) | Ads Manager → Audiences → Create → Custom → Website → define rules (e.g., "all visitors last 180d") | ★★★★★ highest intent |
| Customer list | Upload CSV of emails/phones | ★★★★★ matches existing customers |
| IG engagers | Custom → Instagram account → everyone who engaged in last 90d | ★★★★ warm audience |
| FB Page engagers | Custom → Facebook Page → similar settings | ★★★★ |
| Video viewers | Custom → Video → 25%/50%/75% completion | ★★★ |
| Lead form openers | Custom → Lead form → opened but didn't submit | ★★★★ rescue high-intent drop-offs |

Build these audiences BEFORE launching the first campaign — you'll use them as Exclusion sets even for prospecting.

### Lookalike Audiences

1. Pick a Custom Audience source (minimum 100 matched people; 1000+ is better)
2. Choose country (Greece for most cloudless.gr targeting)
3. Set percentage: 1% = 100k people in Greece, most similar; 10% = 1M people, least similar but larger reach
4. Start with **1%** for top-of-funnel, expand to 3-5% if the 1% audience is too small for €/day budget to spend

### Detailed targeting (interests/behaviors/demographics)

In the Ad Set → Audience → Detailed targeting field, you can add/exclude:

- Interests (e.g., "Web development", "Entrepreneurship", "Small business")
- Behaviors (e.g., "Small business owners", "Frequent travelers")
- Demographics (e.g., job titles — limited post-2022 due to EU DMA changes)

**EU restriction (important for cloudless.gr):** Since the Digital Markets Act took effect, detailed targeting based on sensitive categories (religion, politics, health, sexual orientation) is banned. Meta also phased out many job-title targeting options. Rely more on Custom Audiences + Lookalikes for precision.

### Placements

- **Advantage+ placements (Automatic)** — Meta picks across all surfaces: Feed, Stories, Reels, Audience Network, Messenger, etc.
- **Manual placements** — you select specific surfaces

**Recommendation for small budgets:** Use Advantage+. Meta's delivery algorithm will find the cheapest placement. Going manual requires enough data per placement to optimize, which requires more budget than a €500/mo advertiser typically has.

## 4. Budget & bidding

### Budget level

- **Campaign Budget Optimization (CBO)** — set at campaign level, Meta distributes between ad sets
- **Ad Set Budget Optimization** — set at each ad set, you control distribution

CBO is generally better when you have 2+ ad sets; simplifies management. Required for Advantage+ campaigns.

### Daily vs. lifetime

- **Daily** — Meta spends about €X/day (can vary ±25% on any given day)
- **Lifetime** — Meta spends €X total over the campaign date range; must set end date

Use Lifetime for time-boxed promos (e.g., "Black Friday sale 11/25–11/29"), Daily for evergreen campaigns.

### Bid strategy

| Strategy | What it does | When to use |
|----------|-------------|-------------|
| Highest volume | Maximize results regardless of cost | Default; let Meta optimize |
| Cost per result goal | Hit a specific CPA target | After learning phase; you know what "good" costs |
| ROAS goal | Hit a specific return on ad spend | Sales campaigns with enough conversion data |
| Bid cap | Never pay more than X per event | Experienced advertisers; can starve ad sets |

Start with **Highest volume** (no cap). Only switch to Cost per result goal after you've had 2+ weeks of data.

## 5. Creative — the ad itself

### Formats

| Format | Best for | Specs |
|--------|---------|-------|
| Single image | Simple, fast to produce, CTA-focused | 1080×1080 (1:1) or 1080×1350 (4:5) for feed, 1080×1920 (9:16) for Reels/Stories |
| Single video | Storytelling, demos, high engagement | Same sizes; 15s for feed, ≤60s for Reels, ≤15s for Stories |
| Carousel | Showcase multiple products/messages | 2-10 cards, each 1080×1080 |
| Collection | E-commerce with catalog | Requires product catalog |
| Dynamic creative | Auto A/B test creative combinations | Upload 2-10 images + 2-5 headlines + 2-5 texts; Meta combines |

### Copy structure (primary text)

Best-performing pattern for cloudless.gr:

1. **Hook** (first line, ≤125 chars so it's above "See More")
2. **Value prop** (what problem you solve)
3. **Social proof or specificity**
4. **CTA** (explicit action)

Example:

```
Your Next.js deploy shouldn't break at 2 AM.

cloudless.gr builds battle-tested infra for teams that can't afford downtime.

→ 40+ deployments shipped with zero rollback incidents.

Book a free audit: cloudless.gr/contact
```

### Headline + description

- Headline: 27-40 chars, hook-forward
- Description: 27-30 chars, supports the headline
- Both appear below the image/video

### CTA button

Pick from: Learn More, Sign Up, Contact Us, Book Now, Get Quote, Apply Now, etc. Match to objective.

### Landing page

- Must match the ad promise — if ad says "free audit", landing page must have "free audit" prominently
- Load speed matters; Meta penalizes slow LPs
- Must have the Meta Pixel firing the relevant event (ViewContent, Lead, Purchase)

## 6. Launch checklist

Before clicking **Publish** on your first campaign:

- [ ] Campaign objective matches business goal
- [ ] Special ad category declared if relevant (Housing/Employment/Credit/Politics — EU also requires Social Issues declaration)
- [ ] Ad Set audience is either a Custom Audience or a sensible Saved Audience (not totally broad 18–65+ Greece)
- [ ] Exclusion: anyone who already converted (website visitors who fired Lead/Purchase in last 30d)
- [ ] Placements = Advantage+ (unless you have good reason otherwise)
- [ ] Daily budget ≥ €10 (below this, Meta can't learn)
- [ ] Optimization event = the event you actually track (Lead, Purchase, not just "Link Click")
- [ ] Pixel installed and verified firing correct event on landing page
- [ ] Ad creative passes Meta's policies (no "you" targeting in copy, no misleading claims, no before/after for health/beauty)
- [ ] Copy + headline no misspellings, clear CTA
- [ ] UTMs on landing URL for GA4 / Supermetrics tracking (e.g., `?utm_source=meta&utm_medium=paid&utm_campaign=leads-q2-2026`)
- [ ] Ad account balance / billing threshold high enough to avoid mid-campaign pauses

## 7. Ad review

After publish, ads enter **In Review** status. Typical timing:

- Most ads approve in 15 min – 24h
- Flagged ads can take 48–72h for secondary review
- Rejected ads: read the disapproval reason, edit, resubmit (counts as a new review cycle)

### Common rejection reasons

- "Personal attributes" — using "you" pronouns in a way that implies you know the viewer's circumstances ("Struggling with debt?")
- "Restricted categories" — financial services, gambling, supplements, CBD, weight loss, etc.
- "Misleading" — exaggerated claims without proof
- "Low quality landing page" — slow, popup-heavy, or thin content

Appeal via Ads Manager → the rejected ad → "Request Review". Be specific about what you changed.

## 8. Monitoring & the optimization loop

### What to check daily (first 2 weeks)

- Spend per ad set vs. budget
- CPM (cost per 1000 impressions) — sanity check that delivery is happening
- CTR (click-through rate) — >1% is decent, >2% is good for cold traffic
- CPA (cost per optimization event) — relative to your target

### What to check weekly

- Frequency (how many times the same person sees the ad) — below 3/week is fine; above 5 = audience fatigue
- Results breakdown by placement — if one placement drags down overall, switch to manual and exclude
- Results breakdown by demographic (age + gender) — re-allocate if a group dominates

### Learning phase

- Every new ad set starts in "Learning" until it gets ~50 optimization events in 7 days
- Don't edit during learning — every significant edit resets the phase
- If you haven't exited learning in 14 days, merge ad sets or raise budget

### When to kill an ad

- 3-7 days of underperformance at 2x your target CPA — kill
- Frequency >5 with declining CTR — kill (ad fatigue)
- High CTR but low conversions → audience quality issue, try a different audience
- Low CTR → creative issue, try a different ad

## 9. Attribution

Meta's attribution window default: **7-day click + 1-day view**. Changes dramatically affect reported results.

- Match your window to your business sales cycle (cloudless.gr = long sales cycle, use 7-day click + 1-day view or even extend)
- In Ads Manager column picker, add "Attribution setting" column to always see which window a result count is using
- Cross-reference with GA4 — Meta + GA4 will NEVER perfectly match because of view-through attribution differences, ITP, ad blockers

## 10. Reporting

Three options:

1. **Ads Manager Reports** — built-in, good for quick checks
   - URL: `https://business.facebook.com/adsmanager/reporting`
   - Scheduled email reports daily/weekly
2. **Windsor.ai** — pull Meta data via MCP into Claude or Notion
   - Requires the ad account to be inside a portfolio Windsor is connected to
   - Query via `get_data(connector="facebook", accounts=["<ad_account_id>"], ...)`
3. **Looker Studio** — polished dashboards for clients/stakeholders
   - Connect Windsor → Looker Studio destination
   - Or use Meta's native Looker Studio connector

For cloudless.gr, the MCP path is already wired — Windsor + Claude gives ad-hoc analysis without leaving Cowork.

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| No delivery / zero impressions | Audience too narrow, bid too low, scheduled for future | Widen audience, raise budget, check start date |
| Spending but no conversions | Pixel not firing, wrong event selected, broken landing page | Test Pixel via Helper extension, verify event in Events Manager |
| Rejected for "special ad category" | Category auto-detected based on copy/LP content | Declare category OR edit copy to remove trigger keywords |
| Ads manager shows "Account restricted" | Billing issue or policy strike | Check Account Quality dashboard |
| Results in Ads Manager don't match GA4 | Attribution window + ad blocker + browser privacy | Set up Conversions API (server-side) for better accuracy |
| High CPM vs. industry benchmark | Over-narrow audience, low quality score, high-competition window | Broaden audience, improve creative, shift schedule |
| Frequency climbing fast | Audience too small for budget | Lower budget OR expand audience |

## 12. Policy quick-reference

Full policies: `https://www.facebook.com/policies/ads/`

Most-hit gotchas for cloudless.gr's likely verticals:

- Can't use Meta's trademarks in ad text ("Facebook", "Instagram", "Meta") except factually
- Can't promise specific results ("Guaranteed 10x ROI")
- Can't use before/after imagery for anything body/health related
- Can't claim user attributes ("You're over 40 and...")
- Can't use low-resolution, deceptive, or shock imagery
- Landing page must have a visible privacy policy link (especially for Lead forms)

## 13. Quick launch workflow for the first cloudless.gr campaign

1. **Audience build (do this today)**
   - Custom Audience: cloudless.gr website visitors last 180d (seed for lookalike + retargeting)
   - Custom Audience: IG engagers last 90d
   - Lookalike Audience: 1% from website visitors 180d
2. **Campaign 1: Prospecting**
   - Objective: Leads
   - Ad Set A: Lookalike 1% of website visitors
   - Ad Set B: Saved Audience — Greece, age 25-55, interests "Web development, Next.js, Startups, Small business"
   - Budget: €15/day each ad set, CBO €30/day total
   - Placements: Advantage+
3. **Campaign 2: Retargeting**
   - Objective: Leads
   - Ad Set: Website visitors last 30d who DIDN'T convert
   - Budget: €10/day
   - Creative: testimonial + direct "Book a call" CTA
4. Let run 7 days. Review. Adjust.

Return to `ad-account.md` for Pixel setup if not yet done. Return to `page-and-ig.md` if Page/IG connection still incomplete.


## Reference: business-portfolio.md

# Business Portfolio — Structure, Assets, People

Meta's "Business Portfolio" (the product formerly known as Business Manager) is the container that holds all your business assets: Pages, Instagram accounts, ad accounts, Pixels, Catalogs, datasets. Without one, you cannot scale beyond personal-profile-owned assets.

## 1. Anatomy of a Business Portfolio

A Portfolio has:

- **An owner** (you, the person who created it)
- **Assets** — Pages, IG accounts, ad accounts, Pixels, Catalogs, Datasets (Events Manager), WhatsApp Business Accounts
- **People** — users with roles on the portfolio itself + specific permissions on each asset
- **Partners** — other businesses you've given asset access to (e.g., an ad agency)
- **Billing** — payment methods and tax info (separate from per-ad-account billing)

Assets within a portfolio get **portfolio-level permissions** layered on top of per-asset roles. A user can be:

- Admin on the portfolio (full access to all current + future assets)
- Employee on the portfolio (limited by per-asset role)
- Explicitly assigned to a specific asset without portfolio-wide access

## 2. Finding your portfolio(s)

One person can own multiple Portfolios (and is typically a member of several via work). See all of them at:

```
https://business.facebook.com/latest/select-business
```

or from any portfolio page, click the business name in the top-left to switch.

**cloudless.gr context:** Themis has TWO portfolios:

- `1558125105019725` — "Themistoklis Baltzakis" (auto-created, functional, has Page)
- `1526956002406847` — "cloudless.gr" (manually created, carries the IG link but flagged "can't advertise")

Decision recorded in auto-memory: keep everything in `1558125105019725`; do not try to use `1526956002406847` for advertising.

## 3. Adding assets to a Portfolio

### 3a. Adding a Facebook Page

Direct URL: `https://business.facebook.com/latest/settings/pages?business_id=<PORTFOLIO_ID>`

Three flows:

1. **Add a Page you own** — simplest, instant. You must be currently an admin of the Page on your personal profile.
2. **Claim a Page** — if another portfolio owns it, you request ownership. The current owner portfolio's admin must approve (or Meta support arbitrates if the request is legitimate business transfer).
3. **Request access (agency mode)** — you don't own the Page, you just need Admin/Editor/Advertiser access to do work. The Page admin grants access but retains ownership. THIS IS WHAT CAUSES "LITE MODE" — see `page-and-ig.md`.

**Gotcha:** A Page can only be OWNED by one portfolio at a time. If you try to add it to a second portfolio, Meta blocks with a misleading error like "Only people with full control…" — the real reason is ownership conflict elsewhere.

### 3b. Adding an Instagram Business account

Direct URL: `https://business.facebook.com/latest/settings/instagram_accounts?business_id=<PORTFOLIO_ID>`

Requirements:

- IG must already be a **Business** or **Creator** account (switch in IG mobile app → Settings → Account)
- You must know the IG login credentials OR the IG account must be linked to a Page inside the same portfolio

Flow:

1. Click "Add" → enter IG username + password OR "I already have access" (if linked via Page)
2. Meta then asks: "Which ad accounts should this IG be available in?" — pick your portfolio's ad accounts

**cloudless.gr gotcha:** The IG `@cloudless_gr` currently shows under the **People → business users** list in portfolio `1526956002406847` (NEW asset model) rather than in the classic `/instagram_accounts` page. Meta is mid-migration. If you can't find an IG account, check BOTH URLs.

### 3c. Creating or adding an ad account

See `ad-account.md` — this is its own multi-step process with billing setup.

### 3d. Adding a Pixel / Dataset

Settings → Data Sources → Pixels → Add.

Create new: pick a name, copy the Pixel ID, install on site via `<Script>` tag in Next.js app root.

Claim existing: same workflow as Page claim; owner must approve.

## 4. People and roles

Go to: Settings → People → Add

Portfolio-level roles:

- **Admin** — full access, can add/remove people and assets
- **Employee** — default role, permissions granted per-asset
- **Finance Analyst** — only sees billing / spend reports
- **Finance Editor** — can modify billing methods

Per-asset roles (set by assigning the person to specific assets):

For a **Page**:

- Full control (Admin) — can manage everything including roles
- Partial access: Create content, Messages and community activity, Community activity and messages, Ads, Insights, see `page-and-ig.md`

For an **ad account**:

- Admin — full access including billing
- Advertiser — can create/edit ads but not billing
- Analyst — read-only

For an **IG business account**:

- Full control
- Content creator
- Community manager
- Advertiser
- Insights analyst

### Inviting someone

1. Enter their personal Facebook email (must match the email on their FB account, not a work/alias)
2. Pick their portfolio role
3. Pick assets to grant access to + per-asset role
4. Meta sends them an invite; they accept via the link

## 5. "You can't use this business portfolio to advertise" — fixes

This error shows when your portfolio is flagged for one of several reasons. Try these in order:

### 5a. Check the restriction reason

URL: `https://business.facebook.com/latest/settings/info?business_id=<PORTFOLIO_ID>` → look for "Business restrictions" card.

Typical reasons:

1. **No verified business info** — fill in legal name, address, phone, website, tax ID (optional for EU sole proprietors but recommended)
2. **Policy violation** — a previous ad was flagged; portfolio entered review mode
3. **Suspicious activity** — multiple rapid asset changes triggered automated flag
4. **Incomplete business verification** — required for some regions / higher spend levels
5. **Unassigned ad account** — the portfolio has no ad account, so "advertising" is literally impossible (this is the cloudless.gr `1526956002406847` case)

### 5b. Start business verification

URL: `https://business.facebook.com/security/businessverification/?business_id=<PORTFOLIO_ID>`

What you need:

- Legal business name (matches tax documents)
- Business address (matches a utility bill or registration cert)
- Phone number (SMS or call verification)
- Website (optional but speeds approval)
- A document: business license, incorporation cert, VAT/tax certificate — EU sole proprietors often submit VIES / tax number

Greek sole proprietors can submit:

- VAT registration (AFM document) — primary
- Business license from the local Επιμελητήριο if registered
- Tax clearance certificate as backup

Review takes 3-10 business days typically.

### 5c. Appeal a policy rejection

URL: `https://business.facebook.com/business/accountquality?business_id=<PORTFOLIO_ID>` → find the flagged item → Request Review.

Keep appeals short + factual. Meta's review team is looking for a reason to approve; if you misrepresent, they'll reject permanently.

### 5d. Decision for cloudless.gr

For `1526956002406847` (the restricted one): **skip business verification**. The portfolio is empty of ads-worthy assets anyway. Just keep it around for the IG registration record.

For `1558125105019725` (the functional one): verify business identity preemptively so future ads don't hit the $250/lifetime "unverified business" spend cap.

## 6. Partner access (for agency scenarios)

If you want to work with an agency or the agency wants to work in your portfolio:

**You give agency access to YOUR portfolio's assets:**

- Settings → Partners → Add → Give a partner access to your assets → Enter partner portfolio ID → Pick assets + roles

**You access agency's portfolio:**

- Agency sends you an invitation link; accept and pick which of your portfolios links in

Partner relationships are per-asset; removing the partnership removes ALL asset access at once.

## 7. Deleting a portfolio

Settings → Business Info → scroll bottom → Permanently Delete Business.

**Warning:** This is irreversible and unlinks ALL assets. Pages/IG/ad accounts go back to their original individual owners. If you just want to clean up, it's usually better to REMOVE assets than delete the portfolio.

For cloudless.gr `1526956002406847`: **do not delete**. Doing so would unlink @cloudless_gr IG; reconnecting into the functional portfolio might fail if Meta's systems remember the old association. Leave it dormant.

## 8. Quick self-audit checklist

Run through this before launching ads to catch portfolio-level gaps:

- [ ] Portfolio has a clear business name and at least one asset of each type you need (Page, IG, ad account)
- [ ] You are Admin on the portfolio (not just Employee)
- [ ] Business info section has legal name, address, phone filled in
- [ ] Business verification is either completed or not required for your region/spend level
- [ ] At least one payment method is attached to the portfolio (used as default for new ad accounts)
- [ ] No "Business restrictions" warning visible on the Info page
- [ ] Pixel / Dataset created and attached to the ad account that will run the campaign
- [ ] Ad account has at least one Page attached under Business Info
- [ ] People section has a backup Admin (in case you lose account access)


## Reference: business-suite-app.md

# Meta Business Suite — Daily Content Ops

The Business Suite is Meta's unified tool for managing Facebook + Instagram from one surface. Web version at `business.facebook.com`, mobile app in iOS/Android stores. This doc covers the day-to-day content workflow for cloudless.gr: posting, scheduling, DMs, insights.

## 1. What Business Suite replaced

- **Creator Studio** (2021–2024) — deprecated, features merged into Suite
- **Pages Manager app** — deprecated, replaced by Business Suite mobile
- **Ads Manager** — still exists separately; Suite has a "lite" Ads section but for anything beyond boosting posts, use `adsmanager.facebook.com`

For cloudless.gr content ops, Business Suite is the primary tool. Ads Manager is only opened for dedicated campaigns.

## 2. Web vs. mobile — feature parity

| Feature | Web | Mobile app |
|---------|-----|-----------|
| Post to FB Page | ✅ | ✅ |
| Post to IG | ✅ | ✅ |
| Schedule posts | ✅ | ✅ |
| Story scheduling | ✅ (7-day limit) | ✅ |
| Reels scheduling | ✅ (with caveats — see §5) | ✅ (limited) |
| DM inbox (FB + IG + Messenger) | ✅ | ✅ |
| Comments across accounts | ✅ | ✅ |
| Insights | ✅ (full) | ✅ (summary) |
| Boost post | ✅ | ✅ |
| Ads creation beyond boost | ❌ (Ads Manager) | ❌ |
| Multi-account switching | ✅ | ✅ |
| Content library (upload assets reusable across posts) | ✅ | ❌ |

**Recommendation:** Do content authoring on web (bigger canvas, easier scheduling), use mobile for inbox/DM management on the go.

## 3. Composer — creating a post

### Web composer flow

1. Business Suite → **Posts & stories** (left nav) → **Create post**
2. Top of composer: select destinations
   - Checkbox for Facebook Page
   - Checkbox for Instagram
   - Can post to one, both, or neither (neither = draft)
3. Write the caption — one text box, but if both FB+IG are checked you can expand a "Customize for each platform" toggle to write distinct copy
4. Add media (image/video/carousel)
5. Tag other accounts (IG mentions, FB tags)
6. Add location (geotag)
7. Choose action button / CTA if posting a FB Link post
8. Bottom: **Publish now** / **Schedule** / **Save as draft**

### Cross-posting gotchas

| What | FB Page | Instagram |
|------|--------|----------|
| Link in post body | Clickable (full URL) | NOT clickable (captions don't linkify); use "link in bio" convention or Stories link sticker |
| #hashtags | Low discoverability (FB doesn't surface hashtag feeds much) | High discoverability — use 3-10 relevant tags |
| Line length of first line | Shorter first line preferred | First line is what shows before "... more" — critical hook space |
| Image aspect ratio | 1:1, 4:5, 16:9 all fine | 1:1 or 4:5 (9:16 for Reels) — 16:9 horizontal crops poorly in feed |
| Character limit | 63,206 | 2,200 (IG) — but first ~125 is what shows |

For cloudless.gr: write the IG version first (more constrained), let FB inherit it, then expand FB with a clickable link as a separate comment if needed.

## 4. Scheduling

### How to schedule

1. Compose as normal
2. Click **Schedule** instead of Publish now
3. Pick date + time (respects the **Page's timezone** — for cloudless.gr = Europe/Athens)
4. Confirm

Scheduled posts appear in **Posts & stories → Scheduled** — you can edit, reschedule, or delete before the publish time.

### Scheduling limits

| Content type | How far ahead | Constraints |
|--------------|--------------|-------------|
| FB Page post | Up to 75 days ahead | No limit on number of scheduled posts |
| FB Story | Up to 7 days ahead | - |
| IG post | Up to 75 days ahead | - |
| IG Story | Up to 7 days ahead | - |
| IG Reel | Up to 75 days ahead | Must be uploaded from Business Suite (not pulled from IG app drafts) |

### Best posting times for cloudless.gr (Greek tech audience)

Rough starting points — validate with Insights after 4 weeks:

- **LinkedIn-adjacent IT audience:** Tue–Thu 9:30–11:30 local, 14:00–16:00 local
- **B2B content:** Weekday mornings before 11:00
- **Personal/brand-building:** Sunday evenings 19:00–21:00 for slow scroll engagement

Avoid: Friday afternoons, all-day Saturdays, public holidays.

## 5. Reels specifics

Reels in Business Suite have quirks that trip people up:

- Reels **scheduled from Suite** behave differently than Reels posted natively from IG app — music library is limited to "commercial use" tracks only (no chart hits)
- Custom audio uploaded with the video works fine
- Thumbnail selection: upload a custom 9:16 image OR pick a frame from the video (frame picker is primitive on web)
- Cover text: can't add via Suite web; if you need Reels cover text, author in Canva/Figma first and upload the finished 9:16 asset
- Captions (burned-in text) should also be authored externally; Suite has no auto-captions for scheduled Reels

For polished Reels workflow: Canva or CapCut → export 9:16 MP4 → upload to Business Suite → schedule.

## 6. Stories

- FB and IG Stories are SEPARATE in Suite — you pick destination at compose time
- Can't schedule more than 7 days ahead
- Stickers (polls, questions, location, music) MUST be added in the native IG app (Suite's composer has limited sticker support)
- Link stickers on IG: available to all Business accounts with verified contact info

For content strategy, treat Stories as real-time tools — don't try to schedule 4 weeks of Stories from Suite, author them same-day or day-before.

## 7. Inbox — unified DMs and comments

Business Suite's Inbox pulls in:

- FB Page messages (from Messenger)
- IG direct messages (only Business account DMs; personal chat accounts don't route here)
- FB Page comments
- IG post comments
- FB Page reviews / Recommendations

### Routing

- One big inbox by default; filter by channel via tabs
- Assign conversations to teammates (if portfolio has multiple people)
- Use labels (e.g., "Lead", "Support", "Spam") to organize
- Saved replies: templates for common questions — Settings → Saved replies

### Automated responses

Suite → Inbox → **Automations**:

- **Instant reply** — auto-responds to the first message of a conversation (e.g., "Thanks for reaching out! We'll get back to you within 1 business day.")
- **Away message** — custom message during hours you're not available
- **FAQs** — bot-style menu of common question → canned answer pairs

For cloudless.gr:

- Instant reply acknowledging receipt + setting 1-business-day expectation
- FAQs covering: pricing, service areas, tech stack, contact options
- Away message: off-hours / weekends

### Notifications

Turn on push notifications in the mobile app for high-priority events (new DM, new review) — otherwise messages sit unread.

## 8. Insights

Suite → **Insights** (left nav) — lighter than Ads Manager or Meta Graph API Insights, but fine for daily/weekly check-ins.

### Key metrics to track

| Metric | What it tells you |
|--------|-------------------|
| Reach | Unique accounts who saw your content |
| Impressions | Total views (includes repeats) |
| Engagement rate | (Reactions + comments + shares) / reach |
| Follower growth | Net new followers per period |
| Profile visits | How many clicked through to the profile |
| Content interactions per post | Ranks your top performers |
| Audience demographics | Age / gender / geo / active times |

### What Insights CAN'T tell you

- Website click-throughs beyond basic link clicks (use GA4 for this)
- Conversion/lead tracking (use Pixel + Ads Manager)
- Historical data beyond 2 years (use Windsor for archival)

For deeper analysis, export or run Windsor + Claude queries.

## 9. Content Planner view

Suite → **Planner** — calendar visualization of scheduled and published content.

- Month / week / day views
- Drag-and-drop to reschedule
- Color-coded by platform
- Click a slot to create a new post at that time

Useful for visualizing content cadence and identifying quiet days. Not useful for campaign planning (no ad campaigns shown).

## 10. Multi-account switching

If you manage multiple businesses:

- Top-left dropdown shows all Portfolios + Pages you have access to
- Click to switch context
- Each switch reloads inbox, insights, scheduled posts, etc. for that account
- Notifications stay global (you see alerts for any managed account)

For cloudless.gr with one portfolio, this is just the one cloudless.gr context.

## 11. Meta Business AI / copy suggestions

Inside the composer, recent additions:

- **Generate variations** — AI rewrites your caption in different tones
- **Generate images** — text-to-image, limited to ad creative quality at time of writing
- **Smart captions** — AI proposes hashtags and mentions

Treat as drafts, always edit. Don't publish AI-raw output — tone and clichés are obvious.

## 12. Troubleshooting content ops

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Post failed" scheduled-time passed | Time was in the past OR offline during publish | Reschedule; ensure wifi present if using mobile for scheduling |
| IG post skips — no error | Account connection went lite-mode | Re-link IG per `page-and-ig.md` |
| Can't schedule Reel | File format wrong (must be MP4, 9:16, <90s) | Re-export |
| Hashtags not clickable on FB | Normal — FB doesn't render hashtags as links like IG | Ignore; or add them as a comment for less visual clutter |
| Inbox shows zero messages | Channel permissions off | Toggle channels on in Settings → Inbox → Channels |
| Insights show zero | New account with <7 days data, or account in review | Wait 7+ days; check Account Quality if stagnant |
| Scheduled post publishes with wrong image | Upload race condition OR cache issue | Delete + reschedule, clear browser cache |
| Draft lost after navigate away | Autosave is imperfect | Always click "Save draft" explicitly before leaving the tab |

## 13. Weekly content ops routine for cloudless.gr

Suggested rhythm:

**Monday morning (30 min)**

- Review last week's Insights top-3 posts + bottom-1 post
- Write this week's 3-5 posts in Business Suite
- Schedule across Tue-Fri mornings

**Daily (5 min)**

- Check Inbox, reply to DMs + comments
- Monitor ads (if running) via Ads Manager

**Friday afternoon (15 min)**

- Review week's Insights
- Export data to Notion "Social Media Dashboard" (via Windsor MCP or manual)
- Plan next week's themes

For scheduled automation beyond Suite (e.g., cross-post to LinkedIn, trigger a Slack notification on a new DM), use the existing IFTTT / Windsor integrations — see `social_media_integration.md` in auto-memory.

## 14. Keyboard shortcuts (web)

Some useful ones buried in Suite's web UI:

- `N` — New post from Home
- `I` — Inbox
- `P` — Posts & stories
- `L` — Planner (Content calendar)
- `?` — Show all shortcuts

Only work when focus is on the main pane, not inside a text field.


## Reference: commerce.md

# Commerce Manager — Catalog, Shops, Tagged Products

Meta's Commerce surface for selling on Facebook and Instagram. This doc is **forward-looking** for cloudless.gr — current business is services (Next.js consulting, hosting), not physical/digital products, so Commerce is NOT active today. Skip this file unless/until you start packaging offerings as purchasable SKUs.

## 1. When Commerce makes sense

Commerce is a fit when you have:

- A **physical product catalog** (inventory with SKUs, prices, variants)
- A **digital product catalog** with stable SKUs (courses, templates, downloads)
- Intent to run **shopping-objective ads** (Advantage+ Shopping, Sales objective with Catalog)
- A checkout flow — either on your own site OR Meta's native checkout (US only at time of writing)

Commerce is NOT a fit when:

- You sell services only (consulting hours, retainers) — use Lead Gen campaigns instead
- Catalog changes daily or SKUs are unstable
- You want to experiment with "just posting product photos" — plain posts work fine without Commerce infrastructure

## 2. Components

**Catalog** — the product database. Lives in Commerce Manager; shared across Shop, Ads, Instagram Shopping, Marketplace.

**Shop** — a storefront on your FB Page and/or IG profile. Browse-able by users, can click through to your site or Meta checkout.

**Tagged products** — product tags inside organic posts, Reels, and Stories. Lets users tap through to a product from content.

**Advantage+ Catalog Ads** — ad format that dynamically pulls product cards from the Catalog, best for e-commerce with 20+ SKUs.

## 3. Creating a Catalog

Direct URL:

```
https://business.facebook.com/commerce/catalogs/create?business_id=1558125105019725
```

1. Click **Create catalog** → choose catalog type: **E-commerce** (most common) / **Travel** / **Real Estate** / **Auto** / **Medical** / **Hotels** / **Flights**
2. Pick upload method:
   - **Manual** — add products one by one (fine for <20 SKUs)
   - **Data feed** — upload CSV/TSV/XML, or host a feed URL that Meta re-pulls on schedule
   - **Partner platform** — Shopify, WooCommerce, Magento, BigCommerce native integrations
   - **Pixel** — auto-populate from Pixel's `ViewContent` events (requires product microdata on the site)
3. Assign to Business Portfolio `1558125105019725`
4. Name the catalog (e.g., "cloudless.gr products")
5. Create → you land in Commerce Manager → Catalog

### Required product fields

For a basic e-commerce catalog:

- `id` — stable unique SKU
- `title`
- `description`
- `availability` (in stock / out of stock / preorder)
- `condition` (new / refurbished / used)
- `price` (with currency)
- `link` (product page URL)
- `image_link` (at least 500×500)
- `brand`

Optional but useful: `sale_price`, `sale_price_effective_date`, `gtin` / `mpn` (GTIN enables Meta Shopping features), `product_type` (category tree), `google_product_category`, variants (color / size / pattern).

### Feed formats

- **CSV/TSV** — simplest; first row = column headers matching Meta field names
- **XML (RSS or ATOM)** — standard product feed format, often auto-generated by Shopify/Woo
- **JSON** — supported for advanced cases via API

Feed URL must be public (or behind Basic Auth credentials you share with Meta). Meta re-pulls on a configurable schedule (hourly / daily / weekly).

## 4. Setting up a Shop

Requires:

- Catalog attached
- FB Page (for FB Shop) or IG Business account (for IG Shop)
- Business verified on Meta
- Acceptance of Meta's Commerce Policies

Flow:

```
https://business.facebook.com/commerce_manager/
```

1. Commerce Manager → **Set up a shop**
2. Pick checkout method:
   - **Checkout on another website** (your own) — Meta redirects to your site when user clicks Buy
   - **Checkout with messaging** — user messages you; you close via chat (labor-intensive)
   - **Checkout on Facebook and Instagram** — Meta's native checkout (US only; EU is limited/coming)
3. Pick sales channel — FB Page and/or IG profile
4. Connect the Catalog
5. Customize the storefront — banner, featured products, collections
6. Submit for review — takes 1-3 business days

Once approved, the Shop appears as a "Shop" tab on the FB Page and as a shop bag icon on the IG profile.

## 5. Tagging products in content

### In organic posts (FB Page + IG)

During compose in Business Suite:

1. Upload the image/video as normal
2. Look for **Tag products** option
3. Tap the image → select point → type product name → pick from Catalog
4. Save and post

Users can tap the dot to jump to the product page.

### In Reels

Same flow; tags appear as a "View products" link at the bottom of the Reel.

### In Stories

Use the **Product sticker** — search your Catalog → drop onto Story.

### In ads

Catalog ads auto-pull from the Catalog based on Advantage+ Shopping targeting rules. Manual product tagging in ads also possible via ad creative customizations.

## 6. Advantage+ Catalog Ads

The ad format for catalogs with 20+ SKUs:

1. Ads Manager → Create Campaign → Objective: **Sales**
2. Select Catalog during campaign setup
3. Advantage+ Shopping Campaign toggles on
4. Meta picks which products to show to which users based on:
   - Their interaction with similar products on the site
   - Their Pixel-tracked behavior (viewed/added to cart/purchased)
   - Lookalike matching

Budget: start at minimum €30/day; catalog ads need volume to optimize.

Creative: Meta auto-generates carousel + single-image variants from the Catalog. You supply headline/copy templates with variables (`{{product.name}}`, `{{product.price}}`).

## 7. Commerce Policies (trip-wires)

Full: `https://www.facebook.com/policies/commerce/`

Common rejections:

- **Prohibited products** — animals, tobacco, alcohol, weapons, drugs/supplements (most), adult products, medical devices, recalled items, event tickets (restricted)
- **Digital products** with unclear fulfillment
- **Service listings** — Commerce is for products; services should be in-person bookings or site lead gen
- **Policy violations in product description or image** — e.g., before/after imagery, sensational claims
- **Low-quality product images** — blurry, watermarked, collage, or obvious template

## 8. Instagram Shopping specifics

Beyond a standard Shop, IG offers:

- **Shopping tags in Reels** — mentioned above
- **Shopping from Creators** — if you have creator partners, they can tag YOUR products in their own content
- **Live Shopping** — products shown during IG Live broadcasts
- **Drops** — scheduled product launches
- **Collections** — curated groups of products displayed on your IG Shop

Activating: IG app → Settings → Business → Shopping → Get started. Requires existing Catalog + eligibility check (Business Account, linked to FB Page with Shop, US or approved country, compliant with policies).

EU availability of full IG Shopping features is uneven as of 2026. Check eligibility in-app.

## 9. Meta Pay

If using Meta's native checkout (US only today):

- Users pay with Meta Pay (stored payment profile) inside FB/IG
- Meta handles payment processing (takes a selling fee, currently ~5% per transaction + $0.40)
- Funds payout to your bank on a rolling schedule

For EU (where cloudless.gr operates), checkout is still on your site — Meta Pay isn't available for EU checkout end-to-end. Use Stripe / Viva Wallet on cloudless.gr's Next.js site.

## 10. Commerce + Stripe for cloudless.gr (hypothetical future)

If cloudless.gr ever productizes (e.g., a Next.js starter template sold as a digital download):

1. Define the product in a `products.json` file in the Next.js app
2. Generate a Meta-compatible feed at `cloudless.gr/products-feed.xml` via an API route
3. Commerce Manager → Catalog → Data feed → enter the URL, schedule daily re-pull
4. Stripe handles payment (per `stripe-nextjs/SKILL.md`)
5. Checkout method: "Checkout on another website" → redirect to `cloudless.gr/checkout/[sku]` which initiates Stripe Checkout Session
6. Success URL calls `fbq('track', 'Purchase', {value, currency})` + Conversions API server-side purchase event
7. Run Advantage+ Catalog Ads against IG/FB audience

This gives cloudless.gr a fully-tracked funnel from Meta ad → tagged product → Stripe → Conversions API → back into Meta's optimization signal.

## 11. Alternatives for service businesses

Since cloudless.gr is services-first, Commerce isn't the primary channel. Better routes:

- **Lead Gen campaigns** (in `ads-manager.md`) — forms, consultation bookings
- **Book Now CTA** on FB Page — connect Google Calendar or the Next.js booking system (per `google-calendar-nextjs/SKILL.md`)
- **Messaging ads** — click-to-Messenger / click-to-WhatsApp
- **Traffic campaigns** to service landing pages with Pixel Lead events

Revisit Commerce if/when cloudless.gr launches a packaged digital product.

## 12. Commerce checklist (for future activation)

- [ ] Have at least 5 stable SKUs with prices
- [ ] Product images are 1080×1080 minimum, no watermarks
- [ ] Data feed endpoint created (or Shopify/Woo integration if using a platform)
- [ ] Business verification completed in Portfolio 1558125105019725
- [ ] Commerce Policies reviewed — no prohibited categories
- [ ] Catalog created in Commerce Manager, products importing successfully
- [ ] Shop configured with FB and/or IG as channel
- [ ] Checkout method decided (site redirect for EU)
- [ ] Pixel firing `ViewContent`, `AddToCart`, `Purchase` events per SKU
- [ ] Conversions API sending server-side equivalents
- [ ] Test purchase end-to-end before activating ads
- [ ] Advantage+ Shopping campaign structure drafted


## Reference: page-and-ig.md

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
