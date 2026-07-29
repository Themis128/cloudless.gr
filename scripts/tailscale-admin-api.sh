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

# Hostnames / prefixes to keep even if tagged k8s
KEEP_RE='^(office|github-omv|omv-ha|cloudless-k3s-operator)$'

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

# grants: append missing by stable JSON identity
if "grants" in patch:
    existing = cur.get("grants") or cur.get("Grants") or []
    # Prefer lowercase grants (modern)
    key = "grants" if "grants" in cur or "grants" in patch else "Grants"
    if "grants" not in cur and "Grants" in cur:
        key = "Grants"
    else:
        key = "grants"
    have = {json.dumps(g, sort_keys=True) for g in existing}
    merged = list(existing)
    for g in patch["grants"]:
        sig = json.dumps(g, sort_keys=True)
        if sig not in have:
            merged.append(g)
            have.add(sig)
    cur[key] = merged
    # Drop alternate casing duplicate if we standardized
    if key == "grants" and "Grants" in cur and "grants" in cur:
        del cur["Grants"]

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
for d in devices:
    name = d.get("hostname") or d.get("name") or ""
    short = name.split(".")[0]
    tags = d.get("tags") or []
    last = d.get("lastSeen") or ""
    if keep.match(short):
        print(f"KEEP  {short}  tags={tags}")
        continue
    if stale.match(short):
        to_delete.append(d)
        print(f"STALE {short}  id={d.get('id')}  tags={tags}  lastSeen={last}")
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

print(f"\nWill delete {len(to_delete)} device(s)")
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
