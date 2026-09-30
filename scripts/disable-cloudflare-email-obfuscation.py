#!/usr/bin/env python3
"""Disable Cloudflare "Email Obfuscation" (Scrape Shield) on the
cloudless.gr zone.

WHY: Email Obfuscation rewrites email addresses in the HTML at the edge —
AFTER Next.js SSR — turning `contact@cloudless.gr` into an obfuscated
`<a class="__cf_email__">` placeholder plus an injected decode script.
React then hydrates SSR markup (plain email) against the edge-rewritten
DOM → text mismatch → React error #418 on /en. The strict CSP also
blocks the injected decode script.

Auth: CLOUDFLARE_API_TOKEN env (Zone:Read + Zone Settings:Edit).
Idempotent: if already "off", reports success and changes nothing."""

import json
import os
import sys
import urllib.error
import urllib.request

DOMAIN = os.environ.get("DOMAIN", "cloudless.gr")
API = "https://api.cloudflare.com/client/v4"

CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
if not CF_TOKEN:
    print(f"::error::no CLOUDFLARE_API_TOKEN — add a GitHub repository "
          f"secret with Zone:Read + Zone Settings:Edit on {DOMAIN}.")
    sys.exit(1)


def cf(method: str, url: str, body=None) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {CF_TOKEN}",
                 "Content-Type": "application/json"}, method=method)
    try:
        return json.loads(urllib.request.urlopen(req, timeout=30).read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"success": False, "errors": [{"message": str(e)}]}
    except Exception as e:
        return {"success": False, "errors": [{"message": str(e)}]}


print(f"==> resolving zone for {DOMAIN}")
zresp = cf("GET", f"{API}/zones?name={DOMAIN}")
if not zresp.get("success"):
    print(json.dumps(zresp))
    print("::error::zone lookup failed (token missing Zone:Read?)")
    sys.exit(1)
result = zresp.get("result") or []
ZONE_ID = result[0]["id"] if result else ""
if not ZONE_ID:
    print(f"::error::could not resolve zone id for {DOMAIN}")
    sys.exit(1)
print(f"    zone: {ZONE_ID}")

print("==> current email_obfuscation setting")
cur = cf("GET", f"{API}/zones/{ZONE_ID}/settings/email_obfuscation")
cur_val = (cur.get("result") or {}).get("value", "unknown")
print(f"    value: {cur_val}")

if cur_val == "off":
    print("==> already off — nothing to do")
    sys.exit(0)

print("==> disabling email_obfuscation")
resp = cf("PATCH",
          f"{API}/zones/{ZONE_ID}/settings/email_obfuscation",
          {"value": "off"})
if not resp.get("success"):
    print(json.dumps(resp))
    print("::error::PATCH failed — token likely missing 'Zone Settings: "
          "Edit' scope. Add it to the Cloudflare token (Zone → Zone "
          f"Settings → Edit, zone {DOMAIN}).")
    sys.exit(1)

new_val = (resp.get("result") or {}).get("value")
print(f"==> email_obfuscation is now: {new_val}")
if new_val != "off":
    print(f"::error::expected off, got {new_val}")
    sys.exit(1)
print("==> done. The __cf_email__ rewrite that caused React #418 on /en "
      "is disabled.")
