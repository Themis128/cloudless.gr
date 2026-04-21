# Admin Agency Hub — Implementation Plan

> **Goal:** Turn the `/admin` panel into a full-stack digital agency command centre:
> social media campaign management, email marketing, lead pipeline, content calendar,
> client reporting — all with AI-assisted creation.

---

## Table of Contents

1. [What We're Building](#1-what-were-building)
2. [Architecture Overview](#2-architecture-overview)
3. [Platform APIs & Credentials Needed](#3-platform-apis--credentials-needed)
4. [Phase Roadmap](#4-phase-roadmap)
5. [Phase 1 — Meta (Facebook + Instagram)](#5-phase-1--meta-facebook--instagram)
6. [Phase 2 — Email Marketing (ActiveCampaign)](#6-phase-2--email-marketing-activecampaign)
7. [Phase 3 — Google Ads](#7-phase-3--google-ads)
8. [Phase 4 — Lead Pipeline Automation (HubSpot)](#8-phase-4--lead-pipeline-automation-hubspot)
9. [Phase 5 — LinkedIn Campaigns](#9-phase-5--linkedin-campaigns)
10. [Phase 6 — TikTok Campaigns](#10-phase-6--tiktok-campaigns)
11. [Phase 7 — X (Twitter) Campaigns](#11-phase-7--x-twitter-campaigns)
12. [Phase 8 — Content Calendar](#12-phase-8--content-calendar)
13. [Phase 9 — Client Reporting](#13-phase-9--client-reporting)
14. [Phase 10 — AI Campaign Assistant](#14-phase-10--ai-campaign-assistant)
15. [Admin Panel Navigation Changes](#15-admin-panel-navigation-changes)
16. [SSM Parameters to Add](#16-ssm-parameters-to-add)

---

## 1. What We're Building

The admin panel gains a **"Marketing Hub"** — a set of new sections alongside the existing Orders / CRM / Analytics / Errors panels:

```
/admin
├── (existing)
│   ├── orders/
│   ├── crm/            ← extend into full pipeline
│   ├── analytics/      ← keep SEO, add cross-channel
│   ├── errors/
│   ├── users/
│   └── settings/
│
└── (NEW — Marketing Hub)
    ├── campaigns/          ← Social campaign manager (all platforms)
    │   ├── page.tsx        ← Unified campaign dashboard
    │   ├── meta/           ← Facebook + Instagram
    │   ├── google/         ← Google Ads
    │   ├── linkedin/       ← LinkedIn
    │   ├── tiktok/         ← TikTok
    │   └── x/              ← X / Twitter
    ├── email/              ← ActiveCampaign: campaigns, automations, lists
    ├── pipeline/           ← HubSpot full deal pipeline view
    ├── calendar/           ← Content calendar (posts, blogs, emails)
    ├── reports/            ← Client-facing performance reports
    └── ai-assistant/       ← AI campaign creation wizard
```

---

## 2. Architecture Overview

```
Admin Browser
    │
    ├── fetchWithAuth() ── Cognito JWT ──► /api/admin/campaigns/**
    │                                           │
    │                                    lib/campaigns/
    │                                    ├── meta.ts         → Meta Marketing API v19
    │                                    ├── google-ads.ts   → Google Ads API v17
    │                                    ├── linkedin.ts     → LinkedIn Marketing API
    │                                    ├── tiktok.ts       → TikTok Marketing API
    │                                    └── x-ads.ts        → X Ads API v12
    │
    ├── fetchWithAuth() ──────────────── /api/admin/email/**
    │                                    lib/activecampaign.ts → ActiveCampaign API v3
    │
    ├── fetchWithAuth() ──────────────── /api/admin/pipeline/**
    │                                    lib/hubspot.ts (extend with deals/pipeline)
    │
    └── fetchWithAuth() ──────────────── /api/admin/reports/**
                                         lib/reports.ts → aggregates all sources
```

All new API keys go into **AWS SSM** under `/cloudless/production/` and are read via `getConfig()` — same pattern as everything else.

AI campaign creation routes call **Anthropic Claude API** (or OpenAI) server-side, never exposing keys to the browser.

---

## 3. Platform APIs & Credentials Needed

### Meta (Facebook + Instagram)
| Credential | How to get | SSM key |
|---|---|---|
| App ID | business.facebook.com → Apps | `META_APP_ID` |
| App Secret | Same app | `META_APP_SECRET` |
| Long-lived User Token | Graph API Explorer + token exchange | `META_USER_ACCESS_TOKEN` |
| Ad Account ID | Business Manager → Ad Accounts | `META_AD_ACCOUNT_ID` |
| Pixel ID | Events Manager → Create Pixel | `NEXT_PUBLIC_META_PIXEL_ID` |
| CAPI Access Token | Pixel Settings → Conversions API | `META_CAPI_ACCESS_TOKEN` |

**Status:** Partially done. Complete `meta-account-runbook.md` first (Phases A+B+C).

### Google Ads
| Credential | How to get | SSM key |
|---|---|---|
| Developer Token | ads.google.com → Tools → API Center | `GOOGLE_ADS_DEVELOPER_TOKEN` |
| Customer ID | Google Ads account → top right | `GOOGLE_ADS_CUSTOMER_ID` |
| OAuth2 credentials | Same Google service account already in SSM | reuse `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` |

### LinkedIn
| Credential | How to get | SSM key |
|---|---|---|
| Client ID | linkedin.com/developers → Create App | `LINKEDIN_CLIENT_ID` |
| Client Secret | Same app | `LINKEDIN_CLIENT_SECRET` |
| Access Token | OAuth 2.0 flow (w_member_social, r_ads, rw_ads) | `LINKEDIN_ACCESS_TOKEN` |
| Ad Account ID | LinkedIn Campaign Manager | `LINKEDIN_AD_ACCOUNT_ID` |
| Organization URN | Company page → ID | `LINKEDIN_ORGANIZATION_URN` |

### TikTok
| Credential | How to get | SSM key |
|---|---|---|
| App ID | ads.tiktok.com → Developer → Apps | `TIKTOK_APP_ID` |
| App Secret | Same app | `TIKTOK_APP_SECRET` |
| Access Token | TikTok Business API OAuth | `TIKTOK_ACCESS_TOKEN` |
| Advertiser ID | TikTok Ads Manager | `TIKTOK_ADVERTISER_ID` |

### X (Twitter)
| Credential | How to get | SSM key |
|---|---|---|
| API Key | developer.twitter.com → Create Project | `X_API_KEY` |
| API Secret | Same project | `X_API_SECRET` |
| Access Token | Same project | `X_ACCESS_TOKEN` |
| Access Secret | Same project | `X_ACCESS_SECRET` |
| Ad Account ID | ads.twitter.com | `X_AD_ACCOUNT_ID` |

### ActiveCampaign (already built as MCP server)
| Credential | How to get | SSM key |
|---|---|---|
| API URL | AC Settings → Developer | `ACTIVECAMPAIGN_API_URL` |
| API Token | AC Settings → Developer | `ACTIVECAMPAIGN_API_TOKEN` |

### AI API (for campaign generation)
| Credential | How to get | SSM key |
|---|---|---|
| Anthropic API Key | console.anthropic.com | `ANTHROPIC_API_KEY` |

---

## 4. Phase Roadmap

| Phase | Feature | Effort | Unblocked by |
|---|---|---|---|
| **1** | Meta campaigns + Pixel activation | Medium | Complete runbook phases A+B+C |
| **2** | ActiveCampaign email marketing | Small | Add SSM keys |
| **3** | Google Ads | Medium | Get developer token approved |
| **4** | HubSpot full deal pipeline | Small | Already have HubSpot connected |
| **5** | LinkedIn campaigns | Medium | Create LinkedIn App |
| **6** | TikTok campaigns | Medium | Create TikTok Business App |
| **7** | X campaigns | Medium | Twitter developer account |
| **8** | Content calendar | Medium | Phases 1-4 done |
| **9** | Client reporting | Large | Phases 1-7 done |
| **10** | AI campaign assistant | Medium | ANTHROPIC_API_KEY + at least 1 platform |

---

## 5. Phase 1 — Meta (Facebook + Instagram)

### What to build

**New files:**
```
src/lib/campaigns/meta.ts              ← Meta Marketing API client
src/app/api/admin/campaigns/meta/
    route.ts                           ← GET campaigns list
    create/route.ts                    ← POST create campaign
    [id]/route.ts                      ← GET/PATCH/DELETE single campaign
    [id]/adsets/route.ts               ← Ad sets
    [id]/ads/route.ts                  ← Ads
    insights/route.ts                  ← Performance data
src/app/[locale]/admin/campaigns/
    page.tsx                           ← Unified campaigns dashboard
    meta/page.tsx                      ← Meta-specific view
```

**`src/lib/campaigns/meta.ts` — key functions:**
```typescript
// Campaign management
listCampaigns(adAccountId: string): Promise<MetaCampaign[]>
createCampaign(data: CreateCampaignInput): Promise<MetaCampaign>
updateCampaign(id: string, data: Partial<CreateCampaignInput>): Promise<MetaCampaign>
pauseCampaign(id: string): Promise<void>
deleteCampaign(id: string): Promise<void>

// Ad Sets
listAdSets(campaignId: string): Promise<MetaAdSet[]>
createAdSet(data: CreateAdSetInput): Promise<MetaAdSet>

// Ads
listAds(adSetId: string): Promise<MetaAd[]>
createAd(data: CreateAdInput): Promise<MetaAd>

// Insights
getCampaignInsights(campaignId: string, datePreset: string): Promise<MetaInsights>
getAccountInsights(adAccountId: string, datePreset: string): Promise<MetaInsights>

// Targeting
getInterests(query: string): Promise<MetaInterest[]>
getCustomAudiences(adAccountId: string): Promise<MetaAudience[]>
```

**Admin page tabs:**
- **Overview** — spend today / this week / this month, active campaigns count, top performing ad
- **Campaigns** — table: name, status, objective, budget, spend, ROAS, actions (pause/edit/duplicate)
- **Create Campaign** — form: objective → audience → budget → creative → launch
- **Insights** — charts: impressions, clicks, CTR, CPC, conversions over time

### First step (before any code)
Complete `meta-account-runbook.md`:
1. Phase A — Full-mode IG link *(do first)*
2. Phase B — Create ad account + add payment method
3. Phase C — Create Pixel, wire CAPI in `/api/contact`

---

## 6. Phase 2 — Email Marketing (ActiveCampaign)

You already have a complete MCP server at `activecampaign-mcp-server/`. The plan is to expose it as REST API routes consumed by an admin UI.

### What to build

```
src/lib/activecampaign.ts              ← AC API v3 client (wraps existing MCP logic)
src/app/api/admin/email/
    campaigns/route.ts                 ← GET list, POST create
    campaigns/[id]/route.ts            ← GET, PATCH, DELETE
    campaigns/[id]/send/route.ts       ← POST schedule/send
    contacts/route.ts                  ← GET list, POST sync
    lists/route.ts                     ← GET lists
    automations/route.ts               ← GET automations + toggle
    stats/route.ts                     ← Open rate, click rate, unsubscribes
src/app/[locale]/admin/email/
    page.tsx                           ← Email dashboard (stats overview)
    campaigns/page.tsx                 ← Campaign list + create
    contacts/page.tsx                  ← Contact list + import
    automations/page.tsx               ← Automation flows
```

**Admin page tabs:**
- **Dashboard** — total contacts, active campaigns, avg open rate, avg click rate
- **Campaigns** — list with status (draft / scheduled / sent), stats, actions
- **New Campaign** — name → list → subject → HTML body (with AI generation option) → schedule
- **Contacts** — search, filter by list/tag, add/remove tags
- **Automations** — list all flows, active contact counts, toggle on/off

**SSM keys to add:**
```
/cloudless/production/ACTIVECAMPAIGN_API_URL
/cloudless/production/ACTIVECAMPAIGN_API_TOKEN
```

---

## 7. Phase 3 — Google Ads

### What to build

```
src/lib/campaigns/google-ads.ts        ← Google Ads API v17 client
src/app/api/admin/campaigns/google/
    route.ts                           ← GET campaigns
    create/route.ts                    ← POST create campaign
    [id]/route.ts                      ← GET/PATCH single
    keywords/route.ts                  ← GET/POST keywords
    insights/route.ts                  ← Performance metrics
src/app/[locale]/admin/campaigns/google/
    page.tsx
```

**Key functions in `google-ads.ts`:**
```typescript
listCampaigns(): Promise<GoogleCampaign[]>
createSearchCampaign(data: SearchCampaignInput): Promise<GoogleCampaign>
createPerformanceMaxCampaign(data: PMaxInput): Promise<GoogleCampaign>
getCampaignMetrics(id: string, dateRange: string): Promise<GoogleMetrics>
getKeywordIdeas(seedKeywords: string[]): Promise<KeywordIdea[]>
pauseCampaign(id: string): Promise<void>
```

**Note:** Google Ads API requires a developer token approved by Google (takes 1-5 days for Standard Access). Apply early.

---

## 8. Phase 4 — Lead Pipeline Automation (HubSpot)

You already have `src/lib/hubspot.ts` with contacts, deals, and companies. This phase closes the automation loop and adds a visual pipeline view.

### What to build

**Extend `src/lib/hubspot.ts`:**
```typescript
// Already exists — extend these:
updateDeal(id: string, data: Partial<Deal>): Promise<Deal>
moveDealStage(id: string, stageId: string): Promise<Deal>
createDealFromContact(contactId: string, source: string): Promise<Deal>
getDealsByStage(stageId: string): Promise<Deal[]>
createNote(dealId: string, body: string): Promise<Note>
createTask(dealId: string, task: TaskInput): Promise<Task>
```

**New automation routes:**
```
src/app/api/admin/pipeline/
    board/route.ts                     ← GET all deals grouped by stage (kanban)
    deals/[id]/move/route.ts           ← POST move deal to new stage
    deals/[id]/notes/route.ts          ← GET/POST notes on a deal
    stats/route.ts                     ← Conversion rates, avg deal size, velocity
```

**New admin page:**
```
src/app/[locale]/admin/pipeline/
    page.tsx                           ← Kanban board view of HubSpot pipeline
```

**Automations to wire up (in API routes):**
- `POST /api/calendar/book` → auto-create HubSpot deal (stage: "Consultation Booked")
- `POST /api/webhooks/stripe` (checkout.completed) → auto-create HubSpot deal (stage: "Closed Won")
- `POST /api/contact` → auto-create HubSpot deal (stage: "New Lead") — already upserts contact, add deal creation

---

## 9. Phase 5 — LinkedIn Campaigns

```
src/lib/campaigns/linkedin.ts
src/app/api/admin/campaigns/linkedin/**
src/app/[locale]/admin/campaigns/linkedin/page.tsx
```

**Key LinkedIn API endpoints used:**
- `GET /adAccounts/{id}/campaigns` — list campaigns
- `POST /adAccounts/{id}/campaigns` — create campaign
- `GET /adAnalytics` — performance data
- `POST /ugcPosts` — create organic posts
- `GET /organizations/{id}/followStatistics` — follower stats

**LinkedIn OAuth:** Scopes needed: `r_ads`, `rw_ads`, `w_member_social`, `r_organization_social`

---

## 10. Phase 6 — TikTok Campaigns

```
src/lib/campaigns/tiktok.ts
src/app/api/admin/campaigns/tiktok/**
src/app/[locale]/admin/campaigns/tiktok/page.tsx
```

**Key TikTok API endpoints:**
- `GET /campaign/get/` — list campaigns
- `POST /campaign/create/` — create campaign
- `GET /report/integrated/get/` — performance metrics
- `POST /creative/create/` — upload creative assets

---

## 11. Phase 7 — X (Twitter) Campaigns

```
src/lib/campaigns/x-ads.ts
src/app/api/admin/campaigns/x/**
src/app/[locale]/admin/campaigns/x/page.tsx
```

**Key X Ads API endpoints:**
- `GET /accounts/{id}/campaigns` — list campaigns
- `POST /accounts/{id}/campaigns` — create campaign
- `GET /stats/accounts/{id}` — performance stats
- `POST /accounts/{id}/promoted_tweets` — promote existing tweets

---

## 12. Phase 8 — Content Calendar

A unified visual calendar showing all scheduled content across channels.

```
src/lib/content-calendar.ts           ← Aggregates from all platforms
src/app/api/admin/calendar/
    route.ts                           ← GET all scheduled items
    create/route.ts                    ← POST schedule a post/email/blog
    [id]/route.ts                      ← PATCH/DELETE
src/app/[locale]/admin/calendar/
    page.tsx                           ← Month/week view calendar UI
```

**What appears on the calendar:**
| Type | Source | Colour |
|---|---|---|
| Social posts | Meta / LinkedIn / TikTok / X schedule | Platform colour |
| Email campaigns | ActiveCampaign scheduled sends | Purple |
| Blog posts | Notion Blog DB publish dates | Cyan |
| Consultations | Google Calendar bookings | Green |
| Ad campaigns | Start/end dates from all ad platforms | Orange |

**Calendar item creation:**
- Pick date → pick type → pick platform → fill details (or use AI) → schedule

---

## 13. Phase 9 — Client Reporting

Auto-generated performance reports combining data from all connected platforms, exportable as PDF or shareable as a live HTML page.

```
src/lib/reports.ts                     ← Aggregates all data sources
src/app/api/admin/reports/
    route.ts                           ← GET list of saved reports
    generate/route.ts                  ← POST generate new report
    [id]/route.ts                      ← GET single report data
    [id]/pdf/route.ts                  ← GET export as PDF
src/app/[locale]/admin/reports/
    page.tsx                           ← Report list + generate button
    [id]/page.tsx                      ← Report viewer
```

**Report sections (configurable per report):**
1. **Executive Summary** — total spend, total leads, total revenue, top channel
2. **SEO Performance** — GSC clicks/impressions/keywords (already built)
3. **Paid Social** — Meta / LinkedIn / TikTok / X: impressions, clicks, conversions, ROAS
4. **Email Marketing** — ActiveCampaign: sent, open rate, click rate, unsubscribes
5. **Lead Pipeline** — HubSpot: new leads, qualified, proposals, closed won, conversion rate
6. **Website Analytics** — Notion Analytics: page views, form submits, store visits

**Report generation flow:**
1. Choose date range + client name
2. Select which sections to include
3. Claude API generates written insights/commentary for each section
4. Render as HTML → export PDF via Puppeteer/html-pdf-node

---

## 14. Phase 10 — AI Campaign Assistant

An AI wizard that creates full campaign setups from a plain-language brief.

```
src/app/api/admin/ai/
    campaign/route.ts                  ← POST: brief → campaign strategy
    copy/route.ts                      ← POST: generate ad copy variants
    audience/route.ts                  ← POST: suggest targeting
    report-insights/route.ts           ← POST: generate report commentary
src/app/[locale]/admin/ai-assistant/
    page.tsx                           ← Campaign creation wizard
```

**AI assistant capabilities:**

### Campaign Strategy Generator
Input: "I want to promote my AI marketing service to Greek SMBs with a €500/month budget"

Output:
```json
{
  "recommended_platforms": ["Meta", "LinkedIn"],
  "campaign_objective": "LEAD_GENERATION",
  "budget_split": { "meta": 300, "linkedin": 200 },
  "audience": {
    "meta": { "interests": ["digital marketing", "AI", "business software"], "age": "28-55", "geo": "Greece" },
    "linkedin": { "job_titles": ["CEO", "Marketing Manager", "Founder"], "company_size": "1-200", "geo": "Greece" }
  },
  "ad_formats": ["single_image", "carousel"],
  "copy_suggestions": ["headline variants", "body text variants", "CTAs"]
}
```

### Ad Copy Generator
Input: service description + platform + objective

Output: 3-5 variants of headline + body + CTA, optimised for the platform's character limits

### Audience Builder
Input: target customer description

Output: recommended targeting parameters per platform (interests, behaviors, lookalike sources)

### Reporting Insights
Input: raw metrics data

Output: plain-English commentary — "Your CTR of 2.4% on Meta is 40% above the industry average for SaaS services in Greece…"

**Implementation:** All AI routes call Claude (`claude-sonnet-4-6`) server-side via Anthropic SDK. Context includes brand guidelines from AGENTS.md + current campaign data for intelligent suggestions.

---

## 15. Admin Panel Navigation Changes

Update `src/app/[locale]/admin/layout.tsx` — new `adminLinks` array:

```typescript
const adminLinks = [
  // Existing
  { href: "/admin", label: "Dashboard", icon: "◈" },
  { href: "/admin/orders", label: "Orders", icon: "◇" },
  { href: "/admin/crm", label: "CRM", icon: "◉" },
  { href: "/admin/analytics", label: "SEO", icon: "📊" },
  { href: "/admin/errors", label: "Errors", icon: "⚠" },
  { href: "/admin/users", label: "Users", icon: "👤" },

  // NEW — Marketing Hub
  { href: "/admin/campaigns", label: "Campaigns", icon: "📣", section: "Marketing" },
  { href: "/admin/email", label: "Email", icon: "📧", section: "Marketing" },
  { href: "/admin/pipeline", label: "Pipeline", icon: "🔀", section: "Marketing" },
  { href: "/admin/calendar", label: "Calendar", icon: "📅", section: "Marketing" },
  { href: "/admin/reports", label: "Reports", icon: "📋", section: "Marketing" },
  { href: "/admin/ai-assistant", label: "AI Assistant", icon: "🤖", section: "Marketing" },

  // Existing
  { href: "/admin/settings", label: "Settings", icon: "⚙" },
];
```

The sidebar gains a **"Marketing"** section divider between the existing ops links and the new marketing links.

---

## 16. SSM Parameters to Add

Add all of these to AWS SSM Parameter Store under `/cloudless/production/`:

```bash
# Meta
META_APP_ID                    (String)
META_APP_SECRET                (SecureString)
META_USER_ACCESS_TOKEN         (SecureString)
META_AD_ACCOUNT_ID             (String)
NEXT_PUBLIC_META_PIXEL_ID      (String)         ← also needed as env var in sst.config.ts
META_CAPI_ACCESS_TOKEN         (SecureString)

# Google Ads
GOOGLE_ADS_DEVELOPER_TOKEN     (SecureString)
GOOGLE_ADS_CUSTOMER_ID         (String)
# reuse existing GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY

# LinkedIn
LINKEDIN_CLIENT_ID             (String)
LINKEDIN_CLIENT_SECRET         (SecureString)
LINKEDIN_ACCESS_TOKEN          (SecureString)
LINKEDIN_AD_ACCOUNT_ID         (String)
LINKEDIN_ORGANIZATION_URN      (String)

# TikTok
TIKTOK_APP_ID                  (String)
TIKTOK_APP_SECRET              (SecureString)
TIKTOK_ACCESS_TOKEN            (SecureString)
TIKTOK_ADVERTISER_ID           (String)

# X (Twitter)
X_API_KEY                      (SecureString)
X_API_SECRET                   (SecureString)
X_ACCESS_TOKEN                 (SecureString)
X_ACCESS_SECRET                (SecureString)
X_AD_ACCOUNT_ID                (String)

# ActiveCampaign
ACTIVECAMPAIGN_API_URL         (String)
ACTIVECAMPAIGN_API_TOKEN       (SecureString)

# AI
ANTHROPIC_API_KEY              (SecureString)
```

Also extend `AppConfig` interface in `src/lib/ssm-config.ts` and `IntegrationConfig` in `src/lib/integrations.ts` to include all new keys with `isConfigured()` guards.

---

## Implementation Order (Recommended)

1. **Today** — Finish `meta-account-runbook.md` Phases A+B+C (unblocks Meta + Pixel)
2. **Week 1** — Phase 4 (HubSpot pipeline) — smallest lift, already connected
3. **Week 1** — Phase 2 (ActiveCampaign email) — MCP server already built, just needs UI
4. **Week 2** — Phase 1 (Meta campaigns) — highest ROI once runbook is done
5. **Week 2** — Phase 10 (AI assistant) — can generate copy for Meta immediately after
6. **Week 3** — Phase 8 (Content calendar) — needs at least Meta + email to be useful
7. **Week 4** — Phase 3 (Google Ads) — parallel with developer token approval
8. **Week 5** — Phases 5, 6, 7 (LinkedIn, TikTok, X)
9. **Week 6** — Phase 9 (Client reporting) — aggregate everything
