#!/usr/bin/env bash
#
# keycloak-ensure.sh — reconcile auth to its KNOWN-GOOD ("last working") state.
#
# Idempotent self-healing: detects drift/outage and restores it. Safe to run on a
# schedule. Each correction is recorded; if nothing was wrong it changes nothing.
#
#   Desired state (the "last working condition"):
#     • Keycloak pod fits its heap: limit >= 768Mi, JAVA_OPTS_APPEND -Xmx512m
#       (the 2026-06-01 OOM fix) and auth.cloudless.gr discovery returns 200.
#     • realm: registrationAllowed=true, resetPasswordAllowed=true,
#       loginWithEmailAllowed=true.
#     • cloudless-app client has a `groups` membership mapper with full.path=false,
#       claim.name=groups, id+access token claims (so isAdmin() sees "admin").
#     • admin group exists and ADMIN_EMAIL is a member.
#
# Recovery phase uses kubectl (patch+rollout); reconcile phase uses kcadm INSIDE
# the keycloak pod (admin password never leaves the pod). The keycloak image has
# no awk/jq — parse kcadm CSV with grep/cut.
#
# Exit 0 if healthy at the end (with or without corrections), 1 if still broken.
# Env: ADMIN_EMAIL (default tbaltzakis@cloudless.gr), CLIENT_ID (cloudless-app),
#      MEM_LIMIT (768Mi), NAMESPACE/DEPLOYMENT/REALM, DISCOVERY.

set -uo pipefail

NAMESPACE="${NAMESPACE:-keycloak}"
DEPLOYMENT="${DEPLOYMENT:-keycloak}"
REALM="${REALM:-master}"
CLIENT_ID="${CLIENT_ID:-cloudless-app}"
ADMIN_EMAIL="${ADMIN_EMAIL:-tbaltzakis@cloudless.gr}"
MEM_LIMIT="${MEM_LIMIT:-768Mi}"
HEAP="${HEAP:--Xms128m -Xmx512m -Djdk.reflect.useDirectMethodHandle=false}"
DISCOVERY="${DISCOVERY:-https://auth.cloudless.gr/realms/master/.well-known/openid-configuration}"

command -v kubectl >/dev/null 2>&1 || { echo "error: kubectl not found / no cluster access"; exit 1; }

CHANGES=0
note() { CHANGES=$((CHANGES+1)); echo "CORRECTED: $*"; }
code() { curl -sS -m 8 -o /dev/null -w '%{http_code}' "$DISCOVERY" 2>/dev/null || echo 000; }

echo "== keycloak-ensure $(date -u '+%F %T')Z =="

# ── Phase 1: liveness / OOM recovery ────────────────────────────────────────
LIMIT=$(kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" \
  -o jsonpath='{.spec.template.spec.containers[0].resources.limits.memory}' 2>/dev/null)
DISC=$(code)
echo "discovery=$DISC deploy_limit=$LIMIT"
if [ "$DISC" != "200" ] || [ "$LIMIT" = "384Mi" ] || [ "$LIMIT" = "480Mi" ]; then
  note "Keycloak unhealthy (discovery=$DISC, limit=$LIMIT) — restoring memory + restart"
  kubectl -n "$NAMESPACE" patch limitrange default-container-limits --type=merge -p \
    '{"spec":{"limits":[{"type":"Container","max":{"memory":"1Gi","cpu":"2"},"default":{"memory":"512Mi","cpu":"1"},"defaultRequest":{"memory":"128Mi","cpu":"100m"}}]}}' >/dev/null 2>&1 || true
  PATCH=$(printf '{"spec":{"template":{"spec":{"containers":[{"name":"%s","resources":{"requests":{"memory":"384Mi","cpu":"100m"},"limits":{"memory":"%s","cpu":"1"}},"env":[{"name":"JAVA_OPTS_APPEND","value":"%s"}]}]}}}}' "$DEPLOYMENT" "$MEM_LIMIT" "$HEAP")
  kubectl -n "$NAMESPACE" patch deploy "$DEPLOYMENT" --type=strategic -p "$PATCH" >/dev/null 2>&1
  kubectl -n "$NAMESPACE" rollout restart "deploy/$DEPLOYMENT" >/dev/null 2>&1
  kubectl -n "$NAMESPACE" rollout status "deploy/$DEPLOYMENT" --timeout=210s >/dev/null 2>&1 || true
  for _ in $(seq 1 18); do DISC=$(code); [ "$DISC" = "200" ] && break; sleep 10; done
  echo "after recovery: discovery=$DISC"
fi

if [ "$DISC" != "200" ]; then
  echo "HEALTHY=no (Keycloak still not 200 after recovery)"; echo "CHANGES=$CHANGES"; exit 1
fi

# ── Phase 2: config reconcile (in-pod kcadm) ────────────────────────────────
POD=$(kubectl -n "$NAMESPACE" get pod -l app="$DEPLOYMENT" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
RECON=$(kubectl -n "$NAMESPACE" exec -i "$POD" -- env \
  RL="$REALM" CID="$CLIENT_ID" NU="$ADMIN_EMAIL" bash -s <<'EOS'
set -u
K=/opt/keycloak/bin/kcadm.sh
csv() { $K get "$@" --format csv --noquotes 2>/dev/null; }
AU="${KEYCLOAK_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}}"
AP="${KEYCLOAK_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:-}}"
$K config credentials --server http://localhost:8080 --realm master --user "$AU" --password "$AP" >/dev/null 2>&1 \
  || { echo "RECON_ADMIN_AUTH=failed"; exit 0; }

# realm flags
rf() { csv "realms/$RL" --fields "$1" | head -1; }
for kv in registrationAllowed=true resetPasswordAllowed=true loginWithEmailAllowed=true; do
  k=${kv%=*}; want=${kv#*=}
  cur=$(rf "$k")
  if [ "$cur" != "$want" ]; then
    $K update "realms/$RL" -s "$k=$want" >/dev/null 2>&1 && echo "FIX realm.$k: $cur -> $want"
  fi
done

# admin group
GID=$(csv groups -r "$RL" -q search=admin --fields id,name | grep -iE ',admin$' | head -1 | cut -d, -f1)
[ -z "$GID" ] && { $K create groups -r "$RL" -s name=admin >/dev/null 2>&1; GID=$(csv groups -r "$RL" -q search=admin --fields id,name | grep -iE ',admin$' | head -1 | cut -d, -f1); echo "FIX admin group: created"; }

# cloudless-app groups mapper (correct config)
CUUID=$(csv clients -r "$RL" -q clientId="$CID" --fields id | head -1)
MJSON='{"name":"groups","protocol":"openid-connect","protocolMapper":"oidc-group-membership-mapper","config":{"full.path":"false","id.token.claim":"true","access.token.claim":"true","userinfo.token.claim":"true","claim.name":"groups"}}'
if [ -n "$CUUID" ]; then
  MID=$(csv "clients/$CUUID/protocol-mappers/models" -r "$RL" --fields id,name | grep ',groups$' | head -1 | cut -d, -f1)
  ok=0
  if [ -n "$MID" ]; then
    CFG=$($K get "clients/$CUUID/protocol-mappers/models/$MID" -r "$RL" 2>/dev/null)
    printf '%s' "$CFG" | grep -qE '"full.path"[ ]*:[ ]*"false"' \
      && printf '%s' "$CFG" | grep -qE '"claim.name"[ ]*:[ ]*"groups"' \
      && printf '%s' "$CFG" | grep -qE '"id.token.claim"[ ]*:[ ]*"true"' \
      && printf '%s' "$CFG" | grep -qE '"access.token.claim"[ ]*:[ ]*"true"' && ok=1
  fi
  if [ "$ok" != "1" ]; then
    [ -n "$MID" ] && $K delete "clients/$CUUID/protocol-mappers/models/$MID" -r "$RL" >/dev/null 2>&1
    printf '%s' "$MJSON" > /tmp/gm.json
    $K create "clients/$CUUID/protocol-mappers/models" -r "$RL" -f /tmp/gm.json >/dev/null 2>&1 \
      && echo "FIX groups mapper on $CID: set correct config"
  fi
else
  echo "WARN client $CID not found (cannot ensure mapper)"
fi

# admin user membership
USERID=$(csv users -r "$RL" -q username="$NU" --fields id | head -1)
if [ -z "$USERID" ]; then
  USERID=$($K create users -r "$RL" -s username="$NU" -s email="$NU" -s enabled=true -s emailVerified=true -i 2>/dev/null)
  echo "FIX admin user $NU: created"
fi
if [ -n "$USERID" ] && ! csv "groups/$GID/members" -r "$RL" --fields id | grep -qx "$USERID"; then
  $K update "users/$USERID/groups/$GID" -r "$RL" -s realm="$RL" -s userId="$USERID" -s groupId="$GID" -n >/dev/null 2>&1 \
    && echo "FIX admin membership: added $NU"
fi
echo "RECON_OK"
EOS
)
echo "$RECON"
# Count in-pod corrections (lines beginning FIX).
FIXES=$(printf '%s\n' "$RECON" | grep -c '^FIX ' || true)
CHANGES=$((CHANGES + FIXES))

# ── Phase 3: Pi `cloudless` app auth wiring (HA standby) ────────────────────
# next-auth on the k3s app needs AUTH_SECRET/KEYCLOAK_*(realm master)/AUTH_TRUST_HOST
# (cloudless-app-auth secret + envFrom). If the app stops serving the keycloak
# provider (secret deleted, envFrom dropped on a manifest re-apply, etc.), restore
# it by re-running the wire tool. Cheap HTTP check when healthy; only acts on break.
PI_PROV=$(curl -sS -m 8 "https://pi-origin.cloudless.gr/api/auth/providers" 2>/dev/null || echo "")
if printf '%s' "$PI_PROV" | grep -q '"keycloak"'; then
  echo "PI_APP_AUTH=ok"
else
  note "Pi cloudless app not serving the keycloak provider — restoring auth wiring"
  AK=$(kubectl -n cloudless get secret pi-standby-aws-creds -o jsonpath='{.data.AWS_ACCESS_KEY_ID}' 2>/dev/null | base64 -d 2>/dev/null || true)
  SK=$(kubectl -n cloudless get secret pi-standby-aws-creds -o jsonpath='{.data.AWS_SECRET_ACCESS_KEY}' 2>/dev/null | base64 -d 2>/dev/null || true)
  [ -n "$AK" ] && echo "::add-mask::$AK"; [ -n "$SK" ] && echo "::add-mask::$SK"
  HERE="$(cd "$(dirname "$0")" && pwd)"
  if [ -n "$AK" ] && [ -n "$SK" ] && command -v aws >/dev/null 2>&1 && [ -f "$HERE/wire-pi-keycloak.sh" ]; then
    AWS_ACCESS_KEY_ID="$AK" AWS_SECRET_ACCESS_KEY="$SK" AWS_REGION=us-east-1 bash "$HERE/wire-pi-keycloak.sh" || echo "  (wire-pi-keycloak returned non-zero)"
  else
    echo "  (cannot auto-restore Pi app auth: need aws CLI + pi-standby-aws-creds + wire-pi-keycloak.sh)"
  fi
fi

FINAL=$(code)
echo "final discovery=$FINAL CHANGES=$CHANGES"
if [ "$FINAL" = "200" ]; then
  [ "$CHANGES" -eq 0 ] && echo "HEALTHY=yes (no drift)" || echo "HEALTHY=yes (restored; $CHANGES correction(s))"
  exit 0
fi
echo "HEALTHY=no"; exit 1
