# Full Lambda → Workers Migration Plan

## Current State

- **221 API route.ts files** total
- **Workers migrated:** auth, subscribe, unsubscribe, chat, cron, analytics (7 endpoints)
- **Lambda remaining:** ~214 routes still on AWS via SST

## Route Categories & Migration Complexity

### Tier 1: Core Business Logic (HIGH PRIORITY)

| Routes | Count | Complexity | Notes |
|--------|-------|------------|-------|
| `/api/contact` | 1 | Medium | SES → Email binding, Slack webhook |
| `/api/checkout` | 1 | High | Stripe SDK, needs secret management |
| `/api/webhooks/stripe` | 1 | High | Webhook signature verification, fulfillment |
| `/api/subscribe` | 1 | Low | Email binding |
| `/api/unsubscribe` | 1 | Low | Email binding |
| `/api/user/profile` | 1 | Low | D1 already configured |
| `/api/user/purchases` | 1 | Low | Stripe data |

### Tier 2: Cron Jobs (HIGHEST PRIORITY - Infrastructure)

| Route | Schedule | Complexity | Dependencies |
|-------|----------|------------|--------------|
| `/api/cron/analytics-rollup` | Daily 01:00 UTC | High | Notion API, Slack |
| `/api/cron/calendar-digest` | Weekdays 06:00 UTC | Medium | Google Calendar, content-calendar lib |
| `/api/cron/report-cleanup` | Sunday 02:00 UTC | Low | File cleanup |
| `/api/cron/voice-brief` | Monday 05:00 UTC | High | Notion, AI generation |
| `/api/cron/gsc-cache-refresh` | Hourly | Medium | Google Search Console |
| `/api/cron/postiz-sync` | Scheduled | Medium | Postiz API |
| `/api/cron/postiz-oauth-check` | Scheduled | Low | Postiz API |
| `/api/cron/ad-analytics-poll` | Scheduled | Medium | Ad platforms APIs |
| `/api/cron/client-reports` | Scheduled | High | Multiple integrations |
| `/api/cron/slack-digest` | Scheduled | Medium | Slack |
| `/api/cron/owner-digest` | Scheduled | Medium | Various APIs |

### Tier 3: Chat & AI (MEDIUM PRIORITY)

| Routes | Count | Notes |
|--------|-------|-------|
| `/api/chat` | 1 | Bedrock → Workers AI |
| `/api/chat-ai` | 1 | Workers AI |
| `/api/recommendations` | 1 | Bedrock + DynamoDB trending |
| `/api/internal/ai/*` | 1 | Workers AI |
| `/api/admin/ai/*` | 10+ | Workers AI, D1 storage |

### Tier 4: Content & CMS (MEDIUM PRIORITY)

| Routes | Count | Notes |
|--------|-------|-------|
| `/api/blog/*` | 2 | Notion API |
| `/api/docs/*` | 2 | Notion API |
| `/api/case-studies/*` | 2 | Notion API |
| `/api/notion-image` | 1 | R2 for caching |
| `/api/admin/notion/*` | 10+ | Notion API management |

### Tier 5: Admin & Analytics (LOW PRIORITY - Admin only)

| Routes | Count | Notes |
|--------|-------|-------|
| `/api/admin/analytics/*` | 15+ | GSC, DuckDB-wasm, D1 |
| `/api/admin/campaigns/*` | 10+ | Ad platform APIs |
| `/api/admin/crm/*` | 6 | EspoCRM/HubSpot APIs |
| `/api/admin/postiz/*` | 20+ | Postiz API |
| `/api/admin/reports/*` | 3 | PDF generation, D1 |
| `/api/admin/users` | 1 | Cognito → D1 |
| `/api/admin/subscriptions` | 1 | Stripe |

### Tier 6: Webhooks & Integrations (LOW PRIORITY)

| Routes | Count | Notes |
|--------|-------|-------|
| `/api/webhooks/*` | 8 | Various external services |
| `/api/slack/*` | 3 | Slack bot |
| `/api/newsletter-slack/*` | 3 | Slack |
| `/api/workflows/*` | 1 | n8n workflows |

## Migration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Cloudflare Workers (after migration)                            │
├─────────────────────────────────────────────────────────────────┤
│ Bindings needed:                                                  │
│ - D1: AUTH_DB (already)                                           │
│ - D1: ANALYTICS_DB (new) - GSC cache, stats, reports            │
│ - D1: NOTIFICATIONS_DB (new) - admin notifications             │
│ - R2: ASSETS_BUCKET (already)                                    │
│ - R2: MEDIA_BUCKET (already)                                      │
│ - R2: DATALAKE_BUCKET (already)                                  │
│ - R2: ANALYTICS_BUCKET (already)                                 │
│ - Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET               │
│ - Secrets: NOTION_API_KEY, HUBSPOT_API_KEY, etc.                  │
│ - AI: AI binding for Workers AI                                   │
│ - Email: EMAIL binding (already)                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Migration Steps

### Phase 1: Infrastructure (Week 1)

- [ ] Add missing D1 databases to wrangler.json
- [ ] Migrate DynamoDB tables to D1 schemas
- [ ] Add Workers AI binding
- [ ] Migrate secrets to Wrangler
- [ ] Create Workers Cron triggers

### Phase 2: Core Routes (Week 2-3)

- [ ] `/api/contact` - Email + Slack
- [ ] `/api/checkout` - Stripe
- [ ] `/api/webhooks/stripe` - Stripe webhook
- [ ] `/api/user/*` - User profile/purchases
- [ ] `/api/subscribe` - Email

### Phase 3: Cron Jobs (Week 2)

- [ ] Migrate all 11 cron handlers to Workers format
- [ ] Add Cron Triggers to wrangler.json
- [ ] Remove from sst.config.ts

### Phase 4: Chat & AI (Week 3-4)

- [ ] `/api/chat` - Workers AI
- [ ] `/api/chat-ai` - Workers AI
- [ ] `/api/recommendations` - AI + D1
- [ ] `/api/admin/ai/*` - AI endpoints

### Phase 5: Content & CMS (Week 4-5)

- [ ] `/api/blog/*` - Notion
- [ ] `/api/docs/*` - Notion
- [ ] `/api/admin/notion/*` - Notion management

### Phase 6: Admin & Analytics (Week 5-6)

- [ ] `/api/admin/analytics/*` - GSC, stats
- [ ] `/api/admin/campaigns/*` - Ad APIs
- [ ] `/api/admin/crm/*` - CRM
- [ ] `/api/admin/postiz/*` - Social

### Phase 7: Cleanup (Week 6)

- [ ] Remove SST infrastructure
- [ ] Remove DynamoDB tables
- [ ] Remove Cognito
- [ ] Update Fly.io proxy to Workers-only

## Key Technical Changes Required

### AWS SDK → Workers Bindings

- `@aws-sdk/client-dynamodb` → `env.DB.prepare()` (D1)
- `@aws-sdk/client-s3` → `env.BUCKET.get/put()` (R2)
- `@aws-sdk/client-ses` → `env.EMAIL.send()` (Email)
- `@aws-sdk/client-bedrock` → `env.AI.run()` (Workers AI)
- `@aws-sdk/client-cognito` → D1 queries

### Next.js API Route → Workers Handler

```typescript
// Before (Next.js)
export async function POST(request: NextRequest) {
  const body = await request.json();
  // ...
}

// After (Workers)
export default {
  async fetch(request, env, ctx) {
    if (request.method === "POST" && url.pathname === "/api/...") {
      const body = await request.json();
      // ...
    }
  }
}
```

### Cron Jobs Migration

```json
// Add to wrangler.json
{
  "triggers": {
    "crons": [
      "0 1 * * *",   // analytics-rollup daily
      "0 6 * * 1-5", // calendar-digest weekdays
      // etc.
    ]
  }
}
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss (DynamoDB migration) | High | Backup before migration |
| Auth downtime | High | Dual auth during transition |
| Slack/email notifications fail | Medium | Monitor + alert |
| Cron job failures | Medium | Test with dry-run first |
| API key exposure | High | Use Wrangler secrets properly |

## Estimated Effort

- **Total routes:** 221
- **Lines of code:** ~15,000-20,000
- **Developer time:** 6-8 weeks (1 dev)
