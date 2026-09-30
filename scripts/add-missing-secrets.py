#!/usr/bin/env python3
"""Add missing GitHub secrets required for the SST Cloudflare
deployment workflow — sets CRON_SECRET (known value) and prints
manual steps for CLOUDFLARE_API_TOKEN / CF_ACCOUNT_ID."""

import subprocess
import sys

CRON_SECRET = ("3a0761c6c112e74b0e9a9692f864eb071d3fe6638f"
               "b3e042a348d0d5ccd429c4")

print("🔐 Adding missing GitHub secrets for SST Cloudflare "
      "Infrastructure deployment")
print("=" * 72)

if subprocess.call(["gh", "auth", "status"],
                   stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL) != 0:
    sys.exit("❌ GitHub CLI not authenticated. Please run: "
             "gh auth login")

print("""
📋 Required Secrets to Add:
---------------------------
1. CLOUDFLARE_API_TOKEN - You need to create this at Cloudflare
2. CF_ACCOUNT_ID - Your Cloudflare account ID
3. CRON_SECRET - Ready to add (value known)
""")

print("🔍 Checking which secrets are missing...")
r = subprocess.run(
    ["gh", "secret", "list", "--repo",
     "Themis128/cloudless.gr", "--json", "name",
     "-t", ".[].name"], capture_output=True, text=True)
existing = set(r.stdout.split())


def check_and_add(name: str, value: str) -> None:
    if name in existing:
        print(f"✅ {name} already exists")
    elif value:
        print(f"🔐 Adding {name}...")
        subprocess.run(
            ["gh", "secret", "set", name, "--repo",
             "Themis128/cloudless.gr"],
            input=value, text=True)
    else:
        print(f"⚠️  {name} needs to be added manually "
              "(no value provided)")


check_and_add("CRON_SECRET", CRON_SECRET)

print("\n⚠️  Manual Action Required:")
print("---------------------------")

if "CLOUDFLARE_API_TOKEN" not in existing:
    print("""❌ CLOUDFLARE_API_TOKEN - MISSING

   To get this:
   1. Go to: https://dash.cloudflare.com/profile/api-tokens
   2. Click 'Create Token'
   3. Use 'Edit Cloudflare Workers' template or create custom with:
      - Account:Edit
      - Zone:Edit
      - D1:Edit
      - R2:Edit
      - Workers:Edit
   4. Copy the token and add it to GitHub:
      gh secret set CLOUDFLARE_API_TOKEN --repo Themis128/cloudless.gr <<< 'YOUR_TOKEN_HERE'""")
else:
    print("✅ CLOUDFLARE_API_TOKEN already exists")

if "CF_ACCOUNT_ID" not in existing:
    print("""❌ CF_ACCOUNT_ID - MISSING

   To get this:
   1. Go to: https://dash.cloudflare.com
   2. Look at the right sidebar - Account ID is displayed there
   3. Add it to GitHub:
      gh secret set CF_ACCOUNT_ID --repo Themis128/cloudless.gr <<< 'YOUR_ACCOUNT_ID_HERE'""")
else:
    print("✅ CF_ACCOUNT_ID already exists")

print("""
📝 After adding all secrets, verify with:
   gh secret list --repo Themis128/cloudless.gr

🚀 Then run deployment:
   gh workflow run .github/workflows/sst-infra-deploy.yml --repo Themis128/cloudless.gr""")
