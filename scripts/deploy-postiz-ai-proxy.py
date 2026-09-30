#!/usr/bin/env python3
"""Deploy the postiz-ai-proxy Cloudflare Worker and wire its secrets.

Usage:
  NVIDIA_API_KEY=nvapi-... PROXY_TOKEN=<random> \
      python3 scripts/deploy-postiz-ai-proxy.py

PROXY_TOKEN is what you store in the postiz-providers k8s secret as
POSTIZ_AI_PROXY_TOKEN. Generate one with: openssl rand -hex 32"""

import os
import subprocess
import sys

WRANGLER_CONFIG = "workers/postiz-ai-proxy/wrangler.jsonc"

nvidia_key = os.environ.get("NVIDIA_API_KEY", "")
proxy_token = os.environ.get("PROXY_TOKEN", "")
if not nvidia_key:
    sys.exit("ERROR: NVIDIA_API_KEY is not set")
if not proxy_token:
    sys.exit("ERROR: PROXY_TOKEN is not set")

print("→ Setting Worker secrets…")
for name, value in (("NVIDIA_API_KEY", nvidia_key), ("PROXY_TOKEN", proxy_token)):
    r = subprocess.run(
        ["pnpm", "wrangler", "secret", "put", name, "--config", WRANGLER_CONFIG],
        input=value,
        text=True,
    )
    if r.returncode != 0:
        sys.exit(r.returncode)

print("→ Deploying Worker…")
dep = subprocess.run(["pnpm", "wrangler", "deploy", "--config", WRANGLER_CONFIG])
if dep.returncode != 0:
    sys.exit(dep.returncode)

print("""
✓ Worker deployed at: https://postiz-ai-proxy.cloudless.workers.dev

Next: add POSTIZ_AI_PROXY_TOKEN to the postiz-providers k8s secret:
  kubectl -n postiz create secret generic postiz-providers \\
    --from-literal=POSTIZ_AI_PROXY_TOKEN='$PROXY_TOKEN' \\
    --from-literal=POSTIZ_API_KEY=<existing> \\
    ... (other OAuth keys) \\
    --dry-run=client -o yaml | kubectl apply -f -

Then restart Postiz:
  kubectl -n postiz rollout restart deploy/postiz""")
