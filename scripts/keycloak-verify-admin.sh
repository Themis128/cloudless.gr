#!/usr/bin/env bash
#
# keycloak-verify-admin.sh — prove (without a login) that the admin's cloudless-app
# token carries groups:["admin"], so the /admin gate + post-login resolver route
# them correctly. Uses Keycloak's evaluate-scopes example-token endpoint via kcadm.

set -uo pipefail
NS="${NS:-keycloak}"; DEP="${DEP:-keycloak}"; RL="${RL:-master}"
CID="${CID:-cloudless-app}"; ADMIN_EMAIL="${ADMIN_EMAIL:-tbaltzakis@cloudless.gr}"
command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found"; exit 1; }
POD=$(kubectl -n "$NS" get pod -l app="$DEP" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
[ -n "$POD" ] || { echo "no $DEP pod"; exit 1; }

kubectl -n "$NS" exec -i "$POD" -- env RL="$RL" CID="$CID" NU="$ADMIN_EMAIL" bash -s <<'EOS'
set -u
K=/opt/keycloak/bin/kcadm.sh
csv() { $K get "$@" --format csv --noquotes 2>/dev/null; }
AU="${KEYCLOAK_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}}"
AP="${KEYCLOAK_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:-}}"
$K config credentials --server http://localhost:8080 --realm master --user "$AU" --password "$AP" >/dev/null 2>&1 || { echo "ADMIN_AUTH=failed"; exit 0; }
CUUID=$(csv clients -r "$RL" -q clientId="$CID" --fields id | head -1)
USERID=$(csv users -r "$RL" -q username="$NU" --fields id | head -1)
echo "client=$CID($CUUID) user=$NU($USERID)"
echo "group memberships:"; csv "users/$USERID/groups" -r "$RL" --fields name | sed 's/^/  /'
echo "--- example id token cloudless-app would issue for $NU ---"
TOK=$($K get "clients/$CUUID/evaluate-scopes/generate-example-id-token" -r "$RL" -q "userId=$USERID" -q "scope=openid" 2>&1)
echo "$TOK" | grep -A4 '"groups"' || echo "  (no groups claim in example token)"
if echo "$TOK" | tr -d ' \n' | grep -q '"groups":\["admin"\]\|"groups":\[.*"admin".*\]'; then
  echo "RESULT=PASS (token carries groups including 'admin' -> isAdmin() true)"
else
  echo "RESULT=FAIL (groups/admin not in token)"
fi
EOS
