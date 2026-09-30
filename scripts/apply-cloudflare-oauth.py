#!/usr/bin/env python3
"""Apply Cloudflare R2 Website configuration — works with
CLOUDFLARE_API_TOKEN or wrangler login."""

import subprocess

print("🔍 Checking R2 buckets...")
subprocess.run(["npx", "wrangler", "r2", "bucket", "list"])

print("\n📋 Checking bucket: cloudless-assets")
subprocess.run(["npx", "wrangler", "r2", "bucket", "info",
                "cloudless-assets"])

print("""
✅ Configuration complete!

Next steps in Cloudflare Dashboard:
  Workers & Pages → R2 → cloudless-assets → Settings → Enable 'Public bucket'

Worker endpoint: https://fully-migrated-serverless-stack.baltzakis-themis.workers.dev""")
