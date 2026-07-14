# Lambda → Cloudflare Workers Migration Analysis

## Current Architecture (Post-CloudFront Delete)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Fly.io HA Proxy (Edge Entry Point)                      │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  fly-proxy-app/proxy.py (92 lines)                                     │  │
│  │  - Health checks Workers every 30s                                     │  │
│  │  - Routes: cloudless.gr → Workers, fallback → Pi/k3s                    │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                           │
                           │ Health OK
                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Cloudflare Workers (Primary)                        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  src/index-cloudflare-free.js (500 lines)                            │  │
│  │  - Auth: register, login, logout, session, password reset             │  │
│  │  - Static assets via R2 (ASSETS_BUCKET)                               │  │
│  │  - Analytics parquet endpoint                                          │  │
│  │  - Health endpoint                                                     │  │
│  │  - SPA fallback for unknown routes                                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                           │
                           │ Workers Fallback (not all routes covered)
                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              AWS Lambda/SST (via Fly Proxy)              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  src/app/api/ (221 route.ts files)                                    │  │
│  │  - Full Next.js application with SSR                                 │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                           │
                           ▼ (Pi Standby)
┌─────────────────────────────────────────────────────────────────────────────┐
│  Pi/k3s Cluster (Tertiary Fallback)                                     │
│  - Serves same Next.js image                                             │
│  - Reached via Tailscale Funnel                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Migration Status: NOT COMPLETE

### What IS Migrated (Workers Primary)
- ✅ D1 Auth: register, login, logout, session, password reset
- ✅ R2 Static Assets serving
- ✅ Analytics parquet endpoint
- ✅ Health check
- ✅ SPA fallback routing

### What is NOT Migrated (Still on Lambda)

| Category | Routes | Status |
|----------|--------|--------|
| **Contact** | `/api/contact` | ❌ Lambda only |
| **Checkout/Payments** | `/api/checkout`, `/api/webhooks/stripe`, `/api/user/purchases` | ❌ Lambda only |
| **Chat/AI** | `/api/chat`, `/api/chat-ai`, `/api/recommendations`, `/api/internal/ai/generate` | ❌ Lambda only (Bedrock) |
| **Calendar** | `/api/calendar/*`, `/api/user/consultations` | ❌ Lambda only (Google Calendar) |
| **Blog/Docs** | `/api/blog/*`, `/api/docs/*`, `/api/case-studies/*` | ❌ Lambda only (Notion) |
| **Admin Analytics** | `/api/admin/analytics/*`, `/api/analytics/*` (GSC) | ❌ Lambda only |
| **Notion CMS** | `/api/admin/notion/*`, `/api/notion-image` | ❌ Lambda only |
| **Email** | `/api/subscribe`, `/api/newsletter/*`, `/api/contact` | ⚠️ Workers-aware with Lambda fallback |
| **CRM** | `/api/crm/contact`, `/api/admin/crm/*`, `/api/admin/leads` | ❌ Lambda only (EspoCRM/HubSpot) |
| **Social Media** | `/api/admin/postiz/*`, `/api/admin/campaigns/*` | ❌ Lambda only |
| **Cron Jobs** | All `/api/cron/*` routes | ❌ Lambda/Scheduled via Fly.io cron apps |
| **Portal** | `/api/portal/*` routes | ❌ Lambda only |
| **User Profile** | `/api/user/profile`, `/api/user/delete` | ❌ Lambda only |
| **Slack Webhook** | `/api/slack/*`, `/api/newsletter-slack/*` | ❌ Lambda only |
| **CSP Reports** | `/api/csp-report` | ❌ Lambda only |
| **Workspaces** | `/api/admin/workspaces`, `/api/admin/analytics/workspaces` | ❌ Lambda only |
| **Voice Brief** | `/api/admin/voice-brief`, `/api/cron/voice-brief` | ⚠️ Partial (D1 primary, but API on Lambda) |

## Key Dependencies to Migrate

### External Services
- Notion API (blog, docs, tasks, projects, submissions)
- Google Calendar API (availability, bookings)
- Stripe API (checkout, webhooks, subscriptions)
- EspoCRM/HubSpot API (contact sync)
- Postiz API (social media posting)
- n8n API (workflows)
- Slack Webhooks
- Google Search Console

### AWS Services (Fallback Sources)
- DynamoDB: StripeTransactions, UserProfile, AdminNotifications, AnalyticsCache, SessionTokenStore
- S3: cloudless-analytics-data (events/, lake/)
- SES: Order confirmations, notifications
- Bedrock: Chat/AI (Titan embeddings, Nova Micro)

## Migration Path Options

### Option A: Full Migration to Workers
Convert all 221 API routes to Worker endpoints. This requires:
- ~10,000+ lines of code conversion
- R2/D1 bindings for all data stores
- Workers AI for all LLM calls
- Wrangler secrets for all API keys

### Option B: Hybrid (Current State)
- Workers handles: Auth + Static Assets + Analytics
- Lambda handles: Complex business logic
- Pi handles: Full fallback

### Option C: Selective Route Migration
Prioritize critical routes:
1. Contact form (SES → Email binding)
2. Checkout/payment verification
3. Chat widget (Workers AI)
4. User profile sync

## Recommendation

The current hybrid architecture (cloudless.gr → Cloudflare Workers, with Lambda as fallback) is **production-ready**. The Workers implementation handles:

1. **Authentication** - D1-based, no Cognito dependency
2. **Static assets** - R2-based, no S3 dependency  
3. **Health/monitoring** - Workers endpoint for uptime checks

The remaining 200+ routes on Lambda represent the full application logic. These can be:
- Gradually migrated as needed
- Keep Lambda as fallback (it's cost-effective for sporadic use)
- Pi cluster provides tertiary failover

**The deletion of CloudFront distribution completes the infrastructure layer cleanup.**
**Fly.io proxy provides HA failover for the Workers→Lambda→Pi chain.**