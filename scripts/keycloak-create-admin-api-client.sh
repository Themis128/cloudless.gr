#!/usr/bin/env bash
#
# keycloak-create-admin-api-client.sh — create/ensure a least-privilege Keycloak
# service-account client the website uses to list users in the admin panel.
#
# Why: /api/admin/users needs a Keycloak admin token. Using the master admin
# password from the app is over-privileged; instead we use a confidential
# client (cloudless-admin-api) whose service account holds ONLY view-users /
# query-users / query-groups. Its secret is written to SSM so the app reads it
# at runtime (KEYCLOAK_ADMIN_CLIENT_ID / KEYCLOAK_ADMIN_CLIENT_SECRET).
#
# Runs kcadm inside the keycloak pod (admin password never leaves the cluster)
# and writes SSM from the CI runner (OIDC creds). The client secret is captured
# silently and masked — never printed to logs or posted anywhere.
set -uo pipefail
NS="${NS:-keycloak}"; DEP="${DEP:-keycloak}"; RL="${RL:-master}"
CID="${CID:-cloudless-admin-api}"
SSM_PREFIX="${SSM_PREFIX:-/cloudless/production}"
command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found"; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "aws not found"; exit 1; }
POD=$(kubectl -n "$NS" get pod -l app="$DEP" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
[ -n "$POD" ] || { echo "no $DEP pod"; exit 1; }

echo "== 1) ensure client + service-account roles (in-pod) =="
kubectl -n "$NS" exec -i "$POD" -- env RL="$RL" CID="$CID" bash -s <<'EOS'
set -u
K=/opt/keycloak/bin/kcadm.sh
AU="${KEYCLOAK_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}}"
AP="${KEYCLOAK_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:-}}"
$K config credentials --server http://localhost:8080 --realm master --user "$AU" --password "$AP" >/dev/null 2>&1 || { echo "ADMIN_AUTH=failed"; exit 7; }
EXIST=$($K get clients -r "$RL" -q clientId="$CID" --fields id --format csv --noquotes | head -1)
if [ -z "$EXIST" ]; then
  $K create clients -r "$RL" \
    -s clientId="$CID" -s enabled=true -s publicClient=false \
    -s serviceAccountsEnabled=true -s standardFlowEnabled=false \
    -s directAccessGrantsEnabled=false \
    -s 'description=Least-privilege service account for admin user-management API' >/dev/null 2>&1 \
    && echo "client created" || echo "client create failed"
else
  echo "client already exists ($EXIST)"
fi
# Grant ONLY the read roles needed to list/search users + groups.
$K add-roles -r "$RL" --uusername "service-account-$CID" --cclientid realm-management \
  --rolename view-users --rolename query-users --rolename query-groups --rolename view-groups >/dev/null 2>&1 \
  && echo "roles granted" || echo "roles grant (already present or partial)"
echo -n "effective realm-management roles: "
$K get-roles -r "$RL" --uusername "service-account-$CID" --cclientid realm-management --effective --fields name --format csv --noquotes 2>/dev/null | tr '\n' ' '
echo
EOS

echo "== 2) capture client secret (silent) =="
SECRET=$(kubectl -n "$NS" exec -i "$POD" -- env RL="$RL" CID="$CID" bash -s <<'EOS'
K=/opt/keycloak/bin/kcadm.sh
AU="${KEYCLOAK_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}}"
AP="${KEYCLOAK_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:-}}"
$K config credentials --server http://localhost:8080 --realm master --user "$AU" --password "$AP" >/dev/null 2>&1
UUID=$($K get clients -r "$RL" -q clientId="$CID" --fields id --format csv --noquotes | head -1)
$K get "clients/$UUID/client-secret" -r "$RL" | grep -o '"value"[^,}]*' | head -1 | cut -d'"' -f4
EOS
)
echo "::add-mask::$SECRET"
if [ -z "$SECRET" ]; then echo "RESULT=FAIL (no client secret)"; exit 1; fi
echo "secret captured (len ${#SECRET}, masked)"

echo "== 3) write SSM (id + secret) =="
aws ssm put-parameter --name "$SSM_PREFIX/KEYCLOAK_ADMIN_CLIENT_ID" --value "$CID" --type String --overwrite >/dev/null 2>&1 \
  && echo "  $SSM_PREFIX/KEYCLOAK_ADMIN_CLIENT_ID = $CID" || { echo "PUT id FAILED"; exit 1; }
aws ssm put-parameter --name "$SSM_PREFIX/KEYCLOAK_ADMIN_CLIENT_SECRET" --value "$SECRET" --type SecureString --overwrite >/dev/null 2>&1 \
  && echo "  $SSM_PREFIX/KEYCLOAK_ADMIN_CLIENT_SECRET = (SecureString, set)" || { echo "PUT secret FAILED"; exit 1; }

# Note: the keycloak image has no curl, so the client_credentials grant is
# verified live via /api/admin/users after the app picks up the SSM values.
echo "RESULT=PASS (cloudless-admin-api ready + SSM written; app reads creds from SSM)"
