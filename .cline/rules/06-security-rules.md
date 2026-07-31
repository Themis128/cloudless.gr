# Security Rules

## Authentication & Authorization

- **Auth store:** Cloudflare D1 `user-auth-db` — users, sessions, roles, password hashes (PBKDF2)
- **Session:** Opaque `session_token` cookie (or Bearer header), resolved by `src/lib/api-auth.ts`
- **Default session:** 30 days; 60 days with "remember me"
- **Admin check:** Membership in D1 `roles` → projected as `groups: ["admin"]`
- **Route protection:** `src/proxy.ts` (before render) + layout guards
- **Password rules:** ≥8 chars with upper, lower, digit, and special character
- **Account lockout:** After 5 failed attempts in 15 minutes
- **Rate limiting:** Auth endpoints: max 10 attempts/minute. Centralized in `proxy.ts`.
- **CSRF protection:** Implemented via `csrf.ts` utility and migration 0004
- **Email verification:** Activation token + OTP via SES (`auth-activation.ts`)
- **Password reset:** Max 3 requests/hour

## API Security

- **CORS:** Restricted to `cloudless.gr` in production, localhost in dev
- **Security headers:** X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS with preload
- **Checkout validation:** Server-side product lookup by ID; client cannot set prices
- **Stripe webhooks:** Signature verification via `stripe.webhooks.constructEvent()`
- **Slack endpoints:** HMAC-SHA256 verification for events, commands, interactions
- **Rate limiting:** Centralized in `proxy.ts` (IP-based, per endpoint). Do NOT add per-route rate limiters.

## Secret Management

- **Production secrets:** Wrangler secrets (Workers) or environment variables (k3s)
- **Non-secret config:** D1 `app_config` table (migration 0007)
- **No .env files in production** — only in development
- **SSM fallback:** Available for legacy compatibility, disabled via `SSM_DISABLED=1`
- **Required secrets:** `SESSION_SECRET` (32+ bytes), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NOTION_API_KEY`, `SLACK_WEBHOOK_URL`

## Output Security

- **Email bodies:** HTML-escaped via `escapeHtml()` to prevent injection
- **API responses:** Never expose internal error details to clients
- **User data:** Never expose password hashes or session tokens in API responses

## Audit Logging

- **Admin audit log:** All admin actions logged to `admin_audit_log` table (migration 0005)
- **Session activity:** Login IPs/timestamps tracked
- **Retention:** Audit logs retained for 365 days (configurable)

## Infrastructure Security

- **Cloudflare Tunnel:** All traffic encrypted end-to-end; no public IPs for internal services
- **DDoS protection:** Built-in Cloudflare DDoS mitigation
- **WAF:** Web Application Firewall with OWASP rules
- **Bot management:** Protection against malicious bots
- **Zero-trust:** Service bindings communicate via private network