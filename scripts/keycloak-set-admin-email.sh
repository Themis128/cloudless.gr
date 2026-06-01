#!/usr/bin/env bash
#
# keycloak-set-admin-email.sh — ensure a Keycloak user has its email set +
# verified. The website keys several features (purchases lookup, calendar) off
# the user's email claim; a blank email blocks them. Idempotent.
#
# Runs kcadm inside the keycloak pod (admin password never leaves the cluster).
set -uo pipefail
NS="${NS:-keycloak}"; DEP="${DEP:-keycloak}"; RL="${RL:-master}"
USERNAME="${USERNAME:-tbaltzakis@cloudless.gr}"
EMAIL="${EMAIL:-tbaltzakis@cloudless.gr}"
command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found"; exit 1; }
POD=$(kubectl -n "$NS" get pod -l app="$DEP" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
[ -n "$POD" ] || { echo "no $DEP pod"; exit 1; }

kubectl -n "$NS" exec -i "$POD" -- env RL="$RL" NU="$USERNAME" EM="$EMAIL" bash -s <<'EOS'
set -u
K=/opt/keycloak/bin/kcadm.sh
AU="${KEYCLOAK_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}}"
AP="${KEYCLOAK_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:-}}"
$K config credentials --server http://localhost:8080 --realm master --user "$AU" --password "$AP" >/dev/null 2>&1 || { echo "ADMIN_AUTH=failed"; exit 7; }
# NB: $UID is a bash readonly builtin — use USERID.
USERID=$($K get users -r "$RL" -q username="$NU" --fields id --format csv --noquotes | head -1)
[ -n "$USERID" ] || { echo "USER_NOT_FOUND=$NU"; exit 1; }
echo "user=$NU id=$USERID"
echo -n "before: "; $K get "users/$USERID" -r "$RL" --fields email,emailVerified --format csv --noquotes
$K update "users/$USERID" -r "$RL" -s "email=$EM" -s 'emailVerified=true' && echo "SET_OK" || echo "SET_FAIL"
echo -n "after:  "; $K get "users/$USERID" -r "$RL" --fields email,emailVerified --format csv --noquotes
echo -n "RESULT="; $K get "users/$USERID" -r "$RL" --fields email --format csv --noquotes | grep -qi "$EM" && echo "PASS" || echo "FAIL"
EOS
