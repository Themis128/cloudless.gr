# AWS → Cloudflare Migration Plan

## Overview
Migrate remaining AWS services to Cloudflare equivalents to complete the cloudless.gr migration.

---

## Current AWS Services in Use

### 1. SSM Parameters (Secrets Management)
**Current:** `/cloudless/production/*` parameters stored in AWS SSM SecureString

**Cloudflare Replacement:** Workers KV or D1 secrets via wrangler secret put

**Services affected:**
- `ADMIN_ALERT_SECRET` - For alert webhook authentication
- `POSTIZ_ADMIN_EMAIL/PASSWORD` - Postiz admin credentials
- `POSTIZ_API_KEY` - Postiz API key (if needed)
- OAuth tokens for ad platforms (Google, Meta, LinkedIn, TikTok, X)

### 2. Lambda Functions - TO BE MIGRATED

#### pi-proxy Lambda
- **Current purpose:** Tailscale → Pi failover proxy
- **Cloudflare replacement:** Workers + Tailscale Funnel or Cloudflare Tunnel
- **Migration path:** 
  - Create `/api/pi-proxy` Workers route that proxies to Pi via Tailscale IP
  - The pi-alert-api already runs on Pi - can be exposed via tunnel directly

#### SES-to-EspoCRM Lambda  
- **Current purpose:** Receive email from SES → Create EspoCRM contact/deal
- **Cloudflare replacement:** Email Routing + Email Service webhook
- **Migration path:**
  - Use Cloudflare Email Routing with custom email handler
  - Route inbound emails to `/api/inbound-email` Workers endpoint
  - Workers parses email and creates EspoCRM deal via API

---

## Migration Steps

### Phase 1: Secrets Migration

```bash
# List current SSM parameters
aws ssm describe-parameters --query 'Parameters[].Name' --output text

# Migrate each secret to Workers KV/D1
# Option A: Workers KV (simple key-value)
npx wrangler kv:key put --binding=SECRETS "<key>" "<value>"

# Option B: D1 secrets table (for structured secrets)
# Create migration to add secrets table
# npx wrangler d1 migrations apply user-auth-db --local --migration-folder migrations
```

### Phase 2: Lambda Migration

#### pi-proxy → Workers Proxy
- Current: Standalone Lambda function proxying Tailscale traffic
- Replace: Workers route at `/api/pi-proxy/*` that forwards to Pi Tailscale IP

#### SES-to-EspoCRM → Workers Email Handler
- Current: SES inbound → Lambda → EspoCRM API
- Replace: Cloudflare Email Routing → Workers `/api/inbound-email` → EspoCRM

### Phase 3: Email Configuration

```bash
# Verify Cloudflare Email service is set up
# DNS records needed:
# - MX record for cloudless.gr (points to Cloudflare Email)
# - SPF: v=spf1 include:_spf.mx.cloudflare.net ~all
# - DKIM: Provided by Cloudflare
# - DMARC: _dmarc TXT record
```

### Phase 4: Cleanup

```bash
# Remove AWS SDK from dependencies
npm uninstall aws-sdk

# Delete SSM parameters
aws ssm delete-parameters --names "/cloudless/production/ADMIN_ALERT_SECRET" ...

# Cancel Lambda functions
aws lambda delete-function --function-name pi-proxy
aws lambda delete-function --function-name SES-to-EspoCRM

# Remove AWS credentials from .env
# Remove from GitHub repo secrets if used
```

---

## Cloudflare Services to Use

| AWS Service | Cloudflare Replacement | Notes |
|-------------|---------------------|-------|
| SSM Parameter Store | Workers KV or D1 | KV for simple secrets, D1 for structured |
| Lambda (pi-proxy) | Workers | Proxy endpoint + Tailscale |
| Lambda (SES webhook) | Workers + Email Routing | Email service handles inbound |
| SES | Cloudflare Email Routing | Routes to Workers endpoint |
| S3 | R2 | Already migrated ✓ |
| DynamoDB | D1 | Already migrated ✓ |
| CloudFront | Cloudflare CDN | Already migrated ✓ |

---

## Implementation Order

1. **[HIGH]** Migrate ADMIN_ALERT_SECRET to Workers KV
2. **[HIGH]** Create Workers inbound email endpoint (`/api/inbound-email`)
3. **[MEDIUM]** Replace pi-proxy Lambda with Workers proxy route
4. **[MEDIUM]** Configure Cloudflare Email Routing + DNS
5. **[LOW]** Migrate remaining OAuth tokens
6. **[LOW]** Remove AWS SDK, cleanup SSM params

---

## Files to Create/Modify

- `src/app/api/pi-proxy/route.ts` - New Workers proxy endpoint
- `src/app/api/inbound-email/route.ts` - Email webhook handler  
- `migrations/0006-secrets-table.sql` - Optional: secrets table in D1
- Remove from `package.json`: `aws-sdk` dependency
- Remove from `.env`: AWS credential variables