#!/usr/bin/env python3
"""Cloudflare load balancer provisioning for cloudless.gr HA failover.

Creates/updates:
  - health monitors (HTTPS GET /api/health) per host
  - two origin pools per host: AWS (CloudFront) primary + Pi/k3s standby
  - zone load balancers with default_pools=[aws, pi], fallback_pool=pi
  - DNS cutover: deletes the proxied A/AAAA/CNAME record at the host name
    so the LB can claim it (apply mode only)

Env:
  DOMAIN   zone (default cloudless.gr)
  MODE     report (default) | apply
  CONFIRM  apply requires CONFIRM=1
  CLOUDFLARE_API_TOKEN — else Cloudflare secret/D1 config.
  Scopes: Zone:Read, Load Balancing:Monitors and Pools:Edit,
  Load Balancing:Load Balancers:Edit, DNS:Edit.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from cf_secrets import cf_config_get  # noqa: E402

DOMAIN = os.environ.get("DOMAIN", "cloudless.gr")
MODE = os.environ.get("MODE", "report")
CONFIRM = os.environ.get("CONFIRM", "0")
HOSTS = ["cloudless.gr", "www.cloudless.gr"]

CF_APEX_ORIGIN = "d3k7muo3c6lw6s.cloudfront.net"
CF_WWW_ORIGIN = "dgrxxatzrgxfi.cloudfront.net"
PI_ORIGIN = "omv.tail8eb71.ts.net"
HEALTH_PATH = "/api/health"


def die(msg: str) -> None:
    print(f"ERROR: {msg}")
    sys.exit(1)


def block(msg: str) -> None:
    """A precondition waiting on a human. Informational in report mode."""
    print(f"BLOCKED: {msg}")
    if APPLY:
        sys.exit(1)
    print("(report mode — exiting 0; resolve the above, then re-run / dispatch apply)")
    sys.exit(0)


APPLY = 0
if MODE == "apply":
    if CONFIRM != "1":
        die("MODE=apply requires CONFIRM=1 (refusing to mutate without explicit confirm)")
    APPLY = 1
print(f"== Cloudflare LB setup for {DOMAIN} — mode={MODE} ==")

CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN") or cf_config_get("CLOUDFLARE_API_TOKEN")
if not CF_TOKEN or CF_TOKEN == "null":
    block(
        "no CLOUDFLARE_API_TOKEN — add to Cloudflare secrets (or env "
        "CLOUDFLARE_API_TOKEN) with scopes: Zone:Read, Load Balancing "
        "Monitors/Pools:Edit, Load Balancing Load Balancers:Edit, "
        "DNS:Edit (zone cloudless.gr)."
    )

API = "https://api.cloudflare.com/client/v4"


def cf(method: str, url: str, body=None) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {CF_TOKEN}", "Content-Type": "application/json"},
        method=method,
    )
    try:
        return json.loads(urllib.request.urlopen(req, timeout=30).read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"success": False, "errors": [{"code": e.code, "message": str(e)}]}
    except Exception as e:
        return {"success": False, "errors": [{"message": str(e)}]}


def errs(resp: dict) -> None:
    for e in resp.get("errors") or []:
        print(f"  [{e.get('code')}] {e.get('message')}")


# ---- zone + account ----
zresp = cf("GET", f"{API}/zones?name={DOMAIN}")
if not zresp.get("success"):
    errs(zresp)
    die("zone lookup failed (token missing Zone:Read?)")
zone = (zresp.get("result") or [{}])[0]
ZONE_ID = zone.get("id", "")
ACCT_ID = (zone.get("account") or {}).get("id", "")
if not ZONE_ID or not ACCT_ID:
    die(f"could not resolve zone/account for {DOMAIN}")
print(f"zone:    {ZONE_ID}")
print(f"account: {ACCT_ID}")

# ---- entitlement ----
presp = cf("GET", f"{API}/accounts/{ACCT_ID}/load_balancers/pools")
if not presp.get("success"):
    print("Load Balancing API not available:")
    errs(presp)
    block(
        "the account likely lacks the Load Balancing add-on, or the "
        "token lacks LB scope. Enable LB in the Cloudflare dashboard "
        "(Traffic -> Load Balancing) and grant the token 'Load "
        "Balancing: Monitors and Pools: Edit' + 'Load Balancing: Load "
        "Balancers: Edit'."
    )
print("Load Balancing entitlement: OK")


def find_id(resp: dict, pred) -> str:
    for r in resp.get("result") or []:
        if pred(r):
            return r.get("id", "")
    return ""


pool_aws: list[str] = []
pool_pi: list[str] = []

# ===================== MONITORS + POOLS (account scope) =====================
for host in HOSTS:
    aws_origin = CF_APEX_ORIGIN if host == DOMAIN else CF_WWW_ORIGIN
    pi_origin = PI_ORIGIN
    mon_desc = f"cloudless-health-{host}"
    safe = host.replace(".", "-")
    pool_aws_name = f"cl-aws-{safe}"
    pool_pi_name = f"cl-pi-{safe}"

    print(f"\n--- {host} ---")
    print(f"  primary origin (AWS): {aws_origin}  (Host: {host}{HEALTH_PATH})")
    print(f"  standby origin (Pi):  {pi_origin}   (Host: {host}{HEALTH_PATH})")

    # ---- monitor ----
    mlist = cf("GET", f"{API}/accounts/{ACCT_ID}/load_balancers/monitors")
    mon_id = find_id(mlist, lambda r, d=mon_desc: r.get("description") == d)
    mon_body = {
        "type": "https",
        "method": "GET",
        "path": HEALTH_PATH,
        "description": mon_desc,
        "expected_codes": "200",
        "interval": 60,
        "retries": 2,
        "timeout": 5,
        "follow_redirects": False,
        "allow_insecure": False,
        "header": {"Host": [host]},
    }
    if APPLY:
        if mon_id:
            r = cf("PUT", f"{API}/accounts/{ACCT_ID}/load_balancers/monitors/{mon_id}", mon_body)
        else:
            r = cf("POST", f"{API}/accounts/{ACCT_ID}/load_balancers/monitors", mon_body)
            mon_id = (r.get("result") or {}).get("id", "")
        if not r.get("success"):
            errs(r)
            die(f"monitor upsert failed for {host}")
        print(f"  monitor:   {mon_id} (upserted)")
    else:
        state = (
            f"exists {mon_id} (would update)" if mon_id else f"MISSING (would create '{mon_desc}')"
        )
        print(f"  monitor:   {state}")

    # ---- pools ----
    plist = cf("GET", f"{API}/accounts/{ACCT_ID}/load_balancers/pools")
    for kind, pname, porigin, oname in (
        ("aws", pool_aws_name, aws_origin, "cloudfront"),
        ("pi", pool_pi_name, pi_origin, "pi-k3s-funnel"),
    ):
        pool_id = find_id(plist, lambda r, n=pname: r.get("name") == n)
        pool_body = {
            "name": pname,
            "enabled": True,
            "minimum_origins": 1,
            "monitor": mon_id or None,
            "origins": [
                {
                    "name": oname,
                    "address": porigin,
                    "enabled": True,
                    "weight": 1,
                    "header": {"Host": [host]},
                }
            ],
        }
        pool_body = {k: v for k, v in pool_body.items() if v is not None and v != ""}
        if APPLY:
            if not mon_id:
                die(f"no monitor id for {host}; cannot create pool {pname}")
            if pool_id:
                r = cf("PUT", f"{API}/accounts/{ACCT_ID}/load_balancers/pools/{pool_id}", pool_body)
            else:
                r = cf("POST", f"{API}/accounts/{ACCT_ID}/load_balancers/pools", pool_body)
                pool_id = (r.get("result") or {}).get("id", "")
            if not r.get("success"):
                errs(r)
                die(f"pool upsert failed: {pname}")
            print(f"  pool {kind}:  {pool_id}  ({pname} -> {porigin})")
        else:
            state = (
                f"exists {pool_id}" if pool_id else f"MISSING (would create '{pname}' -> {porigin})"
            )
            print(f"  pool {kind}:  {state}")
        (pool_aws if kind == "aws" else pool_pi).append(pool_id)

# ===================== LOAD BALANCERS (zone scope) =========================
for i, host in enumerate(HOSTS):
    aws_pool = pool_aws[i]
    pi_pool = pool_pi[i]
    llist = cf("GET", f"{API}/zones/{ZONE_ID}/load_balancers")
    lb_id = find_id(llist, lambda r, n=host: r.get("name") == n)

    print(f"\n--- LB {host} ---")
    if not APPLY:
        drec = cf("GET", f"{API}/zones/{ZONE_ID}/dns_records?name={host}")
        for r in drec.get("result") or []:
            print(
                f"  current DNS: {r.get('type')} {r.get('name')} -> "
                f"{r.get('content')} (proxied={r.get('proxied')})"
            )
        if lb_id:
            print(f"  LB: exists {lb_id} (would update default_pools=[aws,pi], fallback=pi)")
        else:
            print("  LB: MISSING (would create; replaces the proxied DNS record above)")
        continue

    if not aws_pool or not pi_pool:
        die(f"missing pool ids for {host}")
    lb_body = {
        "name": host,
        "proxied": True,
        "enabled": True,
        "steering_policy": "off",
        "default_pools": [aws_pool, pi_pool],
        "fallback_pool": pi_pool,
        "description": "cloudless HA: AWS primary -> Pi standby (auto-failover on /api/health)",
    }

    if lb_id:
        r = cf("PUT", f"{API}/zones/{ZONE_ID}/load_balancers/{lb_id}", lb_body)
        if not r.get("success"):
            errs(r)
            die(f"LB update failed: {host}")
        print(f"  LB: {lb_id} (updated)")
    else:
        # cutover: an LB cannot coexist with a plain proxied record of
        # the same name — capture + delete the conflict first.
        drec = cf("GET", f"{API}/zones/{ZONE_ID}/dns_records?name={host}")
        for r in drec.get("result") or []:
            print(
                f"  replacing DNS: {r.get('type')} {r.get('name')} -> "
                f"{r.get('content')} (proxied={r.get('proxied')})"
            )
        for r in drec.get("result") or []:
            if r.get("type") in ("A", "AAAA", "CNAME"):
                rd = cf("DELETE", f"{API}/zones/{ZONE_ID}/dns_records/{r['id']}")
                if not rd.get("success"):
                    errs(rd)
                    die(f"could not delete DNS record {r['id']} before LB cutover ({host})")
        r = cf("POST", f"{API}/zones/{ZONE_ID}/load_balancers", lb_body)
        if not r.get("success"):
            errs(r)
            die(f"LB create failed: {host}")
        lb_id = (r.get("result") or {}).get("id", "")
        print(f"  LB: {lb_id} (created — {host} now served by the load balancer)")

print()
if APPLY:
    print("== DONE — Cloudflare LB failover is live. Steady state: AWS primary.")
    print(f"   Verify: curl -sI https://{DOMAIN}/api/health  (200), then watch a")
    print("   forced-AWS-5xx flip to the Pi standby in the LB Analytics tab.")
else:
    print("== REPORT ONLY — nothing changed.")
    print("   To apply the plan above (creates the LB + cuts apex/www DNS over):")
    print("   GitHub -> Actions -> 'Cloudflare HA load balancer' -> Run workflow")
    print("   -> set apply = true. Result + verification are posted back to #382.")
