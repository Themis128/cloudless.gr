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
