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
# NOTE: the keycloak image has no awk/jq/python — parse kcadm CSV with grep/cut.
# NOTE: $UID is a bash readonly var (=1000); use $USERID for the Keycloak user id.
K=/opt/keycloak/bin/kcadm.sh
csv() { $K get "$@" --format csv --noquotes 2>/dev/null; }
AU="${KEYCLOAK_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}}"
AP="${KEYCLOAK_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:-}}"
$K config credentials --server http://localhost:8080 --realm master --user "$AU" --password "$AP" >/dev/null 2>&1 \
  || { echo "ADMIN_AUTH=failed"; exit 0; }
echo "ADMIN_AUTH=ok"

# 1) admin group  (CSV row is "id,name"; keep the one whose name is exactly admin)
admin_gid() { csv groups -r "$RL" -q search=admin --fields id,name | grep -iE ',admin$' | head -1 | cut -d, -f1; }
GID=$(admin_gid)
if [ -z "$GID" ]; then
  $K create groups -r "$RL" -s name=admin >/dev/null 2>&1
  GID=$(admin_gid)
  echo "ADMIN_GROUP=created ($GID)"
else
  echo "ADMIN_GROUP=present ($GID)"
fi

# 2) groups membership mapper on the next-auth client — ensure it is CORRECT.
# isAdmin() checks groups.includes("admin"), so the mapper MUST emit "admin"
# (full.path=false) under claim.name=groups, in both id & access tokens. A wrong
# full.path=true would emit "/admin" and silently break admin detection.
MAPPER_JSON='{"name":"groups","protocol":"openid-connect","protocolMapper":"oidc-group-membership-mapper","config":{"full.path":"false","id.token.claim":"true","access.token.claim":"true","userinfo.token.claim":"true","claim.name":"groups"}}'
CUUID=$(csv clients -r "$RL" -q clientId="$CID" --fields id | head -1)
if [ -z "$CUUID" ]; then
  echo "CLIENT=$CID NOT_FOUND (cannot add groups mapper!)"
else
  MID=$(csv "clients/$CUUID/protocol-mappers/models" -r "$RL" --fields id,name | grep ',groups$' | head -1 | cut -d, -f1)
  if [ -n "$MID" ]; then
    CFG=$($K get "clients/$CUUID/protocol-mappers/models/$MID" -r "$RL" 2>/dev/null)
    FP=$(printf '%s' "$CFG" | grep -oE '"full.path"[ ]*:[ ]*"[a-z]+"' | grep -oE '(true|false)$')
    CN=$(printf '%s' "$CFG" | grep -oE '"claim.name"[ ]*:[ ]*"[^"]+"' | sed -E 's/.*"([^"]+)"$/\1/')
    IDC=$(printf '%s' "$CFG" | grep -oE '"id.token.claim"[ ]*:[ ]*"[a-z]+"' | grep -oE '(true|false)$')
    ATC=$(printf '%s' "$CFG" | grep -oE '"access.token.claim"[ ]*:[ ]*"[a-z]+"' | grep -oE '(true|false)$')
    echo "GROUPS_MAPPER=present on $CID (full.path=$FP claim.name=$CN id.token=$IDC access.token=$ATC)"
    if [ "$FP" != "false" ] || [ "$CN" != "groups" ] || [ "$IDC" != "true" ] || [ "$ATC" != "true" ]; then
      $K delete "clients/$CUUID/protocol-mappers/models/$MID" -r "$RL" >/dev/null 2>&1
      printf '%s' "$MAPPER_JSON" > /tmp/groups-mapper.json
      $K create "clients/$CUUID/protocol-mappers/models" -r "$RL" -f /tmp/groups-mapper.json >/dev/null 2>&1 \
        && echo "GROUPS_MAPPER=reconfigured to correct config" || echo "GROUPS_MAPPER=reconfigure_failed"
    else
      echo "GROUPS_MAPPER=config_ok (emits 'admin' in id+access tokens)"
    fi
  else
    printf '%s' "$MAPPER_JSON" > /tmp/groups-mapper.json
    $K create "clients/$CUUID/protocol-mappers/models" -r "$RL" -f /tmp/groups-mapper.json >/dev/null 2>&1 \
      && echo "GROUPS_MAPPER=created on $CID" || echo "GROUPS_MAPPER=create_failed on $CID"
  fi
fi

# 3) the admin user
USERID=$(csv users -r "$RL" -q username="$NU" --fields id | head -1)
if [ -z "$USERID" ]; then
  USERID=$($K create users -r "$RL" -s username="$NU" -s email="$NU" -s enabled=true -s emailVerified=true -i 2>/dev/null) \
    || { echo "USER=create_failed"; exit 0; }
  echo "USER=created ($USERID)"
else
  echo "USER=present ($USERID)"
fi
if [ -n "$NP" ]; then
  $K set-password -r "$RL" --userid "$USERID" --new-password "$NP" >/dev/null 2>&1 \
    && echo "PW_SET=ok" || echo "PW_SET=failed"
else
  echo "PW_SET=skipped (no ADMIN_PASSWORD; set via forgot-password or re-run with the secret)"
fi

# 4) membership + single-admin enforcement
$K update "users/$USERID/groups/$GID" -r "$RL" -s realm="$RL" -s userId="$USERID" -s groupId="$GID" -n >/dev/null 2>&1 \
  && echo "MEMBERSHIP=added" || echo "MEMBERSHIP=already/failed"
# Only strip OTHER admins once the sole admin actually has a password set —
# otherwise we'd leave a passwordless account as the only admin (lockout).
if [ -n "$NP" ]; then
  for m in $(csv "groups/$GID/members" -r "$RL" --fields id); do
    if [ "$m" != "$USERID" ] && [ -n "$m" ]; then
      $K delete "users/$m/groups/$GID" -r "$RL" >/dev/null 2>&1 && echo "REMOVED_OTHER_ADMIN=$m"
    fi
  done
else
  echo "SINGLE_ADMIN=deferred (no password set yet — not removing existing admins to avoid lockout)"
fi

# 5) verify the admin's password authenticates (kcadm direct grant as the user)
if [ -n "$NP" ]; then
  $K config credentials --config /tmp/av.json --server http://localhost:8080 --realm "$RL" \
     --client admin-cli --user "$NU" --password "$NP" >/dev/null 2>&1 \
    && echo "LOGIN_VERIFIED=yes" || echo "LOGIN_VERIFIED=no"
  rm -f /tmp/av.json 2>/dev/null || true
fi
# Show current admin-group members for confirmation.
echo "ADMIN_MEMBERS:"; csv "groups/$GID/members" -r "$RL" --fields username,email | sed 's/^/  /'
echo "DONE: mapper on '$CID' emits the groups claim; '$NU' is in the admin group."
EOS
