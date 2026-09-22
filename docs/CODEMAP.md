# Cloudless.gr Application Codemap

Last verified: 2026-09-21. Companion codemap for the social-automation platform: `cu130-slim/docs/CODEMAP.md` (SocialAuto at social.cloudless.gr).

## 🏗️ **Architecture Overview**

**cloudless.gr** is a full-stack cloud consulting platform built with modern web technologies, featuring:

- **Multi-tenant SaaS architecture** with role-based access control
- **Headless CMS** via AppFlowy for content management
- **Integrated marketing stack** (Ads, SEO, Analytics, Email)
- **Single-node Raspberry Pi k3s cluster** deployment with Cloudflare Workers proxy
- **Real-time monitoring** (ESP32 sensors, cluster health)

---

## 🛠️ **Tech Stack**

### **Core Framework**

- **Next.js 15.5.24** (App Router, React 19.2.8)
- **TypeScript 5.5.0** (strict mode)
- **Tailwind CSS 4.0.0** (utility-first styling)
- **next-intl 4.14.5** (i18n routing: en, el, fr, de)
- **next-auth 5.0.0-beta.32** (authentication)

### **Infrastructure & Deployment**

- **Raspberry Pi k3s cluster** (single-node omv, primary production deployment)
- **Cloudflare Workers** (edge proxy via cloudless2 worker)
- **Cloudflare Tunnel** (secure pi-origin.cloudless.gr access)
- **SafeDeploy** (rollback system with auto-rollback watchdog)
- **Docker** (standalone builds)
- **GitHub Actions** (80+ CI/CD workflows)

### **Data & Storage**

- **Cloudflare D1 `app_config`** (runtime secrets / config store — replaces AWS SSM)
- **Self-hosted mail (omv-ha)**: postfix relay via Resend + dovecot IMAP + Roundcube (see `docs/MAIL-SERVER-SETUP.md`); Resend API as relay
- **AppFlowy Cloud** (headless CMS)
- **Stripe** (payments, subscriptions)
- **DuckDB** (analytics data lake)

> **AWS remnant**: `lambda/pi-proxy/` is a single AWS Lambda + SSM standby
> failover proxy (deployed via `deploy-pi-proxy.yml`) — the last AWS
> dependency. Everything else (auth, config, sessions) is Cloudflare
> D1/KV or self-hosted; DynamoDB/Cognito are already gone (comments only).

### **Monitoring & Analytics**

- **Sentry** (error tracking)
- **Prometheus + Grafana** (cluster monitoring)
- **Google Search Console** (SEO analytics)
- **SocialAuto** (`social.cloudless.gr` — live social publishing/analytics platform, repo `cu130-slim`)
- **Postiz** (legacy social scheduler, Helm charts under `infrastructure/postiz/`)
- **N8N** (workflow automation — drives SocialAuto posting pipelines)

### **Testing**

- **Vitest 5.0.1** (unit tests, jsdom)
- **Playwright 1.63.0** (E2E tests, 3 projects)
- **React Testing Library 16.0.0** (component tests)
- **@axe-core/playwright 4.13.0** (accessibility)

---

## 📁 **Directory Structure**

```
cloudless.gr/
├── src/                          # Application source
│   ├── app/                      # Next.js App Router
│   │   ├── [locale]/            # i18n routing (en, el, fr, de)
│   │   │   ├── page.tsx         # Homepage
│   │   │   ├── services/        # Service offerings
│   │   │   ├── store/           # E-commerce
│   │   │   ├── auth/            # Authentication (login, signup)
│   │   │   ├── dashboard/      # Customer portal
│   │   │   ├── admin/          # Admin panel (60+ admin pages)
│   │   │   ├── blog/            # Blog listing & posts
│   │   │   ├── docs/            # Documentation
│   │   │   ├── contact/        # Contact form
│   │   │   └── campaigns/      # Campaign landing pages
│   │   ├── api/                # API routes (100+ endpoints)
│   │   │   ├── admin/          # Admin APIs (analytics, AI, CRM)
│   │   │   ├── auth/           # Authentication APIs
│   │   │   ├── checkout/       # Stripe checkout
│   │   │   ├── slack/          # Slack integration
│   │   │   └── webhooks/       # Stripe webhooks
│   │   ├── layout.tsx           # Root layout
│   │   └── proxy.ts            # Middleware (auth + locale)
│   ├── components/             # React components
│   │   ├── ui/                 # UI primitives (buttons, cards)
│   │   ├── services/           # Service cards, pricing
│   │   ├── store/              # E-commerce components
│   │   ├── admin/              # Admin UI components
│   │   └── ClientDecorators.tsx # Command palette, effects
│   ├── context/                # React contexts
│   │   ├── AuthContext.tsx     # Authentication state
│   │   └── CartContext.tsx     # Shopping cart state
│   ├── lib/                    # Business logic & integrations
│   │   ├── auth-d1.ts         # Cloudflare D1 auth
│   │   ├── ssm-config.ts       # Runtime config loader (D1 app_config + env fallback)
│   │   ├── slack-notify.ts     # Slack notifications
│   │   ├── gsc.ts              # Google Search Console (11x functions)
│   │   ├── appflowy-*.ts       # AppFlowy CMS integration
│   │   ├── stripe.ts           # Stripe payments
│   │   ├── integrations.ts     # External service integrations
│   │   └── i18n.ts             # Locale configuration
│   ├── locales/                # i18n dictionaries
│   │   ├── en.json             # English translations
│   │   ├── el.json             # Greek translations
│   │   ├── fr.json             # French translations
│   │   └── de.json             # German translations
│   └── instrumentation.ts       # Sentry/observability
├── __tests__/                  # Vitest unit tests (99+ suites)
│   └── stubs/                  # AWS SDK & Next.js stubs
├── e2e/                        # Playwright E2E tests
│   ├── deep/                   # Deep E2E specs
│   └── k3s/                    # k3s cluster tests
├── infrastructure/             # Infrastructure code
│   ├── pi-alert-api/           # Python FastAPI (ESP32 alerts)
│   ├── esp32-watchdog/         # ESP32/Arduino firmware
│   ├── postiz/                 # Postiz Helm charts
│   ├── cloudflare-tunnels/     # Cloudflare tunnel configs
│   └── terraform/              # Lambda optimization
├── k8s/                        # Kubernetes manifests
│   ├── cluster-protection/     # Resource limits, Prometheus rules
│   └── grafana-dashboards/     # Grafana dashboards
├── lambda/pi-proxy/            # AWS Lambda standby failover proxy (last AWS remnant)
├── scripts/                    # Automation scripts
├── workers/                    # Cloudflare Workers
├── tools/                      # MCP tools & utilities
├── docs/                       # Documentation
├── public/                     # Static assets
└── .github/workflows/          # CI/CD workflows
```

---

## 🎯 **Key Features & Modules**

### **Authentication & Authorization**

- **Cloudflare D1** (user-auth-db) for password authentication
- **Opaque session cookies** (30-day default)
- **Role-based access control** (admin, user, customer)
- **Admin promotion** via API (`POST /api/admin/users`)

### **Content Management (AppFlowy)**

- **Headless CMS** via AppFlowy Cloud integration
- **Dynamic content**: blog posts, case studies, FAQs, services
- **Multi-language support** via AppFlowy locales
- **Real-time content updates** via webhooks

### **E-commerce & Payments**

- **Stripe integration** for subscriptions and one-time purchases
- **Shopping cart** with React context state management
- **Product catalog** with dynamic pricing
- **Customer portal** for order management

### **Marketing & Campaigns**

- **Multi-platform ads**: Google Ads, Meta (Facebook/Instagram), LinkedIn, TikTok, X (Twitter)
- **Campaign landing pages** with conversion tracking
- **Social publishing** via SocialAuto (`social.cloudless.gr`) — n8n pipelines generate + publish posts; Postiz charts remain for legacy use
- **Email campaigns** with ActiveCampaign integration

### **Analytics & Reporting**

- **Google Search Console** integration (11 SEO functions)
- **Custom analytics dashboards** (Grafana, Metabase)
- **Data lake architecture** with DuckDB
- **ROI tracking** across marketing channels
- **Search funnel analysis** and keyword opportunities

### **Admin Panel (60+ pages)**

- **Analytics dashboards** (SEO, social, unified, workspaces)
- **AI assistant** (content generation, campaign creation)
- **CRM management** (contacts, companies, deals, tickets)
- **Campaign management** (Google, Meta, LinkedIn, TikTok, X)
- **Cluster monitoring** (k3s health, ESP32 sensors)
- **CMS management** (AppFlowy projects, tasks, submissions)
- **Email automation** (campaigns, lists, contacts)
- **Integrations hub** (external service configuration)

### **Infrastructure & Monitoring**

- **Raspberry Pi k3s cluster** (single-node omv Pi 5)
- **ESP32 sensor network** with real-time alerts
- **Cloudflare tunnel** for secure Pi access
- **Prometheus + Grafana** monitoring stack
- **SafeDeploy** rollback system with auto-rollback watchdog
- **Health checks** and automatic recovery

---

## 🔌 **API Endpoints (100+ routes)**

### **Authentication**

- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Password reset

### **Admin APIs**

- **Analytics**: `/api/admin/analytics/*` (SEO, social, unified, data lake)
- **AI**: `/api/admin/ai/*` (generate, assistant, langgraph, product descriptions)
- **CRM**: `/api/admin/crm/*` (contacts, companies, deals, tickets)
- **Campaigns**: `/api/admin/campaigns/*` (Google, Meta, LinkedIn, TikTok, X)
- **Cluster**: `/api/admin/cluster/*` (health, watchdogs, Kuma status)
- **CMS**: `/api/admin/appflowy/*` (projects, tasks, submissions, comments)
- **Email**: `/api/admin/email/*` (campaigns, lists, contacts, automations)

### **Public APIs**

- `POST /api/contact` - Contact form submission
- `POST /api/subscribe` - Newsletter subscription
- `POST /api/checkout` - Stripe checkout initiation
- `GET /api/health` - Health check endpoint
- `POST /api/webhooks/stripe` - Stripe webhook handler

---

## 🎨 **Design System**

### **Color Palette**

- **Void colors**: `#0a0a0f` (void), `#12121a` (void-light), `#1a1a2e` (void-lighter)
- **Neon colors**: cyan `#00fff5`, magenta `#ff00ff`, green `#00ff41`, blue `#4d7cff`
- **Typography**: Instrument Sans (headings), Work Sans (body), Geist Mono (code)

### **Component Patterns**

- **Cards**: `rounded-xl border border-slate-800 bg-void-light/50`
- **Buttons**: `rounded-lg` (WCAG 44px+ touch targets)
- **Backdrop**: `bg-void/90 backdrop-blur-xl` on navbar
- **Scanlines & cyber-grid** effects for cyberpunk aesthetic

---

## 🚀 **Development Workflow**

### **Local Development**

```bash
pnpm dev                    # Start dev server on :4000
pnpm dev:local-auth        # Use local SQLite instead of D1
pnpm dev:webpack           # Webpack mode (for coverage)
```

### **Testing**

```bash
pnpm test                   # Vitest watch mode
pnpm test:ci                # Vitest CI run
pnpm test:e2e               # Playwright E2E tests
pnpm test:k3s               # k3s cluster tests
```

### **Deployment**

```bash
pnpm deploy                 # Cloudflare Workers deploy to production
pnpm deploy:staging         # Cloudflare Workers deploy to staging
scripts/rollback.sh previous # SafeDeploy rollback (~15s, no rebuild)
```

### **Code Quality**

```bash
pnpm lint                   # ESLint
pnpm format                 # Prettier
pnpm typecheck              # TypeScript type checking
```

---

## 🔐 **Security & Secrets**

- **No .env files in production** - runtime secrets from Cloudflare D1 `app_config` table
- **D1 config writes**: `Actions → "Set D1 config value"` (`.github/workflows/set-d1-config.yml`)
- **Local dev**: `.env.local` (git-ignored)
- **Secret caching**: 5-minute cache with stale-on-error fallback
- **Rate limiting**: IP-based for API routes
- **Webhook verification**: HMAC-SHA256 for Stripe

---

## 📊 **Coverage & Quality**

- **Vitest coverage thresholds**: lines 47%, functions 37%, branches 37%, statements 46%
- **E2E test coverage**: 200+ Playwright tests across 3 projects
- **Accessibility**: @axe-core/playwright integration
- **Code quality**: ESLint, Prettier, Ruff (Python), mypy (Python)

---

## 🌐 **Deployment Architecture**

```
Production Traffic:
cloudless.gr → Worker cloudless2 (pi-origin-proxy)
              → Cloudflare Tunnel (pi-origin.cloudless.gr)
              → k3s cloudless-app on omv (NodePort)
```

**Primary**: Raspberry Pi k3s cluster (single-node omv Pi 5)
**Edge**: Cloudflare Workers (cloudless2 reverse proxy)
**Tunnel**: Cloudflare Tunnel for secure origin access

---

## 📱 **Key Integrations**

- **AppFlowy Cloud**: Headless CMS for dynamic content
- **Stripe**: Payment processing and subscriptions
- **Google Search Console**: SEO analytics and reporting
- **ActiveCampaign**: Email marketing and automation
- **SocialAuto** (`social.cloudless.gr`): social publishing, DM inbox, analytics — see `cu130-slim/docs/CODEMAP.md`
- **Postiz**: Legacy social media scheduling (superseded by SocialAuto)
- **N8N**: Workflow automation (runs the SocialAuto posting pipelines)
- **Slack**: Notifications and team communication
- **Sentry**: Error tracking and monitoring

---

## 📣 **Social Content Strategy (Visibility Era — adopted 2026-09)**

Social content for cloudless.gr is generated and published by **SocialAuto** (`social.cloudless.gr`, repo `cu130-slim`) via n8n workflows — the site itself has no posting code. Strategy adopted from Sofia Kakkava's "Visibility Era" challenge:

- **Voice (DAY 1)**: Expert-led blend — teach one concrete thing → ground it in a real observation (never invented anecdotes) → close with energizing momentum + question. Practitioner tone, plain English/Greek, EUR pricing.
- **Platforms (DAY 2, 8-week commitment)**: **MAIN = LinkedIn** (original content + carousels via the `cloudless.gr` Company Page) → **SECONDARY = Meta** (Instagram, Facebook Page, Threads — adapted versions) → **LAST = Twitter/X, TikTok** (opportunistic only).
- **Scheduled flows**: LinkedIn carousel every 2 days 19:00 EET; LinkedIn weekly cloud post Mon 09:00; Instagram marketing image daily; all other platform posts are webhook/on-demand.
- **Source of truth**: `brand_voices.voice_signature` in SocialAuto (`creator_type.py`/`platforms` commands); full details in `cu130-slim/docs/CODEMAP.md`.

### SocialAuto → datalake pipeline (added 2026-09)

SocialAuto pushes its own first-party data into the datalake — no Postiz needed:

- **Producer**: `datalake_export` Celery task (every 6h, cu130-slim) writes JSON tables to `datalake-bucket` under `lake/socialauto-*` — accounts, posts, post-metric history, follower snapshots, account-insight events, per-team insights-engine output, leads (sha256 email + domain only), 90-day web events (UTM only; IP/UA dropped).
- **Materializer**: `scripts/etl/materialize-datalake-snapshots.mjs` reads them via `safeJson`/`r2List` into gold sections `socialauto_ops`, `social_engagement`, `social_outliers`, `social_recommendations`, `social_leads`, `social_attribution` — rendered on `/admin/analytics/datalake`.
- **Real-time leads**: `POST /api/webhooks/socialauto-leads` (shared-secret) → EspoCRM `createLead`, which then appears in `espocrm_funnel` — the lake export is the analytical copy.
- **`postiz_ops`** is kept for history but Postiz is retired; SocialAuto sections are the live social surface.

---

## 🔄 **SafeDeploy Rollback System**

### **Deployment Architecture**

- **SafeDeploy**: Automatic rollback system for Pi deployments
- **Rollback**: `scripts/rollback.sh previous` (~15s, no rebuild)
- **Watchdog**: Continuous prod monitor (systemd timer, every 2min)
- **Auto-rollback**: Triggers at 16min unhealthy (alerts at 6min)
- **Health checks**: Post-deploy validation with automatic failover

### **Rollback Workflow**

1. Every deploy writes to per-SHA `releases/` directory
2. Symlink flip for atomic deployment
3. Health checks validate new release
4. Auto-rollback on failure (watchdog monitoring)
5. Manual rollback via `scripts/rollback.sh previous`

---

## 🌐 **Cloudflare Tunnel & Proxy Configuration**

### **Production Traffic Path**

```
browser → cloudless.gr → Worker cloudless2 (pi-origin-proxy)
      → Cloudflare Tunnel (pi-origin.cloudless.gr)
      → k3s cloudless-app on omv (NodePort)
```

### **Cloudflare Workers (cloudless2)**

- **Role**: Reverse proxy only (no app secrets)
- **Worker**: `workers/pi-origin-proxy`
- **Origin**: `pi-origin.cloudless.gr` via Cloudflare Tunnel
- **Headers**: `x-served-by: pi-tunnel-proxy` indicates proxy path
- **Secrets**: Empty Wrangler secrets (proxy doesn't need app secrets)

### **Cloudflare Tunnel**

- **Origin**: `pi-origin.cloudless.gr`
- **Access**: Secure tunnel to k3s cluster
- **Benefits**: No public IP exposure, automatic SSL
- **Direct origin**: Available for debugging/crons

---

## 🎯 **Business Logic Modules**

### **Customer Journey**

1. **Landing** → Services → Contact → Signup
2. **Onboarding** → Dashboard → Service selection
3. **Purchase** → Stripe checkout → Order confirmation
4. **Delivery** → Project management → Completion
5. **Support** → Dashboard settings → Support tickets

### **Admin Operations**

1. **Content management** → AppFlowy projects → Publish
2. **Campaign creation** → AI assistant → Multi-platform ads
3. **Analytics review** → Unified dashboards → ROI analysis
4. **Customer support** → CRM tickets → Email automation
5. **Infrastructure monitoring** → Cluster health → Alert management

---

This codemap provides a comprehensive overview of the cloudless.gr application architecture, tech stack, and key components. The system is designed as a modern, scalable SaaS platform with integrated marketing, analytics, and infrastructure monitoring capabilities.
