---
name: meta-business-help
description: >
  UI-level help and playbooks for operating Meta (Facebook + Instagram) as a business
  user — Business Portfolio, ad account setup, Page + IG linking, Ads Manager,
  and the Meta Business Suite app. Distinct from the developer-focused meta-business-suite
  skill (which covers the Graph API). Use this skill when the user asks how to do
  something inside business.facebook.com, adsmanager.facebook.com, or the Business
  Suite app on mobile. Triggers on "create ad account", "add payment method", "Meta
  billing", "Business Portfolio", "Business Manager", "move Page to portfolio",
  "give Page access", "link Instagram to Facebook Page", "Instagram Business
  account", "boost post", "Ads Manager", "Meta Business Suite", "audience",
  "Pixel setup", "Commerce Manager", "why can't I advertise", "Business Portfolio
  restriction", or any "how do I do X in Facebook/Meta for business" question.
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
