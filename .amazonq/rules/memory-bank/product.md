# Product: cloudless.gr

## Purpose & Value Proposition

Cloudless.gr is a full-stack SaaS agency website and client platform for a cloud/serverless consultancy targeting Greek startups and SMBs. It combines a public marketing site with a full client portal, admin panel, and AI-powered digital marketing tools — all deployed on AWS.

Core value: One platform that serves as a marketing site, lead capture engine, client portal, e-commerce store, and internal ops dashboard.

## Key Features & Capabilities

### Public / Marketing

- Multi-locale site (en, el, fr, de) with cookie-based locale switching
- Blog via Notion CMS, services listing, contact form (SES + Slack + EspoCRM)
- Newsletter signup with SES welcome email + Slack notification
- E-commerce store (checkout redirects to contact page with product/campaign context instead of Stripe Checkout)
- PWA support (service worker, offline.html, web manifest)
- SEO: sitemap, robots.txt, structured data (JSON-LD), OpenGraph images

### Authentication & Users

- AWS Cognito Hosted UI (OIDC + PKCE) via next-auth v5
- Admin detection via Cognito `admin` group → JWT `groups` claim
- RP-initiated logout (full SSO session termination)
- Route protection in middleware (`src/proxy.ts`) — server-side before render
- Theme preference (dark/light/system) synced across tabs and to user profile

### Client Dashboard (`/dashboard`)

- Authenticated client portal with settings, subscriptions, orders
- User profile management
- Consultation booking (Google Calendar integration)
- Portal deliverables and client-specific workspace

### Admin Panel (`/admin`)

- Full analytics: GSC (Google Search Console), Stripe, DuckDB
- CRM: EspoCRM contacts, pipelines, deals
- Notion CMS management: blog, docs, forms, case studies, tasks
- AI analytics orchestration with Anthropic Claude + AWS Bedrock
- A/B test flag management (SSM-backed)
- Client portal management and approval flow
- Slack workspace management
- Newsletter send + subscriber reports
- SEO keyword and CTR opportunity dashboards
- Voice brief generation
- Calendar and content calendar management

### Integrations

- Slack: full two-way (outbound notify + inbound slash commands, events, interactions)
- Notion: blog, docs, forms, projects, analytics, calendar, reports
- EspoCRM: CRM contacts, deals, pipelines, webhooks
- Google Calendar: booking availability and slot reservation
- Google Search Console: 10+ analytics functions
- Stripe: webhooks, subscription management (checkout disabled — redirects to contact page)
- AWS SES v2: transactional email (contact, orders, newsletter, portal)
- AWS SSM: all secrets and some mutable JSON state
- Sentry: error tracking (client, server, edge)
- Meta: Pixel, CAPI (Conversions API)
- ActiveCampaign: email marketing
- Postiz: social media scheduling
- TikTok OAuth, LinkedIn, X Ads, Google Ads

### Infrastructure

- k3s Kubernetes on Raspberry Pi for HA standby / self-hosted workloads
- ESP32 watchdog hardware with MQTT alerts → Notion + Slack
- Cloudflare tunnels for Pi exposure
- Terraform for Lambda optimization
- GitHub Actions: 80+ workflows for CI, deploy, audits, cluster ops

## Target Users

- **Clients**: Greek/EU startups and SMBs receiving cloud/marketing services
- **Admin (owner)**: Single-tenant internal ops — analytics, CRM, content management
- **Anonymous visitors**: Lead generation through contact form, newsletter, blog, store
