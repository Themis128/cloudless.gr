# Testing Rules

## Test Framework

- **Runner:** Vitest
- **Environment:** jsdom (for React components), node (for utilities)
- **Config:** `vitest.config.mts` (unit), `vitest.integration.config.mts` (integration)
- **Path aliases:** Resolve via `resolve.tsconfigPaths` in vitest config

## Running Tests

```bash
pnpm test          # Watch mode
pnpm test:ci       # Single run (CI)
pnpm test:coverage # With coverage report
```

## Test File Organization

- **Location:** `__tests__/` directory at project root
- **Naming:** `*.test.ts` for utilities, `*.test.tsx` for components
- **Co-location:** Test files mirror source structure (e.g., `__tests__/admin-api.test.ts` for `src/app/api/admin/`)

## What to Test

- **API routes:** Request validation, auth guards, error responses, success paths
- **Components:** Render output, user interactions, state changes, edge cases
- **Utilities:** Pure functions with comprehensive input/output testing
- **Context:** State management, reducer logic, provider behavior
- **Integrations:** Webhook handlers, external API calls (mocked)

## Mocking Strategy

- **AWS services:** Mock SES, SSM, S3 clients
- **Stripe:** Use `stripe.webhooks.constructEvent()` with test signatures
- **Notion:** Mock API responses for blog, docs, forms
- **D1:** Use in-memory SQLite or mock D1 binding
- **External APIs:** Mock fetch calls with `vi.fn()`

## E2E Testing

- **Tool:** Playwright
- **Config:** `playwright.config.mts` (local), `playwright.production.config.mts` (production)
- **Location:** `e2e/` directory
- **Production smoke tests:** Run against `cloudless.gr` and `pi-origin.cloudless.gr`

## Test Quality Standards

- **Coverage target:** >80% for utilities, >60% for API routes
- **No test skips:** Avoid `test.skip` or `it.skip` — fix or remove
- **No console.log:** Remove debug logging from tests
- **Descriptive names:** `describe('ComponentName')` and `it('should do something when...')`
- **Arrange-Act-Assert:** Follow AAA pattern in each test

## React 19 Compatibility

- Vitest config must include: `define: { "process.env.NODE_ENV": "development" }`
- This ensures React's CJS build exports `act`, which `@testing-library/react` requires