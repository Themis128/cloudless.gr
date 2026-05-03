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
2. All keywords (dimensions: ["query"], rowLimit: 25000) → count for organicKeywords

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
