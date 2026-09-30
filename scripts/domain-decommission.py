#!/usr/bin/env python3
"""domain-decommission.py — safely retire a domain's AWS Route 53
health checks and Cloudflare DNS records, scoped strictly to that
domain.

SAFETY:
  - DISCOVERY-FIRST. Default MODE=report only lists what *would* be
    removed; nothing is deleted unless MODE=apply AND CONFIRM=1.
  - SCOPED BY NAME. Route 53 health checks are matched by FQDN ending
    in the target DOMAIN; Cloudflare records by the DOMAIN's zone.
  - PROTECTED IDS. The cloudless.gr HA *secondary* health check
    30a69f1c-8d48-49bd-9067-cabec979478b is NEVER deletable here —
    it belongs to the ACTIVE cloudless.gr failover.

Env: DOMAIN (default cloudless.online), MODE=report|apply,
     CONFIRM=1 (required for apply), CLOUDFLARE_API_TOKEN."""

import json
import os
import shutil
import subprocess
import urllib.error
import urllib.request

DOMAIN = os.environ.get("DOMAIN", "cloudless.online")
MODE = os.environ.get("MODE", "report")
CONFIRM = os.environ.get("CONFIRM", "0")

PROTECTED_HEALTH_CHECKS = {"30a69f1c-8d48-49bd-9067-cabec979478b"}


def is_apply() -> bool:
    return MODE == "apply" and CONFIRM == "1"


def log(*args) -> None:
    print(f"[decommission:{DOMAIN}]", *args)


log(f"mode={MODE} confirm={CONFIRM} (apply deletes only when "
    "MODE=apply + CONFIRM=1)")

have_aws = shutil.which("aws") is not None
if not have_aws:
    log("WARN: aws CLI not found — skipping Route 53")

# --- 1) Route 53 health checks scoped to this domain ---
r53_found = r53_deleted = 0
if have_aws:
    r = subprocess.run(["aws", "route53", "list-health-checks",
                        "--output", "json"],
                       capture_output=True, text=True)
    if not r.stdout.strip():
        log(f"Route 53: list-health-checks returned nothing — "
            f"{r.stderr.strip()}")
    else:
        checks = json.loads(r.stdout).get("HealthChecks", [])
        matched = []
        for hc in checks:
            fqdn = (hc.get("HealthCheckConfig", {})
                    .get("FullyQualifiedDomainName", "").lower())
            if fqdn == DOMAIN or fqdn.endswith("." + DOMAIN):
                matched.append((hc["Id"], fqdn,
                                hc["HealthCheckConfig"].get("Type")))
        for hid, fqdn, htype in matched:
            r53_found += 1
            if hid in PROTECTED_HEALTH_CHECKS:
                log(f"Route 53: PROTECTED health check {hid} "
                    f"({fqdn}) — skipping (cloudless.gr failover)")
                continue
            if is_apply():
                r = subprocess.run(
                    ["aws", "route53", "delete-health-check",
                     "--health-check-id", hid],
                    capture_output=True, text=True)
                if r.returncode == 0:
                    log(f"Route 53: DELETED health check {hid} "
                        f"({fqdn})")
                    r53_deleted += 1
                else:
                    log(f"Route 53: delete {hid} FAILED — "
                        f"{r.stderr.strip()}")
            else:
                log(f"Route 53: would delete health check {hid} "
                    f"({fqdn}) [report-only]")
        if not r53_found:
            log(f"Route 53: no health checks scoped to {DOMAIN}")

# --- 2) Cloudflare DNS records in this domain's zone ---
cf_found = cf_deleted = 0
cf_token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
if not cf_token and have_aws:
    r = subprocess.run(
        ["aws", "ssm", "get-parameter", "--name",
         "/cloudless/production/CLOUDFLARE_API_TOKEN",
         "--with-decryption", "--query", "Parameter.Value",
         "--output", "text"], capture_output=True, text=True)
    if r.returncode == 0:
        cf_token = r.stdout.strip()

if not cf_token:
    log("Cloudflare: no CLOUDFLARE_API_TOKEN (env or SSM) — skipping "
        "DNS-record cleanup.")
    log("Cloudflare: set /cloudless/production/CLOUDFLARE_API_TOKEN "
        "(Zone:DNS:Edit, Zone:Read) to enable.")
else:
    def cf(method: str, path: str) -> dict:
        req = urllib.request.Request(
            f"https://api.cloudflare.com/client/v4{path}",
            method=method,
            headers={"Authorization": f"Bearer {cf_token}"})
        try:
            return json.loads(urllib.request.urlopen(
                req, timeout=15).read())
        except Exception:
            return {"success": False}

    zones = cf("GET", f"/zones?name={DOMAIN}").get("result") or []
    if not zones:
        log(f"Cloudflare: no zone found for {DOMAIN} (already "
            "removed, or token lacks Zone:Read).")
    else:
        zone_id = zones[0]["id"]
        log(f"Cloudflare: zone {DOMAIN} = {zone_id}")
        recs = cf("GET", f"/zones/{zone_id}/dns_records"
                         "?per_page=100").get("result") or []
        for rec in recs:
            cf_found += 1
            rid, rtype, rname = rec["id"], rec["type"], rec["name"]
            if is_apply():
                r = cf("DELETE", f"/zones/{zone_id}/dns_records/{rid}")
                if r.get("success"):
                    log(f"Cloudflare: DELETED {rtype} {rname} ({rid})")
                    cf_deleted += 1
                else:
                    log(f"Cloudflare: delete {rtype} {rname} FAILED")
            else:
                log(f"Cloudflare: would delete {rtype} {rname} "
                    f"({rid}) [report-only]")
        if not cf_found:
            log(f"Cloudflare: zone {DOMAIN} has no DNS records")

# --- Summary ---
log(f"──────── summary for {DOMAIN} ────────")
log(f"Route 53 health checks: found={r53_found} deleted={r53_deleted}")
log(f"Cloudflare DNS records: found={cf_found} deleted={cf_deleted}")
if not is_apply():
    log("REPORT-ONLY. Re-run with MODE=apply CONFIRM=1 (or the "
        "workflow's apply=true input) to delete.")
log(f"NOTE: in-cluster monitors that probe {DOMAIN} (omv-ha "
    "k8s/health-monitor.yaml, OMV")
log("      uptime-kuma) live in other repos — clean them there; this "
    "tool only handles R53 + Cloudflare.")
