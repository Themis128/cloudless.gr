#!/usr/bin/env bash
# Tag every Tailscale device according to the cloudless fabric taxonomy.
#
# Tags (must exist in infrastructure/tailscale/acl-policy.example.json):
#   tag:pi            — physical Pi hosts (SSH / deploy)
#   tag:k8s           — k3s fabric proxies (ingress, kube-apiserver, subnet routers)
#   tag:k8s-operator  — Tailscale Kubernetes operator
#   tag:app-connector — Tailscale Apps connectors (SaaS DNS breakout)
#
# User workstations (office*) stay UNTAGGED so autogroup:self / member identity applies.
#
# Usage:
#   bash scripts/tailscale-retag-fleet.sh            # apply
#   DRY_RUN=1 bash scripts/tailscale-retag-fleet.sh  # print plan only
#   LIST_ONLY=1 bash scripts/tailscale-retag-fleet.sh
set -euo pipefail

TAILNET="${TAILSCALE_TAILNET:-tail4ecae1.ts.net}"
API="${TAILSCALE_API_BASE:-https://api.tailscale.com/api/v2}"
DRY_RUN="${DRY_RUN:-0}"
LIST_ONLY="${LIST_ONLY:-0}"
case "${DRY_RUN}" in 1|true|TRUE|yes|YES) DRY_RUN=1 ;; *) DRY_RUN=0 ;; esac
case "${LIST_ONLY}" in 1|true|TRUE|yes|YES) LIST_ONLY=1 ;; *) LIST_ONLY=0 ;; esac

need() { command -v "$1" >/dev/null || { echo "missing $1"; exit 1; }; }
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
  [[ -n "$tok" && "$tok" != null ]] || { echo "OAuth failed" >&2; exit 2; }
  echo "Authorization: Bearer $tok"
}

AUTH="$(auth_header)"
echo "==> Devices on $TAILNET"
DEVICES=$(curl -fsS -H "$AUTH" -H 'Accept: application/json' "$API/tailnet/$TAILNET/devices")

python3 - "$DEVICES" "$DRY_RUN" "$LIST_ONLY" "$AUTH" "$API" <<'PY'
import json, sys, urllib.request

path, dry, list_only, auth, api = sys.argv[1:6]
dry = dry in ("1", "true", "TRUE")
list_only = list_only in ("1", "true", "TRUE")
data = json.load(open(path))
devices = data.get("devices") or []

def short_name(d):
    name = d.get("hostname") or d.get("name") or ""
    return name.split(".")[0]

def desired_tags(short: str):
    """Return list of tags, or None to leave unchanged, or [] to clear tags."""
    s = short.lower()

    # User / operator workstations — must stay untagged
    if s in {"office", "office-1", "office-2", "office-3"} or s.startswith("office-"):
        return []

    # Physical Pis
    if s in {"github-omv", "omv", "omv-main"}:
        # github-omv historically ran Apps connector; keep both so SaaS DNS
        # breakout and classic SSH grants (tag:pi) both work.
        return ["tag:pi", "tag:app-connector"]
    if s in {"omv-ha", "omv-2"}:
        return ["tag:pi"]

    # Tailscale Kubernetes operator
    if s.startswith("tailscale-operator") or s == "cloudless-k3s-operator":
        return ["tag:k8s-operator"]

    # Fabric: ingress / kube-apiserver ProxyGroups + Connector subnet routers
    if (
        s.startswith("ingress-")
        or s.startswith("kube-")
        or s.startswith("k3s-subnet-router")
        or s.startswith("k3s-cidrs-")
        or s.startswith("ts-k3s-cidrs")
        or s.startswith("monitoring-prox")
    ):
        return ["tag:k8s"]

    # Fly / dedicated Apps connector VMs
    if s.startswith("cloudless-fly-proxy") or s.startswith("app-connector"):
        return ["tag:app-connector"]

    # Unknown — report, do not change
    return None

print(f"{'hostname':32} {'current':40} {'desired':40} action")
print("-" * 120)

hdr_name, hdr_val = auth.split(": ", 1)
changes = 0
unknown = []
for d in sorted(devices, key=lambda x: short_name(x).lower()):
    short = short_name(d)
    cur = list(d.get("tags") or [])
    want = desired_tags(short)
    cur_s = ",".join(cur) if cur else "(none)"
    if want is None:
        print(f"{short:32} {cur_s:40} {'(unknown — skip)':40} SKIP")
        unknown.append(short)
        continue
    want_s = ",".join(want) if want else "(none/clear)"
    # Compare as sets (order irrelevant)
    if set(cur) == set(want):
        print(f"{short:32} {cur_s:40} {want_s:40} OK")
        continue
    action = "CLEAR" if want == [] else "SET"
    print(f"{short:32} {cur_s:40} {want_s:40} {action}")
    changes += 1
    if list_only or dry:
        continue
    # Clearing tags: Tailscale API requires empty array — user devices must not stay tagged.
    body = json.dumps({"tags": want}).encode()
    req = urllib.request.Request(
        f"{api}/device/{d['id']}/tags",
        data=body,
        method="POST",
        headers={hdr_name: hdr_val, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"  → HTTP {resp.status}")
    except Exception as e:
        print(f"  → FAIL {e}", file=sys.stderr)
        # Clearing tags on a user device may 400 if API disallows empty — surface and continue
        if want != []:
            raise

print()
print(f"pending_changes={changes} unknown={len(unknown)} dry_run={dry} list_only={list_only}")
if unknown:
    print("UNKNOWN (left unchanged):", ", ".join(unknown))
PY

echo "==> Done"
