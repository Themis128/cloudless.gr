# Technology Stack

## Core Framework

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.2.1 | App Router, React 19.2.4, Turbopack |
| React | 19.2.4 | UI framework |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4 | Styling with `@theme inline` custom tokens |
| pnpm | 11.9.0 | Package manager (monorepo via pnpm-workspace.yaml) |

## 3D & Animation

| Library | Purpose |
|---------|---------|
| @react-three/fiber + drei | 3D scenes (ParticleField3D, HolographicCard) |
| three.js | WebGL rendering |
| GSAP + ScrollTrigger | Scroll animations |
| Lenis | Smooth scrolling |

## UI Components

| Library | Purpose |
|---------|---------|
| cmdk | Command palette (Cmd+K) |
| next-intl | Internationalization (en, el, fr) |

## State Management

| Context | Purpose |
|---------|---------|
| AuthContext | D1 session auth state |
| CartContext | In-memory cart (useReducer) |
| CookieConsentContext | GDPR cookie consent |

## Backend & Infrastructure

| Service | Purpose | Status |
|---------|---------|--------|
| Cloudflare Workers | Edge compute, API routes | ✅ Primary |
| Cloudflare D1 | Auth DB (user-auth-db) | ✅ Primary |
| Cloudflare R2 | Object storage (assets, analytics, datalake) | ✅ Primary |
| Cloudflare Workers AI | AI inference (llama-3.1-8b) | ✅ Primary |
| Cloudflare Tunnel | Secure service exposure | ✅ Active |
| Cloudflare Email | Transactional email | ✅ Active |
| Pi k3s cluster | Self-hosted Kubernetes (11 services) | ✅ Active |
| AWS SES | Email sending (legacy fallback) | ⏳ Legacy |
| AWS SSM | Secrets (legacy, SSM_DISABLED=1 in ETL) | ⏳ Legacy |
| Stripe | Payments, webhooks | ✅ Active |

## Deployed Services (k3s)

| Service | Namespace | NodePort | Status |
|---------|-----------|----------|--------|
| grafana | monitoring | 30850 | ✅ |
| kuma (uptime) | uptime-kuma | 32501 | ✅ |
| n8n | n8n | 30900 | ✅ |
| ntfy | ntfy | 30080 | ✅ |
| espocrm | espocrm | 30700 | ✅ |
| meili | meilisearch | 30902 | ✅ |
| postiz | postiz | 30500 | ✅ |
| appflowy | appflowy | 30810 | ✅ |
| docs | default | 30901 | ✅ |

## External Integrations

| Integration | Purpose | Config Check |
|------------|---------|-------------|
| Slack | Notifications | `SLACK_WEBHOOK_URL` |
| EspoCRM | CRM | `HUBSPOT_API_KEY` |
| Notion | CMS (blog, docs) | `NOTION_API_KEY` + `NOTION_BLOG_DB` |
| Google Calendar | Booking | `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` |
| Sentry | Error tracking | `SENTRY_AUTH_TOKEN` |
| Meta CAPI | Conversion tracking | `META_CAPI_ACCESS_TOKEN` |

## Testing

| Tool | Purpose |
|------|---------|
| Vitest | Unit/integration tests |
| @testing-library/react | Component tests |
| Playwright | E2E tests (e2e/ directory) |
| jsdom | DOM environment for tests |

## Build & Deploy

| Tool | Purpose |
|------|---------|
| OpenNext.js | Next.js → Cloudflare Workers build |
| SST | Infrastructure as Code (Cloudflare) |
| Wrangler | Workers CLI |
| GitHub Actions | CI/CD |