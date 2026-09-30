#!/usr/bin/env python3
"""Smoke-test a Cloudflare API token against the scopes the cloudless.gr
infra MCP expects. Reads the token from $CLOUDFLARE_API_TOKEN if set,
otherwise from Cloudflare secret / D1 config.

Exit code: 0 if all checks pass, non-zero if any scope is missing or
the token verify call fails outright.

Run after rotating the token (see skills/cloudflare-token-doctor/SKILL.md
Stage 3) or whenever an MCP tool unexpectedly returns "Invalid access
token".

Usage:
  python3 scripts/cf-token-smoketest.py
  CLOUDFLARE_API_TOKEN=... python3 scripts/cf-token-smoketest.py
  ZONE_ID=... ACCOUNT_ID=... python3 scripts/cf-token-smoketest.py"""

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from cf_secrets import cf_config_get  # noqa: E402

ZONE_NAME = os.environ.get("ZONE_NAME", "cloudless.gr")
ZONE_ID = os.environ.get("ZONE_ID", "")
ACCOUNT_ID = os.environ.get("ACCOUNT_ID", "")
CF = os.environ.get("CLOUDFLARE_API_TOKEN", "")

if not CF:
    print("→ Resolving token from Cloudflare/D1")
    CF = cf_config_get("CLOUDFLARE_API_TOKEN")
if not CF or CF == "null":
    print(
        "ERR: token is empty — set CLOUDFLARE_API_TOKEN env or add to Cloudflare secrets",
        file=sys.stderr,
    )
    sys.exit(2)

API = "https://api.cloudflare.com/client/v4"
PASS = FAIL = WARN = 0


def check(label: str, status: str = "ok") -> None:
    global PASS, FAIL
    if status == "ok":
        print(f"  \033[32m✓\033[0m  {label}")
        PASS += 1
    else:
        print(f"  \033[31m✗\033[0m  {label} — {status}")
        FAIL += 1


def warn(label: str, status: str) -> None:
    global WARN
    print(f"  \033[33m!\033[0m  {label} — {status}")
    WARN += 1


def curl_cf(path: str, method: str = "GET", body=None) -> dict:
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {CF}", "Content-Type": "application/json"},
        method=method,
    )
    try:
        return json.loads(urllib.request.urlopen(req, timeout=30).read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"success": False}
    except Exception:
        return {"success": False}


def err_msg(d: dict) -> str:
    errs = d.get("errors") or [{}]
    return errs[0].get("message", "unknown")


def err_code(d: dict) -> str:
    errs = d.get("errors") or [{}]
    return str(errs[0].get("code", "no-code"))


print("\nCloudflare token smoke-test")
print("---------------------------")

# 0. Token verify
verify = curl_cf("/user/tokens/verify")
if verify.get("success") and verify.get("result", {}).get("status") == "active":
    check("Token verify (active)")
else:
    check("Token verify", f"code={err_code(verify)}: {err_msg(verify)}")
    print("\nAborting further checks — token isn't valid.")
    sys.exit(1)

# 1. Zone:Read
if not ZONE_ID:
    zr = curl_cf(f"/zones?name={ZONE_NAME}")
    result = zr.get("result") or []
    ZONE_ID = result[0]["id"] if result else ""
    if ZONE_ID:
        check(f"Zone:Read (resolved {ZONE_NAME} → {ZONE_ID})")
    else:
        check("Zone:Read", err_msg(zr) if zr.get("errors") else "no result")
else:
    check(f"Zone:Read (zone id pre-set: {ZONE_ID})")

# 2. Zone Settings:Read
if ZONE_ID:
    zs = curl_cf(f"/zones/{ZONE_ID}/settings")
    check("Zone Settings:Read") if zs.get("success") else check("Zone Settings:Read", err_msg(zs))

# 3. DNS:Read/Edit
if ZONE_ID:
    dns = curl_cf(f"/zones/{ZONE_ID}/dns_records?per_page=1")
    check("DNS:Read") if dns.get("success") else check("DNS:Read", err_msg(dns))

    test_record = f"tiktok-developers-site-verification=cf-smoketest-{int(time.time())}"
    create = curl_cf(
        f"/zones/{ZONE_ID}/dns_records",
        "POST",
        {
            "type": "TXT",
            "name": f"_cf-smoketest.{ZONE_NAME}",
            "content": test_record,
            "ttl": 60,
            "comment": "smoketest",
        },
    )
    rec_id = (create.get("result") or {}).get("id", "")
    if create.get("success") and rec_id:
        delete = curl_cf(f"/zones/{ZONE_ID}/dns_records/{rec_id}", "DELETE")
        if delete.get("success"):
            check("DNS:Edit")
        else:
            check("DNS:Edit (cleanup failed)", err_msg(delete))
    else:
        check("DNS:Edit", f"code={err_code(create)}: {err_msg(create)}")

# 4. Analytics:Read (GraphQL) — most recent hour keeps under 3-day cap
if ZONE_ID:
    since = (datetime.now(UTC) - timedelta(hours=1)).strftime("%Y-%m-%dT%H:00:00Z")
    gq_body = {
        "query": (
            "query($z: String!, $s: Time!) { viewer { zones(filter: "
            "{zoneTag: $z}) { httpRequests1hGroups(limit: 1, filter: "
            "{datetime_geq: $s}) { sum { requests } } } } }"
        ),
        "variables": {"z": ZONE_ID, "s": since},
    }
    gq = curl_cf("/graphql", "POST", gq_body)
    gq_err = (gq.get("errors") or [{}])[0].get("message", "")
    check("Analytics:Read (GraphQL viewer.zones)") if not gq_err else check(
        "Analytics:Read", gq_err
    )

# 5. User API Tokens:Read (optional)
tl = curl_cf("/user/tokens")
tl_ok = tl.get("success")
if tl_ok:
    check(f"User API Tokens:Read ({len(tl.get('result', []))} tokens visible)")
else:
    warn(
        "User API Tokens:Read",
        f"{err_msg(tl)} (optional; add API Tokens Read to inspect Workers Write)",
    )

# 6. Workers Scripts:Read (account-scoped)
if not ACCOUNT_ID:
    me = curl_cf("/accounts")
    result = me.get("result") or []
    ACCOUNT_ID = result[0]["id"] if result else ""
if ACCOUNT_ID:
    ws = curl_cf(f"/accounts/{ACCOUNT_ID}/workers/scripts")
    if ws.get("success"):
        check(f"Workers Scripts:Read ({len(ws.get('result', []))} scripts on account {ACCOUNT_ID})")
    else:
        check("Workers Scripts:Read", err_msg(ws))
else:
    check("Workers Scripts:Read", "could not resolve account id")

# 7. Workers Scripts:Write — policy inspection, else versions-create probe
WORKERS_WRITE_ID = "e086da7e2179491d91ee5f35b3ca210a"
if tl_ok:
    has = sum(
        1
        for t in tl.get("result", [])
        if t.get("status") == "active"
        for pol in t.get("policies", [])
        for pg in pol.get("permission_groups", [])
        if pg.get("id") == WORKERS_WRITE_ID
    )
    if has:
        check("Workers Scripts:Write (present on an active user token policy)")
    else:
        check(
            "Workers Scripts:Write",
            "not found on active token policies — cloudflare-deploy.yml will 10000",
        )
elif ACCOUNT_ID:
    req = urllib.request.Request(
        f"{API}/accounts/{ACCOUNT_ID}/workers/scripts/cloudless2/versions",
        data=b"{}",
        headers={"Authorization": f"Bearer {CF}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=30)
        probe = "200"
        probe_body = {}
    except urllib.error.HTTPError as e:
        probe = str(e.code)
        try:
            probe_body = json.loads(e.read())
        except Exception:
            probe_body = {}
    except Exception:
        probe, probe_body = "000", {}
    probe_err = err_code(probe_body)
    if probe in ("400", "422", "415"):
        check("Workers Scripts:Write (versions create rejected as validation — auth OK)")
    elif probe in ("401", "403") or probe_err in ("10000", "1001"):
        check(
            "Workers Scripts:Write",
            f"HTTP {probe} code={probe_err} — add Workers Scripts Write for cloudless2 deploy",
        )
    else:
        warn(
            "Workers Scripts:Write",
            f"unexpected HTTP {probe} — see cloudflare-workers-deploy skill",
        )
else:
    warn("Workers Scripts:Write", "skipped (no account id)")

# 8. D1:Read
if ACCOUNT_ID:
    d1 = curl_cf(f"/accounts/{ACCOUNT_ID}/d1/database")
    if d1.get("success"):
        check(f"D1:Read ({len(d1.get('result', []))} databases)")
    else:
        check("D1:Read", err_msg(d1))

# 9. Cloudflare Tunnel:Read (optional)
TUNNEL_ID = os.environ.get("CLUSTER_CLOUDFLARED_TUNNEL_ID", "e977a490-58c5-4fdb-9155-86832e3e636a")
if ACCOUNT_ID:
    tn = curl_cf(f"/accounts/{ACCOUNT_ID}/cfd_tunnel/{TUNNEL_ID}/configurations")
    if tn.get("success"):
        check("Cloudflare Tunnel:Read (config)")
    else:
        warn(
            "Cloudflare Tunnel:Read",
            f"code={err_code(tn)}: {err_msg(tn)} (CI soft-skips; set "
            "CLOUDFLARE_TUNNEL_API_TOKEN or Tunnel Write)",
        )

print("\n---------------------------")
print(f"Pass: {PASS}  Fail: {FAIL}  Warn: {WARN}")

if FAIL > 0:
    print("""
→ Re-issue / ensure-ci the token with the missing scopes. See
   skills/cloudflare-token-doctor/SKILL.md and
   .claude/skills/cloudflare-workers-deploy/SKILL.md
   python3 scripts/cf-token-permissions.py ensure-ci "<token-name>""")
    sys.exit(1)

if WARN > 0:
    print("\n→ Warnings only — CI may still soft-skip tunnel/proxy deploy. Fix when convenient.")
