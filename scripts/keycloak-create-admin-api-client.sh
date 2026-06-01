#!/usr/bin/env bash
#
# keycloak-create-admin-api-client.sh — create/ensure a least-privilege Keycloak
# service-account client the website uses to list users in the admin panel.
#
# Why: /api/admin/users needs a Keycloak admin token. Using the master admin
# password from the app is over-privileged; instead we use a confidential
# client (cloudless-admin-api) whose service account holds ONLY view-users /
# query-users / query-groups / view-groups. Its secret is written to SSM so the
# app reads it at runtime (KEYCLOAK_ADMIN_CLIENT_ID / KEYCLOAK_ADMIN_CLIENT_SECRET).
#
# SECURITY: the client secret is NEVER printed to stdout (this script is piped
# through `tee` into a log that gets posted to an issue — printing it, even via
# `::add-mask::`, leaks it). It is captured by command substitution and passed
# straight to `aws ssm put-parameter`. The secret is regenerated on every run so
# any previously-exposed value is invalidated.
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
UUID=$($K get clients -r "$RL" -q clientId="$CID" --fields id --format csv --noquotes | head -1)
# Resolve the service-account USER ID (more reliable than --uusername).
SAID=$($K get "clients/$UUID/service-account-user" -r "$RL" --fields id --format csv --noquotes | head -1)
echo "client=$CID uuid=$UUID service-account=$SAID"
[ -n "$SAID" ] || { echo "NO_SERVICE_ACCOUNT"; exit 1; }
# The admin client that holds view-users/query-users etc. is realm-specific:
#   - non-master realm  -> "realm-management"
#   - the master realm  -> "master-realm"  (realm-management does NOT exist here)
if [ "$RL" = "master" ]; then MGMT="master-realm"; else MGMT="realm-management"; fi
echo "management client: $MGMT"
# Grant each read role individually; show the error if a grant fails.
for role in view-users query-users query-groups view-groups; do
  err=$($K add-roles -r "$RL" --uid "$SAID" --cclientid "$MGMT" --rolename "$role" 2>&1) \
    && echo "  + $role" || echo "  ! $role: $(echo "$err" | head -1)"
done
echo -n "effective $MGMT roles: "
$K get-roles -r "$RL" --uid "$SAID" --cclientid "$MGMT" --effective --fields name --format csv --noquotes 2>/dev/null | tr '\n' ' '
echo
EOS

echo "== 2) (re)generate client secret + capture silently =="
# Regenerate so any previously-exposed secret is dead, then read the new value.
# Only the secret value reaches stdout of this exec; it is captured, never echoed.
SECRET=$(kubectl -n "$NS" exec -i "$POD" -- env RL="$RL" CID="$CID" bash -s <<'EOS'
K=/opt/keycloak/bin/kcadm.sh
AU="${KEYCLOAK_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}}"
AP="${KEYCLOAK_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:-}}"
$K config credentials --server http://localhost:8080 --realm master --user "$AU" --password "$AP" >/dev/null 2>&1
UUID=$($K get clients -r "$RL" -q clientId="$CID" --fields id --format csv --noquotes | head -1)
$K create "clients/$UUID/client-secret" -r "$RL" >/dev/null 2>&1
$K get "clients/$UUID/client-secret" -r "$RL" | grep -o '"value"[^,}]*' | head -1 | cut -d'"' -f4
EOS
)
if [ -z "$SECRET" ]; then echo "RESULT=FAIL (no client secret)"; exit 1; fi
echo "secret regenerated + captured (length ${#SECRET}); not printed"

echo "== 3) write SSM (id + secret) =="
aws ssm put-parameter --name "$SSM_PREFIX/KEYCLOAK_ADMIN_CLIENT_ID" --value "$CID" --type String --overwrite >/dev/null 2>&1 \
  && echo "  $SSM_PREFIX/KEYCLOAK_ADMIN_CLIENT_ID = $CID" || { echo "PUT id FAILED"; exit 1; }
aws ssm put-parameter --name "$SSM_PREFIX/KEYCLOAK_ADMIN_CLIENT_SECRET" --value "$SECRET" --type SecureString --overwrite >/dev/null 2>&1 \
  && echo "  $SSM_PREFIX/KEYCLOAK_ADMIN_CLIENT_SECRET = (SecureString, rotated + set)" || { echo "PUT secret FAILED"; exit 1; }

# Note: the keycloak image has no curl, so the client_credentials grant is
# verified live via /api/admin/users after the app picks up the SSM values.
echo "RESULT=PASS (cloudless-admin-api ready + SSM written; secret never logged)"
