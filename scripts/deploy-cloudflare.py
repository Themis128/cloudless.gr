#!/usr/bin/env python3
"""Deploy to Cloudflare Workers with full migration:
build Next.js → upload assets to R2 → deploy Worker with routes."""

import subprocess
import sys

print("=== Cloudflare Workers Deployment ===")

steps = [
    ("Building Next.js...", ["pnpm", "cf:build"]),
    ("Uploading assets to R2...", ["pnpm", "cf:r2:upload-dir"]),
    ("Deploying Worker...", ["pnpm", "cf:deploy"]),
]
for msg, cmd in steps:
    print(msg)
    r = subprocess.run(cmd)
    if r.returncode != 0:
        sys.exit(r.returncode)

print("=== Deployment Complete ===")
print("Your app is now at https://cloudless.gr")
