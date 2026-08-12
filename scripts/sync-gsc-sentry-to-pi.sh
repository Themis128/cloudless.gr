#!/usr/bin/env bash
# Patch k8s cloudless-secrets on omv with GSC + Sentry keys, then restart cloudless-app.
# cloudless2 is proxy-only — secrets must live on the Pi pod.
#
# Usage (operator machine; do NOT commit secret values):
#   set -a
#   # load only the needed keys from your local env file yourself, e.g.:
#   #   source <(grep -E '^(GOOGLE_|GSC_|SENTRY_)' .env.local)
#   set +a
#   bash scripts/sync-gsc-sentry-to-pi.sh
#
# Or after this workflow lands on main:
#   gh workflow run sync-gsc-sentry-pi-secrets.yml

set -euo pipefail

SSH_HOST="${SSH_HOST:-omv}"
NS=cloudless
SECRET=cloudless-secrets

need=(
  GOOGLE_CLIENT_EMAIL
  GOOGLE_PRIVATE_KEY
  GOOGLE_CALENDAR_ID
  GSC_SITE_URL
  SENTRY_AUTH_TOKEN
)
for k in "${need[@]}"; do
  if [[ -z "${!k:-}" ]]; then
    echo "missing env: $k" >&2
    exit 1
  fi
done

: "${SENTRY_ORG:=baltzakisthemiscom}"
: "${SENTRY_PROJECT:=cloudless-gr}"

export GOOGLE_CLIENT_EMAIL GOOGLE_PRIVATE_KEY GOOGLE_CALENDAR_ID GSC_SITE_URL
export SENTRY_AUTH_TOKEN SENTRY_ORG SENTRY_PROJECT

PATCH=$(python3 -c '
import json, os, base64, re
keys = [
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_CALENDAR_ID",
  "GSC_SITE_URL",
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
]
placeholder = re.compile(r"^(your[_-]?value|your[_-]?service|changeme|todo|xxx|placeholder)", re.I)
data = {}
for k in keys:
  v = (os.environ.get(k) or "").strip()
  if not v:
    raise SystemExit(f"missing {k}")
  if placeholder.match(v):
    raise SystemExit(f"{k} looks like a placeholder; refuse to sync")
  if k == "GOOGLE_PRIVATE_KEY":
    pem = v.replace("\\n", "\n")
    if "BEGIN" not in pem or len(pem) < 200:
      raise SystemExit("GOOGLE_PRIVATE_KEY must be a PEM private key (BEGIN…, length>=200)")
    v = pem
  data[k] = base64.b64encode(v.encode()).decode()
print(json.dumps({"data": data}))
')

echo "Patching $NS/$SECRET on $SSH_HOST (key names only)…"
ssh "$SSH_HOST" "sudo k3s kubectl -n $NS patch secret $SECRET --type merge -p '$PATCH'"
ssh "$SSH_HOST" "sudo k3s kubectl -n $NS rollout restart deploy/cloudless-app"
ssh "$SSH_HOST" "sudo k3s kubectl -n $NS rollout status deploy/cloudless-app --timeout=180s"

echo "Verify key presence:"
ssh "$SSH_HOST" "sudo k3s kubectl -n $NS get secret $SECRET -o json" | python3 -c '
import json,sys
keys=set(json.load(sys.stdin).get("data",{}))
need=["GOOGLE_CLIENT_EMAIL","GOOGLE_PRIVATE_KEY","GOOGLE_CALENDAR_ID","GSC_SITE_URL","SENTRY_AUTH_TOKEN","SENTRY_ORG","SENTRY_PROJECT"]
print("present:", ", ".join(k for k in need if k in keys))
missing=[k for k in need if k not in keys]
if missing:
  raise SystemExit("MISSING: "+", ".join(missing))
print("ok")
'
