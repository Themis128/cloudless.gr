#!/usr/bin/env python3
"""Save all secrets from environment to Cloudflare Workers secrets
(bulk).

Usage: CLOUDFLARE_API_TOKEN=... \
    python3 scripts/save-secrets-to-cloudflare.py

Reads all secrets from os.environ and sets them via wrangler. Also
prints a Kubernetes secret manifest (for k3s with SSM_DISABLED=1)."""

import os
import shutil
import subprocess
import sys

ALL_SECRETS = [
    "SESSION_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "SLACK_WEBHOOK_URL",
    "SLACK_BOT_TOKEN",
    "SLACK_SIGNING_SECRET",
    "POSTIZ_API_KEY",
    "ADMIN_ALERT_SECRET",
    "ESPOCRM_API_KEY",
    "ESPOCRM_BASE_URL",
    "ANTHROPIC_API_KEY",
    "ACTIVECAMPAIGN_API_TOKEN",
    "NOTION_API_KEY",
]

GH_SECRETS = [
    "SESSION_SECRET",
    "STRIPE_SECRET_KEY",
    "POSTIZ_API_KEY",
    "ADMIN_ALERT_SECRET",
    "ANTHROPIC_API_KEY",
]

print("🔐 Cloudflare Workers Secrets Bulk Setup")
print("=========================================")

if not shutil.which("wrangler") and not shutil.which("npx"):
    sys.exit("❌ wrangler not found\nInstall with: npm install -g wrangler")

with_values = [s for s in ALL_SECRETS if os.environ.get(s)]

print(f"\n📋 Found {len(with_values)} secrets in environment:")
for s in with_values:
    print(f"  - {s}")
print()

if not with_values:
    sys.exit("❌ No secrets found in environment\n\nLoad your .env file first.")

try:
    reply = input(f"Set these {len(with_values)} secrets to Cloudflare Workers? (y/N) ")
except EOFError:
    reply = "n"
if reply.strip().lower() != "y":
    print("Aborted.")
    sys.exit(0)

print("💾 Setting secrets...\n")
success = fail = 0
for secret in with_values:
    print(f"  {secret}... ", end="", flush=True)
    r = subprocess.run(
        ["npx", "wrangler", "secret", "put", secret],
        input=os.environ[secret],
        text=True,
        capture_output=True,
    )
    if r.returncode == 0:
        print("✓")
        success += 1
    else:
        print("✗ (already exists or error)")
        fail += 1

print(f"\nSummary: {success} set, {fail} skipped/errors\n")

print("📋 Kubernetes secret manifest (for k3s with SSM_DISABLED=1):")
print("--- save as k3s/cloudless-secrets.yaml ---")
print("apiVersion: v1\nkind: Secret\nmetadata:")
print("  name: cloudless-secrets\n  namespace: cloudless")
print("type: Opaque\nstringData:")
for s in with_values:
    print(f'  {s}: "{os.environ[s]}"')
print("---\n")

print("📋 GitHub Actions repo secrets (run after gh auth login):")
for s in GH_SECRETS:
    if os.environ.get(s):
        print(f"gh secret set {s} --repo Themis128/cloudless.gr")
print()

print("✅ Done. Secrets available to both Workers and k3s.")
