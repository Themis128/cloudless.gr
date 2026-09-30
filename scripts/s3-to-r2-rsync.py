#!/usr/bin/env python3
"""S3 to R2 migration (rsync-style): download S3 assets to a local
temp dir, then upload to R2 with a 500ms rate limit to avoid 429s."""

import subprocess
import tempfile
import time
from pathlib import Path

S3_BUCKET = "cloudless-production-cloudlesssiteassetsbucket-sasvvhra"
S3_PREFIX = "_assets/_next/static/"
R2_BUCKET = "cloudless-assets"

CONTENT_TYPES = {
    "css": "text/css", "js": "application/javascript",
    "json": "application/json", "html": "text/html",
    "svg": "image/svg+xml", "png": "image/png",
    "jpg": "image/jpeg", "jpeg": "image/jpeg",
    "gif": "image/gif", "webp": "image/webp",
    "woff2": "font/woff2", "woff": "font/woff",
}

temp_dir = Path(tempfile.mkdtemp())
assets = temp_dir / "assets"

print("🚀 Starting S3 to R2 migration (rsync-style)...\n")
print("=== Step 1: Downloading from S3 ===")
subprocess.run(
    ["aws", "s3", "sync", f"s3://{S3_BUCKET}/{S3_PREFIX}",
     str(assets), "--exclude", "*", "--include", "*"],
    capture_output=True)

files = [f for f in assets.rglob("*") if f.is_file()] \
    if assets.is_dir() else []
print(f"   Downloaded {len(files)} files\n")

print("=== Step 2: Uploading to R2 ===")
migrated = 0
for f in files:
    key = str(f.relative_to(assets))
    ct = CONTENT_TYPES.get(key.rsplit(".", 1)[-1].lower(),
                           "application/octet-stream")
    print(f"   Uploading: {key}")
    subprocess.run(
        ["npx", "wrangler", "r2", "object", "put",
         f"{R2_BUCKET}/{key}", "--file", str(f),
         "--content-type", ct, "--cache-control",
         "public, max-age=31536000, immutable", "--remote"],
        capture_output=True)
    migrated += 1
    time.sleep(0.5)  # rate limit: 500ms to avoid 429 errors

print(f"\n   Migrated {migrated} files")

import shutil
shutil.rmtree(temp_dir, ignore_errors=True)

print("""
🎉 Migration complete!
   Next steps:
   1. Verify: curl https://cloudless.gr/_next/static/chunks/*.js
   2. Deploy: npx wrangler deploy --config wrangler-cloudflare-free.json""")
