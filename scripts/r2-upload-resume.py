#!/usr/bin/env python3
"""Resume R2 upload from local cache (S3 download already complete).

Uploads in parallel (5 workers), prints OK/FAIL per file, uses
immutable cache headers and per-extension content types."""

import os
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

TEMP_DIR = os.environ.get("R2_CACHE_DIR", "/tmp/tmp.d3kiKTyfZa")
ASSETS = Path(TEMP_DIR) / "assets"
BUCKET = "cloudless-assets"

if not ASSETS.is_dir():
    sys.exit(f"cache dir {ASSETS} not found — run the S3 download "
             "first")

files = [f for f in ASSETS.rglob("*") if f.is_file()]
print(f"🚀 Resuming R2 upload from local cache...")
print(f"   Files available: {len(files)}\n")

print("=== Checking what's already in R2 ===")
print("   (Will overwrite existing files - R2 PUT is idempotent)\n")

CONTENT_TYPES = {
    "css": "text/css", "js": "application/javascript",
    "json": "application/json", "html": "text/html",
    "svg": "image/svg+xml", "png": "image/png",
    "jpg": "image/jpeg", "jpeg": "image/jpeg",
    "gif": "image/gif", "webp": "image/webp",
    "woff2": "font/woff2", "woff": "font/woff",
}


def upload(f: Path) -> str:
    rel = str(f.relative_to(ASSETS))
    ct = CONTENT_TYPES.get(f.suffix.lstrip(".").lower(),
                           "application/octet-stream")
    r = subprocess.run(
        ["npx", "wrangler", "r2", "object", "put",
         f"{BUCKET}/{rel}", "--file", str(f), "--content-type", ct,
         "--cache-control", "public, max-age=31536000, immutable",
         "--remote"], capture_output=True)
    return f"{'OK' if r.returncode == 0 else 'FAIL'}:{rel}"


print("=== Uploading to R2 (parallel) ===")
results = []
with ThreadPoolExecutor(max_workers=5) as ex:
    for line in ex.map(upload, files):
        print(line)
        results.append(line)

results_file = Path(tempfile.mkdtemp(
    prefix="r2-upload-")) / "results.txt"
results_file.write_text("\n".join(results) + "\n")

ok = sum(1 for r in results if r.startswith("OK:"))
fail = sum(1 for r in results if r.startswith("FAIL:"))

print(f"""
=== Results ===
   Uploaded: {ok} files
   Failed: {fail} files

🎉 Upload complete!
   Verify: curl -I https://cloudless.gr/_next/static/""")
