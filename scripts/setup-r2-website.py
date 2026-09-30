#!/usr/bin/env python3
"""Setup R2 bucket for website hosting — uploads ./out to
cloudless-assets. Requires CLOUDFLARE_API_TOKEN."""

import os
import subprocess
import sys
from pathlib import Path

if not os.environ.get("CLOUDFLARE_API_TOKEN"):
    sys.exit("❌ Error: CLOUDFLARE_API_TOKEN not set\n"
             "Set it with: export "
             "CLOUDFLARE_API_TOKEN='your-token'")

BUCKET = "cloudless-assets"
DIST_DIR = Path("./out")

print(f"🔍 Checking R2 bucket: {BUCKET}")
subprocess.run(["npx", "wrangler", "r2", "bucket", "list"])

print(f"\n📋 Listing objects in {BUCKET} (first 10):")
subprocess.run(["npx", "wrangler", "r2", "object", "list",
                BUCKET, "--limit", "10"])

print(f"\n📤 Uploading files from {DIST_DIR} to {BUCKET}...")
if DIST_DIR.is_dir():
    for f in sorted(DIST_DIR.rglob("*")):
        if not f.is_file():
            continue
        key = str(f.relative_to(DIST_DIR))
        print(f"  Uploading: {key}")
        subprocess.run(
            ["npx", "wrangler", "r2", "object", "put",
             f"{BUCKET}/{key}", f"--file={f}"],
            capture_output=True)
else:
    print(f"⚠️  Directory {DIST_DIR} not found")

print(f"""
✅ Setup complete!

Next steps:
1. Go to https://dash.cloudflare.com → Workers & Pages → R2 → {BUCKET}
2. Enable 'Public bucket' for r2.dev access, OR
3. Add custom domain under 'Custom domains' tab

Worker endpoint: https://fully-migrated-serverless-stack.baltzakis-themis.workers.dev""")
