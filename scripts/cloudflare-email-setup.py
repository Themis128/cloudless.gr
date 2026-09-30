#!/usr/bin/env python3
"""Cloudflare Email Routing setup — configures MX, SPF, DMARC records
and a routing destination address.

Usage:
  CLOUDFLARE_API_TOKEN=… python3 scripts/cloudflare-email-setup.py \
      [dest-email]
  DOMAIN=cloudless.gr (env)"""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

DOMAIN = os.environ.get("DOMAIN", "cloudless.gr")
DEST_EMAIL = sys.argv[1] if len(sys.argv) > 1 else f"tbaltzakis@{DOMAIN}"

token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
if not token:
    proc = subprocess.run(
        ["gh", "secret", "view", "CLOUDFLARE_API_TOKEN"], capture_output=True, text=True
    )
    if proc.returncode == 0:
        token = proc.stdout.strip()
if not token:
    sys.exit(
        "ERROR: CLOUDFLARE_API_TOKEN not found\nSet it with: export CLOUDFLARE_API_TOKEN=your_token"
    )

API = "https://api.cloudflare.com/client/v4"


def cf(method: str, path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(body).encode() if body else None,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        return json.loads(urllib.request.urlopen(req, timeout=15).read())
    except urllib.error.HTTPError as e:
        return {"success": False, "errors": [{"message": e.read()[:300].decode(errors="replace")}]}
    except Exception as e:
        return {"success": False, "errors": [{"message": str(e)}]}


print(f"🔍 Finding zone for {DOMAIN}...")
zone = cf("GET", f"/zones?name={DOMAIN}")
zones = zone.get("result") or []
if not zones:
    sys.exit(f"ERROR: Zone {DOMAIN} not found")
zone_id = zones[0]["id"]
account_id = zones[0]["account"]["id"]
print(f"✓ Zone ID: {zone_id}")
print(f"✓ Account ID: {account_id}")


def record_exists(rtype: str, name: str) -> bool:
    r = cf("GET", f"/zones/{zone_id}/dns_records?type={rtype}&name={name}")
    return bool(r.get("result"))


def add_record(rtype: str, name: str, content: str, priority: int | None = None) -> None:
    if record_exists(rtype, name):
        print(f"✓ {rtype} already exists: {name}")
        return
    data = {"type": rtype, "name": name, "content": content, "ttl": 3600, "proxied": False}
    if priority is not None:
        data["priority"] = priority
    r = cf("POST", f"/zones/{zone_id}/dns_records", data)
    if r.get("success"):
        print(f"✓ Added {rtype} record: {name}")
    else:
        print(f"   Note: {rtype} record may have issues: {name} — {r.get('errors')}")


print("\n[1/4] Setting MX records...")
add_record("MX", DOMAIN, "mx1.mail.protonmail.ch", 10)
add_record("MX", DOMAIN, "mx2.mail.protonmail.ch", 20)

print("\n[2/4] Setting SPF record...")
add_record("TXT", DOMAIN, "v=spf1 include:cloudflare.net ~all")

print("\n[3/4] Setting DMARC...")
add_record("TXT", f"_dmarc.{DOMAIN}", f"v=DMARC1; p=none; rua=mailto:postmaster@{DOMAIN}")

print("\n[4/4] Setting up routing destination...")
r = cf("POST", f"/accounts/{account_id}/email/routing/addresses", {"email": DEST_EMAIL})
print(
    f"✓ Destination added: {DEST_EMAIL}"
    if r.get("success")
    else f"   Destination may already exist: {DEST_EMAIL}"
)

print("""
==========================================
✅ Setup complete!
==========================================

Check your email ({DEST_EMAIL}) for verification link.
Then deploy: pnpm cf:deploy:free""")
