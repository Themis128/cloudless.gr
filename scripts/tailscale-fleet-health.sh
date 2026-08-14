#!/usr/bin/env bash
# Inventory every Tailscale device: online/offline, version vs latest stable,
# and flag managed Linux hosts that need a fix or upgrade.
#
# Auth: TS_API_KEY  OR  TS_CLIENT_ID + TS_CLIENT_SECRET (OAuth)
#
# Usage:
#   bash scripts/tailscale-fleet-health.sh
#   FAIL_ON_ISSUES=1 bash scripts/tailscale-fleet-health.sh
#   JSON_OUT=/tmp/fleet.json bash scripts/tailscale-fleet-health.sh
set -euo pipefail

TAILNET="${TAILSCALE_TAILNET:-tail4ecae1.ts.net}"
API="${TAILSCALE_API_BASE:-https://api.tailscale.com/api/v2}"
FAIL_ON_ISSUES="${FAIL_ON_ISSUES:-0}"
JSON_OUT="${JSON_OUT:-}"
case "${FAIL_ON_ISSUES}" in 1|true|TRUE|yes|YES) FAIL_ON_ISSUES=1 ;; *) FAIL_ON_ISSUES=0 ;; esac

# Hostnames we expect to keep online (physical / always-on). Ephemeral GHA
# nodes and user laptops are reported but do not fail the job by default.
MANAGED_RE='^(github-omv|omv|omv-main|omv-ha|omv-2)$'

need() { command -v "$1" >/dev/null || { echo "missing $1" >&2; exit 1; }; }
need curl
need jq
need python3

auth_header() {
  if [[ -n "${TS_API_KEY:-}" ]]; then
    echo "Authorization: Basic $(printf '%s:' "$TS_API_KEY" | base64 -w0 2>/dev/null || printf '%s:' "$TS_API_KEY" | base64)"
    return
  fi
  local id="${TS_CLIENT_ID:-${TAILSCALE_OAUTH_CLIENT_ID:-}}"
  local secret="${TS_CLIENT_SECRET:-${TAILSCALE_OAUTH_CLIENT_SECRET:-${TAILSCALE_OAUTH_SECRET:-}}}"
  if [[ -z "$id" || -z "$secret" ]]; then
    echo "Set TS_API_KEY or TS_CLIENT_ID+TS_CLIENT_SECRET" >&2
    exit 2
  fi
  local tok
  tok=$(curl -fsS -u "${id}:${secret}" \
    -d grant_type=client_credentials \
    "$API/oauth/token" | jq -r .access_token)
  [[ -n "$tok" && "$tok" != null ]] || { echo "OAuth token exchange failed" >&2; exit 2; }
  echo "Authorization: Bearer $tok"
}

AUTH="$(auth_header)"
echo "==> Authenticated for tailnet $TAILNET"

LATEST=$(curl -fsSL 'https://pkgs.tailscale.com/stable/?mode=json' | jq -r '.TarballsVersion // empty')
[[ -n "$LATEST" ]] || { echo "Could not resolve latest Tailscale stable version" >&2; exit 1; }
echo "==> Latest stable Tailscale: $LATEST"

DEVICES_FILE=$(mktemp)
REPORT_FILE=$(mktemp)
trap 'rm -f "$DEVICES_FILE" "$REPORT_FILE"' EXIT

curl -fsS -H "$AUTH" -H 'Accept: application/json' \
  "$API/tailnet/$TAILNET/devices" >"$DEVICES_FILE"

python3 - "$DEVICES_FILE" "$LATEST" "$MANAGED_RE" "$REPORT_FILE" <<'PY'
import json, re, sys
from datetime import datetime, timezone

path, latest, managed_re, out_path = sys.argv[1:5]
managed = re.compile(managed_re)
data = json.load(open(path))
devices = data.get("devices") or []
now = datetime.now(timezone.utc)

def short_name(d):
    name = d.get("name") or d.get("hostname") or ""
    return name.split(".")[0].lower()

def ver_tuple(v: str):
    # "1.102.2-tdeadbeef" / "1.102.2" → (1,102,2)
    base = (v or "").split("-")[0].strip()
    parts = []
    for p in base.split("."):
        try:
            parts.append(int(p))
        except ValueError:
            parts.append(0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])

def is_online(d):
    # Prefer connectedToControl; fall back to lastSeen within 5 minutes.
    if d.get("connectedToControl") is True:
        return True
    if d.get("connectedToControl") is False:
        return False
    last = d.get("lastSeen")
    if not last:
        return False
    try:
        ts = datetime.fromisoformat(last.replace("Z", "+00:00"))
    except ValueError:
        return False
    return (now - ts).total_seconds() < 300

rows = []
issues = []
for d in sorted(devices, key=lambda x: short_name(x)):
    short = short_name(d)
    os_name = (d.get("os") or d.get("osType") or "?").lower()
    cv = d.get("clientVersion") or ""
    ver = cv.split("-")[0] if cv else "?"
    online = is_online(d)
    outdated = False
    if ver != "?" and ver_tuple(ver) < ver_tuple(latest):
        outdated = True
    tags = ",".join(d.get("tags") or [])
    addresses = ",".join(d.get("addresses") or [])
    managed_host = bool(managed.match(short))
    row = {
        "hostname": short,
        "os": os_name,
        "online": online,
        "version": ver,
        "clientVersion": cv,
        "outdated": outdated,
        "latest": latest,
        "managed": managed_host,
        "tags": tags,
        "addresses": addresses,
        "id": d.get("id") or d.get("nodeId") or "",
    }
    rows.append(row)
    if managed_host and not online:
        issues.append(f"OFFLINE managed host: {short}")
    if managed_host and outdated:
        issues.append(f"OUTDATED managed host: {short} {ver} < {latest}")
    if managed_host and os_name.startswith("linux") and outdated:
        pass  # upgrade path exists
    elif outdated and not managed_host:
        issues.append(f"OUTDATED (manual): {short} ({os_name}) {ver} < {latest}")

print(f"{'HOST':<22} {'OS':<10} {'STATE':<8} {'VERSION':<12} {'LATEST':<10} {'TAGS'}")
print("-" * 90)
for r in rows:
    state = "online" if r["online"] else "OFFLINE"
    flag = " *" if r["outdated"] else ""
    print(
        f"{r['hostname']:<22} {r['os']:<10} {state:<8} {r['version']+flag:<12} {r['latest']:<10} {r['tags']}"
    )

print()
print(f"Devices: {len(rows)}  Latest: {latest}  Issues: {len(issues)}")
for i in issues:
    print(f"  - {i}")

report = {
    "tailnet": None,
    "latest": latest,
    "generatedAt": now.isoformat(),
    "devices": rows,
    "issues": issues,
    "managedOffline": [r["hostname"] for r in rows if r["managed"] and not r["online"]],
    "managedOutdated": [r["hostname"] for r in rows if r["managed"] and r["outdated"]],
    "upgradeableLinux": [
        r["hostname"]
        for r in rows
        if r["managed"] and r["os"].startswith("linux")
    ],
}
json.dump(report, open(out_path, "w"), indent=2)
print(f"\nWrote report → {out_path}")
PY

# python wrote REPORT_FILE; expose for callers
cp "$REPORT_FILE" "${JSON_OUT:-/tmp/tailscale-fleet-health.json}"
REPORT_PATH="${JSON_OUT:-/tmp/tailscale-fleet-health.json}"
echo "REPORT_PATH=$REPORT_PATH"

ISSUES=$(jq '.issues | length' "$REPORT_PATH")
MANAGED_OFF=$(jq -r '.managedOffline | length' "$REPORT_PATH")
MANAGED_OLD=$(jq -r '.managedOutdated | length' "$REPORT_PATH")
echo "Summary: issues=$ISSUES managed_offline=$MANAGED_OFF managed_outdated=$MANAGED_OLD"

if [[ "$FAIL_ON_ISSUES" -eq 1 && ( "$MANAGED_OFF" -gt 0 || "$MANAGED_OLD" -gt 0 ) ]]; then
  echo "::error::Managed Tailscale hosts have offline or outdated clients"
  exit 1
fi
