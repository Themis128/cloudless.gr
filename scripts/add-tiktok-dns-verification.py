#!/usr/bin/env python3
"""Add TikTok site-verification DNS TXT record to the cloudless.gr zone.

TikTok's verification bot checks for either:
  <meta name="tiktok-developers-site-verification" content="TOKEN">
  OR a DNS TXT record: tiktok-developers-site-verification=TOKEN

We use the TXT record because Cloudflare Bot Management may challenge
TikTok's HTTP crawler before it can read the meta tag.

Auth: CLOUDFLARE_API_TOKEN env (Zone:Read + Zone:DNS:Edit).
Idempotent: exact-match → skip; prefix-match with old token → PUT update;
none → create."""

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

DOMAIN = os.environ.get("DOMAIN", "cloudless.gr")
TOK = os.environ.get("TIKTOK_VERIFICATION_TOKEN", "")
if not TOK:
    print("::error::TIKTOK_VERIFICATION_TOKEN is required.")
    sys.exit(1)
TXT_VALUE = f"tiktok-developers-site-verification={TOK}"
PREFIX = "tiktok-developers-site-verification="
API = "https://api.cloudflare.com/client/v4"

CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
if not CF_TOKEN:
    print(
        "::error::no CLOUDFLARE_API_TOKEN — add a GitHub repository "
        "secret with Zone:Read + Zone:DNS:Edit."
    )
    sys.exit(1)


def cf(method: str, url: str, body=None) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {CF_TOKEN}", "Content-Type": "application/json"},
        method=method,
    )
    try:
        return json.loads(urllib.request.urlopen(req, timeout=30).read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"success": False, "errors": [{"message": str(e)}]}
    except Exception as e:
        return {"success": False, "errors": [{"message": str(e)}]}


print(f"→ Looking up zone ID for {DOMAIN}…")
zresp = cf("GET", f"{API}/zones?name={DOMAIN}&status=active")
result = zresp.get("result") or []
ZONE_ID = result[0]["id"] if result else ""
if not ZONE_ID:
    print(f"::error::zone not found for {DOMAIN} — check token permissions.")
    sys.exit(1)
print(f"  zone_id={ZONE_ID}")

print("→ Checking for existing TikTok verification TXT record…")
records = (
    cf("GET", f"{API}/zones/{ZONE_ID}/dns_records?type=TXT&name={DOMAIN}&per_page=100").get(
        "result"
    )
    or []
)

exact = next((r["id"] for r in records if r.get("content") == TXT_VALUE), "")
if exact:
    print(f"✓ TXT record already exists with this token (id={exact}) — nothing to do.")
    sys.exit(0)

old = next((r for r in records if (r.get("content") or "").startswith(PREFIX)), None)

if old:
    print(f"→ Found existing TikTok verification record with different token (id={old['id']})")
    print(f"  old value: {old.get('content')}")
    print(f"  new value: {TXT_VALUE}")
    print("→ Updating TXT record…")
    resp = cf(
        "PUT",
        f"{API}/zones/{ZONE_ID}/dns_records/{old['id']}",
        {"type": "TXT", "name": DOMAIN, "content": TXT_VALUE, "ttl": 300},
    )
    if resp.get("success"):
        print(f"✓ TXT record updated (id={old['id']})")
    else:
        print(f"::error::failed to update DNS record: {json.dumps(resp)}")
        sys.exit(1)
else:
    print("→ No existing TikTok verification TXT record found — creating new one.")
    print(f"→ Creating TXT record: {TXT_VALUE}")
    resp = cf(
        "POST",
        f"{API}/zones/{ZONE_ID}/dns_records",
        {"type": "TXT", "name": DOMAIN, "content": TXT_VALUE, "ttl": 300},
    )
    if resp.get("success"):
        print(f"✓ TXT record created (id={(resp.get('result') or {}).get('id')})")
    else:
        print(f"::error::failed to create DNS record: {json.dumps(resp)}")
        sys.exit(1)

print("→ Verifying record is live (may take up to 60s)…")
for i in range(1, 13):
    out = subprocess.run(
        ["dig", "+short", "TXT", DOMAIN, "@1.1.1.1"], capture_output=True, text=True
    ).stdout
    if TXT_VALUE in out:
        print(f"✓ TXT record visible via 1.1.1.1 (attempt {i})")
        sys.exit(0)
    print(f"  … not visible yet (attempt {i}), waiting 5s…")
    time.sleep(5)
print(
    "::warning::record created but not yet visible via DNS — may "
    "take a few more seconds to propagate."
)
