#!/usr/bin/env python3
"""Setup Cloudflare Email DNS records programmatically — MX, SPF,
DMARC for Email Routing.

Usage: DOMAIN=cloudless.gr \
    python3 scripts/setup-email-dns.py [dest-email]"""

import os
import shutil
import subprocess
import sys

DOMAIN = os.environ.get("DOMAIN", "cloudless.gr")
DEST_EMAIL = sys.argv[1] if len(sys.argv) > 1 else f"tbaltzakis@{DOMAIN}"

print(f"🔧 Setting up Cloudflare Email DNS records for {DOMAIN}...\n")

if not shutil.which("npx"):
    sys.exit("ERROR: Wrangler CLI not found. Install with: npm install -g wrangler")


def dns(*args: str) -> None:
    r = subprocess.run(["npx", "wrangler", "dns", *args], capture_output=True)
    if r.returncode != 0:
        print("   record may already exist")


print("[1/4] Setting MX records for Email Routing...")
# Cloudflare Email Routing requires ProtonMail MX records
dns(
    "create",
    "mx1.mail.protonmail.ch",
    "--type",
    "MX",
    "--name",
    DOMAIN,
    "--priority",
    "10",
    "--ttl",
    "3600",
)
dns(
    "create",
    "mx2.mail.protonmail.ch",
    "--type",
    "MX",
    "--name",
    DOMAIN,
    "--priority",
    "20",
    "--ttl",
    "3600",
)

print("\n[2/4] Setting SPF record...")
dns(
    "create",
    "v=spf1 include:cloudflare.net ~all",
    "--type",
    "TXT",
    "--name",
    DOMAIN,
    "--ttl",
    "3600",
)

print("\n[3/4] Setting DMARC record...")
dns(
    "create",
    f"v=DMARC1; p=none; rua=mailto:postmaster@{DOMAIN}",
    "--type",
    "TXT",
    "--name",
    f"_dmarc.{DOMAIN}",
    "--ttl",
    "3600",
)

print("\n[4/4] Checking current DNS records...")
subprocess.run(["npx", "wrangler", "dns", "list", "--domain", DOMAIN])

print(f"""
==========================================
✅ DNS Configuration Complete!
==========================================

Next: Configure Email Routing in Cloudflare Dashboard
1. Go to Cloudflare → Email → Routing
2. Add destination: {DEST_EMAIL}
3. Verify noreply@{DOMAIN}
4. Deploy worker: pnpm cf:deploy:free""")
