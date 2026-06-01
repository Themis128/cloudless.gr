#!/usr/bin/env bash
#
# keycloak-enable-signup.sh — toggle self-service registration on the realm via
# kcadm inside the keycloak pod (admin password stays in-pod).
#
# By default the master realm has registrationAllowed=false, so the website's
# "Create Account" button cannot self-enrol users. Set it true to let visitors
# register themselves; also enables login-with-email and the "forgot password"
# reset flow, which the app's signup/forgot-password pages expect.
#
# Env: ENABLE (true|false, default true), NAMESPACE, DEPLOYMENT, REALM.
# Usage: bash scripts/keycloak-enable-signup.sh        # enable
#        ENABLE=false bash scripts/keycloak-enable-signup.sh   # disable

set -uo pipefail

NAMESPACE="${NAMESPACE:-keycloak}"
DEPLOYMENT="${DEPLOYMENT:-keycloak}"
REALM="${REALM:-master}"
ENABLE="${ENABLE:-true}"

command -v kubectl >/dev/null 2>&1 || { echo "error: kubectl not found / no cluster access"; exit 1; }
POD=$(kubectl -n "$NAMESPACE" get pod -l app="$DEPLOYMENT" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
[ -n "$POD" ] || { echo "error: no $DEPLOYMENT pod in ns/$NAMESPACE"; exit 1; }

kubectl -n "$NAMESPACE" exec -i "$POD" -- env RL="$REALM" EN="$ENABLE" bash -s <<'EOS'
set -u
K=/opt/keycloak/bin/kcadm.sh
AU="${KEYCLOAK_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}}"
AP="${KEYCLOAK_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:-}}"
$K config credentials --server http://localhost:8080 --realm master --user "$AU" --password "$AP" >/dev/null 2>&1 \
  || { echo "ADMIN_AUTH=failed"; exit 0; }
get() { $K get "realms/$RL" --fields "$1" 2>/dev/null | grep -o 'true\|false' | head -1; }
echo "BEFORE: registrationAllowed=$(get registrationAllowed) resetPasswordAllowed=$(get resetPasswordAllowed) loginWithEmailAllowed=$(get loginWithEmailAllowed)"
$K update "realms/$RL" \
  -s registrationAllowed="$EN" \
  -s resetPasswordAllowed=true \
  -s loginWithEmailAllowed=true >/dev/null 2>&1 \
  && echo "UPDATE=ok (registrationAllowed=$EN)" || echo "UPDATE=failed"
echo "AFTER:  registrationAllowed=$(get registrationAllowed) resetPasswordAllowed=$(get resetPasswordAllowed) loginWithEmailAllowed=$(get loginWithEmailAllowed)"
EOS
