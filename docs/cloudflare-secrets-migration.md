# Cloudflare Workers Secrets Migration Guide

## Overview
Replace AWS SSM with Cloudflare Workers secrets via wrangler.

---

## Current Architecture
- Production: Reads from `/cloudless/production/*` in SSM
- Dev/Test: Reads from process.env directly
- Already has `SSM_DISABLED=1` mode for k3s Pi deployment

---

## Migration Path

### Option A: Workers Secrets (wrangler)
For each secret, run:
```bash
# Example for ADMIN_ALERT_SECRET
npx wrangler secret put ADMIN_ALERT_SECRET

# For SES configuration
npx wrangler secret put SES_FROM_EMAIL
npx wrangler secret put SES_TO_EMAIL
```

### Option B: Workers KV (for bulk secrets)
Create a KV namespace for configuration:
```bash
# Create KV namespace
npx wrangler kv:namespace create "SECRETS"

# Add each secret
npx wrangler kv:key put --binding=SECRETS "ADMIN_ALERT_SECRET" "generated-token"
npx wrangler kv:key put --binding=SECRETS "SLACK_WEBHOOK_URL" "https://hooks.slack.com/..."
```

---

## Required Changes

### 1. Update ssm-config.ts for Cloudflare-native mode
Replace SSM client with Workers-specific fetching:
- Use `process.env.SECRET_NAME` in Workers environment
- Secrets are bound at deploy time via wrangler

### 2. Update wrangler.jsonc
Add secret bindings:
```json
{
  "secrets": {
    "ADMIN_ALERT_SECRET": {},
    "SLACK_WEBHOOK_URL": {}
  }
}
```

### 3. Environment Variables for Pi (SSM_DISABLED=1)
When deploying to k3s, inject secrets via Kubernetes:
```yaml
env:
  - name: ADMIN_ALERT_SECRET
    valueFrom:
      secretKeyRef:
        name: cloudless-secrets
        key: ADMIN_ALERT_SECRET
```

---

## Secrets to Migrate

| Source | Target | Notes |
|--------|--------|-------|
| SSM `/cloudless/production/ADMIN_ALERT_SECRET` | `ADMIN_ALERT_SECRET` (Workers secret) | High priority |
| SSM `/cloudless/production/SES_*` | `SES_FROM_EMAIL`, `SES_TO_EMAIL` | For email routing |
| SSM `/cloudless/production/SLACK_*` | `SLACK_WEBHOOK_URL` (Workers secret) | Already has fallback |
| SSM `/cloudless/production/STRIPE_*` | `STRIPE_SECRET_KEY` (Workers secret) | Already configured |
| SSM `/cloudless/production/POSTIZ_*` | `POSTIZ_API_KEY` (Workers secret) | Social scheduler |
| SSM `/cloudless/production/ESPOCRM_*` | `ESPOCRM_API_KEY` (Workers secret) | CRM integration |

---

## Deployment Steps

1. **Add secrets to Workers**
   ```bash
   for secret in ADMIN_ALERT_SECRET SES_FROM_EMAIL SES_TO_EMAIL; do
     npx wrangler secret put $secret
   done
   ```

2. **Update the config loader**
   Modify `src/lib/ssm-config.ts` to:
   - Check `process.env.CF_WORKERS` first
   - Fall back to `buildConfigFromEnv()` (already exists)

3. **Deploy to k3s with env vars**
   Set `SSM_DISABLED=1` in the Kubernetes deployment
   Inject all needed secrets as environment variables

4. **Verify both environments**
   - Workers: Test via `curl https://cloudless.gr/api/health`
   - k3s: Test via `curl http://192.168.1.128:30800/api/health`

---

## Testing

```bash
# Test Workers deployment
curl -I https://cloudless.gr/api/health

# Test k3s deployment  
curl -I http://192.168.1.128:30800/api/health

# Verify config loading
curl https://cloudless.gr/api/debug/config  # if endpoint exists