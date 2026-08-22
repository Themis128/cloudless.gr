# Cloudless.gr Application Codemap

## 🏗️ **Architecture Overview**

**cloudless.gr** is a full-stack cloud consulting platform built with modern web technologies, featuring:
- **Multi-tenant SaaS architecture** with role-based access control
- **Headless CMS** via AppFlowy for content management
- **Integrated marketing stack** (Ads, SEO, Analytics, Email)
- **Hybrid deployment** (AWS Lambda + Raspberry Pi k3s cluster)
- **Real-time monitoring** (ESP32 sensors, cluster health)

---

## 🛠️ **Tech Stack**

### **Core Framework**
- **Next.js 16.2.9** (App Router, React 19.2.7)
- **TypeScript 6.0.3** (strict mode)
- **Tailwind CSS 4.3.1** (utility-first styling)
- **next-intl 4.13.0** (i18n routing: en, el, fr, de)
- **next-auth 5.0.0-beta.31** (authentication)

### **Infrastructure & Deployment**
- **AWS Lambda** (primary production deployment via SST v4)
- **Raspberry Pi k3s cluster** (HA standby, real-time monitoring)
- **Cloudflare Workers** (edge proxy, ESP32 tunnel)
- **Docker** (standalone builds)
- **GitHub Actions** (80+ CI/CD workflows)

### **Data & Storage**
- **AWS SSM Parameter Store** (secrets management)
- **AWS SES v2** (transactional email)
- **AppFlowy Cloud** (headless CMS)
- **Stripe** (payments, subscriptions)
- **DynamoDB** (transaction cache)
- **DuckDB** (analytics data lake)

### **Monitoring & Analytics**
- **Sentry** (error tracking)
- **Prometheus + Grafana** (cluster monitoring)
- **Google Search Console** (SEO analytics)
- **Postiz** (social media scheduling)
- **N8N** (workflow automation)

### **Testing**
- **Vitest 4.1.9** (unit tests, jsdom)
- **Playwright 1.61.0** (E2E tests, 3 projects)
- **React Testing Library 16.3.2** (component tests)
- **@axe-core/playwright 4.11.3** (accessibility)

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
│   │   │   └── webhooks/       # Stripe & Notion webhooks
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
│   │   ├── ssm-config.ts       # AWS SSM secrets loader
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
│   ├── lambda/                 # AWS Lambda handlers
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
├── lambda/                     # AWS Lambda functions
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
- **Multi-language support** with Notion fallback
- **Real-time content updates** via webhooks

### **E-commerce & Payments**
- **Stripe integration** for subscriptions and one-time purchases
- **Shopping cart** with React context state management
- **Product catalog** with dynamic pricing
- **Customer portal** for order management

### **Marketing & Campaigns**
- **Multi-platform ads**: Google Ads, Meta (Facebook/Instagram), LinkedIn, TikTok, X (Twitter)
- **Campaign landing pages** with conversion tracking
- **Social media scheduling** via Postiz integration
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
- **Raspberry Pi k3s cluster** (single-node HA setup)
- **ESP32 sensor network** with real-time alerts
- **Cloudflare tunnel** for secure Pi access
- **Prometheus + Grafana** monitoring stack
- **Automatic failover** and health checks

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
- `POST /api/webhooks/notion` - Notion webhook handler

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
pnpm deploy                 # SST deploy to production
pnpm deploy:staging         # SST deploy to staging
```

### **Code Quality**
```bash
pnpm lint                   # ESLint
pnpm format                 # Prettier
pnpm typecheck              # TypeScript type checking
```

---

## 🔐 **Security & Secrets**

- **No .env files in production** - all secrets from AWS SSM
- **SSM path prefix**: `/cloudless/production/`
- **Local dev**: `.env.local` (git-ignored)
- **Secret caching**: 5-minute cache with stale-on-error fallback
- **Rate limiting**: IP-based for API routes
- **Webhook verification**: HMAC-SHA256 for Stripe and Notion

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
cloudless.gr → Cloudflare → AWS Lambda (Amplify)
              → Cloudflare Tunnel → Pi k3s cluster (HA standby)
```

**Primary**: AWS Lambda via SST (Amplify)
**Standby**: Raspberry Pi k3s cluster with automatic failover
**Edge**: Cloudflare Workers for proxy and tunnel

---

## 📱 **Key Integrations**

- **AppFlowy Cloud**: Headless CMS for dynamic content
- **Stripe**: Payment processing and subscriptions
- **Google Search Console**: SEO analytics and reporting
- **ActiveCampaign**: Email marketing and automation
- **Postiz**: Social media scheduling
- **N8N**: Workflow automation
- **Slack**: Notifications and team communication
- **Sentry**: Error tracking and monitoring

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
