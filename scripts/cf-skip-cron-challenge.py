#!/usr/bin/env python3
"""Unblock GitHub Actions cron callers from Cloudflare Bot Fight Mode.

Free Bot Fight Mode cannot be skipped via WAF custom rules. See:
  https://developers.cloudflare.com/bots/get-started/bot-fight-mode/#limitations

Tries zone setting bot_fight_mode=off. If the API rejects the setting
(dashboard-only on some Free plans), exits 0 with a warning.

Auth: CLOUDFLARE_API_TOKEN with Zone:Read + Zone Settings:Edit"""

import json
import os
import sys
import urllib.error
import urllib.request

DOMAIN = os.environ.get("DOMAIN", "cloudless.gr")
ZONE_ID = os.environ.get("CLOUDFLARE_ZONE_ID") or os.environ.get("CF_ZONE_ID", "")
TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
API = "https://api.cloudflare.com/client/v4"

if not TOKEN:
    print("::error::CLOUDFLARE_API_TOKEN is required (Zone:Read + Zone Settings:Edit)")
    sys.exit(1)


def cf(method: str, url: str, body=None) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
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


if not ZONE_ID:
    print(f"==> resolving zone for {DOMAIN}")
    zresp = cf("GET", f"{API}/zones?name={DOMAIN}")
    result = zresp.get("result") or []
    ZONE_ID = result[0]["id"] if result else ""
    if not ZONE_ID:
        print(f"::error::could not resolve zone id for {DOMAIN}")
        print(json.dumps(zresp))
        sys.exit(1)
print(f"==> zone: {ZONE_ID}")

SETTING_URL = f"{API}/zones/{ZONE_ID}/settings/bot_fight_mode"

print("==> GET bot_fight_mode")
cur = cf("GET", SETTING_URL)
print(f"    success: {cur.get('success')} value: {(cur.get('result') or {}).get('value')}")
if cur.get("errors"):
    print(f"    errors: {cur['errors']}")

print("==> PATCH bot_fight_mode=off")
resp = cf("PATCH", SETTING_URL, {"value": "off"})
if resp.get("success"):
    val = (resp.get("result") or {}).get("value")
    print(f"✓ bot_fight_mode={val}")
    sys.exit(0 if val == "off" else 1)

print("Cloudflare API error:", json.dumps(resp.get("errors"), indent=2), file=sys.stderr)
print(
    "::warning::API cannot toggle bot_fight_mode (often dashboard-only "
    "on Free). Disable manually: Dashboard → cloudless.gr → Security → "
    "Bots → Bot Fight Mode OFF",
    file=sys.stderr,
)

print("==> done — re-check cron path for Just a moment…")
