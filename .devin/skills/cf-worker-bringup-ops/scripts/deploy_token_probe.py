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

# /user/tokens/verify only reports status — permission groups must be
# read from GET /user/tokens (matched by the verify result's token id).
# NEEDED uses the Cloudflare API permission-group names (not dashboard
# labels): wrangler deploy needs account-level "Workers Scripts Write".
NEEDED = {"Workers Scripts Write"}


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

    # /user/tokens/verify carries no policies — look the token up in
    # /user/tokens by id to read its permission groups. That endpoint
    # needs User → API Tokens → Read; degrade gracefully if absent.
    flat: set[str] = set()
    policies_known = False
    tok_id = res.get("id")
    if tok_id:
        try:
            req2 = urllib.request.Request(
                "https://api.cloudflare.com/client/v4/user/tokens",
                headers={"Authorization": f"Bearer {token}"},
            )
            with urllib.request.urlopen(req2, timeout=15) as r2:
                listing = json.loads(r2.read())
            for t in listing.get("result", []):
                if t.get("id") == tok_id:
                    flat = {
                        g.get("name")
                        for pol in t.get("policies", [])
                        for g in pol.get("permission_groups", [])
                    }
                    policies_known = True
                    break
        except Exception as e:
            print(f"(could not list token policies: {e} — verify-only mode)")

    if policies_known:
        print(f"permission groups ({len(flat)}):")
        for g in sorted(flat):
            print(f"  - {g}")
    else:
        print("permission groups: unavailable (token lacks API Tokens read, or verify-only)")

    if policies_known and not (NEEDED & flat):
        print("\nNOTE: token is valid but Workers Scripts Write was not found in its policies.")
    hit = NEEDED & flat
    if hit:
        print(f"\nOK — token already has {sorted(hit)}; CI deploys should work.")
    elif policies_known:
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
