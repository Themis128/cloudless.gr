#!/usr/bin/env python3
"""Integration activation doctor — checks, sets, and live-verifies the
Cloudflare secrets/D1 config that gate the platform's integrations.

Usage:
  activate-integration.py status
      Show which activation keys exist in Cloudflare/D1 (values never printed).

  activate-integration.py set KEY VALUE
      Write one key to Cloudflare (Wrangler secret + D1 config) and
      immediately run the matching live verification.

  activate-integration.py verify [activecampaign|tiktok|x|postiz|slack]
      Live-verify one integration (or all when omitted) using the values
      already in Cloudflare/D1. Read-only against each provider.

Requirements: wrangler CLI with Cloudflare API token.
"""

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from cf_secrets import (cf_config_get, cf_config_set, cf_exists,  # noqa: E402
                        cf_secret_set, cf_verify_auth)

ALLOWED_KEYS = [
    "ACTIVECAMPAIGN_API_URL", "ACTIVECAMPAIGN_API_TOKEN",
    "ACTIVECAMPAIGN_LEAD_AUTOMATION_ID",
    "TIKTOK_ACCESS_TOKEN", "TIKTOK_ADVERTISER_ID",
    "X_AD_ACCOUNT_ID",
    "POSTIZ_API_URL", "POSTIZ_API_KEY",
    "CLOUDFLARE_API_TOKEN",
    "SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET", "SLACK_DEFAULT_CHANNEL",
]


def mark(key: str) -> None:
    print(f"  [{'set' if cf_exists(key) else 'MISSING':7s}] {key}")


def cmd_status() -> None:
    print("Activation keys in Cloudflare/D1:")
    print("ActiveCampaign:")
    for k in ("ACTIVECAMPAIGN_API_URL", "ACTIVECAMPAIGN_API_TOKEN",
              "ACTIVECAMPAIGN_LEAD_AUTOMATION_ID"):
        mark(k)
    print("TikTok Ads:")
    mark("TIKTOK_ACCESS_TOKEN")
    mark("TIKTOK_ADVERTISER_ID")
    print("X Ads:")
    mark("X_AD_ACCOUNT_ID")
    print("Postiz:")
    mark("POSTIZ_API_URL")
    mark("POSTIZ_API_KEY")
    print("Cloudflare:")
    mark("CLOUDFLARE_API_TOKEN")
    print("Slack:")
    for k in ("SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET",
              "SLACK_DEFAULT_CHANNEL"):
        mark(k)


def http_code(url: str, headers: dict) -> int:
    req = urllib.request.Request(url, headers=headers)
    try:
        return urllib.request.urlopen(req, timeout=15).status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def configured(*keys: str) -> bool:
    return all(cf_config_get(k) not in ("", "null") for k in keys)


def verify_activecampaign() -> int:
    url = cf_config_get("ACTIVECAMPAIGN_API_URL").rstrip("/")
    token = cf_config_get("ACTIVECAMPAIGN_API_TOKEN")
    if not configured("ACTIVECAMPAIGN_API_URL", "ACTIVECAMPAIGN_API_TOKEN"):
        print("activecampaign: not configured")
        return 1
    code = http_code(f"{url}/api/3/contacts?limit=1",
                     {"Api-Token": token})
    if code != 200:
        print(f"activecampaign: token rejected (HTTP {code})")
        return 1
    print("activecampaign: OK (API reachable, token valid)")
    automation_id = cf_config_get("ACTIVECAMPAIGN_LEAD_AUTOMATION_ID")
    if automation_id and automation_id != "null":
        acode = http_code(f"{url}/api/3/automations/{automation_id}",
                          {"Api-Token": token})
        if acode == 200:
            print(f"activecampaign: automation {automation_id} OK")
        else:
            print(f"activecampaign: automation {automation_id} "
                  f"returned HTTP {acode}")
            return 1
    else:
        print("activecampaign: LEAD_AUTOMATION_ID not set — follow-up "
              "sequences stay off")
    return 0


def verify_tiktok() -> int:
    token = cf_config_get("TIKTOK_ACCESS_TOKEN")
    adv = cf_config_get("TIKTOK_ADVERTISER_ID")
    if not configured("TIKTOK_ACCESS_TOKEN", "TIKTOK_ADVERTISER_ID"):
        print("tiktok: not configured")
        return 1
    req = urllib.request.Request(
        'https://business-api.tiktok.com/open_api/v1.3/advertiser/info/'
        f'?advertiser_ids=["{adv}"]',
        headers={"Access-Token": token})
    try:
        body = json.loads(urllib.request.urlopen(req, timeout=15).read())
    except Exception as e:
        print(f"tiktok: request failed ({e})")
        return 1
    if body.get("code") == 0:
        print(f"tiktok: OK (advertiser {adv} visible)")
        return 0
    print(f"tiktok: API code {body.get('code')} — token/advertiser "
          "mismatch")
    return 1


def verify_x() -> int:
    acct = cf_config_get("X_AD_ACCOUNT_ID")
    if not acct or acct == "null":
        print("x: X_AD_ACCOUNT_ID not configured")
        return 1
    print(f"x: X_AD_ACCOUNT_ID present ({acct}) — full OAuth1 "
          "verification runs in the app (admin → Campaigns → X)")
    return 0


def verify_postiz() -> int:
    url = cf_config_get("POSTIZ_API_URL").rstrip("/")
    key = cf_config_get("POSTIZ_API_KEY")
    if not configured("POSTIZ_API_URL", "POSTIZ_API_KEY"):
        print("postiz: not configured")
        return 1
    code = http_code(f"{url}/api/public/v1/integrations",
                     {"Authorization": key})
    if code == 200:
        print("postiz: OK (API reachable, key valid)")
        return 0
    print(f"postiz: HTTP {code}")
    return 1


def verify_slack() -> int:
    token = cf_config_get("SLACK_BOT_TOKEN")
    channel = cf_config_get("SLACK_DEFAULT_CHANNEL") or "#general"
    if not token or token == "null":
        print("slack: bot token not configured")
        return 1
    req = urllib.request.Request(
        "https://slack.com/api/chat.postMessage",
        data=json.dumps({"channel": channel,
                         "text": "Integration check from "
                                 "activate-integration.py ✅"}).encode(),
        headers={"Authorization": f"Bearer {token}",
                 "Content-Type": "application/json"}, method="POST")
    try:
        resp = json.loads(urllib.request.urlopen(req, timeout=15).read())
    except Exception as e:
        print(f"slack: request failed ({e})")
        return 1
    if resp.get("ok"):
        print(f"slack: OK (test message posted to {channel})")
        return 0
    print(f"slack: {resp.get('error')} — if not_in_channel, /invite "
          "the bot in Slack")
    return 1


VERIFIERS = {"activecampaign": verify_activecampaign,
             "tiktok": verify_tiktok, "x": verify_x,
             "postiz": verify_postiz, "slack": verify_slack}


def cmd_verify(target: str = "all") -> int:
    if target == "all":
        return int(any(v() for v in VERIFIERS.values()))
    if target not in VERIFIERS:
        print(f"Unknown target: {target}")
        sys.exit(2)
    return VERIFIERS[target]()


def cmd_set(key: str, value: str) -> int:
    if key not in ALLOWED_KEYS:
        print(f"Refusing to set '{key}' — not an activation key. "
              f"Allowed: {' '.join(ALLOWED_KEYS)}")
        sys.exit(2)
    if cf_verify_auth():
        sys.exit(1)
    print(f"Writing {key} to Cloudflare... ", end="", flush=True)
    print("ok (Wrangler)" if cf_secret_set(key, value) == 0
          else "Wrangler failed")
    print("ok (D1)" if cf_config_set(key, value) else "D1 failed")

    if key.startswith("ACTIVECAMPAIGN_"):
        return cmd_verify("activecampaign")
    if key.startswith("TIKTOK_"):
        return cmd_verify("tiktok")
    if key == "X_AD_ACCOUNT_ID":
        return cmd_verify("x")
    if key.startswith("POSTIZ_"):
        return cmd_verify("postiz")
    if key.startswith("SLACK_"):
        return cmd_verify("slack")
    return 0


cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
if cmd == "status":
    cmd_status()
elif cmd == "set":
    if len(sys.argv) < 4:
        print(f"Usage: {sys.argv[0]} set KEY VALUE")
        sys.exit(2)
    sys.exit(cmd_set(sys.argv[2], sys.argv[3]))
elif cmd == "verify":
    sys.exit(cmd_verify(sys.argv[2] if len(sys.argv) > 2 else "all"))
else:
    print(f"Usage: {sys.argv[0]} "
          "{status|set KEY VALUE|verify [target]}")
    sys.exit(2)
