# cloudless.gr — Architecture Map

> Updated: 2026-07-10 (reflects k3s primary + Cloudflare HA failover)

---

## 1. Framework & App Structure

- **Framework:** Next.js 16.2.1 (App Router), deployed via SST v4
- **Runtime:** Node.js >=20, pnpm >=10 (lock: pnpm-lock.yaml)
- **Package manager:** pnpm 10.33.2 (workspaces defined in `pnpm-workspace.yaml`)
- **Language:** TypeScript 6.0.3 (strict mode via tsconfig.json)
- **Styling:** Tailwind CSS v4.3.1 (PostCSS plugin `@tailwindcss/postcss`)
- **Bundle analysis:** `@next/bundle-analyzer` (enabled via `ANALYZE=true`)
- **Viewport routes:**
  - `src/app/page.tsx` — root (unlocalized)
  - `src/app/[locale]/page.tsx` — localized landing pages
  - `src/app/portal/*` — token-based client portal (locale-neutral)
  - `src/app/services`, `src/app/icons/*` — statically generated
  - `src/app/api/*` — API route handlers
- **App-wide layouts:**
  - `src/app/layout.tsx` — root layout
  - `src/app/[locale]/layout.tsx` — locale-aware layout
  - `src/app/portal/layout.tsx` — portal layout
  - Admin / Auth / Dashboard sub-layouts under `[locale]/`
- **Static generation:** `sitemap.ts`, `robots.ts`, `icon.tsx`, `opengraph-image.tsx`, `twitter-image.tsx`, `manifest.webmanifest` → `/api/pwa-manifest`

---

## 2. Auth Flow

- **Auth library:** next-auth v5.0.0-beta.31 (`src/lib/auth.ts`)
- **Provider:** Cognito OIDC (custom issuer derivation from `COGNITO_USER_POOL_ID`)
- **Token storage:** DynamoDB `SessionTokenStore` table — keeps session cookie under 4KB (avoids CloudFront/Lambda 413s)
- **Session strategy:** JWT, with refresh-token rotation (pattern from authjs.dev)
- **Groups:** Cognito `cognito:groups` claim → `session.user.groups`
- **Lazy initialization:** All `process.env` reads are deferred per-request; `instrumentation.register()` hydrates SSM secrets before first request
- **Graceful fallback:** Returns 200/null when auth env vars are absent (safe for local dev without AWS)
- **Auth pages:** `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/post-login`
- **Route handlers:** `src/app/api/auth/[...nextauth]/route.ts` (destructures `handlers.GET` / `handlers.POST`)
- **Other auth-related APIs:**
  - `/api/auth/register` — user registration
  - `/api/auth/confirm` — email verification
  - `/api/auth/activate` — account activation
  - `/api/auth/resend-verification`
  - `/api/admin/autologin` — admin impersonation/login
- **API auth helper:** `src/lib/api-auth.ts` — validates API requests via Cognito JWT
- **Context:** `src/context/AuthContext.tsx` — client-side auth state
- **Provider component:** `src/components/NextAuthProvider.tsx`

---

## 3. i18n / Localization

- **Library:** next-intl v4.13.0
- **Configuration:** `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navigation.ts`
- **Locales:** 4 — `en` (default), `el`, `fr`, `de`
- **Locale strategy:** `always` — all URLs prefixed (e.g. `/en/services`, `/el/services`)
- **Translation files:** `src/locales/{en,el,fr,de}.json`
- **Static imports:** All locale JSON is statically imported (Turbopack-compatible, avoids dynamic-import issues)
- **Navigation helpers:** `src/i18n/navigation.ts` wraps next-intl's `createNavigation` with correct `usePathname`, `Link`, `redirect`
- **Middleware:** next-intl middleware handles locale detection + 307 redirect (no custom middleware.ts file)
- **Locale switcher:** `src/components/LocaleSwitcher.tsx`
- **Library helpers:** `src/lib/i18n.ts`, `src/lib/use-locale.ts`
- **Locale-neutral routes:** `/portal/*` has explicit `redirects()` stripping locale prefixes (308 to canonical `/portal/:path`)
- **Tests:** `__tests__/locale-defaults.test.ts`, `e2e/locale-pages-sweep.spec.ts`, `e2e/journey-theme-locale.spec.ts`

---

## 4. Main Pages & Components

### Public Pages (`src/app/[locale]/`)
| Route | Description |
|---|---|
| `/` | Landing page (hero, services summary, stats, testimonials, CTA) |
| `/services` | Services overview |
| `/contact` | Contact form |
| `/store` | Product listing ("cloud consulting store") |
| `/store/[id]` | Product detail |
| `/store/success` | Post-purchase success |
| `/blog` | Blog listing (Notion-powered CMS) |
| `/blog/[slug]` | Blog article |
| `/case-studies` | Case study listing |
| `/case-studies/[slug]` | Case study detail |
| `/docs` / `docs/[slug]` | Documentation pages |
| `/campaigns` / `/campaigns/[slug]` | Marketing campaign landing pages |
| `/work` | Portfolio/work samples |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
| `/refund` | Refund policy |
| `/cookies` | Cookie policy |
| `/accessibility` | Accessibility statement |

### Auth Pages (`src/app/[locale]/auth/`)
| Route | Description |
|---|---|
| `/auth/login` | Sign in (next-auth custom page) |
| `/auth/signup` | Registration |
| `/auth/forgot-password` | Password reset |
| `/auth/post-login` | Post-authentication redirect |

### Dashboard Pages (`src/app/[locale]/dashboard/`)
| Route | Description |
|---|---|
| `/dashboard` | User dashboard home |
| `/dashboard/consultations` | Booked consultations |
| `/dashboard/profile` | User profile |
| `/dashboard/purchases` | Purchase history |
| `/dashboard/services` | Active services |
| `/dashboard/settings` | Account settings |

### Admin Pages (`src/app/[locale]/admin/`)
~40+ admin sub-routes — the full admin cockpit covering:

- **Analytics:** datalake, SEO, unified dashboards, workspaces, ROI
- **Campaigns:** Google Ads, Meta Ads, LinkedIn Ads, TikTok Ads, X Ads
- **CRM:** Contacts, companies, deals, tickets, pipelines
- **CMS:** Blog, case studies, FAQs, services, testimonials
- **Notion:** All Notion-backed views (projects, tasks, submissions, status, analytics, docs)
- **Operations:** Cluster monitor, ESP32 devices, Grafana, errors, audits, integrations
- **Other:** AI assistant, AI generator, voice brief, email/ActiveCampaign, subscriptions, users, workspaces, calendar, client portals, Postiz, reports, settings, notifications

### Client Portal (`src/app/portal/`)
| Route | Description |
|---|---|
| `/portal/[token]` | Token-authenticated client portal |
| `/portal/waiting` | Waiting room for pending clients |

### Core Components (`src/components/`)
- **Layout:** `Navbar`, `Footer`, `Logo`, `ThemeProvider`, `ThemeSwitcher`, `LocaleSwitcher`, `CookieConsent`
- **UI:** `CommandPalette`, `TierTable`, `HolographicCard`, `TerminalBlock`, `StatCounter`, `ScrollReveal`, `NeonCursor`, `TypingText`, `ParticleField`
- **Store:** `StoreGrid`, `CartButton`, `CartSlideOver`, `AddToCartButton`, `ProductIcon`
- **Analytics:** `GoogleAnalyticsConsent`, `ClarityAnalytics`, `LinkedInInsightTag`, `PlausibleAnalytics`, `ConsentGatedPixel`
- **Chat:** `ChatWidget`, `ClientChatWidget`
- **Utility:** `DeferredRender`, `ChunkReloadGuard`, `LenisInitializer`, `ClientDecorators`, `ServiceWorkerRegistration`
- **Admin:** `CampaignPageKit`
- **Contexts:** `AuthContext`, `CartContext`, `WorkspaceContext`, `CookieConsentContext`

### API Routes (`src/app/api/`) — Key Groups
- `auth/*` — Authentication handlers
- `admin/*` — Full admin API (AI, analytics, campaigns, CRM, CMS, Notion, Postiz, etc.)
- `cron/*` — Scheduled tasks (ad-analytics-poll, gsc-cache-refresh, client-reports, etc.)
- `webhooks/*` — External webhooks (Stripe, Notion, Sentry, Postiz, EspoCRM, n8n, MQTT, admin-alerts)
- `slack/*`, `newsletter-slack/*` — Slack bot endpoints
- `health`, `analytics/*`, `blog/*`, `docs/*`, `contact`, `calendar/*`, `chat`, `checkout`, `subscribe`, `unsubscribe`
- `services`, `testimonials`, `case-studies/*`, `faqs`, `user/*`, `crm/*`, `campaigns/conversion`

---

## 5. Environment Variables

**[See full `.env.example`](.env.example)** — 170 lines covering:

| Category | Variables |
|---|---|
| **AWS** | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SSM_PREFIX` |
| **Auth** | `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`, Cognito OIDC vars |
| **Email** | `SES_FROM_EMAIL`, `SES_TO_EMAIL`, `AWS_SES_REGION` |
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Slack** | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_WEBHOOK_URL` |
| **HubSpot** | `HUBSPOT_API_KEY`, `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_PORTAL_ID` |
| **Notion** | `NOTION_API_KEY`, 10+ DB IDs, webhook secret |
| **Google** | Calendar + Search Console service account + GSC site URL |
| **Sentry** | DSN, org, project, auth token |
| **Anthropic** | API key + chat model config |
| **ActiveCampaign** | API URL + token |
| **Ad Platforms** | Google Ads, LinkedIn Ads, TikTok Ads, X Ads, Meta/Facebook Ads |
| **CRON** | `CRON_SECRET` |
| **App** | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PORTFOLIO_MODE`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_CLARITY_PROJECT_ID` |

Production secrets hydrated from AWS SSM via Sentry/instrumentation.

---

## 6. Scripts

| Command | Action |
|---|---|
| `pnpm dev` | `next dev -p 4000` |
| `pnpm build` | `next build` |
| `pnpm start` | `next start -p 4000` |
| `pnpm lint` | `eslint src` |
| `pnpm lint:fix` | `eslint src --fix` |
| `pnpm lint:md` | markdownlint |
| `pnpm lint:py` | ruff check |
| `pnpm format` | prettier |
| `pnpm format:check` | prettier --check |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | `vitest` (unit tests) |
| `pnpm test:ci` | `vitest run` |
| `pnpm test:e2e:*` | Various Playwright test runner scripts |
| `pnpm deploy` | `sst deploy --stage production` |
| `pnpm analyze` | `ANALYZE=true next build` |

---

## 7. Deployment & Build Assumptions & HA Architecture

- **Primary runtime:** Pi k3s cluster (self-hosted on OMV-MAIN, exposed via Tailscale Funnel: omv.tail8eb71.ts.net)
- **HA failover:** Cloudflare Workers (`cloudless-gr.baltzakis-themis.workers.dev`) via Load Balancer
- **Docker build (Pi):** `Dockerfile` + `NEXT_OUTPUT_STANDALONE=1` for self-contained bundle
- **WSL dev:** `NEXT_DIST_DIR` env var to avoid NTFS slow benchmarks; `allowedDevOrigins` for LAN access
- **SSM hydration:** Secrets loaded via `instrumentation.ts` → SST SSM parameter store (`/cloudless/production/*`)
- **Server external packages:** AWS SDK clients externalized (Turbopack resolver workaround for pnpm hoisting)
- **next-auth** is transpiled (not externalized) — avoids ESM import errors
- **Coverage mode:** E2E coverage via V8 native coverage (server `NODE_V8_COVERAGE` + browser CDP), forced `source-map` devtool
- **Source maps:** Only in coverage mode (production maps uploaded to Sentry via SST)
- **K8s manifests:** `k8s/` directory for Pi cluster deployments
  - Persistent workloads use dedicated 120GB SSD on OMV-MAIN (nodeSelector constraint)
  - Meilisearch (R21) at `k8s/search/meilisearch.yaml` with 4Gi PVC
- **Workers (Cloudflare):** `workers/` directory for HA failover Worker
- **Infrastructure:** `infrastructure/` directory with IaC (Terraform/SST)

### Cloudflare Load Balancer Failover

- **DNS provider:** Cloudflare (delegated nameservers own cloudless.gr zone)
- **Setup workflow:** `.github/workflows/cloudflare-lb.yml` provisions:
  - Monitors: `cloudless-health-<host>` checking `/api/health` every 60s (expect 200)
  - Pools: `cl-worker-<host>` (Cloudflare Worker) + `cl-pi-<host>` (Pi/k3s)
  - Steering: `off` — serves first healthy pool in default_pools
- **Failover:** `.github/workflows/switch-to-k3s.yml` flips LB to Pi during AWS outages
- **Revert:** Same workflow with `revert: true` restores AWS primary
- **Token required:** `CLOUDFLARE_API_TOKEN` with scopes: Zone:Read, Load Balancing Pools/Monitors/Pools:Edit, DNS:Edit

---

## 8. Test Structure

- **Unit tests:** Vitest v4 (`__tests__/*.test.ts/tsx`) — ~30+ test files covering:
  - Auth callbacks, admin APIs, analytics, Notion, Slack, Sentry, client portals
  - Locale defaults, canonical origin, article quality gates, etc.
- **E2E tests:** Playwright v1.61 (`e2e/*.spec.ts`) — multiple configs:
  - `playwright.config.mts` — main config
  - `playwright.k3s.config.mts` — k3s cluster tests
  - `playwright.production.config.mts` — production smoke tests
  - Test helpers in `e2e/helpers/`
- **Coverage:** Vitest V8 coverage + Monocart coverage reports
- **CI tooling:** `monocart.config.mts`, `vitest.config.mts`, `vitest.integration.config.mts`

---

## 9. Risks Before Production Changes

1. **Auth availability:** Auth config resolves lazily; changes to `COGNITO_*` env vars could break sign-in/session flow
2. **i18n completeness:** 4 locale JSON files must stay in sync — missing keys = blank UI text
3. **External API dependencies:** Notion, Stripe, Slack, ActiveCampaign, HubSpot, AWS SDK — all must be available or gracefully degraded
4. **SSM hydration timing:** `instrumentation.register()` runs async; any route handler that accesses `process.env` before hydration gets empty/fallback values
5. **Turbopack vs Webpack:** Some configs differ between dev (Turbopack) and prod (Webpack) — `serverExternalPackages` only applies to Turbopack
6. **Locale redirects:** next-intl middleware intercepts before Next.js `rewrites()` — any new public route must be tested for locale redirect behavior
7. **Coverage config:** `next.config.ts` has conditional webpack overrides when `COVERAGE=1` — editing next.config.ts could break the coverage pipeline
8. **Secrets in .env.local:** Contains real credentials — never commit, never expose in logs
9. **pnpm overrides:** Version pinning for security advisories — removing/altering overrides could reintroduce vulnerabilities
10. **Next.js 16 edge:** Using `next@16.2.1` — some APIs may have changed from v14/v15 patterns
11. **LB failover:** Requires `CLOUDFLARE_API_TOKEN` with Load Balancing scopes in SSM

---

## 10. File Reference

| File | Purpose |
|---|---|
| `package.json` | Scripts, dependencies, pnpm overrides |
| `next.config.ts` | All Next.js configuration |
| `tsconfig.json` | TypeScript strict mode config |
| `eslint.config.mjs` | Flat ESLint config |
| `vitest.config.mts` | Unit test runner config (Vitest v4) |
| `playwright.config.mts` | E2E test runner config |
| `postcss.config.mjs` | PostCSS config (Tailwind v4) |
| `src/lib/auth.ts` | next-auth v5 with Cognito OIDC + DynamoDB token store |
| `src/i18n/routing.ts` | Locale definitions (en, el, fr, de) |
| `src/i18n/request.ts` | Static locale message loader |
| `sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts` | Sentry config |
| `sst.config.ts` | SST v4 deploy config |
| `instrumentation.ts` | SSM hydration on cold start |
| `.env.example` | All environment variables |
| `Dockerfile` | Self-hosted Docker build (Pi/k3s) |
| `.github/workflows/cloudflare-lb.yml` | Cloudflare HA failover setup |
| `.github/workflows/switch-to-k3s.yml` | Manual failover/increase script |
| `k8s/search/meilisearch.yaml` | R21 search backend (4Gi PVC on OMV-MAIN SSD) |