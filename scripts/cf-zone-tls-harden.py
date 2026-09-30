#!/usr/bin/env python3
"""Harden Cloudflare zone TLS for cloudless.gr:
  - min_tls_version = 1.2
  - Always Use HTTPS (idempotent)
  - Zone HSTS: max-age=63072000; includeSubDomains; preload; nosniff

Auth: CLOUDFLARE_API_TOKEN with Zone Settings:Edit on cloudless.gr
Usage:
  python3 scripts/cf-zone-tls-harden.py
  python3 scripts/cf-zone-tls-harden.py --check   # report only"""

import json
import os
import sys
import urllib.error
import urllib.request

DOMAIN = os.environ.get("DOMAIN", "cloudless.gr")
ZONE_ID = os.environ.get("CLOUDFLARE_ZONE_ID") or \
    os.environ.get("CF_ZONE_ID") or \
    "7025298073d6a5c645a6ad9add0cbf0e"
TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
API = "https://api.cloudflare.com/client/v4"
CHECK_ONLY = "--check" in sys.argv[1:]

if not TOKEN:
    sys.exit("error: CLOUDFLARE_API_TOKEN is required "
             "(Zone Settings:Edit)")


def cf_get(path: str) -> dict:
    req = urllib.request.Request(
        f"{API}{path}",
        headers={"Authorization": f"Bearer {TOKEN}"})
    return json.loads(urllib.request.urlopen(req, timeout=15).read())


def cf_patch(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{API}{path}", data=json.dumps(body).encode(), method="PATCH",
        headers={"Authorization": f"Bearer {TOKEN}",
                 "Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=15).read())


def setting(name: str) -> dict:
    return cf_get(f"/zones/{ZONE_ID}/settings/{name}")


def value(resp: dict, default=None):
    return (resp.get("result") or {}).get("value", default)


print(f"==> zone {DOMAIN} ({ZONE_ID})")

min_tls = value(setting("min_tls_version"))
hsts = value(setting("security_header"), {}) or {}
sts = hsts.get("strict_transport_security") or {}
https = value(setting("always_use_https"))

print(f"  min_tls_version: {min_tls}")
print(f"  always_use_https: {https}")
print(f"  hsts.enabled: {sts.get('enabled')}")
print(f"  hsts.max_age: {sts.get('max_age')}")
print(f"  hsts.include_subdomains: {sts.get('include_subdomains')}")
print(f"  hsts.preload: {sts.get('preload')}")
print(f"  hsts.nosniff: {sts.get('nosniff')}")

EXPECTED_STS = {"enabled": True, "max_age": 63072000,
                "include_subdomains": True, "preload": True,
                "nosniff": True}

def check() -> bool:
    ok = (min_tls == "1.2" and https == "on"
          and all(sts.get(k) == v for k, v in EXPECTED_STS.items()))
    print("✓ zone TLS posture OK" if ok else
          "✗ zone TLS posture DRIFT")
    return ok


if CHECK_ONLY:
    sys.exit(0 if check() else 1)

print("==> PATCH min_tls_version=1.2")
cf_patch(f"/zones/{ZONE_ID}/settings/min_tls_version", {"value": "1.2"})
print("==> PATCH always_use_https=on")
cf_patch(f"/zones/{ZONE_ID}/settings/always_use_https",
         {"value": "on"})
print("==> PATCH security_header HSTS (63072000, includeSubDomains, "
      "preload, nosniff)")
cf_patch(f"/zones/{ZONE_ID}/settings/security_header",
         {"value": {"strict_transport_security": EXPECTED_STS}})

print("==> verify")
min_tls = value(setting("min_tls_version"))
sts = (value(setting("security_header"), {}) or {}
       ).get("strict_transport_security") or {}
https = value(setting("always_use_https"))
sys.exit(0 if check() else 1)
