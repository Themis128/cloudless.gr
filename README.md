# Cloudless — cloudless.gr

> **Auth is Cloudflare D1.** App admin = membership in the `admin` group in the D1 `user-auth-db`. Managed via `/api/admin/users/promote`.

Cloud computing, serverless development, data analytics, and AI-powered digital marketing for startups and SMBs.

Built with **Next.js 16**, **React 19**, **Tailwind CSS 4**, and **TypeScript**.

## Localization (i18n)

The app supports four locales with cookie-based switching:

- `en` — English (default)
- `el` — Greek (full translation)
- `fr` — French (full translation)
- `de` — German (full translation)

Translation dictionaries live in `src/locales/en.json` and `src/locales/el.json`. The i18n system provides `translate(locale, key, fallback)` for strings and `translateArray(locale, key, fallback)` for array values. Server components use `getServerLocale()` from `src/lib/server-locale.ts`; client components use the `useCurrentLocale()` hook.

**Translated pages:** Homepage, Navbar, Footer, Contact, Login, Signup, Forgot Password, Dashboard, NewsletterForm, PWA install banner.

**Adding a new string:** Add the key to both `en.json` and `el.json`, then use `translate(locale, 'section.key', 'fallback')` in the component.

## Authentication

```mermaid
sequenceDiagram
    participant U as User
    participant App as Next.js Client
    participant D1 as Cloudflare D1

    U->>App: Click "Sign in"
    App->>App: Email/password form
    U->>App: Enter credentials
    App->>D1: Verify credentials (PBKDF2 hash)
    D1-->>App: User record + roles
    App->>App: Create session token
    App-->>U: Session cookie + redirect
    alt admin group
        App->>U: Show admin panel
    else regular user
        App->>U: Show dashboard
    end
```

User authentication is powered by **Cloudflare D1** with PBKDF2 password hashing. The `AuthProvider` in `src/context/AuthContext.tsx` wraps the entire app and exposes sign-in, sign-out, and admin detection through the `useAuth()` hook.

Key features of the auth system:

- **Email/password authentication** — credentials verified against D1 `user-auth-db` with PBKDF2 secure hashing.
- **Session management** — server-side sessions stored in D1 with configurable expiry (30 days default, 60 days with "remember me").
- **Admin detection** — server-side via `roles` table in D1. Admin routes are checked by `src/lib/auth-middleware.ts` before rendering.
- **Password security** — minimum 8 characters with mixed case, numbers, and symbols. Account lockout after 5 failed attempts in 15 minutes.
- **Email verification** — OTP via Cloudflare Email binding on registration.
- Route protection is **server-side** via middleware (all unauthenticated requests to `/dashboard` and `/admin` are redirected to login before the page renders) and additionally client-side via layout guards. Locale-prefixed routes (e.g. `/en/dashboard`, `/el/admin/orders`) are normalized before authorization checks.
- Theme preference (`dark` / `light` / `system`) is exposed via a navbar `ThemeSwitcher` (popover on desktop, inline radios on mobile) and the dashboard settings form. Anonymous visitors persist to `localStorage["cloudless-theme-pref"]`; signed-in users also sync to `user.preferences.theme`. Selection priority: admin path (locked dark) → user preference → localStorage → route default. Cross-tab sync via the `storage` event. See `docs/design-system-v2.md` § "Theme switcher".

## Architecture

```mermaid
graph TB
    subgraph Client["Browser / Mobile"]
        UI["Next.js App<br/>React 19 + Tailwind 4"]
        SW["Service Worker PWA"]
    end
    subgraph Routes["API Routes"]
        Contact["/api/contact"]
        Checkout["/api/checkout"]
        Subscribe["/api/subscribe"]
        StripeWH["/api/webhooks/stripe"]
        SlackEvt["/api/slack/events"]
        SlackCmd["/api/slack/commands"]
        SlackInt["/api/slack/interactions"]
        CalAvail["/api/calendar/availability"]
        CalBook["/api/calendar/book"]
        Blog["/api/blog/posts"]
        Health["/api/health"]
    end

    subgraph Cloudflare["Cloudflare"]
        D1["D1 Database"]
        R2["R2 Storage"]
        Email["Email Binding"]
        WorkersAI["Workers AI"]
    end
    subgraph External["External Services"]
        Stripe["Stripe Payments"]
        Slack["Slack Notifications"]
        EspoCRM["EspoCRM CRM"]
        GCal["Google Calendar"]
        Notion["Notion Blog CMS"]
    end

    UI --> Routes
    Routes --> D1
    Routes --> R2
    Routes --> Email
    Contact --> Email
    Contact --> Slack
    Contact --> EspoCRM
    Subscribe --> Email
    Subscribe --> Slack
    Checkout --> Stripe
    StripeWH --> Email
    StripeWH --> Slack
    CalAvail --> GCal
    CalBook --> GCal
    CalBook --> Slack
    Blog --> Notion
    SlackEvt --> Slack
    SlackCmd --> Slack
```

The app uses the Next.js App Router with the following structure:

```
src/
├── app/                    # Pages & API routes (App Router)
│   ├── page.tsx            # Homepage — hero, services overview, CTA
│   ├── services/page.tsx   # Service offerings & pricing
│   ├── blog/               # Blog listing & [slug] detail pages
│   ├── store/              # E-commerce store, [id] detail, success page
│   ├── contact/page.tsx    # Contact form (Cloudflare Email)
│   ├── auth/               # Authentication pages (Cloudflare D1)
│   │   ├── login/page.tsx       # Login — email/password form
│   │   ├── signup/page.tsx      # Sign-up — registration with email verification
│   │   └── forgot-password/page.tsx # Forgot password — reset flow
│   ├── dashboard/          # Client dashboard (auth-protected)
│   ├── admin/              # Admin panel (admin-group-only)
│   ├── not-found.tsx       # Custom 404
│   └── api/
│       ├── contact/route.ts         # POST → Cloudflare Email
│       ├── checkout/route.ts        # POST → Stripe Checkout session
│       ├── subscribe/route.ts       # POST → Cloudflare Email + Slack
│       ├── webhooks/stripe/route.ts # Stripe webhook handler
│       └── slack/
│           ├── events/route.ts      # Slack Events API (mentions, DMs)
│           ├── commands/route.ts    # Slash commands (/cloudless-status, /cloudless-orders)
│           └── interactions/route.ts # Block Kit button clicks and modal submissions
├── components/             # Shared UI components
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   ├── ScrollReveal.tsx
│   └── store/              # Cart button, slide-over, grid, add-to-cart
├── context/
│   ├── CartContext.tsx      # Shopping cart state (useReducer)
│   └── AuthContext.tsx      # Auth state (D1 session) with useAuth() hook
└── lib/
    ├── auth.ts             # D1-based auth config
    ├── ssm-config-d1.ts    # D1 + Wrangler secrets config loader
    ├── integrations.ts     # Third-party integration config (Slack tokens)
    ├── stripe.ts           # Stripe client initialization
    ├── store-products.ts   # Demo product catalog
    ├── blog.ts             # Blog post data
    ├── email-sender.ts     # Cloudflare Email helper
    ├── slack-notify.ts     # SlackClient with retry/backoff; Block Kit notifiers
    ├── slack-verify.ts     # Slack request signature verification (HMAC-SHA256)
    ├── i18n.ts             # Locale system with translate/translateArray
    ├── server-locale.ts    # Server-side locale reader (async cookies)
    └── use-locale.ts       # Client hook for locale switching
```

## Slack Integration

```mermaid
graph LR
    subgraph Outbound["cloudless.gr to Slack"]
        ContactForm["Contact Form"] -->|slackContactNotify| Ch["Slack Channel"]
        SubForm["Subscribe Form"] -->|slackSubscriberNotify| Ch
        StripeHook["Stripe Webhook"] -->|slackOrderNotify| Ch
        ErrHandler["Error Handler"] -->|slackErrorNotify| Ch
        CICD["CI/CD Pipeline"] -->|slackDeployNotify| Ch
    end

    subgraph Inbound["Slack to cloudless.gr"]
        Slack2["Slack"] -->|mention or DM| Events["/api/slack/events"]
        Slack2 -->|slash commands| Commands["/api/slack/commands"]
        Slack2 -->|button clicks| Interactions["/api/slack/interactions"]
    end

    subgraph Security["Verification"]
        Events --> Verify["HMAC-SHA256 Signing Secret"]
        Commands --> Verify
        Interactions --> Verify
    end
```

The app has a full two-way Slack integration. Last verified 2026-04-09 (56 unit tests, 12 integration tests — all pass).

**Outbound notifications** (cloudless.gr → Slack):

- `slackContactNotify` — fires on every contact form submission (fire-and-forget, parallel with EspoCRM CRM upsert)
- `slackSubscriberNotify` — fires on every newsletter sign-up, in parallel with the SES email
- `slackOrderNotify` — fires on Stripe checkout completion with amount and session ID
- `slackErrorNotify` — surface unexpected API errors to your Slack channel
- `slackDeployNotify` — post deploy status from CI/CD

**Inbound endpoints** (Slack → cloudless.gr):

- `POST /api/slack/events` — Events API (app mentions, DMs)
- `POST /api/slack/commands` — Slash commands: `/cloudless-status`, `/cloudless-orders`
- `POST /api/slack/interactions` — Block Kit button clicks and modal submissions

All inbound requests are verified with HMAC-SHA256 using `SLACK_SIGNING_SECRET` before any payload is processed.

Required env vars (see `.env.local` for details):

| Variable | Purpose |
|----------|---------|
| `SLACK_BOT_TOKEN` | Bot OAuth token (`xoxb-...`) for sending messages and responding to events |
| `SLACK_SIGNING_SECRET` | Verifies all inbound requests from Slack |
| `SLACK_WEBHOOK_URL` | Incoming webhook URL (simpler alternative for outbound-only) |

Full setup instructions, ngrok local testing guide, and slash command reference: **[docs/SLACK.md](docs/SLACK.md)**

## Secrets Management

```mermaid
graph LR
    subgraph Dev["Local Development"]
        EnvFile[".env.local"] --> NextJS["Next.js Server"]
    end

    subgraph Prod["Production Cloudflare"]
        Secrets["Wrangler Secrets"] --> Worker["Cloudflare Worker"]
        D1Config["D1 app_config"] --> Worker
    end

    Secrets -->|Secret| STRIPE_KEY["STRIPE_SECRET_KEY"]
    Secrets -->|Secret| SLACK_TOKEN["SLACK_BOT_TOKEN"]
    D1Config -->|Public| APP_CONFIG["Integration config"]
```

This project uses **no `.env` files** in production. All secrets are stored in **Wrangler secrets** and non-sensitive configuration is stored in the **D1 `app_config` table**. Configuration is fetched at runtime via `src/lib/ssm-config-d1.ts`.

### How `ssm-config-d1.ts` works

- Detects Cloudflare Workers runtime and reads from `process.env` (Wrangler secrets) or D1 `app_config` table.
- Falls back to `process.env` for local development.
- Caches D1 config for the lifetime of the Worker instance to avoid repeated queries.

### Required secrets

| Secret | Type | Description |
|---|---|---|
| `STRIPE_SECRET_KEY` | Secret | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Secret | Stripe webhook signature secret |
| `SESSION_SECRET` | Secret | Session signing key (32+ bytes) |
| `SLACK_BOT_TOKEN` | Secret | Slack bot OAuth token |
| `SLACK_SIGNING_SECRET` | Secret | Slack request signing secret |
| `SLACK_WEBHOOK_URL` | Secret | Slack incoming webhook URL |
| `GOOGLE_CLIENT_EMAIL` | Public | Google service account email (in D1) |
| `GOOGLE_PRIVATE_KEY` | Secret | Google service account key |
| `NOTION_API_KEY` | Secret | Notion integration token |
| `ANTHROPIC_API_KEY` | Secret | Claude AI API key |

### D1 app_config keys (non-sensitive)

| Key | Purpose |
|---|---|
| `ESPOCRM_BASE_URL` | EspoCRM instance URL |
| `LINKEDIN_AD_ACCOUNT_ID` | LinkedIn Ads account ID |
| `POSTIZ_API_URL` | Postiz instance URL |
| `NOTION_CALENDAR_DB_ID` | Notion calendar database |
| `NOTION_REPORTS_DB_ID` | Notion reports database |

Set secrets via: `echo "value" \| npx wrangler secret put SECRET_NAME --config wrangler.jsonc`

## Transactional Email

All outbound email uses **Cloudflare Email Service** via `src/lib/email-sender.ts`.

| Function | Trigger | Notes |
|---|---|---|
| `sendEmail()` | Base helper | Accepts optional `listUnsubscribeUrl` → adds RFC 8058 `List-Unsubscribe` + `List-Unsubscribe-Post` headers |
| `notifyTeam()` | Contact form, orders, subscribe, unsubscribe | Sends to admin inbox |
| `sendOrderConfirmation()` | Stripe `checkout.session.completed` | Sent to customer |
| `sendPaymentFailureNotice()` | Stripe `invoice.payment_failed` | Sent to customer |
| `sendSubscriberWelcome()` | Newsletter signup | Sent to subscriber with `List-Unsubscribe` header |

### Unsubscribe

Two endpoints handle opt-outs, both rate-limited to **5 requests / IP / minute**:

- `POST /api/unsubscribe` — JSON `{ email }`, used by the settings UI
- `GET /api/unsubscribe?email=…` — one-click link included in all subscriber emails (`List-Unsubscribe` header)

Both call `addToSuppressionList()` in `src/lib/ses-suppression.ts`, which adds the address to the D1 `email_suppression` table. Cloudflare Email will reject all future sends to suppressed addresses.

### Reliability notes

- `POST /api/subscribe` sends both emails in `Promise.all()` — if either fails the subscriber gets a 500 and can retry. Slack notification is fire-and-forget and never fails the request.
- Cloudflare Email binding provides automatic DKIM/DMARC/SPF when domain is verified.

## Stripe (Store, Checkout, Webhooks)

All Stripe operations use a lazy singleton from `src/lib/stripe.ts` (`getStripe()`) initialized from Wrangler secrets.

### Checkout (`POST /api/checkout`)

- Server-side price resolution only — client-submitted prices are ignored; all amounts come from the internal product catalog.
- Quantity clamped to 1-99.
- Origin validated against an allowlist to prevent open redirect on `success_url`/`cancel_url`.
- If the user is authenticated (Bearer token in `Authorization` header), the checkout session is pre-filled with `customer_email` and `metadata.userId` to link the Stripe order to the authenticated account.
- Every session includes `metadata.source = "cloudless.gr"` for tracing.

### Webhook (`POST /api/webhooks/stripe`)

- Signature verified via `stripe.webhooks.constructEvent()` (HMAC-SHA256) before any processing — returns 400 on failure.
- Webhook secret loaded from Wrangler secret `STRIPE_WEBHOOK_SECRET`.
- `checkout.session.completed`: order confirmation email sent only when `payment_status === "paid"` OR `mode === "subscription"`. One-time payments with `payment_status !== "paid"` (e.g. async bank transfers still pending) do not trigger the email.
- `invoice.payment_failed`: sends failure notice to customer + team alert.
- EspoCRM contact upsert + deal creation runs fire-and-forget after `checkout.session.completed`.
- Sentry `captureException` and `flush` called on handler errors before returning.

### User purchases (`GET /api/user/purchases`)

Requires JWT auth. Looks up the Stripe customer by email, then returns checkout sessions and subscriptions. Falls back to a session scan filtered by email if no Stripe customer record exists yet.

## Notion (Blog CMS, Docs, Forms, Projects, Analytics)

All Notion operations use `src/lib/notion.ts` — a thin fetch wrapper that calls `getIntegrationsAsync()` for the API key on every request (no module-level secret capture).

### Webhook (`POST /api/webhooks/notion`)

- Shared secret verified via `x-webhook-secret` header using `crypto.timingSafeEqual` (timing-safe) before any payload is parsed. Secret loaded from Wrangler secrets via `getIntegrationsAsync()`.
- Missing or incorrect secret returns 401; invalid JSON returns 400.
- Supported event types and their effects:

| Event type | Effect |
|---|---|
| `page.updated` | Invalidates blog/docs cache, revalidates ISR paths + sitemap |
| `page.created` | Same revalidation + optional Slack notify for new docs |
| `submission.status` | Sends "inquiry reviewed" email to submitter when `status === "Done"` |
| `project.updated` | Slack alert on `Completed` or `Blocked` |
| `task.updated` | Slack alert on `Blocked` |
| `analytics.event` | Slack alert when error count >= 10 |

### Calendar persistence (`src/lib/notion-calendar.ts`)

Persists content calendar items to `NOTION_CALENDAR_DB_ID`. Reads config from `getConfigAsync()` (Wrangler secrets + D1 `app_config`). Respects explicit `NOTION_CALENDAR_DB_ID = ""` env-var clears (disables integration).

### Reports persistence (`src/lib/notion-reports.ts`)

Same pattern as calendar, uses `NOTION_REPORTS_DB_ID`.

## Getting Started

```bash
# Install dependencies
pnpm install

# Run the dev server (Turbopack)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Google Search Console (SEO)

The SEO integration in `src/lib/gsc.ts` uses the same Google service account already stored in Wrangler secrets / D1 `app_config` (`GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`) that powers Google Calendar.

### One-time setup

1. Enable the **Google Search Console API** in your GCP project.
2. In the GSC web UI go to **Settings → Users and permissions → Add user**: paste your service account email and set the role to **Full**.
3. Verify the property (`https://cloudless.gr/`) — the HTML meta tag method is already deployed.

### Exported API

| Function | Description |
|---|---|
| `getSeoSnapshot(siteUrl?)` | 28-day aggregate: clicks, impressions, CTR %, avg position, keyword count |
| `getTopKeywords(siteUrl?, limit?)` | Top N keywords by clicks |
| `getPerformanceHistory(siteUrl?, weeks?)` | Daily data for trend charts (default: 12 weeks) |
| `getTopPages(siteUrl?, limit?)` | Top pages by clicks |
| `getWebAnalytics(siteUrl?)` | Totals + top pages combined (used as analytics proxy) |
| `getCtrOpportunities(siteUrl?, limit?)` | Keywords ranking 4-20 with high impressions but CTR below 5% |
| `getDeviceBreakdown(siteUrl?)` | Traffic split by device type (DESKTOP, MOBILE, TABLET) |
| `getProductPageMetrics(siteUrl?, urlPattern?, limit?)` | Page metrics filtered by URL pattern (default: `/store/`) |
| `getQueryPageMapping(siteUrl?, limit?)` | Query-to-page relationships for keyword cannibalization detection |
| `getSearchIntentBreakdown(siteUrl?)` | Keywords grouped by intent: brand, product, informational, navigational |
| `getTrafficByCountry(siteUrl?, limit?)` | Organic traffic breakdown by country (ISO 3166-1 alpha-3) |

All functions return `null` / `[]` on error — they never throw — so dashboard widgets degrade gracefully.

### Admin API routes

| Route | Source | Notes |
|---|---|---|
| `GET /api/admin/analytics/seo` | GSC | Snapshot + top 20 keywords |
| `GET /api/admin/analytics/keywords?limit=N` | GSC | Top keywords, `limit` max 100 |
| `GET /api/admin/analytics/pages?limit=N` | GSC | Top pages, `limit` max 100 |
| `GET /api/admin/analytics/history?weeks=N` | GSC | Daily history, `weeks` max 52 |
| `GET /api/admin/analytics/ctr-opportunities?limit=N` | GSC | CTR optimization opportunities, `limit` max 200 |
| `GET /api/admin/analytics/devices` | GSC | Traffic breakdown by device type |
| `GET /api/admin/analytics/products?limit=N&pattern=…` | GSC | Product page metrics, `limit` max 100, `pattern` default `/store/` |
| `GET /api/admin/analytics/query-pages?limit=N` | GSC | Query-to-page mappings, `limit` max 500 |
| `GET /api/admin/analytics/search-intent` | GSC | Keywords grouped by search intent with bucket counts |
| `GET /api/admin/analytics/countries?limit=N` | GSC | Traffic by country, `limit` max 50 |

All GSC routes require admin JWT and return `503` when `GOOGLE_CLIENT_EMAIL` or `GOOGLE_PRIVATE_KEY` are absent.

### Weekly digest

A scheduled task (`scripts/weekly-seo-digest.ts`) posts a formatted SEO snapshot to Slack `#general` every Monday. Run manually with:

```bash
npx tsx scripts/weekly-seo-digest.ts
```

## Testing

Tests use **Vitest** + **React Testing Library** with jsdom, and **Playwright** for E2E.

```bash
# Run unit tests in watch mode
pnpm test

# Run unit tests once (CI)
pnpm test:ci

# Run E2E tests
npx playwright test

# Run E2E with visible browser
npx playwright test --headed
```

Unit test files live in `__tests__/` (99 suites, 1164 tests) — key modules:

| File | Coverage |
|---|---|
| `__tests__/admin-api.test.ts` | All `/api/admin/**` routes: auth, 503 on missing config, response shape |
| `__tests__/gsc.test.ts` | `src/lib/gsc.ts` — all 11 exported functions, success + error paths |
| `__tests__/hubspot-crm.test.ts` | `getPipelines`, `listCompanies`, `listDeals`, `listOwners` |
| `__tests__/contact-api.test.ts` | `POST /api/contact` |
| `__tests__/subscribe-api.test.ts` | `POST /api/subscribe` — SES + Slack + validation |
| `__tests__/notion-*.test.ts` | All Notion lib modules |
| `__tests__/store-components.test.tsx` | Cart, store grid, add-to-cart |
| `__tests__/locales-parity.test.ts` | All four locale files have matching keys |
| `e2e/*.spec.ts` | Full browser flows via Playwright + axe-core accessibility |

## Brand Identity

The visual identity uses a navy/electric-blue/cyan palette with Instrument Sans for headings and Work Sans for body text. Full brand guidelines are in the `brand/` directory.

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

- **deploy.yml** — Builds and deploys to Cloudflare Workers on push to `main`
- **cloudflare-deploy.yml** — Deploys Worker via Wrangler
- **lighthouse.yml** — Runs Lighthouse audits on PRs against key pages
- **pr-labeler.yml** — Auto-labels PRs by size and file paths
- **stale.yml** — Marks and closes stale issues/PRs

## Deployment

The app deploys to **Cloudflare Workers** via Wrangler. The deployment workflow handles build and deploy automatically on push to `main`. Secrets are managed via Wrangler secrets and D1 `app_config`.

## Git Line Endings

This repository enforces LF line endings for text files via `.gitattributes`:

- `* text=auto eol=lf`
- `*.bat`, `*.cmd`, `*.ps1` are kept as CRLF

This avoids noisy `LF will be replaced by CRLF` warnings and keeps diffs stable across Windows/WSL environments.

## Tech Stack

- Next.js 16.2.4 (App Router, Turbopack)
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4
- Cloudflare D1 (authentication, sessions)
- Cloudflare Email Service (transactional email)
- Cloudflare R2 (object storage)
- Cloudflare Workers AI (AI inference)
- Stripe (checkout & payments)
- Vitest + React Testing Library (1164 tests)

## Project MCP Configuration

The workspace MCP config lives in `mcp.json`. Three servers are configured:

| Server | Package | Purpose |
|--------|---------|---------|
| `project` | `project-mcp` | Project context for Claude Code |
| `mcp-tool-shop` | `mcp-tool-shop` | Additional Claude Code tools |
| `notion` | `@notionhq/notion-mcp-server` | Direct Notion API access (uses `NOTION_API_KEY`) |

All servers use `autoStart: true` and are launched via `npx -y` — no global installs required.

```json
{
  "mcpServers": {
    "project": { "command": "npx", "args": ["-y", "project-mcp"], "autoStart": true },
    "mcp-tool-shop": { "command": "npx", "args": ["-y", "mcp-tool-shop"], "autoStart": true },
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": { "OPENAPI_MCP_HEADERS": "{\"Authorization\":\"Bearer ${NOTION_API_KEY}\",\"Notion-Version\":\"2022-06-28\"}" },
      "autoStart": true
    }
  }
}
```

The `.mcp.json` file is a symlink to `mcp.json` for tools that look for the dot-prefixed filename.
