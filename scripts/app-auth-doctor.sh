#!/usr/bin/env bash
#
# app-auth-doctor.sh — read-only: how is the Pi `cloudless` app wired for auth?
#
# Shows the deployment's env var NAMES + sources (never values), envFrom, the
# secrets/configmaps in the namespace and their KEY names, and whether the
# auth-critical vars (AUTH_SECRET, KEYCLOAK_*) are present. This tells us how to
# wire Keycloak auth onto the k3s standby without breaking it.

set -uo pipefail
NS="${NS:-cloudless}"
DEP="${DEP:-cloudless}"

command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found"; exit 1; }

echo "== app-auth-doctor $(date -u '+%F %T')Z  (ns=$NS deploy=$DEP) =="

echo
echo "## deployment env (name <- value? / secretRef / configMapRef):"
kubectl -n "$NS" get deploy "$DEP" -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}{" <- value:"}{.value}{" sec:"}{.valueFrom.secretKeyRef.name}{"/"}{.valueFrom.secretKeyRef.key}{" cm:"}{.valueFrom.configMapKeyRef.name}{"/"}{.valueFrom.configMapKeyRef.key}{"\n"}{end}' 2>&1

echo
echo "## envFrom (whole secret/configmap imports):"
kubectl -n "$NS" get deploy "$DEP" -o jsonpath='{range .spec.template.spec.containers[0].envFrom[*]}{"secretRef:"}{.secretRef.name}{" configMapRef:"}{.configMapRef.name}{"\n"}{end}' 2>&1

echo
echo "## auth-critical env present in the deployment?"
ENVNAMES=$(kubectl -n "$NS" get deploy "$DEP" -o jsonpath='{.spec.template.spec.containers[0].env[*].name}' 2>/dev/null | tr ' ' '\n')
# Cognito is the active provider (auth.ts gates next-auth on AUTH_SECRET +
# COGNITO_ISSUER/CLIENT_ID at module load). Keycloak vars kept for fallback visibility.
for v in AUTH_SECRET AUTH_TRUST_HOST AUTH_URL \
         COGNITO_ISSUER COGNITO_CLIENT_ID COGNITO_CLIENT_SECRET COGNITO_DOMAIN \
         NEXT_PUBLIC_AUTH_PROVIDER \
         KEYCLOAK_ISSUER NEXT_PUBLIC_KEYCLOAK_ISSUER; do
  printf '  %-30s %s\n' "$v" "$(printf '%s\n' "$ENVNAMES" | grep -qx "$v" && echo PRESENT || echo MISSING)"
done

echo
echo "## secrets in ns/$NS:"
kubectl -n "$NS" get secret -o name 2>&1 | sed 's/^/  /'
echo "## configmaps in ns/$NS:"
kubectl -n "$NS" get configmap -o name 2>&1 | sed 's/^/  /'

echo
echo "## key NAMES (not values) of auth-ish secrets/configmaps:"
for s in $(kubectl -n "$NS" get secret -o name 2>/dev/null | sed 's#secret/##' | grep -iE 'auth|keycloak|app|env|config|cloudless|integration|ssm'); do
  echo "  secret/$s:"; kubectl -n "$NS" get secret "$s" -o jsonpath='{.data}' 2>/dev/null | grep -oE '"[^"]+":' | tr -d '":,' | sed 's/^/      /'
done
for c in $(kubectl -n "$NS" get configmap -o name 2>/dev/null | sed 's#configmap/##' | grep -iE 'auth|keycloak|app|env|config|cloudless'); do
  echo "  configmap/$c:"; kubectl -n "$NS" get configmap "$c" -o jsonpath='{.data}' 2>/dev/null | grep -oE '"[^"]+":' | tr -d '":,' | sed 's/^/      /'
done

echo
echo "## AWS/SSM wiring (how the app reaches SSM at runtime):"
printf '%s\n' "$ENVNAMES" | grep -iE 'AWS|SSM|REGION|ROLE' | sed 's/^/  /' || echo "  (no AWS_* env names)"
echo "## pi-standby-aws-creds secret present?"
kubectl -n "$NS" get secret pi-standby-aws-creds -o jsonpath='{.metadata.name}' 2>&1 | sed 's/^/  /'
echo
echo "_End app-auth-doctor._"
