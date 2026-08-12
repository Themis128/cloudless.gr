# Architecture Overview

## Request Flow

```
Visitor → Cloudflare DNS → Cloudflare Tunnel → k3s (Pi cluster)
                         → Cloudflare Workers → D1/R2/AI
```

## Directory Structure (Key Paths)

```
src/
├── app/                          # Next.js App Router pages
│   ├── [locale]/                 # i18n routes (en, el, fr)
│   │   ├── page.tsx              # Homepage
│   │   ├── services/             # Services & pricing
│   │   ├── blog/[slug]/          # Blog (Notion CMS)
│   │   ├── docs/[slug]/          # Docs (Notion CMS)
│   │   ├── store/                # E-commerce (Stripe)
│   │   ├── contact/              # Contact form
│   │   ├── auth/                 # Login/Signup/Forgot Password
│   │   ├── dashboard/            # Customer portal
│   │   └── admin/                # Admin panel
│   └── api/                      # API routes
│       ├── auth/                 # D1 authentication
│       ├── calendar/             # Google Calendar booking
│       ├── webhooks/stripe/      # Stripe fulfillment
│       ├── contact/              # Contact form handler
│       └── admin/                # Admin API endpoints
├── components/                   # Shared React components
├── context/                      # React context providers
│   ├── AuthContext.tsx           # D1 session auth
│   ├── CartContext.tsx           # In-memory cart
│   └── CookieConsentContext.tsx  # GDPR consent
├── lib/                          # Server utilities
│   ├── api-auth.ts               # requireAuth/requireAdmin
│   ├── auth-d1.ts                # D1 user/session helpers
│   ├── ssm-config.ts             # Secret loading (SSM/D1)
│   ├── integrations.ts           # isConfigured() guards
│   ├── email.ts                  # SES email sending
│   ├── stripe.ts                 # Stripe client
│   ├── notion*.ts                # Notion CMS helpers
│   ├── google-calendar.ts        # Calendar booking
│   ├── slack-*.ts                # Slack integration
│   ├── gsc.ts                    # Google Search Console
│   ├── i18n.ts                   # Translation utilities
│   └── format-price.ts           # Currency formatting
├── locales/                      # Translation files
│   ├── en.json                   # English (195 keys)
│   ├── el.json                   # Greek (195 keys)
│   └── fr.json                   # French (195 keys)
├── proxy.ts                      # Rate limiting + security headers
└── middleware.ts                 # Next.js middleware
```

## Authentication Flow

```
User → /auth/login → POST /api/auth/login → D1 verify PBKDF2 hash
     → Set session_token cookie → Redirect to /dashboard or /admin
```

- **Session:** Opaque `session_token` cookie (30d default, 60d with "remember me")
- **Admin:** D1 `roles` table → `groups: ["admin"]`
- **Protection:** `/dashboard/*` → redirect to login if unauthenticated; `/admin/*` → redirect to dashboard if not admin

## Data Flow Patterns

### Contact Form
```
Form → /api/contact → SES email (customer + team)
                    → Slack notification (fire-and-forget)
                    → EspoCRM upsert (fire-and-forget)
                    → Notion submission (fire-and-forget)
```

### Stripe Checkout
```
Store → Stripe Checkout → Webhook → Order confirmation email
                                   → Team notification (email + Slack)
                                   → Log to analytics
```

### Blog/Docs
```
Notion DB → /api/blog/posts → Cache (5min TTL) → Page render
          → Static fallback (lib/blog.ts) when Notion not configured
```

## Integration Degradation

All integrations are optional. Each API route checks `isConfigured()`:

| Integration | Not Configured → Behavior |
|------------|--------------------------|
| Slack | Skip silently |
| EspoCRM | Skip silently |
| Notion | Return static fallback data |
| Google Calendar | Return 503 "not available" |
| Sentry | Skip silently |

## Deployment Pipeline

```
Git push → GitHub Actions → OpenNext.js build → SST deploy → Cloudflare Workers
                                                           → R2 asset upload
                                                           → k3s rollout (Pi)
```

## Key Design Decisions

1. **Cloudflare-first:** All new development targets Cloudflare Workers/R2/D1 — AWS is legacy
2. **Self-hosted k3s:** Pi cluster for cost savings and control (11 services)
3. **No .env in prod:** Secrets via Wrangler secrets (Workers) or SSM (k3s)
4. **Optional integrations:** Every external service can be disabled without breaking the site
5. **i18n-first:** All UI strings in locale files (en/el/fr), server components use `getServerLocale()`
6. **Design system:** Cyberpunk × Quantum Devflow — void colors, neon accents, scanlines