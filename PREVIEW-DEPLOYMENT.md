# Preview Deployments for Pull Requests

This document describes how to set up and use preview deployments for Cloudflare Workers.

## Overview

The preview workflow (`/.github/workflows/preview.yml`) deploys every PR to a shared preview environment (`cloudless-gr-preview`). This approach is:

- ✅ **Simple** - One preview environment for all PRs
- ✅ **Fast** - No create/destroy overhead
- ✅ **Cost-effective** - Single set of preview resources

## One-time Setup

Run the setup script to create preview bindings:

```bash
# Install dependencies
pnpm install

# Create preview resources
./scripts/setup-preview.sh
```

This creates:
- **D1 Database**: `auth-db-preview`
- **R2 Buckets**: `cloudless-assets-preview`, `cloudless-analytics-preview`, `datalake-bucket-preview`, `app-media-bucket-preview`
- **Analytics Engine Dataset**: `cloudless_analytics_preview` (auto-created on first write)

### Required Secrets

Set these secrets for the preview worker. These can be configured in the Cloudflare dashboard or via CLI:

```bash
npx wrangler secret put SESSION_SECRET --name cloudless-gr-preview
npx wrangler secret put ANTHROPIC_API_KEY --name cloudless-gr-preview
npx wrangler secret put STRIPE_WEBHOOK_SECRET --name cloudless-gr-preview
```

### Apply Schema

Apply the auth database schema to the preview database:

```bash
npx wrangler d1 execute auth-db-preview --file=schema.sql --remote
```

## How It Works

1. **PR opened/synchronized** → `.github/workflows/preview.yml` triggers
2. **Build** → Next.js static export is generated (`pnpm cf:build`)
3. **Upload** → Static assets uploaded to `cloudless-assets-preview` R2 bucket
4. **Deploy** → Worker deployed to `cloudless-gr-preview`
5. **Comment** → Preview URL posted as a sticky comment on the PR

## Preview URL Format

```
https://cloudless-gr-preview.{account-subdomain}.workers.dev
```

## Configuration Files

| File | Purpose |
|------|---------|
| `wrangler.preview.jsonc` | Preview worker configuration with all bindings |
| `.github/workflows/preview.yml` | GitHub Actions workflow for PR deployments |
| `scripts/setup-preview.sh` | One-time setup script for preview resources |

## Differences from Production

| Aspect | Preview | Production |
|--------|---------|------------|
| Domain | `*.workers.dev` | `cloudless.gr` |
| D1 DB | `auth-db-preview` | `user-auth-db` |
| R2 Buckets | `-preview` suffix | Production buckets |
| Analytics | Separate dataset | Shared dataset |
| Secrets | Must be set manually | Set via dashboard/CLI |

## Troubleshooting

### "D1 database not configured"

The preview D1 database ID must be set. Run `npx wrangler d1 list` to find the ID and update `wrangler.preview.jsonc` if needed.

### "Assets not loading"

Check that static assets were uploaded to the preview R2 bucket:
```bash
npx wrangler r2 object list cloudless-assets-preview
```

### "Secrets not found"

Verify secrets are set:
```bash
npx wrangler secret list --name cloudless-gr-preview