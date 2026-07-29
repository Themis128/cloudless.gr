# E2E Tests - cloudless.gr

Comprehensive Playwright test suite covering 100% of the application.

## Architecture

The tests validate the **Cloudflare + Pi k3s + Fly.io** architecture:

| Component | Role | Test Files |
|-----------|------|------------|
| **Cloudflare Workers** | Primary edge - `/api/*`, `/api/health` | `cloudflare-infrastructure.spec.ts`, `infrastructure.spec.ts` |
| **Pi k3s cluster** (omv) | Standby via Tailscale Funnel | `k3s/*` tests |
| **Fly.io proxy** | HA failover proxy | `fly-proxy.spec.ts` |

### Architecture Diagram

```
Visitor → cloudflare.gr edge (cf-ray)
  ├─► Workers (primary) → D1 Auth + R2 Storage
  ├─► pi-origin.cloudless.gr → Pi k3s (standby via Tailscale Funnel)
  └─► cloudless-proxy.fly.dev → Fly.io HA proxy → Pi fallback
```

## Test Files

| File | Description |
|------|-------------|
| `app-fullstack.spec.ts` | Full application coverage - public pages, locales, navigation, SEO |
| `api-all-routes.spec.ts` | Complete API route testing - all endpoints with expected responses |
| `components.spec.ts` | UI component tests - ScrollReveal, buttons, forms, navigation |
| `chat.spec.ts` | Chat widget and AI integration tests |
| `coverage.spec.ts` | Coverage-focused path testing for maximum code coverage |
| `cloudflare-infrastructure.spec.ts` | Workers, D1 auth, R2 storage, Tunnel endpoints |
| `fly-proxy.spec.ts` | Fly.io HA failover proxy tests |
| `infrastructure.spec.ts` | Cloudflare edge, Pi k3s standby, Fly.io proxy |
| `k3s/*.spec.ts` | Pi k3s cluster service smoke tests |

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run with coverage
pnpm test:coverage

# Run specific test file
npx playwright test e2e/app-fullstack.spec.ts

# Run with UI mode
pnpm test:e2e:ui

# Run headed (non-headless)
pnpm test:e2e:headed

# Run infrastructure smoke tests (production endpoints)
INFRA_SMOKE=1 pnpm playwright test e2e/infrastructure.spec.ts

# Run Fly.io proxy tests
INFRA_SMOKE=1 pnpm playwright test e2e/fly-proxy.spec.ts
```

## Test Projects

The Playwright config includes multiple projects:

- **chromium** - Desktop Chrome (headless)
- **firefox** - Desktop Firefox
- **webkit** - Desktop Safari
- **mobile-chrome** - Pixel 5 mobile viewport
- **mobile-safari** - iPhone 12 mobile viewport
- **chromium-user** - User-authenticated tests (depends on credentials in .env.e2e)
- **chromium-admin** - Admin-authenticated tests (depends on credentials in .env.e2e)

## Environment Setup

1. Copy `.env.e2e.example` to `.env.e2e`
2. Fill in test credentials if needed for authenticated tests:
   - `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` - For user-auth tests
   - `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` - For admin-auth tests
   - `CRON_SECRET` - For scheduled endpoint tests

## Coverage

When `COVERAGE=1` is set, the monocart-reporter generates coverage reports:

```bash
# Run with coverage
COVERAGE=1 pnpm test:e2e
```

Reports are saved to `coverage/playwright/`
