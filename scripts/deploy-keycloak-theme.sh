#!/usr/bin/env bash
# Deploy the Cloudless Keycloak login theme to the running k3s cluster.
#
# Strategy: ConfigMap (3 files) + volumeMounts with subPath → survives pod
# restarts without rebuilding the Keycloak image.
#
# Steps:
#   1. Create/update ConfigMap keycloak-theme-cloudless in ns keycloak
#   2. Patch the Keycloak deployment to mount the 3 theme files via subPath
#   3. Rollout restart + wait
#   4. Activate theme on master realm via Admin REST API
#   5. Smoke-check: verify loginTheme=cloudless in realm settings
set -euo pipefail

NAMESPACE=keycloak
DEPLOY=keycloak
KC_URL="${KC_URL:-https://auth.cloudless.gr}"
THEME_DIR="${THEME_DIR:-keycloak-theme/cloudless}"
LOG_PREFIX="[keycloak-theme]"

echo "$LOG_PREFIX Starting theme deployment"

# ── 1. ConfigMap ──────────────────────────────────────────────────────────────
echo "$LOG_PREFIX Creating ConfigMap keycloak-theme-cloudless …"
kubectl create configmap keycloak-theme-cloudless \
  -n "$NAMESPACE" \
  --from-file=theme.properties="${THEME_DIR}/login/theme.properties" \
  --from-file=messages_en.properties="${THEME_DIR}/login/messages/messages_en.properties" \
  --from-file=cloudless.css="${THEME_DIR}/login/resources/css/cloudless.css" \
  --dry-run=client -o yaml | kubectl apply -f -
echo "$LOG_PREFIX ConfigMap applied"

# ── 2. Patch deployment volumes + volumeMounts ────────────────────────────────
echo "$LOG_PREFIX Patching Keycloak deployment to mount theme files …"
kubectl patch deployment "$DEPLOY" -n "$NAMESPACE" --type=strategic --patch '{
  "spec": {
    "template": {
      "spec": {
        "volumes": [
          {
            "name": "kc-theme-cloudless",
            "configMap": { "name": "keycloak-theme-cloudless" }
          }
        ],
        "containers": [
          {
            "name": "keycloak",
            "volumeMounts": [
              {
                "name": "kc-theme-cloudless",
                "mountPath": "/opt/keycloak/themes/cloudless/login/theme.properties",
                "subPath": "theme.properties"
              },
              {
                "name": "kc-theme-cloudless",
                "mountPath": "/opt/keycloak/themes/cloudless/login/messages/messages_en.properties",
                "subPath": "messages_en.properties"
              },
              {
                "name": "kc-theme-cloudless",
                "mountPath": "/opt/keycloak/themes/cloudless/login/resources/css/cloudless.css",
                "subPath": "cloudless.css"
              }
            ]
          }
        ]
      }
    }
  }
}'
echo "$LOG_PREFIX Deployment patched"

# ── 3. Rollout restart ────────────────────────────────────────────────────────
echo "$LOG_PREFIX Restarting Keycloak …"
kubectl rollout restart deployment/"$DEPLOY" -n "$NAMESPACE"
kubectl rollout status deployment/"$DEPLOY" -n "$NAMESPACE" --timeout=180s
echo "$LOG_PREFIX Keycloak is running"

# ── 4. Activate theme via Admin REST API ──────────────────────────────────────
if [ -z "${KEYCLOAK_ADMIN_PASSWORD:-}" ]; then
  echo "$LOG_PREFIX WARN: KEYCLOAK_ADMIN_PASSWORD not set — skipping theme activation"
  echo "THEME_ACTIVATED=skipped"
  exit 0
fi

KC_ADMIN="${KEYCLOAK_ADMIN:-admin}"

echo "$LOG_PREFIX Authenticating with Keycloak Admin API …"
TOKEN=$(curl -sS --fail-with-body \
  -X POST "${KC_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "client_id=admin-cli" \
  --data-urlencode "grant_type=password" \
  --data-urlencode "username=${KC_ADMIN}" \
  --data-urlencode "password=${KEYCLOAK_ADMIN_PASSWORD}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "$LOG_PREFIX Activating cloudless login theme on master realm …"
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X PUT "${KC_URL}/admin/realms/master" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"loginTheme": "cloudless"}')

if [ "$HTTP" = "204" ]; then
  echo "$LOG_PREFIX Theme activated (HTTP 204)"
else
  echo "$LOG_PREFIX WARN: PUT /admin/realms/master returned HTTP $HTTP"
fi

# ── 5. Verify ─────────────────────────────────────────────────────────────────
echo "$LOG_PREFIX Verifying realm loginTheme …"
CURRENT_THEME=$(curl -sS --fail-with-body \
  -H "Authorization: Bearer ${TOKEN}" \
  "${KC_URL}/admin/realms/master" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('loginTheme','(not set)'))") || CURRENT_THEME="(read failed)"

if [ "$CURRENT_THEME" = "cloudless" ]; then
  echo "THEME_ACTIVATED=ok THEME=${CURRENT_THEME}"
else
  echo "THEME_ACTIVATED=fail CURRENT=${CURRENT_THEME}"
  exit 1
fi
