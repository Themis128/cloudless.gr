#!/usr/bin/env python3
"""Email Routing destination-address ops for send_email workers.

The send_email binding requires each recipient to be a *verified*
Email Routing destination address (free-tier gate). This script does
the automatable 90%: resolves the zone, lists destination addresses,
creates missing ones, reports verified/pending state. The residual
human step is clicking the verification link in the mailbox.

Reads CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE (or zone name) from env —
never reads .env and never prints secret values.

Usage:
  CLOUDFLARE_API_TOKEN=... python email_routing_verify.py [--add ADDR ...]

Companions:
- The verification mail lands in the omv mailbox; the cu130-slim
  `mail-code-fetch` skill can poll for the link and POST it back so
  the whole gate becomes headless later.
- If *arbitrary* (non-verified) recipients still fail after your own
  address verifies, transactional mail stays on Resend/SMTP and
  mail-outbound serves ops/digest traffic only.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request

API = "https://api.cloudflare.com/client/v4"


def _req(token: str, method: str, path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"{API}{path}",
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        data=json.dumps(body).encode() if body else None,
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {
            "success": False,
            "errors": [{"code": e.code, "message": e.read()[:300].decode("utf-8", "replace")}],
        }


def main() -> int:
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    zone_name = os.environ.get("CLOUDFLARE_ZONE", "cloudless.gr").strip()
    addrs = [a for a in sys.argv[1:] if not a.startswith("--")]

    if not token:
        print("CLOUDFLARE_API_TOKEN not set — source the account env first.")
        return 2

    zones = _req(token, "GET", f"/zones?name={zone_name}")
    if not zones.get("success") or not zones.get("result"):
        print(f"Zone lookup failed: {zones.get('errors')}")
        print("Token needs Zone:Read on the zone — mint/fix in the CF dashboard.")
        return 1
    # Destination addresses are account-scoped, not zone-scoped —
    # /zones/{id}/email/routing/addresses 404s; use /accounts/{id}/...
    account_id = zones["result"][0].get("account", {}).get("id")
    if not account_id:
        print("Zone result missing account.id — cannot resolve account-level routing API.")
        return 1

    listed = _req(token, "GET", f"/accounts/{account_id}/email/routing/addresses")
    if not listed.get("success"):
        print(f"List destinations failed: {listed.get('errors')}")
        print(
            "Token lacks 'Email Routing:Edit/Read'. Dashboard path: "
            "cloudless.gr → Email → Email Routing → Destination addresses."
        )
        return 1

    have = {a["email"].lower(): a for a in listed.get("result", [])}
    print(f"zone {zone_name}: {len(have)} destination address(es)")
    for email, a in sorted(have.items()):
        print(f"  {email}: {'VERIFIED' if a.get('verified') else 'PENDING'}")

    for addr in addrs:
        email = addr.strip().lower()
        if email in have:
            continue
        res = _req(
            token, "POST", f"/accounts/{account_id}/email/routing/addresses", {"email": email}
        )
        ok = res.get("success")
        print(f"create {email}: {'OK — verification email sent' if ok else res.get('errors')}")
        if ok:
            print("  → click the verify link in the mailbox (or feed it via mail-code-fetch).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
