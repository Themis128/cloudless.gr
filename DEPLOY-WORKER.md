# Worker Deployment Commands

Quick reference for deploying cloudless.gr to Cloudflare Workers.

## Prerequisites

Before deploying, ensure you have:

1. **Cloudflare API Token** set in environment:

   ```bash
   export CLOUDFLARE_API_TOKEN=your_token_here
   ```

2. **Required secrets** configured in Wrangler:

   ```bash
   # Auth secrets
   npx wrangler secret put SESSION_SECRET

   # Cron authorization
   npx wrangler secret put CRON_SECRET

   # Agent RPC authorization
   npx wrangler secret put AGENT_AUTH_TOKEN

   # Optional (for chat features)
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler secret put SLACK_WEBHOOK_URL
   ```

## Quick Deploy (Application Only)

```bash
# Build Next.js and deploy Worker
pnpm cf:build   # Build Next.js
pnpm cf:deploy  # Deploy Worker to Cloudflare
```

## Full Deploy (Infrastructure + Application)

```bash
# Deploys SST infrastructure, builds and deploys Worker
pnpm deploy     # Runs SST infra deploy + cf:build + cf:deploy
```

## Verification

```bash
# Check current Worker status
npx wrangler whoami
npx wrangler deployments list

# Verify endpoints after deployment
curl https://cloudless.gr/api/health
curl https://cloudless.gr/api/auth/session
```

## Static Assets to R2

```bash
# Upload static assets to R2 for edge caching
pnpm cf:r2:upload-static
```

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | ✅ | Session cookie signing (32+ bytes) |
| `CRON_SECRET` | ✅ | Cron job authorization token |
| `AGENT_AUTH_TOKEN` | ✅ | Agent RPC authorization |
| `SLACK_WEBHOOK_URL` | ⚪ | Slack notifications |
| `ANTHROPIC_API_KEY` | ⚪ | Workers AI chat fallback |

## 📚 Related Documentation

- **SST-CLOUDFLARE-HYBRID-ARCHITECTURE.md** - Full architecture documentation
- **ACTIONS-REQUIRED.md** - Current pending tasks
