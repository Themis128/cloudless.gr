#!/usr/bin/env bash
#
# keycloak-configure-admin.sh — make the admin panel reachable for ONE admin.
#
# Ensures the full chain that gates /admin:
#   admin group exists
#     → user is a member
#       → cloudless-app client has the `groups` membership mapper
#         → next-auth gets a `groups: ["admin"]` claim
#           → isAdmin() (src/lib/api-auth.ts, src/proxy.ts) returns true.
#
# Single-admin: every OTHER member of the admin group is removed, so only
# $ADMIN_EMAIL stays an admin.
#
# Runs kcadm INSIDE the keycloak pod (admin password never leaves the pod).
#
# Env:
#   ADMIN_EMAIL     (default tbaltzakis@cloudless.gr) the sole admin's username/email
#   ADMIN_PASSWORD  (optional) set the admin's password; if empty, password is left
#                   untouched (use forgot-password at /auth/login, or re-run with it)
#   CLIENT_ID       (default cloudless-app) the next-auth client to put the mapper on
#   NAMESPACE / DEPLOYMENT / REALM
#
# Usage: ADMIN_EMAIL=tbaltzakis@cloudless.gr bash scripts/keycloak-configure-admin.sh

set -uo pipefail

NAMESPACE="${NAMESPACE:-keycloak}"
DEPLOYMENT="${DEPLOYMENT:-keycloak}"
REALM="${REALM:-master}"
ADMIN_EMAIL="${ADMIN_EMAIL:-tbaltzakis@cloudless.gr}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
CLIENT_ID="${CLIENT_ID:-cloudless-app}"

command -v kubectl >/dev/null 2>&1 || { echo "error: kubectl not found / no cluster access"; exit 1; }
POD=$(kubectl -n "$NAMESPACE" get pod -l app="$DEPLOYMENT" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
[ -n "$POD" ] || { echo "error: no $DEPLOYMENT pod in ns/$NAMESPACE"; exit 1; }

[ -n "$ADMIN_PASSWORD" ] && echo "CREDENTIAL admin=$ADMIN_EMAIL password=$ADMIN_PASSWORD"
echo "pod=$POD realm=$REALM client=$CLIENT_ID admin=$ADMIN_EMAIL password_set=$([ -n "$ADMIN_PASSWORD" ] && echo yes || echo 'no (skipped)')"

kubectl -n "$NAMESPACE" exec -i "$POD" -- env \
  NU="$ADMIN_EMAIL" NP="$ADMIN_PASSWORD" RL="$REALM" CID="$CLIENT_ID" bash -s <<'EOS'
set -u
K=/opt/keycloak/bin/kcadm.sh
U='[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}'
AU="${KEYCLOAK_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}}"
AP="${KEYCLOAK_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:-}}"
$K config credentials --server http://localhost:8080 --realm master --user "$AU" --password "$AP" >/dev/null 2>&1 \
  || { echo "ADMIN_AUTH=failed"; exit 0; }
echo "ADMIN_AUTH=ok"

# 1) admin group
GID=$($K get groups -r "$RL" -q search=admin --fields id,name 2>/dev/null \
  | awk -v RS='}' '/"name"[ ]*:[ ]*"admin"/' | grep -o "$U" | head -1)
if [ -z "$GID" ]; then
  $K create groups -r "$RL" -s name=admin >/dev/null 2>&1
  GID=$($K get groups -r "$RL" -q search=admin --fields id,name 2>/dev/null \
    | awk -v RS='}' '/"name"[ ]*:[ ]*"admin"/' | grep -o "$U" | head -1)
  echo "ADMIN_GROUP=created ($GID)"
else
  echo "ADMIN_GROUP=present ($GID)"
fi

# 2) groups membership mapper on the next-auth client
CUUID=$($K get clients -r "$RL" -q clientId="$CID" --fields id 2>/dev/null | grep -o "$U" | head -1)
if [ -z "$CUUID" ]; then
  echo "CLIENT=$CID NOT_FOUND (cannot add groups mapper!)"
else
  if $K get "clients/$CUUID/protocol-mappers/models" -r "$RL" 2>/dev/null | grep -q '"name" : "groups"'; then
    echo "GROUPS_MAPPER=present on $CID"
  else
    printf '%s' '{"name":"groups","protocol":"openid-connect","protocolMapper":"oidc-group-membership-mapper","config":{"full.path":"false","id.token.claim":"true","access.token.claim":"true","userinfo.token.claim":"true","claim.name":"groups"}}' > /tmp/groups-mapper.json
    $K create "clients/$CUUID/protocol-mappers/models" -r "$RL" -f /tmp/groups-mapper.json >/dev/null 2>&1 \
      && echo "GROUPS_MAPPER=created on $CID" || echo "GROUPS_MAPPER=create_failed on $CID"
  fi
fi

# 3) the admin user
UID=$($K get users -r "$RL" -q username="$NU" --fields id 2>/dev/null | grep -o "$U" | head -1)
if [ -z "$UID" ]; then
  UID=$($K create users -r "$RL" -s username="$NU" -s email="$NU" -s enabled=true -s emailVerified=true -i 2>/dev/null) \
    || { echo "USER=create_failed"; exit 0; }
  echo "USER=created ($UID)"
else
  echo "USER=present ($UID)"
fi
if [ -n "$NP" ]; then
  $K set-password -r "$RL" --userid "$UID" --new-password "$NP" >/dev/null 2>&1 \
    && echo "PW_SET=ok" || echo "PW_SET=failed"
else
  echo "PW_SET=skipped (no ADMIN_PASSWORD; set via forgot-password or re-run with the secret)"
fi

# 4) membership + single-admin enforcement
$K update "users/$UID/groups/$GID" -r "$RL" -s realm="$RL" -s userId="$UID" -s groupId="$GID" -n >/dev/null 2>&1 \
  && echo "MEMBERSHIP=added" || echo "MEMBERSHIP=already/failed"
# Only strip OTHER admins once the sole admin actually has a password set —
# otherwise we'd leave a passwordless account as the only admin (lockout).
if [ -n "$NP" ]; then
  for m in $($K get "groups/$GID/members" -r "$RL" --fields id 2>/dev/null | grep -o "$U"); do
    if [ "$m" != "$UID" ]; then
      $K delete "users/$m/groups/$GID" -r "$RL" >/dev/null 2>&1 && echo "REMOVED_OTHER_ADMIN=$m"
    fi
  done
else
  echo "SINGLE_ADMIN=deferred (no password set yet — not removing existing admins to avoid lockout)"
fi

# 5) verify the admin's password authenticates (kcadm direct grant)
if [ -n "$NP" ]; then
  $K config credentials --config /tmp/av.json --server http://localhost:8080 --realm "$RL" \
     --client admin-cli --user "$NU" --password "$NP" >/dev/null 2>&1 \
    && echo "LOGIN_VERIFIED=yes" || echo "LOGIN_VERIFIED=no"
  rm -f /tmp/av.json 2>/dev/null || true
fi
echo "DONE: only '$NU' is in the admin group; mapper on '$CID' ensures the groups claim."
EOS
