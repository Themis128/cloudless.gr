# E2E Tests - cloudless.gr

Comprehensive Playwright test suite covering 100% of the application.

## Test Files

| File | Description |
|------|-------------|
| `app-fullstack.spec.ts` | Full application coverage - public pages, locales, navigation, SEO |
| `api-all-routes.spec.ts` | Complete API route testing - all endpoints with expected responses |
| `components.spec.ts` | UI component tests - ScrollReveal, buttons, forms, navigation |
| `chat.spec.ts` | Chat widget and AI integration tests |
| `coverage.spec.ts` | Coverage-focused path testing for maximum code coverage |

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