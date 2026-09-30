#!/usr/bin/env python3
"""Clear Cloudflare Worker routes conflict by deleting the old worker.

Resolves: "Can't deploy routes that are assigned to another worker" —
frees routes cloudless.gr / www.cloudless.gr, then deploys the
free-tier worker."""

import subprocess
import sys

print("=== Cloudflare Routes Cleanup ===")

print("Deleting old worker 'cloudless-gr' to free up routes...")
r = subprocess.run(
    ["npx", "wrangler", "delete", "cloudless-gr", "--force",
     "--config", "wrangler.jsonc"])
if r.returncode != 0:
    sys.exit(r.returncode)

print("✅ Old worker deleted, routes are now available")

print("Deploying cloudless-gr-free...")
r = subprocess.run(["pnpm", "cf:deploy:free"])
if r.returncode != 0:
    sys.exit(r.returncode)

print("=== Deployment Complete ===")
