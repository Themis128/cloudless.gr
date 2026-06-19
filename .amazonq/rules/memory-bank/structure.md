# Structure: cloudless.gr

## Top-Level Directory Layout

```
cloudless.gr/
├── src/                    # Application source
│   ├── app/                # Next.js App Router (pages + API routes)
│   ├── components/         # Shared React components
│   ├── context/            # React context providers
│   ├── lib/                # All business logic, integrations, utilities
│   ├── locales/            # i18n dictionaries (en, el, fr, de JSON)
│   ├── i18n/               # next-intl config (routing, request, navigation)
│   ├── lambda/             # AWS Lambda handlers (cron-invoker)
│   └── proxy.ts            # Next.js middleware (auth + locale routing)
├── __tests__/              # Vitest unit tests (99+ suites, 1164+ tests)
│   └── stubs/              # AWS SDK and Next.js module stubs for tests
├── e2e/                    # Playwright E2E specs
│   └── k3s/                # k3s cluster-specific E2E tests
├── infrastructure/         # Non-app infrastructure
│   ├── pi-alert-api/       # Python FastAPI on Raspberry Pi (ESP32 alerts)
│   ├── esp32-watchdog/     # ESP32/Arduino/ESPHome firmware
│   ├── postiz/             # Helm/k8s manifests for Postiz
│   ├── cloudflare-tunnels/ # Cloudflare tunnel configs
│   └── terraform/          # Terraform (Lambda optimization)
├── k8s/                    # Kubernetes manifests (k3s cluster on Pi)
│   ├── cluster-protection/ # Resource limits, etcd, Prometheus rules
│   └── grafana-dashboards/ # Grafana JSON dashboards
├── lambda/                 # AWS Lambda functions (pi-proxy)
├── scripts/                # Automation scripts (TS, bash, Python, mjs)
├── workers/                # Cloudflare Workers (esp32-proxy)
├── tools/                  # MCP tools (cognito-setup-mcp, mcp-security-scanner, ssh-mcp)
├── docs/                   # Project documentation
├── public/                 # Static assets (icons, sw.js, manifest)
└── .github/workflows/      # 80+ GitHub Actions workflows
```

## App Router Structure (`src/app/`)

### Locale-Prefixed Pages (`src/app/[locale]/`)

All user-facing pages live under the `[locale]` segment (en/el/fr/de):

- `/` — Homepage (hero, services, CTA, newsletter)
- `/blog/`, `/blog/[slug]` — Notion-powered blog
- `/case-studies/`, `/case-studies/[slug]` — Portfolio
- `/docs/`, `/docs/[slug]` — Documentation
- `/services/` — Service offerings
- `/store/`, `/store/[id]`, `/store/success` — E-commerce
- `/contact/` — Contact form
- `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/post-login`
- `/dashboard/` — Authenticated client area (profile, purchases, settings, consultations)
- `/admin/` — Admin panel (40+ sub-pages: analytics, CRM, AI, CMS, etc.)

### API Routes (`src/app/api/`)

Organized by domain:

- `/api/admin/**` — Admin-only endpoints (analytics, CRM, AI, Notion, campaigns)
- `/api/auth/[...nextauth]` — next-auth v5 handlers
- `/api/webhooks/stripe|notion|hubspot|postiz` — Inbound webhooks
- `/api/slack/events|commands|interactions` — Slack inbound
- `/api/newsletter-slack/**` — Newsletter-specific Slack app
- `/api/cron/**` — Scheduled job endpoints (called by platform-crons workflow)
- `/api/user/**` — Authenticated user endpoints
- `/api/contact|subscribe|checkout|unsubscribe` — Core public actions (checkout redirects to contact page)
- `/api/calendar/availability|book` — Booking
- `/api/chat` — AI chat (Bedrock/Anthropic)
- `/api/portal/**` — Client portal token endpoints

### Non-Locale Routes

- `/portal/[token]` — Client portal (locale-neutral, token-driven)
- `/services/page.tsx` — Redirect to locale-prefixed version
- Root `layout.tsx` / `page.tsx` — Shell + locale redirect

## Source Library (`src/lib/`)

Flat module directory — one file per concern:

| Category | Files |
|---|---|
| Auth | `auth.ts`, `api-auth.ts`, `cron-auth.ts` |
| AWS | `ssm-config.ts`, `email.ts`, `ses-suppression.ts` |
| Notion | `notion.ts`, `notion-blog.ts`, `notion-docs.ts`, `notion-calendar.ts`, `notion-reports.ts`, `notion-forms.ts`, `notion-projects.ts`, `notion-analytics.ts`, `notion-gsc-reports.ts`, `notion-cache.ts`, `notion-esp32.ts` + 8 more |
| Slack | `slack-notify.ts`, `slack-verify.ts`, `slack-admin.ts`, `slack-manifest.ts`, `slack-users.ts`, `slack-workspace.ts`, `slack-rate-limit.ts`, `newsletter-slack-config.ts`, `newsletter-slack-verify.ts` |
| CRM/Marketing | `hubspot.ts`, `activecampaign.ts`, `meta-capi.ts`, `meta-pixel.ts`, `lead-scoring.ts`, `lead-attribution.ts` |
| Analytics | `gsc.ts`, `gsc-cache.ts`, `analytics-agent-orchestrator.ts`, `analytics-orchestration-input.ts`, `analytics-report-pdf.ts`, `workspace-analytics.ts` |
| AI | `anthropic.ts`, `bedrock-chat.ts`, `bedrock-shared.ts`, `chat-tools.ts`, `admin-assistant-tools.ts`, `agent-voice-brief.ts` |
| Store/Payments | `stripe.ts`, `stripe-transactions.ts`, `stripe-analytics-read.ts`, `store-products.ts`, `store-products-client.ts` |
| Calendar | `google-calendar.ts`, `google-auth.ts`, `booking-slots.ts`, `content-calendar.ts` |
| i18n | `i18n.ts`, `server-locale.ts`, `use-locale.ts`, `locale-defaults.ts` |
| Infra | `integrations.ts`, `amplify-config.ts`, `sentry.ts`, `sentry-scrub.ts`, `rate-limit.ts` |
| Utils | `api-errors.ts`, `validation.ts`, `escape-html.ts`, `format-price.ts`, `structured-data.ts`, `sha-drift.ts` |

## Components (`src/components/`)

- Flat + two subdirectories: `admin/` and `store/`
- Key: `Navbar.tsx`, `Footer.tsx`, `ThemeSwitcher.tsx`, `LocaleSwitcher.tsx`, `NewsletterForm.tsx`, `ChatWidget.tsx`, `CommandPalette.tsx`, `CookieConsent.tsx`

## Context Providers (`src/context/`)

- `AuthContext.tsx` — `useAuth()` hook (session, isAdmin, signIn/Out)
- `CartContext.tsx` — Shopping cart with useReducer
- `CookieConsentContext.tsx` — GDPR consent state
- `WorkspaceContext.tsx` — Multi-workspace switcher

## Middleware (`src/proxy.ts`)

Single middleware file handling:

1. next-intl locale routing (prefix-based)
2. Auth protection: redirects unauthenticated users away from `/dashboard` and `/admin`
3. Admin group check for `/admin` routes
4. Locale normalization before auth checks

## Test Architecture

- `__tests__/` — Vitest unit tests mirror `src/lib/` and `src/app/api/` structure
- `__tests__/stubs/` — Module stubs for AWS SDKs, Next.js server/navigation
- `__tests__/setup.ts` — Global test setup
- `e2e/` — Playwright specs organized by concern; `e2e/k3s/` for cluster tests
- `e2e/_internal/`, `e2e/fixtures/`, `e2e/helpers/` — Shared test utilities

## Infrastructure Components

- `infrastructure/pi-alert-api/` — Python FastAPI service running on Pi: receives ESP32 MQTT alerts, forwards to Notion + Slack
- `infrastructure/esp32-watchdog/` — ESP32 firmware (Arduino/ESPHome/PlatformIO)
- `workers/esp32-proxy/` — Cloudflare Worker bridging ESP32 → Pi API
- `lambda/pi-proxy/` — AWS Lambda proxy for Pi API
- `k8s/` — k3s manifests: app deployment, cluster protection, Grafana dashboards

## Key Configuration Files

| File | Purpose |
|---|---|
| `next.config.ts` | Next.js config: next-intl plugin, SST/Docker output, coverage mode, image optimization |
| `src/proxy.ts` | Middleware: auth guards + locale routing |
| `vitest.config.mts` | Unit test config with path aliases and stubs |
| `playwright.config.mts` | E2E config (public, user, admin projects) |
| `sst.config.ts` | SST v4 infrastructure (AWS Amplify deploy) |
| `tsconfig.json` | TypeScript strict mode with `@/` path alias |
| `eslint.config.mjs` | ESLint flat config |
| `mcp.json` | MCP server config (project, tool-shop, Notion) |
