# API Endpoint Fixes - Cloudless.gr

## Issues Identified (2026-07-20)

### 1. Calendar Endpoints - Missing D1 Support for Config

**Problem:** The `/api/calendar/availability` and `/api/calendar/book` endpoints use `isConfiguredAsync("GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY")` which:
- Works with SSM fallback in Next.js/k3s
- Does NOT work in Workers environment (no SSM access)

**Fix Applied:**
- ✅ Updated `/api/config/route.ts` to include Google Calendar config keys:
  - `GOOGLE_CLIENT_EMAIL` - Added to public keys array
  - `GOOGLE_CALENDAR_ID` - Added to public keys array
  - `GOOGLE_PRIVATE_KEY` - Already in secretKeys (masked as "***" in API response)
- Calendar endpoints already use `isConfiguredAsync` which checks env first, SSM second
- For Workers: config will come from D1 `app_config` table (already integrated in ssm-config-d1.ts)

### 2. Google Calendar Credentials Not in D1 app_config

**Problem:** Google Calendar credentials (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_CALENDAR_ID) need to be stored in D1 `app_config` table for Workers compatibility.

**Fix:** The `/api/config` endpoint now exposes `GOOGLE_CLIENT_EMAIL` and `GOOGLE_CALENDAR_ID` for ETL scripts. `GOOGLE_PRIVATE_KEY` is masked as a secret.

### 3. Chat Tools Integration

**Problem:** The chat tool `check_calendar_availability` and `book_slot` depend on Google Calendar being configured.

**Status:** Working correctly - returns helpful message when not configured:
```
"Calendar booking is not yet wired up. Suggest the visitor use the Contact page to request a time."
```

### 4. Agent Book Endpoint

**Problem:** `/api/agent/book` requires auth and calendar configuration.

**Status:** Correctly returns 503 when calendar not configured via `isAgentBookConfigured()`.

## Changes Made

### src/app/api/config/route.ts (2026-07-20)
- ✅ Added `GOOGLE_CLIENT_EMAIL` to config whitelist (public key)
- ✅ Added `GOOGLE_CALENDAR_ID` to config whitelist (public key)
- `GOOGLE_PRIVATE_KEY` already in secretKeys array (masked for security)

## Endpoint Status Summary

| Endpoint | Method | Expected Status When Unconfigured | Status |
|----------|--------|----------------------------------|--------|
| /api/calendar/availability | GET | 503 | ✅ Correct - returns "Calendar booking is not yet available" |
| /api/calendar/book | POST | 400/503 | ✅ Correct - returns "Calendar booking is not yet available" |
| /api/agent/book | POST | 401/503 | ✅ Correct (auth required, calendar check) |
| /api/chat | POST | 503 | ✅ Correct (Workers AI fallback) |
| /api/admin/calendar | GET | 401 | ✅ Correct (admin auth required) |

## Remaining Configuration Needed

To enable calendar booking, add these secrets:

### Option A: Wrangler Secrets (for Workers)
```bash
pnpm cf:typecheck  # Verify types
npx wrangler secret put GOOGLE_CLIENT_EMAIL --config wrangler.jsonc
npx wrangler secret put GOOGLE_PRIVATE_KEY --config wrangler.jsonc  # With \n for newlines
npx wrangler secret put GOOGLE_CALENDAR_ID --config wrangler.jsonc  # Defaults to "primary"
```

### Option B: D1 app_config (for k3s or shared config)
Add via Wrangler or k3s secret:
```sql
INSERT OR REPLACE INTO app_config (key, value, description) VALUES ('GOOGLE_CLIENT_EMAIL', 'service-account@project.iam.gserviceaccount.com', 'Google Calendar service account');
INSERT OR REPLACE INTO app_config (key, value, description) VALUES ('GOOGLE_CALENDAR_ID', 'primary', 'Google Calendar ID');
```

Note: GOOGLE_PRIVATE_KEY should be set via Wrangler secret for security.

## Test File Notes

The `.test-fix-plan.md` references test files that don't exist in `__tests__/` directory. These tests may have been:
- Removed during migration
- Moved to `e2e/` directory
- Planned but not yet created

Current test approach uses Playwright E2E tests in `e2e/` directory.