#!/usr/bin/env python3
"""Probe the current CLOUDFLARE_API_TOKEN's permission groups and print
exactly what's missing for CI worker deploys — plus the half of the
manual step that IS automatable (`gh secret set`).

Needed for `wrangler deploy` in cloudflare-deploy.yml:
  Account → Workers Scripts → Edit  (the documented blocker, API 10000)
Already present (verified by live deploys): Workers KV / D1 edits etc.

Usage:
  CLOUDFLARE_API_TOKEN=... python deploy_token_probe.py [owner/repo]
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.request

NEEDED = {"Workers Scripts:Edit", "Account Cloudflare Workers Scripts:Edit"}


def main() -> int:
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    repo = sys.argv[1] if len(sys.argv) > 1 else "Themis128/cloudless.gr"
    if not token:
        print("CLOUDFLARE_API_TOKEN not set — source the account env first.")
        return 2

    req = urllib.request.Request(
        "https://api.cloudflare.com/client/v4/user/tokens/verify",
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"verify failed: HTTP {e.code} — token invalid or expired?")
        return 1

    if not data.get("success"):
        print(f"token verify failed: {data.get('errors')}")
        return 1

    res = data["result"]
    print(f"token status: {res.get('status')}  expires: {res.get('expires_on') or 'never'}")
    flat = {
        g.get("name") for pol in res.get("policies", []) for g in pol.get("permission_groups", [])
    }
    print(f"permission groups ({len(flat)}):")
    for g in sorted(flat):
        print(f"  - {g}")

    hit = NEEDED & flat
    if hit:
        print(f"\nOK — token already has {sorted(hit)}; CI deploys should work.")
    else:
        print("\nMISSING Workers Scripts:Edit — this is the documented API-10000 blocker.")
        print("Mint a token in the dashboard:")
        print("  dash.cloudflare.com → My Profile → API Tokens → Create Token")
        print("  perms: Account → Workers Scripts → Edit, Account → D1 → Edit")
        print("  resources: Include → this account only")
        print("Then push it to the repo secret (automatable — this works NOW):")
        print(f"  gh secret set CLOUDFLARE_WORKERS_DEPLOY_TOKEN -R {repo} --body <token>")
        if repo:
            try:
                out = subprocess.run(
                    ["gh", "secret", "list", "-R", repo], capture_output=True, text=True, timeout=20
                )
                names = [ln.split()[0] for ln in out.stdout.splitlines() if ln.strip()]
                print(
                    f"\nrepo secrets present: {[n for n in names if 'CLOUDFLARE' in n or 'CF_' in n]}"
                )
            except Exception:
                pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
