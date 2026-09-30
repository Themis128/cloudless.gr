#!/usr/bin/env python3
"""Deploy the cloudless2 pi-origin-proxy worker to Cloudflare.

Two paths, in order of preference:
  1. Direct wrangler deploy (needs CLOUDFLARE_API_TOKEN in env or
     ~/.wrangler)
  2. Fall back to pushing the wrangler.jsonc bump to main, which
     triggers .github/workflows/cloudflare-deploy.yml

The proxy worker itself needs NO Wrangler secrets — every real app
secret is consumed by the Next.js app on the Pi k3s cluster at runtime.
Do not push them into the proxy."""

import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
os.chdir(REPO_ROOT)
CONFIG = Path("workers/pi-origin-proxy/wrangler.jsonc")

print("== cloudless2 deploy ==")
print(f"config: {CONFIG}")
if not CONFIG.is_file():
    print(f"!! {CONFIG} not found — aborting", file=sys.stderr)
    sys.exit(2)

# --- Path 1: direct wrangler deploy ---
if shutil.which("npx"):
    has_token = (
        os.environ.get("CLOUDFLARE_API_TOKEN")
        or os.environ.get("CF_API_TOKEN")
        or (Path.home() / ".wrangler/config/default.toml").is_file()
    )
    if has_token:
        print("\n-> attempting direct wrangler deploy (Path 1)")
        r = subprocess.run(
            ["npx", "--yes", "wrangler@4", "deploy", "--config", str(CONFIG), "--minify"]
        )
        if r.returncode == 0:
            print("\nOK  direct deploy succeeded.")
            print("    verify: curl -sI https://cloudless.gr | grep -i x-served-by")
            sys.exit(0)
        print("!! direct wrangler deploy failed — falling back to GH Actions push")
    else:
        print("-- no CLOUDFLARE_API_TOKEN in env and no ~/.wrangler config; skipping Path 1")

# --- Path 2: push config bump so GH Actions deploys ---
print("\n-> Path 2: pushing config bump to main to trigger cloudflare-deploy.yml")

if not shutil.which("git"):
    print(
        "!! git not found — install git or run wrangler directly with CLOUDFLARE_API_TOKEN set",
        file=sys.stderr,
    )
    sys.exit(2)

chk = subprocess.run(["git", "status", "--porcelain", str(CONFIG)], capture_output=True, text=True)
if chk.stdout.strip():
    subprocess.run(["git", "add", str(CONFIG)], check=True)
    subprocess.run(
        [
            "git",
            "commit",
            "-m",
            "chore(cloudless2): bump wrangler compat date to trigger proxy redeploy",
        ],
        check=True,
    )
    subprocess.run(["git", "push", "origin", "HEAD:main"], check=True)
    print("OK  pushed to main — cloudflare-deploy.yml will run in ~30s.")
    print("    watch:  gh run watch --repo Themis128/cloudless.gr")
    print("    verify: curl -sI https://cloudless.gr | grep -i x-served-by")
    sys.exit(0)

print("-- no local changes to wrangler.jsonc (compat date already committed)")
if shutil.which("gh"):
    print("-> gh workflow run cloudflare-deploy.yml")
    r = subprocess.run(["gh", "workflow", "run", "cloudflare-deploy.yml", "--ref", "main"])
    if r.returncode == 0:
        print("OK  workflow dispatched — watch with: gh run watch")
        sys.exit(0)
    sys.exit(r.returncode)

print(
    "!! gh CLI not installed — install it or trigger the workflow from the GitHub UI:",
    file=sys.stderr,
)
print(
    "   https://github.com/Themis128/cloudless.gr/actions/workflows/cloudflare-deploy.yml",
    file=sys.stderr,
)
sys.exit(3)
