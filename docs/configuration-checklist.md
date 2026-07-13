# Configuration Checklist — What Is Left To Be Done

> **Last verified:** 2026-07-13 (Cloudflare token smoke-test run #29219613233)

## 🔴 Cloudflare Token Rotation (REQUIRED)

### Current Status
- Token exists and is valid
- **Missing scope:** `User API Tokens:Edit`
- Passes: Zone:Read, DNS:Read, Analytics:Read, Workers:Read
- Fails: User API Tokens:Read (cannot list tokens)

### Required Token Permissions
| Scope | Resource | Permission |
|-------|----------|------------|
| Account | User API Tokens | **Edit** |
| Account | Account Settings | Read |
| Account | Workers Scripts | Read |
| Zone | Zone | Read |
| Zone | Analytics | Read |
| Zone | Zone Settings | Edit |
| Zone | DNS | Edit |
| Zone | Load Balancing: Monitors and Pools | Edit |
| Zone | Load Balancing: Load Balancers | Edit |

### After Minting
```bash
# Store token + apply HA LB in one step:
gh workflow run store-cloudflare-token.yml -f cloudflare_token=<token> -f apply=true

# Or just store (verify first):
gh workflow run store-cloudflare-token.yml -f cloudflare_token=<token> -f apply=false
gh workflow run cloudflare-lb.yml -f mode=report
```

### Unlocks
- HA Load Balancer setup
- Email obfuscation fix
- Infra MCP tools (`mcp__cloudless-infra__cloudflare_*`)

---

## Operator-Only Blockers (UI Required)

### 1. Sentry Webhook Secret
**URL:** https://sentry.io/settings/themis128/projects/cloudless-gr/integrations/

Steps:
1. Create Internal Integration
2. Subscribe to: `issue` events
3. Webhook URL: `https://cloudless.gr/api/webhooks/sentry`
4. Copy Client Secret
5. Run:
   ```bash
   aws ssm put-parameter \
     --name /cloudless/production/SENTRY_WEBHOOK_SECRET \
     --type SecureString \
     --value <secret> \
     --overwrite
   ```

### 2. Kuma Status Page
**URL:** https://kuma.cloudless.gr

Steps:
1. Status Pages → New → slug: `cloudless`
2. Add 12 monitors:
   - cloudless.gr/api/health
   - Each self-hosted app health endpoint
   - Each Pi node
   - Stripe/Cognito surface checks
3. Wire to ntfy + Slack channels (Settings → Notifications)

### 3. ESP32 Notion Page Restore
**URL:** https://www.notion.so/ (ESP32 hub page)

Steps:
1. Open ESP32 Notion page
2. Click ••• → Page history
3. Restore to: **2026-06-02 15:19 UTC**

---

## Cloudflare Workers Required Secrets

Run after deployment to omv-main:

```bash
# Generate secure secrets:
SESSION_SECRET=$(openssl rand -hex 32)
AUTH_SECRET=$(openssl rand -hex 32)

# Set in Workers:
echo "$SESSION_SECRET" | npx wrangler secret put SESSION_SECRET
echo "$STRIPE_SECRET_KEY" | npx wrangler secret put STRIPE_SECRET_KEY
echo "$STRIPE_WEBHOOK_SECRET" | npx wrangler secret put STRIPE_WEBHOOK_SECRET
echo "$AUTH_SECRET" | npx wrangler secret put AUTH_SECRET
```

**Required secrets:**
- `SESSION_SECRET` - Password hashing (D1 auth), 32+ bytes
- `STRIPE_SECRET_KEY` - Checkout API calls
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification
- `AUTH_SECRET` - next-auth session encryption

---

## Pi k3s Cluster SSM Configuration

### EspoCRM API Keys
```bash
# EspoCRM is live - API user 'cloudless-app' exists (ID: 6a36ef141808ed737)
# Keys need to be added to SSM:
aws ssm put-parameter \
  --name /cloudless/production/ESPOCRM_BASE_URL \
  --type SecureString \
  --value "https://espocrm.cloudless.gr" \
  --overwrite

aws ssm put-parameter \
  --name /cloudless/production/ESPOCRM_API_KEY \
  --type SecureString \
  --value "<api-key-from-app-user>" \
  --overwrite
```

### Meilisearch (Already Configured)
- Live at: `https://meili.cloudless.gr`
- Keys in SSM: `MEILI_HOST`, `MEILI_MASTER_KEY`, `MEILI_SEARCH_KEY`

### Grafana Tunnel + DNS (Partial)
- Values stored: `GRAFANA_BASE_URL`, `PROMETHEUS_URL`
- Pending: Tunnel ingress rules + DNS CNAME

```bash
# Append to /etc/cloudflared/config.yml on omv-main:
# - hostname: grafana.cloudless.gr
#   service: http://kube-prom-stack-grafana.monitoring.svc.cluster.local:80
# Then restart cloudflared
```

---

## Verification Commands

```bash
# Check Cloudflare token status:
gh workflow run verify-cloudflare-token.yml

# Check Workers secrets:
npx wrangler secret list

# Check SSM parameters (from Pi or AWS CLI):
aws ssm get-parameters-by-path --path /cloudless/production --with-decryption

# Check health endpoints:
curl -s https://cloudless.gr/api/health
curl -s https://meili.cloudless.gr/health
```

---

## Priority Order

1. **Cloudflare token** (unlocks 3 other items)
2. **Sentry webhook** (for error alerts)
3. **EspoCRM keys** (for CRM operations)
4. **Kuma status page** (for monitoring)
5. **Workers secrets** (for D1 auth)
6. **ESP32 Notion restore** (content restoration)