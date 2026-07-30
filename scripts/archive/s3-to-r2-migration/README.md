# Archived: one-off AWS S3 → Cloudflare R2 migration scripts

These were used during the initial lake cutover. They are **not** part of the
active ETL path (`scripts/etl/*-to-r2.mjs`).

They still reference `@aws-sdk/client-s3` to read from the legacy AWS bucket.
That package was removed from the app in PR-13. To re-run a migration locally:

```bash
pnpm add -D @aws-sdk/client-s3
node scripts/archive/s3-to-r2-migration/s3-to-r2-complete.mjs
```

Prefer the Cloudflare dashboard / Wrangler for any remaining object copies.
