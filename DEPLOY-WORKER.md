# Worker Deployment Commands

Run these commands after setting your Cloudflare API token:

```bash
# 1. Set environment
export CLOUDFLARE_API_TOKEN=your_token_here
export AWS_PROFILE=default

# 2. Verify build is ready (already done)
ls -la out/

# 3. Check current Worker status
npx wrangler whoami

# 4. Deploy to Cloudflare Workers (Free Tier)
pnpm cf:deploy:free

# 5. Verify deployment
curl https://cloudless.gr/api/health
curl https://cloudless.gr/api/auth/session

# 6. Upload static assets to R2
pnpm cf:r2:upload-static
```

## Environment Variables Required

Before deploying, ensure these secrets are set in Wrangler:

```bash
# Required for auth
npx wrangler secret put SESSION_SECRET --env=production

# Required for chat
npx wrangler secret put ANTHROPIC_API_KEY --env=production

# Optional but recommended
npx wrangler secret put STRIPE_SECRET_KEY --env=production
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env=production
npx wrangler secret put SLACK_WEBHOOK_URL --env=production