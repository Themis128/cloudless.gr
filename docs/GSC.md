# Google Search Console Integration

cloudless.gr integrates with Google Search Console (GSC) to power the SEO analytics dashboard in the admin area. All data is fetched via the GSC Search Analytics API using the same service account credentials shared with Google Calendar.

> **Status:** Optional integration — all endpoints return 503 when credentials are not configured. Admin dashboard degrades gracefully.
>
> **Last verified:** 2026-05-01 — 29 unit tests pass (auth, snapshot, keywords, pages, history, devices, countries, CTR opportunities, query-page mapping, search intent, web analytics, error handling)

---

## Architecture

```mermaid
graph TB
    subgraph Admin["Admin Dashboard"]
        SEO["/api/admin/analytics/seo"]
        KW["/api/admin/analytics/keywords"]
        PAGES["/api/admin/analytics/pages"]
        HIST["/api/admin/analytics/history"]
        DEV["/api/admin/analytics/devices"]
        CTR["/api/admin/analytics/ctr-opportunities"]
        CNTR["/api/admin/analytics/countries"]
        QP["/api/admin/analytics/query-pages"]
        SI["/api/admin/analytics/search-intent"]
        WEB["/api/admin/analytics/web"]
        UNIFIED["/api/admin/analytics/unified"]
    end

    subgraph Auth["Service Account Auth (google-auth.ts)"]
        GSCLib["gsc.ts"] --> GetToken["getAccessToken()"]
        GetToken -->|cached per scope| Cache["Closure cache"]
        Cache -->|miss| Google["Google OAuth2 token endpoint"]
    end

    subgraph GSCAPI["GSC Search Analytics API"]
        GSCLib -->|POST searchAnalytics/query| SearchAPI["searchconsole.googleapis.com"]
    end

    SEO & KW & PAGES & HIST & DEV & CTR & CNTR & QP & SI & WEB & UNIFIED --> GSCLib
```

---

## Authentication

GSC uses the same Google service account as Google Calendar. Credentials (`GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`) are loaded from SSM via `getConfig()` and a signed JWT is exchanged for an OAuth2 access token at the token endpoint.

The token is scoped to `https://www.googleapis.com/auth/webmasters.readonly` (read-only, separate from the Calendar scope) and cached in a closure in `createGoogleAuth()` inside `src/lib/google-auth.ts`.

---

## Environment Variables

### Local development (`.env.local`)

```bash
# Same service account used by Google Calendar
GOOGLE_CLIENT_EMAIL=calendar-bot@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"

# GSC property — domain property recommended (covers all protocols/subdomains)
GSC_SITE_URL=sc-domain:cloudless.gr
# Or URL-prefix property:
# GSC_SITE_URL=https://cloudless.gr/
```

### Production (AWS SSM Parameter Store)

| Parameter path | Type |
|----------------|------|
| `/cloudless/production/GOOGLE_CLIENT_EMAIL` | String |
| `/cloudless/production/GOOGLE_PRIVATE_KEY` | SecureString |
| `/cloudless/production/GSC_SITE_URL` | String |

> `GSC_SITE_URL` can also be set as a plain `process.env` var (not SSM-backed) since it's non-sensitive.

---

## GSC Setup (one-time)

1. **Enable the API:** In Google Cloud Console > APIs & Services > Enable "Google Search Console API"
2. **Grant access in GSC:** Search Console → Settings → Users and permissions → Add user → paste the service account email → set role "Full"

---

## Admin API Endpoints

All endpoints require a valid Cognito JWT with the `admin` group (Bearer token in `Authorization` header). Returns 401/403 if unauthenticated. Returns 503 if GSC credentials are not configured.

All responses include `fetchedAt: ISO8601` and `source: "google-search-console"`.

### `GET /api/admin/analytics/seo`

Combined snapshot + top keywords in a single call. Use this as the main dashboard entry point.

**Response:**
```json
{
  "snapshot": { "clicks": 842, "impressions": 18500, "ctr": 4.55, "avgPosition": 12.7, "organicKeywords": 320 },
  "keywords": [{ "keyword": "cloudless gr", "clicks": 120, "impressions": 3000, "ctr": 4.0, "position": 9.2 }],
  "fetchedAt": "...",
  "source": "google-search-console"
}
```

### `GET /api/admin/analytics/keywords?limit=N`

Top organic keywords sorted by clicks (28-day rolling window). `limit` clamped to 1–100, default 20.

### `GET /api/admin/analytics/pages?limit=N`

Top pages by organic clicks. `limit` clamped to 1–100, default 25.

### `GET /api/admin/analytics/history?weeks=N`

Weekly performance trend (clicks, impressions, CTR, avg position). `weeks` clamped to 1–52, default 12.

**Response:** `{ history: [{ date, clicks, impressions, ctr, avgPosition }], weeks, ... }`

### `GET /api/admin/analytics/devices`

Search traffic breakdown by device type (DESKTOP, MOBILE, TABLET).

**Response:** `{ devices: [{ device, clicks, impressions, ctr, avgPosition }], ... }`

### `GET /api/admin/analytics/countries?limit=N`

Organic traffic by country (ISO 3166-1 alpha-3 codes). `limit` clamped to 1–50, default 30.

### `GET /api/admin/analytics/ctr-opportunities?limit=N`

Keywords ranking position 4–20 with impressions > 10 and CTR < 5%. These are the highest-value optimisation candidates (better titles/meta descriptions). `limit` clamped to 1–200, default 50.

### `GET /api/admin/analytics/query-pages?limit=N`

Query → page mapping: which search terms land on which pages. Useful for detecting keyword cannibalisation. `limit` clamped to 1–500, default 100.

### `GET /api/admin/analytics/search-intent`

Keywords bucketed by inferred intent:
- **brand** — contains "cloudless"
- **product** — purchase-intent words (buy, price, order, store, shop…)
- **informational** — knowledge-seeking (how, what, guide, tutorial…)
- **navigational** — everything else

**Response:** `{ intent: { brand: [...], product: [...], informational: [...], navigational: [...] }, summary: { brand: N, ... }, ... }`

### `GET /api/admin/analytics/web`

Site-wide totals + top 20 pages — used as a lightweight web analytics proxy.

### `GET /api/admin/analytics/unified`

Cross-integration dashboard combining SEO (GSC), pipeline (HubSpot), email (ActiveCampaign), and revenue (Stripe) in a single parallel fetch. Returns `null` for any integration that is not configured or fails.

---

## Data Model

All GSC functions use a **28-day rolling window** (`dateRange()` helper). The window always ends today and starts 28 days ago.

### `SeoSnapshot`
```typescript
{ clicks: number; impressions: number; ctr: number; avgPosition: number; organicKeywords: number }
```

### `KeywordData` / `PageData`
```typescript
{ keyword/page: string; clicks: number; impressions: number; ctr: number; position: number }
```

### `PerformancePoint`
```typescript
{ date: string; clicks: number; impressions: number; ctr: number; avgPosition: number }
```

### `CtrOpportunity`
```typescript
{ keyword: string; clicks: number; impressions: number; ctr: number; position: number }
// Only includes position 4–20, impressions > 10, CTR < 5%
```

---

## Request Flow

```mermaid
sequenceDiagram
    participant Admin as Admin Browser
    participant Route as /api/admin/analytics/*
    participant Auth as requireAdmin()
    participant GSCLib as gsc.ts
    participant GAuth as createGoogleAuth()
    participant GSC as GSC Search Analytics API

    Admin->>Route: GET with Bearer token
    Route->>Auth: Verify Cognito JWT
    Auth-->>Route: ok: true / 401/403

    Route->>Route: Check GOOGLE_CLIENT_EMAIL in config
    alt Not configured
        Route-->>Admin: 503 Not configured
    end

    Route->>GSCLib: getSeoSnapshot() / getTopKeywords() / etc.
    GSCLib->>GAuth: getAccessToken()
    GAuth-->>GSCLib: cached or freshly-fetched token
    GSCLib->>GSC: POST searchAnalytics/query
    GSC-->>GSCLib: { rows: [...] }
    GSCLib-->>Route: typed result array
    Route-->>Admin: 200 { data, fetchedAt, source }
```

---

## Running Tests

```bash
pnpm test -- --reporter=verbose __tests__/gsc.test.ts
pnpm test -- --reporter=verbose __tests__/admin-analytics-api.test.ts
```

Test coverage (29 + 33 tests):

| File | Tests | What is tested |
|------|-------|---------------|
| `gsc.test.ts` | 29 | Token auth (missing credentials → null), `getSeoSnapshot` (fields, null on API error, missing rows), `getTopKeywords` (maps rows), `getPerformanceHistory` (date rows), `getTopPages`, `getWebAnalytics` (totals + pages), `getCtrOpportunities` (position/CTR filter), `getDeviceBreakdown`, `getTrafficByCountry`, `getQueryPageMapping`, `getSearchIntentBreakdown` (buckets) |
| `admin-analytics-api.test.ts` | 33 | 401 on all routes, 503 when GSC unconfigured, 200 with correct shape for all 10 endpoints, `limit`/`weeks` param handling |

---

## Security Notes

- **Auth required:** All analytics endpoints are protected by `requireAdmin()` (Cognito JWT with `admin` group). No public GSC data is exposed.
- **Read-only scope:** Token scoped to `webmasters.readonly` — cannot write to GSC.
- **Shared service account:** Same `GOOGLE_PRIVATE_KEY` as Calendar — store as SecureString in SSM.
- **Graceful degradation:** All functions catch errors and return `null` / `[]` — a GSC API failure never crashes the admin dashboard.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/google-auth.ts` | Shared `createGoogleAuth(scope)` factory — provides cached token for both Calendar and GSC |
| `src/lib/gsc.ts` | All GSC functions: snapshot, keywords, pages, history, devices, countries, CTR opportunities, query-page mapping, search intent, web analytics |
| `src/app/api/admin/analytics/seo/route.ts` | Combined snapshot + keywords dashboard endpoint |
| `src/app/api/admin/analytics/unified/route.ts` | Cross-integration unified dashboard (GSC + HubSpot + ActiveCampaign + Stripe) |
