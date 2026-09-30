#!/usr/bin/env python3
"""Manage Cloudflare API token permissions without the dashboard.

Bootstrap: uses Global API Key (email + key) to edit any user token.
Once the target token has "API Tokens Write", it can self-manage.

Usage:
  python3 scripts/cf-token-permissions.py list
  python3 scripts/cf-token-permissions.py show "<token name>"
  python3 scripts/cf-token-permissions.py add "<token name>" \
      "R2 Write" "D1 Write" ...
  python3 scripts/cf-token-permissions.py remove "<token name>" \
      "R2 Write"
  python3 scripts/cf-token-permissions.py ensure-ci "<token name>"
  python3 scripts/cf-token-permissions.py fetch-ids

Auth (in order of precedence):
  1. CF_GLOBAL_API_KEY + CF_EMAIL  — Global API Key (bootstrap)
  2. CLOUDFLARE_API_TOKEN          — Bearer ("API Tokens Write")

The Global API Key is at: dash.cloudflare.com → My Profile → API
Tokens → Global API Key → View. Never store it — interactive use only."""

import json
import os
import sys
import urllib.error
import urllib.request

ACCOUNT_ID = os.environ.get("CF_ACCOUNT_ID") or \
    os.environ.get("CLOUDFLARE_ACCOUNT_ID") or \
    "fb7dc7b69b662480cd5961a4d1913c78"
API = "https://api.cloudflare.com/client/v4"

PERM_IDS = {
    "API Tokens Read": "0cc3a61731504c89b99ec1be78b77aa0",
    "API Tokens Write": "686d18d5ac6c441c867cbf6771e58a0a",
    "Account API Tokens Read": "eb56a6953c034b9d97dd838155666f06",
    "Account API Tokens Write": "5bc3f8b21c554832afc660159ab75fa4",
    "Account Analytics Read": "b89a480218d04ceb98b4fe57ca29dc1f",
    "Cloudflare Tunnel Read": "efea2ab8357b47888938f101ae5e053f",
    "Cloudflare Tunnel Write": "c07321b023e944ff818fec44d8203567",
    "D1 Read": "192192df92ee43ac90f2aeeffce67e35",
    "D1 Write": "09b2857d1c31407795e75e3fed8617a1",
    "D1 Metadata Read": "5b4da8a35efa4fe8be684070183cdb32",
    "Workers Scripts Read": "1a71c399035b4950a1bd1466bbe4f420",
    "Workers Scripts Write": "e086da7e2179491d91ee5f35b3ca210a",
    "Workers R2 Storage Read": "b4992e1108244f5d8bfbd5744320c2e1",
    "Workers R2 Storage Write": "bf7481a1826f439697cb59a20b22293e",
    "Workers R2 Storage Bucket Item Read":
        "6a018a9f2fc74eb6b293b0c548f38b39",
    "Workers R2 Storage Bucket Item Write":
        "2efd5506f9c8494dacb1fa10a3e7d5b6",
    "Workers R2 Storage Metadata Read":
        "dc1beb502339482da2515d6e146ca1ac",
    "Workers AI Read": "a92d2450e05d4e7bb7d0a64968f83d11",
    "Workers AI Write": "bacc64e0f6c34fc0883a1223f938a104",
    "Analytics Read": "9c88f9c5bce24ce7af9a958ba9c504db",
    "DNS Read": "82e64a83756745bbbb1c9c2701bf816b",
    "DNS Write": "4755a26eedb94da69e1066d98aa820be",
    "Zone Read": "c8fed203ed3043cba015a93ad1616f1f",
    "Zone Settings Read": "517b21aee92c4d89936c976ba6e4be55",
    "Zone Settings Write": "3030687196b94b638145a3953da2b699",
    "Zone Write": "e6d2666161e84845a636613608cee8d5",
}
PERM_SCOPES = {
    "API Tokens Read": "user", "API Tokens Write": "user",
    "Analytics Read": "zone", "DNS Read": "zone", "DNS Write": "zone",
    "Zone Read": "zone", "Zone Settings Read": "zone",
    "Zone Settings Write": "zone", "Zone Write": "zone",
}
# Everything else defaults to account scope.

CI_REQUIRED = [
    "API Tokens Write",
    "Workers R2 Storage Write",
    "Workers R2 Storage Bucket Item Write",
    "D1 Write",
    "Workers Scripts Write",
    "Cloudflare Tunnel Write",
    "Account Analytics Read",
    "Zone Settings Read",
    "DNS Read",
    "Zone Read",
    "Workers AI Read",
    "Analytics Read",
]


def auth_headers() -> dict:
    if os.environ.get("CF_GLOBAL_API_KEY") and os.environ.get(
            "CF_EMAIL"):
        return {"X-Auth-Email": os.environ["CF_EMAIL"],
                "X-Auth-Key": os.environ["CF_GLOBAL_API_KEY"]}
    if os.environ.get("CLOUDFLARE_API_TOKEN"):
        return {"Authorization":
                f"Bearer {os.environ['CLOUDFLARE_API_TOKEN']}"}
    sys.exit("ERROR: Set CF_GLOBAL_API_KEY+CF_EMAIL or "
             "CLOUDFLARE_API_TOKEN")


def cf_api(method: str, path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={**auth_headers(),
                 "Content-Type": "application/json"})
    try:
        return json.loads(urllib.request.urlopen(req,
                                                 timeout=20).read())
    except urllib.error.HTTPError as e:
        print(f"ERROR: API returned HTTP {e.code}:", file=sys.stderr)
        try:
            print(json.dumps(json.loads(e.read()), indent=2),
                  file=sys.stderr)
        except Exception:
            pass
        sys.exit(1)
    except Exception as e:
        sys.exit(f"ERROR: {e}")


def list_tokens() -> list[dict]:
    return cf_api("GET", "/user/tokens?per_page=50").get("result") or []


def find_token(name: str) -> dict:
    tokens = list_tokens()
    tid = next((t["id"] for t in tokens if t["name"] == name), None)
    if not tid:
        print(f"ERROR: Token '{name}' not found. Available:",
              file=sys.stderr)
        for t in tokens:
            print(f"  {t['name']}", file=sys.stderr)
        sys.exit(1)
    return cf_api("GET", f"/user/tokens/{tid}")["result"]


def cmd_list() -> None:
    for t in list_tokens():
        print(f"{t['status'].upper()}  {t['name']}  (id: {t['id']})")
        for p in t.get("policies") or []:
            perms = ", ".join(pg.get("name", pg["id"])
                              for pg in p.get("permission_groups") or [])
            res = ", ".join(k.split(".")[-1]
                            for k in (p.get("resources") or {}))
            print(f"  {perms} → {res}")
        print()


def cmd_show(name: str) -> None:
    t = find_token(name)
    print(json.dumps({
        "name": t["name"], "id": t["id"], "status": t["status"],
        "policies": [{"effect": p.get("effect"),
                      "resources": p.get("resources"),
                      "permissions": [pg.get("name", pg["id"])
                                      for pg in
                                      p.get("permission_groups") or []]}
                     for p in t.get("policies") or []]},
        indent=2))


def add_perms(body: dict, perms: list[str]) -> int:
    acct_res = f"com.cloudflare.api.account.{ACCOUNT_ID}"
    user_id = next(
        (k.rsplit(".", 1)[-1]
         for p in body.get("policies") or []
         for k in (p.get("resources") or {})
         if k.startswith("com.cloudflare.api.user.")), None)

    added = 0
    for perm in perms:
        pid = PERM_IDS.get(perm)
        if not pid:
            print(f"ERROR: Unknown permission '{perm}'. Known:",
                  file=sys.stderr)
            print(*sorted(PERM_IDS), sep="\n  ", file=sys.stderr)
            sys.exit(1)
        if any(pg["id"] == pid for p in body.get("policies") or []
               for pg in p.get("permission_groups") or []):
            print(f"SKIP  {perm} (already present)")
            continue

        scope = PERM_SCOPES.get(perm, "account")
        group = {"id": pid, "name": perm}
        policies = body.setdefault("policies", [])

        if scope == "account":
            target = next((p for p in policies
                           if p.get("resources", {}).get(acct_res)
                           == "*"), None)
            if target is None:
                policies.append({
                    "effect": "allow",
                    "resources": {acct_res: "*"},
                    "permission_groups": [group]})
            else:
                target["permission_groups"].append(group)
        elif scope == "zone":
            target = next(
                (p for p in policies
                 if isinstance(
                     p.get("resources", {}).get(acct_res), dict)),
                None)
            if target is None:
                policies.append({
                    "effect": "allow",
                    "resources": {acct_res: {
                        "com.cloudflare.api.account.zone.*": "*"}},
                    "permission_groups": [group]})
            else:
                target["permission_groups"].append(group)
        else:  # user
            if not user_id:
                print("WARN  No user policy found — fetching user "
                      "ID...")
                user_id = cf_api("GET", "/user")["result"]["id"]
            user_res = f"com.cloudflare.api.user.{user_id}"
            target = next((p for p in policies
                           if p.get("resources", {}).get(user_res)
                           is not None), None)
            if target is None:
                policies.append({
                    "effect": "allow",
                    "resources": {user_res: "*"},
                    "permission_groups": [group]})
            else:
                target["permission_groups"].append(group)

        print(f"ADD   {perm} ({pid}) [{scope}]")
        added += 1
    return added


def cmd_add(name: str, perms: list[str]) -> None:
    t = find_token(name)
    body = {k: v for k, v in t.items()}
    added = add_perms(body, perms)
    if not added:
        print("Nothing to add — all permissions already present.")
        return
    r = cf_api("PUT", f"/user/tokens/{t['id']}", body)
    if r.get("success"):
        print(f"OK    Token '{name}' updated with {added} new "
              "permission(s).")
    else:
        print("ERROR: Update failed:", file=sys.stderr)
        print(json.dumps(r, indent=2), file=sys.stderr)
        sys.exit(1)


def cmd_remove(name: str, perms: list[str]) -> None:
    remove_ids = set()
    for perm in perms:
        pid = PERM_IDS.get(perm)
        if not pid:
            sys.exit(f"ERROR: Unknown permission '{perm}'.")
        remove_ids.add(pid)
        print(f"REMOVE  {perm} ({pid})")

    t = find_token(name)
    body = dict(t)
    body["policies"] = [
        {**p, "permission_groups": [
            pg for pg in p.get("permission_groups") or []
            if pg["id"] not in remove_ids]}
        for p in body.get("policies") or []]
    body["policies"] = [p for p in body["policies"]
                        if p["permission_groups"]]

    r = cf_api("PUT", f"/user/tokens/{t['id']}", body)
    if r.get("success"):
        print(f"OK    Permissions removed from '{name}'.")
    else:
        print("ERROR: Update failed:", file=sys.stderr)
        print(json.dumps(r, indent=2), file=sys.stderr)
        sys.exit(1)


def cmd_fetch_ids() -> None:
    print("Fetching all permission group IDs from Cloudflare API...")
    for g in sorted(cf_api("GET", "/user/tokens/permission_groups")
                    .get("result") or [], key=lambda g: g["name"]):
        print(f"  {g['name']!r}: {g['id']!r}  "
              f"# {', '.join(g.get('scopes') or [])}")


USAGE = __doc__ + """
Examples:
  # One-time bootstrap with Global API Key:
  CF_EMAIL=you@example.com CF_GLOBAL_API_KEY=<key> \\
    python3 scripts/cf-token-permissions.py ensure-ci \\
    "Cloudflare Agent Token - 2026-08-08"
"""

if len(sys.argv) < 2:
    print(USAGE)
    sys.exit(1)

cmd, args = sys.argv[1], sys.argv[2:]
if cmd == "list":
    cmd_list()
elif cmd == "show":
    cmd_show(args[0])
elif cmd == "add":
    cmd_add(args[0], args[1:])
elif cmd == "remove":
    cmd_remove(args[0], args[1:])
elif cmd == "ensure-ci":
    print(f"Ensuring CI-required permissions on '{args[0]}'...")
    cmd_add(args[0], CI_REQUIRED)
elif cmd == "fetch-ids":
    cmd_fetch_ids()
else:
    print(USAGE)
    sys.exit(1)
