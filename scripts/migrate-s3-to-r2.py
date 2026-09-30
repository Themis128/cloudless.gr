#!/usr/bin/env python3
"""S3 to R2 migration — migrates cloudless.gr static assets and
analytics data to Cloudflare R2."""

import shutil
import subprocess
import tempfile
from pathlib import Path

S3_ASSETS = "cloudless-production-cloudlesssiteassetsbucket-sasvvhra"
S3_ANALYTICS = "cloudless-analytics-data"
R2_ASSETS = "cloudless-assets"
R2_DATALAKE = "datalake-bucket"

CONTENT_TYPES = {
    "css": "text/css",
    "js": "application/javascript",
    "json": "application/json",
    "html": "text/html",
    "svg": "image/svg+xml",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    "woff2": "font/woff2",
    "woff": "font/woff",
}

temp_dir = tempfile.mkdtemp()
print("🚀 Starting S3 to R2 migration...")


def sync(s3_bucket: str, r2_bucket: str, prefix: str) -> None:
    print(f"📥 Downloading from s3://{s3_bucket}/{prefix}...")
    dest = Path(temp_dir) / r2_bucket
    subprocess.run(
        [
            "aws",
            "s3",
            "sync",
            f"s3://{s3_bucket}/{prefix}",
            str(dest),
            "--exclude",
            "*",
            "--include",
            "*",
        ],
        capture_output=True,
    )

    files = [f for f in dest.rglob("*") if f.is_file()] if dest.is_dir() else []
    if not files:
        print(f"⚠️ No files found in s3://{s3_bucket}/{prefix}")
        return

    print(f"📤 Uploading to R2 bucket {r2_bucket}...")
    for f in files:
        key = str(f.relative_to(dest))
        ct = CONTENT_TYPES.get(key.rsplit(".", 1)[-1].lower(), "application/octet-stream")
        print(f"   Uploading: {key}")
        subprocess.run(
            [
                "npx",
                "wrangler",
                "r2",
                "object",
                "put",
                f"{r2_bucket}/{key}",
                "--file",
                str(f),
                "--content-type",
                ct,
                "--cache-control",
                "public, max-age=31536000, immutable",
                "--remote",
            ],
            capture_output=True,
        )
    print(f"✅ Synced {r2_bucket}")


print("=== Migrating Production Assets ===")
sync(S3_ASSETS, R2_ASSETS, "_assets/")

print("=== Migrating Analytics Data ===")
sync(S3_ANALYTICS, R2_DATALAKE, "events/")
sync(S3_ANALYTICS, R2_DATALAKE, "lake/")

print("=== Migrating Athena Results ===")
sync(S3_ANALYTICS, R2_DATALAKE, "athena-results/")

shutil.rmtree(temp_dir, ignore_errors=True)

print("""🎉 Migration complete!

Next steps:
1. Update cloudless.gr DNS to point to the Worker
2. Run: npx wrangler deploy
3. Test: curl https://cloudless.gr/_next/static/*""")
