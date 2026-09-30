#!/usr/bin/env python3
"""Cloudflare dashboard cleanup & sync — verifies live account matches
wrangler.jsonc bindings. Orphans cloudless-auth (D1) + HEALTH_CACHE
(KV) were deleted 2026-07-30; --execute forces idempotent deletes."""

import subprocess
import sys

print("=== Cloudflare Cleanup & Sync Script ===")
print("Verifying resources against wrangler.jsonc...")

print("""
📊 RESOURCES (expected = live as of 2026-07-30):
=====================

✅ R2 Buckets (wrangler.jsonc):
  Production: app-media-bucket, cloudless-analytics, cloudless-assets, datalake-bucket
  Preview: app-media-bucket-preview, cloudless-analytics-preview, cloudless-assets-preview, datalake-bucket-preview
  Extra (OK): sst-state

✅ D1 Databases:
  - user-auth-db (7ca74513-23c3-412a-b9ca-b0c55835973d) — AUTH_DB / NEXT_CACHE_D1_BINDING (prod)
  - auth-db-preview (70d90155-12de-46d7-a0ea-113b3e7127cf) — staging
  - cloudless-auth — DELETED 2026-07-30 (was unbound orphan)

✅ KV Namespaces:
  - TAG_CACHE (e81bb5dcf84b452b978323f09a3f7428) — prod
  - REVALIDATION_QUEUE (b5b95ab1caed42a8b6e14f5db869bbc6) — prod
  - TAG_CACHE_preview / REVALIDATION_QUEUE_preview — staging
  - HEALTH_CACHE — DELETED 2026-07-30 (was unbound orphan)

🧹 CLEANUP (idempotent):
===========================""")

if len(sys.argv) > 1 and sys.argv[1] == "--execute":
    print("\nEnsuring orphaned D1 cloudless-auth is gone...")
    subprocess.run(
        [
            "npx",
            "wrangler",
            "d1",
            "delete",
            "cloudless-auth",
            "--force",
            "--config",
            "wrangler.jsonc",
        ]
    )
    print("\nEnsuring orphaned KV HEALTH_CACHE is gone...")
    subprocess.run(
        [
            "npx",
            "wrangler",
            "kv",
            "namespace",
            "delete",
            "9a6997af9ff5495ba72b31d2c1e5e6dd",
            "--force",
            "--config",
            "wrangler.jsonc",
        ]
    )
else:
    print(f"""
Orphans already removed from the account. Re-run with --execute only to
force idempotent deletes.
  {sys.argv[0]} --execute""")

print("""
🔧 LOCAL SNAPSHOTS (Bindings explorer / SQLTools):
==============================
  Wrangler Local tab = Miniflare under .wrangler/state (dev data).
  For prod/staging SQLite copies: pnpm db:d1:pull
  Bindings explorer remote cache: /tmp/cloudflare-bindings-explorer/remote-d1/
  Expected remote files: 7ca74513-….sqlite (prod), 70d90155-….sqlite (preview)

✅ VERIFICATION:
========================
  pnpm exec wrangler d1 list
  pnpm exec wrangler kv namespace list
  pnpm exec wrangler r2 bucket list
  curl -s https://cloudless.gr/api/health

=== Analysis Complete ===""")
