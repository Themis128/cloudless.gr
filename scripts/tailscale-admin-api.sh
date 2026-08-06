#!/usr/bin/env bash
# Tailscale Admin API: merge fabric ACL + delete stale k8s proxy devices.
# Auth: TS_API_KEY (tskey-api-…) OR TS_CLIENT_ID + TS_CLIENT_SECRET (OAuth).
# Docs: https://tailscale.com/docs/reference/api
set -euo pipefail

TAILNET="${TAILSCALE_TAILNET:-tail4ecae1.ts.net}"
API="${TAILSCALE_API_BASE:-https://api.tailscale.com/api/v2}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ACL_PATCH="${ACL_PATCH:-$ROOT/infrastructure/tailscale/acl-policy.example.json}"
DRY_RUN="${DRY_RUN:-0}"
case "${DRY_RUN}" in
  1|true|TRUE|yes|YES) DRY_RUN=1 ;;
  *) DRY_RUN=0 ;;
esac

# Hostnames / prefixes to keep even if tagged k8s
# Updated to handle office, office-1, office-2, office-3 naming
# Regex matches: office, office-1, office-2, office-3, github-omv, omv-ha, cloudless-k3s-operator
KEEP_RE='^(office(-[123])?|github-omv|omv-ha|cloudless-k3s-operator)$'

# Stale patterns from Jul rebuild / per-service proxies
STALE_RE='^(monitoring-proxies-[0-9]+|monitoring-proxy-[0-9]+|appflowy|cloudless-app|cloudless-manager|grafana|meilisearch|n8n|postgres|redis|sync-webhook|k3s-subnet-router(-[0-9]+)?|tailscale-operator(-[0-9]+)?)$'

need() { command -v "$1" >/dev/null || { echo "missing $1"; exit 1; }; }
need curl
need jq
need python3

auth_header() {
  if [[ -n "${TS_API_KEY:-}" ]]; then
    # API access tokens use HTTP basic with key as username
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
  if [[ -z "$tok" || "$tok" == null ]]; then
    echo "OAuth token exchange failed" >&2
    exit 2
  fi
  echo "Authorization: Bearer $tok"
}

AUTH="$(auth_header)"
echo "==> Authenticated for tailnet $TAILNET"

echo "==> GET current ACL"
ACL_TMP=$(mktemp)
HDR_TMP=$(mktemp)
HTTP=$(curl -sS -D "$HDR_TMP" -o "$ACL_TMP" -w '%{http_code}' \
  -H "$AUTH" -H 'Accept: application/json' \
  "$API/tailnet/$TAILNET/acl")
if [[ "$HTTP" != "200" ]]; then
  echo "GET ACL failed HTTP $HTTP: $(head -c 400 "$ACL_TMP")" >&2
  exit 1
fi
ETAG=$(awk -F': ' 'BEGIN{IGNORECASE=1} /^etag:/{gsub(/\r/,"",$2); print $2; exit}' "$HDR_TMP")
echo "    ETag: ${ETAG:-none}"

echo "==> Merge fabric ACL patch from $ACL_PATCH"
MERGED=$(mktemp)
python3 - "$ACL_TMP" "$ACL_PATCH" "$MERGED" <<'PY'
import json, sys
cur_path, patch_path, out_path = sys.argv[1:4]
with open(cur_path) as f:
    cur = json.load(f)
with open(patch_path) as f:
    patch = json.load(f)

def deep_merge_dict(a, b):
    out = dict(a or {})
    for k, v in (b or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge_dict(out[k], v)
        else:
            out[k] = v
    return out

# tagOwners / autoApprovers: deep merge
for key in ("tagOwners", "autoApprovers"):
    if key in patch:
        # API may return camelCase or as-is; normalize common forms
        cur_key = key if key in cur else key[0].lower() + key[1:]
        # Tailscale JSON often uses exact keys: tagOwners, autoApprovers
        for candidate in (key, key[0].upper() + key[1:], key.lower()):
            if candidate in cur or candidate == key:
                cur_key = candidate if candidate in cur else key
                break
        cur[key] = deep_merge_dict(cur.get(key, {}), patch[key])

# grants: upsert by (src,dst) so harden passes replace old "*" rules
if "grants" in patch:
    existing = cur.get("grants") or cur.get("Grants") or []
    key = "grants"
    if "grants" not in cur and "Grants" in cur:
        key = "Grants"

    def grant_key(g):
        src = tuple(sorted(g.get("src") or []))
        dst = tuple(sorted(g.get("dst") or []))
        return (src, dst)

    by = {grant_key(g): g for g in existing}
    for g in patch["grants"]:
        by[grant_key(g)] = g
    # Drop obsolete member→app-connector / member→k8s wide opens if patch
    # redefined those destinations (already replaced via grant_key).
    cur[key] = list(by.values())
    if key == "grants" and "Grants" in cur:
        del cur["Grants"]
    print("grants:", len(cur[key]))

# ssh: example policy is authoritative (full replace of ssh section)
if "ssh" in patch:
    cur["ssh"] = patch["ssh"]
    print("ssh rules:", len(cur["ssh"]))

# nodeAttrs: merge tailscale.com/app-connectors by name into target "*"
if "nodeAttrs" in patch:
    cur_attrs = cur.setdefault("nodeAttrs", [])
    # Find or create the catch-all attr block
    star = None
    for attr in cur_attrs:
        if attr.get("target") == ["*"] or attr.get("target") == "*":
            star = attr
            break
    if star is None:
        star = {"target": ["*"], "app": {}}
        cur_attrs.append(star)
    app = star.setdefault("app", {})
    key = "tailscale.com/app-connectors"
    existing = {c.get("name"): c for c in (app.get(key) or []) if c.get("name")}
    for conn in patch["nodeAttrs"][0].get("app", {}).get(key, []):
        name = conn.get("name")
        if not name:
            continue
        existing[name] = conn
    app[key] = list(existing.values())
    print("app-connectors:", ", ".join(sorted(existing)))

with open(out_path, "w") as f:
    json.dump(cur, f, indent=2)
    f.write("\n")
print("merged keys:", ", ".join(sorted(cur.keys())))
PY

if [[ "$DRY_RUN" == "1" ]]; then
  echo "==> DRY_RUN=1 — ACL diff (not posted)"
  diff -u <(jq -S . "$ACL_TMP") <(jq -S . "$MERGED") || true
else
  echo "==> POST merged ACL"
  ARGS=(-H "$AUTH" -H 'Content-Type: application/json' -H 'Accept: application/json')
  [[ -n "$ETAG" ]] && ARGS+=(-H "If-Match: $ETAG")
  HTTP=$(curl -sS -o /tmp/acl-post.json -w '%{http_code}' \
    "${ARGS[@]}" --data-binary @"$MERGED" \
    "$API/tailnet/$TAILNET/acl")
  if [[ "$HTTP" != "200" ]]; then
    echo "POST ACL failed HTTP $HTTP: $(head -c 800 /tmp/acl-post.json)" >&2
    exit 1
  fi
  echo "    ACL updated"
fi

if [[ "${ACL_ONLY:-0}" == "1" || "${ACL_ONLY:-}" == "true" ]]; then
  echo "==> ACL_ONLY=1 — skipping device cleanup"
  rm -f "$ACL_TMP" "$HDR_TMP" "$MERGED"
  echo "==> Done"
  exit 0
fi

echo "==> List devices"
DEVICES=$(mktemp)
HTTP=$(curl -sS -o "$DEVICES" -w '%{http_code}' \
  -H "$AUTH" -H 'Accept: application/json' \
  "$API/tailnet/$TAILNET/devices")
if [[ "$HTTP" != "200" ]]; then
  echo "GET devices failed HTTP $HTTP: $(head -c 400 "$DEVICES")" >&2
  exit 1
fi

python3 - "$DEVICES" "$STALE_RE" "$KEEP_RE" "$DRY_RUN" "$AUTH" "$API" <<'PY'
import json, re, sys, urllib.error, urllib.request
path, stale_re, keep_re, dry, auth, api = sys.argv[1:7]
stale = re.compile(stale_re)
keep = re.compile(keep_re)
data = json.load(open(path))
devices = data.get("devices") or data.get("Devices") or []
to_delete = []
offline_devices = []
for d in devices:
    name = d.get("hostname") or d.get("name") or ""
    short = name.split(".")[0]
    tags = d.get("tags") or []
    last = d.get("lastSeen") or ""
    # Check if device is offline (lastSeen more than 1 day ago or explicitly marked offline)
    is_offline = d.get("offline", False) or d.get("expired", False)
    if not is_offline and last:
        try:
            from datetime import datetime, timezone
            last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            age_hours = (now - last_dt).total_seconds() / 3600
            is_offline = age_hours > 24  # Offline if no seen in 24h
        except:
            pass
    
    if keep.match(short):
        print(f"KEEP  {short}  tags={tags}")
        # Report if offline but kept
        if is_offline:
            print(f"      WARNING: Device {short} is offline! Reconnect before removing from keep list.")
        continue
    if stale.match(short):
        to_delete.append(d)
        offline_status = " (OFFLINE)" if is_offline else ""
        print(f"STALE {short}  id={d.get('id')}  tags={tags}  lastSeen={last}{offline_status}")
        continue
    if any(t == "tag:k8s" for t in tags) and short not in (
        "ingress-0", "ingress-1", "kube-0", "kube-1",
        "k3s-cidrs-0", "k3s-cidrs-1",
    ):
        if (
            "proxy" in short
            or "monitoring" in short
            or short
            in {
                "appflowy",
                "n8n",
                "grafana",
                "meilisearch",
                "postgres",
                "redis",
                "sync-webhook",
                "cloudless-app",
                "cloudless-manager",
            }
        ):
            to_delete.append(d)
            print(f"STALE {short}  id={d.get('id')}  (tag:k8s leftover)")

# Report offline devices separately for attention
for d in devices:
    name = d.get("hostname") or d.get("name") or ""
    short = name.split(".")[0]
    is_offline = d.get("offline", False) or d.get("expired", False)
    if not is_offline and d.get("lastSeen"):
        try:
            from datetime import datetime, timezone
            last_dt = datetime.fromisoformat(d.get("lastSeen").replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            age_hours = (now - last_dt).total_seconds() / 3600
            is_offline = age_hours > 24
        except:
            pass
    if is_offline and keep.match(short):
        offline_devices.append((short, d.get("id")))

if offline_devices:
    print(f"\n!!! OFFLINE DEVICES (may need reconnection):")
    for short, dev_id in offline_devices:
        print(f"    - {short} ({dev_id})")

print(f"\nWill delete {len(to_delete)} stale device(s)")
if dry == "1":
    print("DRY_RUN=1 — skipping DELETE")
    sys.exit(0)

hdr_name, hdr_val = auth.split(": ", 1)
for d in to_delete:
    did = d.get("id")
    short = (d.get("hostname") or d.get("name") or "").split(".")[0]
    req = urllib.request.Request(f"{api}/device/{did}", method="DELETE")
    req.add_header(hdr_name, hdr_val)
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"DELETED {short} ({did}) HTTP {resp.status}")
    except urllib.error.HTTPError as e:
        body = e.read()[:400]
        print(f"FAIL delete {short} ({did}): HTTP {e.code} {body}", file=sys.stderr)
        sys.exit(1)
PY
echo "==> Done"
rm -f "$ACL_TMP" "$HDR_TMP" "$MERGED" "$DEVICES"
