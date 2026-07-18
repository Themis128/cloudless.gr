# Cloudflare Pages Deployment

This document describes the Cloudflare Pages deployment setup for cloudless.gr.

## Overview

Cloudflare Pages provides serverless deployment with:
- **Edge-side rendering (ESR)** - SSR at the edge without cold starts
- **Built-in D1 integration** - Database access in Pages Functions
- **R2 bucket access** - Direct static asset serving
- **Analytics Engine** - Built-in analytics integration
- **Workers AI** - AI model access without additional API calls

## Configuration Files

| File | Purpose |
|------|---------|
| `wrangler.pages.json` | Pages-specific Wrangler configuration |
| `.github/workflows/deploy-pages.yml` | CI/CD deployment pipeline |

## Required Secrets

Set these secrets in Cloudflare (via Wrangler or dashboard):

```bash
# Required for authentication
npx wrangler secret put SESSION_SECRET

# Optional - for enhanced chat
npx wrangler secret put ANTHROPIC_API_KEY

# Optional - for Stripe integration
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

## Deployment

### Automatic (Recommended)

Push to `main` branch triggers the GitHub Action:

```bash
git push origin main
```

### Manual

```bash
# Set your Cloudflare API token
export CLOUDFLARE_API_TOKEN=your_token_here

# Deploy to Pages
pnpm pages:deploy
```

### Development

```bash
# Local development with Pages runtime
pnpm pages:dev
# Opens at http://localhost:3000
```

## Architecture

Pages serves:
- **Static assets** - HTML, CSS, JS from `.vercel/output/static`
- **API routes** - Server-side rendered via Pages Functions
- **Edge middleware** - Request/response modifications

The D1 database (`user-auth-db`) provides:
- User authentication (email/password)
- Session management
- Admin notifications

## Migration Path

The application is being migrated from:
1. **AWS Amplify** (current) → **Cloudflare Workers** (intermediate) → **Cloudflare Pages** (target)

The migration maintains:
- Same D1 database (user-auth-db)
- Same R2 buckets (cloudless-assets, etc.)
- Same API endpoints

## Troubleshooting

### Build fails with "Cannot find module"

Ensure all dependencies are listed in `package.json`:
```bash
pnpm install
pnpm typecheck
```

### D1 binding errors

Verify the database exists and is linked:
```bash
npx wrangler d1 list
npx wrangler d1 info user-auth-db
```

### Pages functions not working

Check that `compatibility_flags` includes `nodejs_compat` in `wrangler.pages.json`.