---
inclusion: manual
---

# Google Search Console (GSC) — Next.js Skill

## Overview

This skill covers the Google Search Console integration for cloudless.gr. GSC is the **primary SEO and web analytics data source** — it replaced Ahrefs in April 2026 using the existing Google service account already in SSM.

All GSC functionality lives in `src/lib/gsc.ts`. API routes are under `src/app/api/admin/analytics/`.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/gsc.ts` | GSC client: auth, query helpers, all public functions |
| `src/app/api/admin/analytics/seo/route.ts` | Snapshot + top keywords |
| `src/app/api/admin/analytics/web/route.ts` | Web analytics (totals + top pages) |
| `src/app/api/admin/analytics/keywords/route.ts` | Top keywords, configurable limit |
| `src/app/api/admin/analytics/pages/route.ts` | Top pages, configurable limit |
| `src/app/api/admin/analytics/history/route.ts` | Weekly performance history |
| `src/lib/ssm-config.ts` | Config — `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GSC_SITE_URL` |

---

## Auth Pattern

GSC uses the **same service account** as Google Calendar. No new credentials needed.

```typescript
// Credentials come from SSM via getConfig()
const email = config.GOOGLE_CLIENT_EMAIL;  // service account email
const key = config.GOOGLE_PRIVATE_KEY;     // RSA private key (\\n already replaced in ssm-config.ts)

// Sign JWT with jose
const { SignJWT, importPKCS8 } = await import("jose");
const privateKey = await importPKCS8(key, "RS256");
const jwt = await new SignJWT({ iss: email, scope: SCOPE, aud: TOKEN_URL })
  .setProtectedHeader({ alg: "RS256" })
  .setIssuedAt(now)
  .setExpirationTime(now + 3600)
  .sign(privateKey);

// Exchange for access token
const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  }),
});
```

**Scope**: `https://www.googleapis.com/auth/webmasters.readonly`

Token is cached in module scope (`cachedToken`) with a 60-second buffer before expiry.

---

## GSC API Pattern

All queries go to:

```
POST https://searchconsole.googleapis.com/v1/sites/{encodedSiteUrl}/searchAnalytics/query
```

The site URL must be `encodeURIComponent`-encoded. Default site: `sc-domain:cloudless.gr` (covers all subdomains and protocols).

### Request body structure:

```json
{
  "startDate": "2026-03-16",
  "endDate": "2026-04-13",
  "dimensions": ["query"],          // "query" | "page" | "date" | "country" | "device"
  "rowLimit": 20,
  "orderBy": [{ "fieldName": "clicks", "sortOrder": "DESCENDING" }]
}
```

### Empty dimensions = site-wide totals (single summary row):

```json
{ "startDate": "...", "endDate": "...", "dimensions": [], "rowLimit": 1 }
```

---

## Public Functions in gsc.ts

### `getSeoSnapshot(siteUrl?)` → `SeoSnapshot | null`

28-day rolling window. Makes **two** GSC calls:

1. Totals (no dimensions) → clicks, impressions, CTR, avgPosition
2. All keywords (dimensions: `["query"]`, rowLimit: 25000) → count for organicKeywords

### `getTopKeywords(siteUrl?, limit=20)` → `KeywordData[]`

Top keywords sorted by clicks. Each row: `{ keyword, clicks, impressions, ctr, position }`.

### `getTopPages(siteUrl?, limit=25)` → `PageData[]`

Top pages sorted by clicks. Each row: `{ page, clicks, impressions, ctr, position }`.

### `getPerformanceHistory(siteUrl?, weeks=12)` → `PerformancePoint[]`

Daily data points for trend charts. Each row: `{ date, clicks, impressions, ctr, avgPosition }`.

- Use `weeks` to control lookback (max 52 = ~1 year)
- Returns daily granularity; aggregate client-side for weekly charts

### `getWebAnalytics(siteUrl?)` → `WebAnalyticsData | null`

Combines totals + top 20 pages. Used by the web analytics dashboard card.

---

## API Routes Reference

| Route | Query params | Returns |
|-------|-------------|---------|
| `GET /api/admin/analytics/seo` | — | `{ snapshot, keywords, fetchedAt, source }` |
| `GET /api/admin/analytics/web` | — | `{ analytics, fetchedAt, source }` |
| `GET /api/admin/analytics/keywords` | `limit` (default 20, max 100) | `{ keywords, fetchedAt, source }` |
| `GET /api/admin/analytics/pages` | `limit` (default 25, max 100) | `{ pages, fetchedAt, source }` |
| `GET /api/admin/analytics/history` | `weeks` (default 12, max 52) | `{ history, weeks, fetchedAt, source }` |

All routes check for `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` in SSM and return `503` if missing.

---

## Adding a New GSC-Backed Route

1. Add a new function to `src/lib/gsc.ts` (follow existing pattern)
2. Create `src/app/api/admin/analytics/{name}/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { yourNewFunction } from "@/lib/gsc";
import { getConfig } from "@/lib/ssm-config";

export async function GET(req: Request) {
  const config = await getConfig();
  if (!config.GOOGLE_CLIENT_EMAIL || !config.GOOGLE_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Google Search Console not configured." },
      { status: 503 },
    );
  }
  try {
    const data = await yourNewFunction();
    return NextResponse.json({ data, fetchedAt: new Date().toISOString(), source: "google-search-console" });
  } catch (err) {
    console.error("[GSC yourNewFunction] Error:", err);
    return NextResponse.json({ error: "Failed to fetch data." }, { status: 500 });
  }
}
```

---

## One-Time Setup (Prerequisites)

Before GSC functions return real data, a human must:

1. **Enable GSC API**: GCP Console → APIs & Services → Enable "Google Search Console API"
2. **Add service account to GSC**: GSC → Settings → Users and permissions → Add user → paste `GOOGLE_CLIENT_EMAIL` → role: "Full"
3. **(Optional) Set GSC_SITE_URL in SSM**: If domain is not `cloudless.gr`, put `sc-domain:yourdomain.com` at `/cloudless/production/GSC_SITE_URL`

---

## CTR Conversion Note

GSC returns CTR as a decimal (e.g., `0.035` = 3.5%). All functions in `gsc.ts` multiply by 100 before returning, so callers always get percentage values (e.g., `3.5`).

---

## Data Freshness

GSC data is typically **2-3 days delayed**. The `fetchedAt` field in all API responses reflects when the data was fetched from GSC, not when the underlying events occurred.

---

## References

- [GSC API patterns and code snippets](references/gsc-patterns.md)


## Reference: gsc-patterns.md

# GSC Code Patterns — cloudless.gr Reference

## Full Auth Flow (copy-paste ready)

```typescript
import { getConfig } from "@/lib/ssm-config";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

let cachedToken: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.token;

  const config = await getConfig();
  const email = config.GOOGLE_CLIENT_EMAIL;
  const key = config.GOOGLE_PRIVATE_KEY;
  if (!email || !key) throw new Error("Google service account not configured");

  const { SignJWT, importPKCS8 } = await import("jose");
  const now = Math.floor(Date.now() / 1000);
  const privateKey = await importPKCS8(key, "RS256");

  const jwt = await new SignJWT({ iss: email, scope: SCOPE, aud: TOKEN_URL })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) throw new Error(`Google token error: ${res.status}`);
  const data = await res.json();

  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}
```

---

## Query Helper

```typescript
const GSC_API = "https://searchconsole.googleapis.com/v1/sites";

async function gscQuery(siteUrl: string, body: object): Promise<Response> {
  const token = await getAccessToken();
  const encoded = encodeURIComponent(siteUrl);
  return fetch(`${GSC_API}/${encoded}/searchAnalytics/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
```

---

## Date Range Helpers

```typescript
// 28-day rolling window (GSC standard)
function dateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 28);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

// N weeks back
function weeksRange(weeks: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - weeks * 7);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}
```

---

## Common Query Bodies

### Site-wide totals (no breakdown)

```json
{
  "startDate": "2026-03-16",
  "endDate": "2026-04-13",
  "dimensions": [],
  "rowLimit": 1
}
```

### Top keywords by clicks

```json
{
  "startDate": "2026-03-16",
  "endDate": "2026-04-13",
  "dimensions": ["query"],
  "rowLimit": 20,
  "orderBy": [{ "fieldName": "clicks", "sortOrder": "DESCENDING" }]
}
```

### Top pages by clicks

```json
{
  "startDate": "2026-03-16",
  "endDate": "2026-04-13",
  "dimensions": ["page"],
  "rowLimit": 25,
  "orderBy": [{ "fieldName": "clicks", "sortOrder": "DESCENDING" }]
}
```

### Daily history (date dimension)

```json
{
  "startDate": "2026-01-13",
  "endDate": "2026-04-13",
  "dimensions": ["date"],
  "rowLimit": 91
}
```

### By country

```json
{
  "startDate": "2026-03-16",
  "endDate": "2026-04-13",
  "dimensions": ["country"],
  "rowLimit": 20,
  "orderBy": [{ "fieldName": "clicks", "sortOrder": "DESCENDING" }]
}
```

### By device

```json
{
  "startDate": "2026-03-16",
  "endDate": "2026-04-13",
  "dimensions": ["device"],
  "rowLimit": 5
}
```

### Keyword + page combo (which keywords drive which pages)

```json
{
  "startDate": "2026-03-16",
  "endDate": "2026-04-13",
  "dimensions": ["query", "page"],
  "rowLimit": 100,
  "orderBy": [{ "fieldName": "clicks", "sortOrder": "DESCENDING" }]
}
```

---

## Response Row Shape

GSC always returns rows in this shape:

```typescript
interface GscRow {
  keys: string[];        // dimension values in the same order as requested dimensions
  clicks: number;
  impressions: number;
  ctr: number;           // decimal! multiply by 100 for percentage
  position: number;      // average ranking position
}
```

Example for `dimensions: ["query", "page"]`:

```json
{
  "keys": ["cloud computing", "https://cloudless.gr/blog/cloud-101"],
  "clicks": 45,
  "impressions": 890,
  "ctr": 0.0506,
  "position": 8.3
}
```

---

## Available Dimensions

| Dimension | Description |
|-----------|-------------|
| `query` | Search query (keyword) |
| `page` | Landing page URL |
| `date` | Date (YYYY-MM-DD) |
| `country` | ISO 3166-1 alpha-3 country code |
| `device` | `DESKTOP`, `MOBILE`, `TABLET` |
| `searchAppearance` | Rich result type |

You can combine up to 3 dimensions in one request.

---

## Useful Limits

| Parameter | Max value | Default in gsc.ts |
|-----------|-----------|-------------------|
| rowLimit | 25,000 | varies per function |
| weeks lookback | 52 (via API route) | 12 |
| pages limit | 100 (via API route) | 25 |
| keywords limit | 100 (via API route) | 20 |
| GSC data delay | 2-3 days | — |

---

## Filtering (not yet used, but available)

```json
{
  "dimensionFilterGroups": [{
    "filters": [{
      "dimension": "page",
      "operator": "contains",
      "expression": "/blog/"
    }]
  }]
}
```

Operators: `equals`, `notEquals`, `contains`, `notContains`, `includingRegex`, `excludingRegex`

---

## Error Handling Pattern

```typescript
export async function yourFunction(): Promise<YourType[]> {
  try {
    const res = await gscQuery(DEFAULT_SITE, { ...body });
    if (!res.ok) {
      console.error("[GSC yourFunction] Error:", await res.text());
      return [];
    }
    const data = await res.json();
    return (data.rows ?? []).map((r: Record<string, unknown>) => ({
      // map fields
    }));
  } catch (err) {
    console.error("[GSC yourFunction] Exception:", err);
    return [];
  }
}
```

---

## Type Definitions (all exported from gsc.ts)

```typescript
export interface SeoSnapshot {
  clicks: number;
  impressions: number;
  ctr: number;           // already in % (e.g. 3.5)
  avgPosition: number;
  organicKeywords: number;
}

export interface KeywordData {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;           // already in %
  position: number;
}

export interface PageData {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;           // already in %
  position: number;
}

export interface PerformancePoint {
  date: string;          // YYYY-MM-DD
  clicks: number;
  impressions: number;
  ctr: number;           // already in %
  avgPosition: number;
}

export interface WebAnalyticsData {
  clicks: number;
  impressions: number;
  ctr: number;           // already in %
  avgPosition: number;
  topPages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    position: number;
  }>;
}
```
