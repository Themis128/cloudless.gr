#!/usr/bin/env python3
"""Setup script for preview environment resources — run once to
create all preview bindings before PRs can be deployed."""

import subprocess

print("=== Setting up Cloudflare preview environment ===")


def wrangler(*args: str, note: str = "") -> None:
    r = subprocess.run(["npx", "wrangler", *args], capture_output=True)
    if r.returncode != 0 and note:
        print(note)


print("Creating preview D1 database...")
wrangler("d1", "create", "auth-db-preview", note="Database may already exist, continuing...")

print("Creating preview R2 buckets...")
for bucket in (
    "cloudless-assets-preview",
    "cloudless-analytics-preview",
    "datalake-bucket-preview",
    "app-media-bucket-preview",
):
    wrangler(
        "r2", "bucket", "create", bucket, note=f"Bucket {bucket} may already exist, continuing..."
    )

print("Analytics Engine dataset will be auto-created on first write...")

print("""
=== Manual steps required ===
Set these secrets for the preview worker:
  npx wrangler secret put SESSION_SECRET --name cloudless-gr-preview
  npx wrangler secret put ANTHROPIC_API_KEY --name cloudless-gr-preview
  npx wrangler secret put STRIPE_WEBHOOK_SECRET --name cloudless-gr-preview

Apply the auth schema to the preview database:
  npx wrangler d1 execute auth-db-preview --file=schema.sql --remote""")
