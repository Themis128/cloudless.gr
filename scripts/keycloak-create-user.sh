#!/usr/bin/env bash
#
# keycloak-create-user.sh — admin-provision a Keycloak user via kcadm, run inside
# the keycloak pod so the admin password never leaves the cluster.
#
# Self-service registration is DISABLED on the master realm (the hosted
# /registrations page returns the login screen), so users are admin-provisioned.
# This is the supported "create a user" path; the e2e suite uses the same idea
# (scripts/e2e-keycloak-provision.sh).
#
# Idempotent: an existing user (matched by username/email) is reused — only its
# password (and optional admin-group membership) is (re)set.
#
# Env:
#   EMAIL       (required)  username + email of the account
#   PASSWORD    (optional)  generated if unset; printed on a `CREDENTIAL` line
#   ADMIN       (1)         add to the Keycloak `admin` group (→ app admin)
#   TEMPORARY   (1)         password must be reset on first login
#   NAMESPACE / DEPLOYMENT / REALM   (default keycloak / keycloak / master)
#
# Usage:
#   EMAIL=user@cloudless.gr bash scripts/keycloak-create-user.sh
#   EMAIL=admin@cloudless.gr ADMIN=1 bash scripts/keycloak-create-user.sh
#
# Requires a kubectl context with exec on the keycloak pod (the
# keycloak-create-user.yml workflow supplies one via Tailscale + KUBECONFIG_B64).

set -uo pipefail

: "${EMAIL:?set EMAIL=user@domain}"
NAMESPACE="${NAMESPACE:-keycloak}"
DEPLOYMENT="${DEPLOYMENT:-keycloak}"
REALM="${REALM:-master}"
ADMIN="${ADMIN:-0}"
TEMPORARY="${TEMPORARY:-0}"
# Default password: alphanumeric (no shell/url-special chars) + complexity tail.
PASSWORD="${PASSWORD:-$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)Aa1}"

command -v kubectl >/dev/null 2>&1 || { echo "error: kubectl not found / no cluster access"; exit 1; }
POD=$(kubectl -n "$NAMESPACE" get pod -l app="$DEPLOYMENT" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
[ -n "$POD" ] || { echo "error: no $DEPLOYMENT pod in ns/$NAMESPACE"; exit 1; }

# Lines starting with CREDENTIAL carry secrets — the workflow strips them before
# posting to the tracking issue, but a local run shows them so you can log in.
echo "CREDENTIAL email=$EMAIL password=$PASSWORD"
echo "pod=$POD realm=$REALM admin=$ADMIN temporary=$TEMPORARY"

kubectl -n "$NAMESPACE" exec -i "$POD" -- env \
  NU="$EMAIL" NP="$PASSWORD" RL="$REALM" AD="$ADMIN" TMP="$TEMPORARY" bash -s <<'EOS'
set -u
K=/opt/keycloak/bin/kcadm.sh
UUID='[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}'
AU="${KEYCLOAK_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}}"
AP="${KEYCLOAK_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:-}}"
$K config credentials --server http://localhost:8080 --realm master --user "$AU" --password "$AP" >/dev/null 2>&1 \
  || { echo "ADMIN_AUTH=failed (no usable admin creds in pod env)"; exit 0; }
echo "ADMIN_AUTH=ok"

ID=$($K get users -r "$RL" -q username="$NU" --fields id 2>/dev/null | grep -o "$UUID" | head -1)
if [ -z "$ID" ]; then
  ID=$($K create users -r "$RL" -s username="$NU" -s email="$NU" -s enabled=true -s emailVerified=true -i 2>/dev/null) \
    || { echo "CREATE=failed"; exit 0; }
  echo "CREATE=ok id=$ID"
else
  echo "EXISTS=ok id=$ID"
fi

TF=false; [ "$TMP" = "1" ] && TF=true
$K set-password -r "$RL" --userid "$ID" --new-password "$NP" --temporary=$TF >/dev/null 2>&1 \
  && echo "PW_SET=ok(temporary=$TF)" || echo "PW_SET=failed"

if [ "$AD" = "1" ]; then
  GID=$($K get groups -r "$RL" --fields id,name 2>/dev/null \
        | awk -v RS='}' '/"name"[ ]*:[ ]*"admin"/' | grep -o "$UUID" | head -1)
  if [ -n "$GID" ]; then
    $K update "users/$ID/groups/$GID" -r "$RL" -s realm="$RL" -s userId="$ID" -s groupId="$GID" -n >/dev/null 2>&1 \
      && echo "ADMIN_GROUP=added" || echo "ADMIN_GROUP=failed"
  else
    echo "ADMIN_GROUP=group_not_found"
  fi
fi

echo "ACCOUNT:"; $K get "users/$ID" -r "$RL" --fields username,email,enabled,emailVerified 2>/dev/null

# Verify the password authenticates. The keycloak image has no curl, so use
# kcadm itself: logging in as the new user via admin-cli direct grant (into a
# throwaway config) proves the credentials work.
if $K config credentials --config /tmp/userverify.json \
     --server http://localhost:8080 --realm "$RL" \
     --client admin-cli --user "$NU" --password "$NP" >/dev/null 2>&1; then
  echo "LOGIN_VERIFIED=yes (password authenticates against Keycloak)"
else
  echo "LOGIN_VERIFIED=no (direct grant as user failed)"
fi
rm -f /tmp/userverify.json 2>/dev/null || true
EOS
