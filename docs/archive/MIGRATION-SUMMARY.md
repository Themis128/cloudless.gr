# Cloudless.gr → Cloudflare R2 Migration Summary

## Completed: S3-Backed Data Layer

### New Files

- `src/lib/r2-s3-client.ts` — Lambda-compatible S3 client pointed at R2 endpoint

### Migrated Files

- `src/lib/analytics.ts` — event sink → R2
- `src/lib/stripe-transactions.ts` — lake sink → R2  
- `src/lib/admin-notifications.ts` — notification archive → R2
- `.env.example` — added R2 credential documentation

### Already Compatible

- `src/lib/r2-upload.ts` — R2 endpoint factory (fixed import)

## Current Status

**Data Transfer (AWS S3 → R2):**

- 52/342 pvc-backups objects transferred (15%)
- 290 Glacier restores queued (3-5h)
- Monitor: `bash ~/Cloudshift/watch-migration.sh`

**Lambda Deployment Requirements:**

```env
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-key-id
R2_SECRET_ACCESS_KEY=your-secret
```

## Remaining (Separate Migration Paths)

1. **DynamoDB → D1:** user-profile.ts, session-token-store.ts, gsc-cache.ts, stripe-transactions core
2. **SSM → D1/env:** workspace-server.ts, pending-clients.ts
3. **SES/SNS → Cloudflare:** email-sender.ts (SES fallback), sns-notify.ts (SNS topic)
4. **11 cron routes:** No AWS S3 dependencies — safe to deploy as-is

## Architecture

```
Lambda Runtime
├── r2-s3-client.ts (S3 SDK → R2 endpoint)
├── analytics.ts (trackS3Event → R2)
├── stripe-transactions.ts (sinkStripeEventToLake → R2)
└── admin-notifications.ts (sinkToLake → R2)
```

All S3 writes now route through the R2 S3-compatible endpoint. Fallback chain: R2 Workers binding → R2 S3 API → AWS S3.
