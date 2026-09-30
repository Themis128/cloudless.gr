#!/usr/bin/env python3
"""Harden Cloudflare Free-plan WAF / Security posture for cloudless.gr:
  - security_level = medium  (was essentially_off)
  - browser_check = on
  - email_obfuscation = off  (intentional — CF rewrite breaks React
    #418)

Bot Fight Mode is dashboard-only on Free (API setting undefined). Keep
it OFF so GHA can hit apex; cron workflows already use pi-origin.

Rulesets / Firewall Services require Zone → Firewall Services →
Read/Edit on the API token. This script reports that gap; it does not
mint tokens.

Usage:
  python3 scripts/cf-zone-waf-harden.py
  python3 scripts/cf-zone-waf-harden.py --check"""

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

HEADERS = {"Authorization": f"Bearer {TOKEN}",
           "Content-Type": "application/json"}


def cf(method: str, path: str, body: dict | None = None,
       tolerate: bool = False) -> dict:
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(body).encode() if body else None,
        method=method, headers=HEADERS)
    try:
        return json.loads(urllib.request.urlopen(req,
                                                 timeout=15).read())
    except Exception as e:
        if tolerate:
            return {"success": False, "errors": [{"message": str(e)}]}
        raise


def get(name: str) -> dict:
    return cf("GET", f"/zones/{ZONE_ID}/settings/{name}")


def patch(name: str, body: dict) -> dict:
    return cf("PATCH", f"/zones/{ZONE_ID}/settings/{name}", body)


def value(resp: dict):
    return (resp.get("result") or {}).get("value")


print(f"==> zone {DOMAIN} ({ZONE_ID})")

sec = value(get("security_level"))
bc = value(get("browser_check"))
eo = value(get("email_obfuscation"))
print(f"  security_level: {sec}")
print(f"  browser_check: {bc}")
print(f"  email_obfuscation: {eo}")

print("==> rulesets probe (needs Zone Firewall Services)")
rs = cf("GET", f"/zones/{ZONE_ID}/rulesets", tolerate=True)
if rs.get("success"):
    print(f"  rulesets: OK ({len(rs.get('result') or [])} entries)")
else:
    print(f"  rulesets: DENIED — {rs.get('errors') or []}")
    print("  → mint token with Zone → Firewall Services → Read "
          "(and Edit to manage rules)")
    print("  → see skills/cloudflare-token-doctor/SKILL.md Stage 1")

print("==> bot_fight_mode probe (Free: often undefined / "
      "dashboard-only)")
bf = cf("GET", f"/zones/{ZONE_ID}/settings/bot_fight_mode",
        tolerate=True)
if bf.get("success"):
    print(f"  bot_fight_mode: {value(bf)}")
else:
    print(f"  bot_fight_mode: not API-readable — {bf.get('errors')}")
    print("  → Dashboard → Security → Bots: leave Bot Fight Mode OFF "
          "(cron/GHA)")


def check() -> bool:
    ok = sec == "medium" and bc == "on" and eo == "off"
    print("✓ zone WAF posture OK" if ok else
          "✗ zone WAF posture DRIFT")
    return ok


if CHECK_ONLY:
    sys.exit(0 if check() else 1)

print("==> PATCH security_level=medium")
patch("security_level", {"value": "medium"})
print("==> PATCH browser_check=on")
patch("browser_check", {"value": "on"})
print("==> PATCH email_obfuscation=off")
patch("email_obfuscation", {"value": "off"})

print("==> verify")
sec = value(get("security_level"))
bc = value(get("browser_check"))
eo = value(get("email_obfuscation"))
sys.exit(0 if check() else 1)
