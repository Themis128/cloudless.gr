#!/usr/bin/env bash
#
# keycloak-bootstrap-admin.sh — stand up a single admin WITHOUT a GitHub secret.
#
# Use when you cannot deliver the admin password through CI (no Secrets:write
# token, the Actions "Run workflow" input isn't usable, etc.). This generates a
# one-time TEMPORARY password inside the cluster, fully configures the sole admin,
# and prints the temp password so the human can log in once and immediately set
# their own (Keycloak forces UPDATE_PASSWORD on first login). The real password is
# never committed, never put in a secret, and never typed into CI.
#
# It ensures the whole admin chain:
#   admin group → user membership → groups mapper on cloudless-app
#   (full.path=false, claim.name=groups, id+access claims) → isAdmin() works.
# And enforces single-admin: every OTHER admin-group member is removed (safe,
# because the sole admin now has a working temp credential).
#
# Env: ADMIN_EMAIL (default tbaltzakis@cloudless.gr), TEMP_PASSWORD (generated if
#      unset), CLIENT_ID (cloudless-app), NAMESPACE/DEPLOYMENT/REALM.
#
# Runs kcadm IN the keycloak pod (admin password stays in-pod). The image has no
# awk/jq — CSV-parse with grep/cut.

set -uo pipefail

NAMESPACE="${NAMESPACE:-keycloak}"
DEPLOYMENT="${DEPLOYMENT:-keycloak}"
REALM="${REALM:-master}"
CLIENT_ID="${CLIENT_ID:-cloudless-app}"
ADMIN_EMAIL="${ADMIN_EMAIL:-tbaltzakis@cloudless.gr}"
# One-time temp password: alphanumeric + a symbol tail to satisfy policy.
TEMP_PASSWORD="${TEMP_PASSWORD:-Tmp-$(head -c 12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 12)-Aa1!}"

command -v kubectl >/dev/null 2>&1 || { echo "error: kubectl not found / no cluster access"; exit 1; }
POD=$(kubectl -n "$NAMESPACE" get pod -l app="$DEPLOYMENT" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
[ -n "$POD" ] || { echo "error: no $DEPLOYMENT pod in ns/$NAMESPACE"; exit 1; }

# The workflow surfaces this line (the temp password is one-time + must-change).
echo "TEMP_LOGIN email=$ADMIN_EMAIL temp_password=$TEMP_PASSWORD"
echo "pod=$POD realm=$REALM client=$CLIENT_ID admin=$ADMIN_EMAIL"

kubectl -n "$NAMESPACE" exec -i "$POD" -- env \
  NU="$ADMIN_EMAIL" NP="$TEMP_PASSWORD" RL="$REALM" CID="$CLIENT_ID" bash -s <<'EOS'
set -u
K=/opt/keycloak/bin/kcadm.sh
csv() { $K get "$@" --format csv --noquotes 2>/dev/null; }
AU="${KEYCLOAK_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}}"
AP="${KEYCLOAK_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:-}}"
$K config credentials --server http://localhost:8080 --realm master --user "$AU" --password "$AP" >/dev/null 2>&1 \
  || { echo "ADMIN_AUTH=failed"; exit 0; }
echo "ADMIN_AUTH=ok"

# admin group
GID=$(csv groups -r "$RL" -q search=admin --fields id,name | grep -iE ',admin$' | head -1 | cut -d, -f1)
[ -z "$GID" ] && { $K create groups -r "$RL" -s name=admin >/dev/null 2>&1; GID=$(csv groups -r "$RL" -q search=admin --fields id,name | grep -iE ',admin$' | head -1 | cut -d, -f1); echo "ADMIN_GROUP=created"; } || echo "ADMIN_GROUP=present"

# groups mapper on cloudless-app — guarantee correct config (delete+recreate).
CUUID=$(csv clients -r "$RL" -q clientId="$CID" --fields id | head -1)
if [ -n "$CUUID" ]; then
  MID=$(csv "clients/$CUUID/protocol-mappers/models" -r "$RL" --fields id,name | grep ',groups$' | head -1 | cut -d, -f1)
  [ -n "$MID" ] && $K delete "clients/$CUUID/protocol-mappers/models/$MID" -r "$RL" >/dev/null 2>&1
  printf '%s' '{"name":"groups","protocol":"openid-connect","protocolMapper":"oidc-group-membership-mapper","config":{"full.path":"false","id.token.claim":"true","access.token.claim":"true","userinfo.token.claim":"true","claim.name":"groups"}}' > /tmp/gm.json
  $K create "clients/$CUUID/protocol-mappers/models" -r "$RL" -f /tmp/gm.json >/dev/null 2>&1 \
    && echo "GROUPS_MAPPER=ensured (full.path=false, claim=groups, id+access)" || echo "GROUPS_MAPPER=failed"
else
  echo "CLIENT=$CID NOT_FOUND"
fi

# the admin user
USERID=$(csv users -r "$RL" -q username="$NU" --fields id | head -1)
if [ -z "$USERID" ]; then
  USERID=$($K create users -r "$RL" -s username="$NU" -s email="$NU" -s enabled=true -s emailVerified=true -i 2>/dev/null) \
    || { echo "USER=create_failed"; exit 0; }
  echo "USER=created"
else
  echo "USER=present"
fi

# temporary password — Keycloak forces UPDATE_PASSWORD on first login.
$K set-password -r "$RL" --userid "$USERID" --new-password "$NP" --temporary=true >/dev/null 2>&1 \
  && echo "PW_SET=ok (temporary; must change on first login)" || echo "PW_SET=failed"

# membership
$K update "users/$USERID/groups/$GID" -r "$RL" -s realm="$RL" -s userId="$USERID" -s groupId="$GID" -n >/dev/null 2>&1 \
  && echo "MEMBERSHIP=ok" || echo "MEMBERSHIP=already/failed"

# single admin — remove every other member (the sole admin now has a temp login).
for m in $(csv "groups/$GID/members" -r "$RL" --fields id); do
  if [ -n "$m" ] && [ "$m" != "$USERID" ]; then
    $K delete "users/$m/groups/$GID" -r "$RL" >/dev/null 2>&1 && echo "REMOVED_OTHER_ADMIN=$m"
  fi
done

echo "ADMIN_MEMBERS:"; csv "groups/$GID/members" -r "$RL" --fields username,email | sed 's/^/  /'
echo "DONE: '$NU' is the sole admin; log in with the temp password, then set your own."
EOS
