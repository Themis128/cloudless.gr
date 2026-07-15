#!/usr/bin/env bash
# keycloak.sh — small CLI wrapper around the Keycloak admin REST API for cloudless.gr.
#
# Usage:
#   ./keycloak.sh token
#   ./keycloak.sh whoami
#   ./keycloak.sh users
#   ./keycloak.sh clients
#   ./keycloak.sh groups
#   ./keycloak.sh user-add-to-group <user-id> <group-name>
#   ./keycloak.sh client-update-redirect <client-id> <new-redirect-uri>
#   ./keycloak.sh smtp-test
#
# Credentials resolution order:
#   1. $KC_USER / $KC_PASS in the environment.
#   2. AWS SSM parameters /cloudless/production/KEYCLOAK_ADMIN_{USER,PASSWORD}.

set -euo pipefail

KC_URL="${KC_URL:-https://auth.cloudless.gr}"
KC_REALM="${KC_REALM:-master}"
TOKEN_CACHE="/tmp/.kc-token"
TOKEN_TTL_SECS=60

die() {
  echo "error: $*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "missing required tool: $1"
}

need curl

# Pick a JSON formatter. Prefer jq; fall back to python3; else passthrough.
fmt_json() {
  if command -v jq >/dev/null 2>&1; then
    jq "${1:-.}"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin), indent=2))'
  else
    cat
  fi
}

# jq with a fallback that still works when only python3 is around.
# Args: <jq-expr> [<python-expr>]   (python-expr operates on `data`)
filter_json() {
  local jq_expr="$1"
  local py_expr="${2:-}"
  if command -v jq >/dev/null 2>&1; then
    jq "$jq_expr"
  elif command -v python3 >/dev/null 2>&1 && [[ -n "$py_expr" ]]; then
    python3 -c "import json,sys; data=json.load(sys.stdin); print($py_expr)"
  else
    cat
  fi
}

load_credentials() {
  if [[ -n "${KC_USER:-}" && -n "${KC_PASS:-}" ]]; then
    return
  fi
  need aws
  KC_USER="$(aws ssm get-parameter \
    --name /cloudless/production/KEYCLOAK_ADMIN_USER \
    --query 'Parameter.Value' --output text 2>/dev/null)" \
    || die "could not read /cloudless/production/KEYCLOAK_ADMIN_USER from SSM"
  KC_PASS="$(aws ssm get-parameter \
    --name /cloudless/production/KEYCLOAK_ADMIN_PASSWORD \
    --with-decryption --query 'Parameter.Value' --output text 2>/dev/null)" \
    || die "could not read /cloudless/production/KEYCLOAK_ADMIN_PASSWORD from SSM"
  export KC_USER KC_PASS
}

get_token() {
  if [[ -f "$TOKEN_CACHE" ]]; then
    local age now mtime
    now=$(date +%s)
    mtime=$(stat -c %Y "$TOKEN_CACHE" 2>/dev/null || stat -f %m "$TOKEN_CACHE" 2>/dev/null || echo 0)
    age=$(( now - mtime ))
    if (( age < TOKEN_TTL_SECS )); then
      cat "$TOKEN_CACHE"
      return
    fi
  fi
  load_credentials
  local resp token
  resp=$(curl -fsS -X POST \
    "$KC_URL/realms/$KC_REALM/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "grant_type=password" \
    --data-urlencode "client_id=admin-cli" \
    --data-urlencode "username=$KC_USER" \
    --data-urlencode "password=$KC_PASS") \
    || die "token request failed (check credentials / network)"
  token=$(printf '%s' "$resp" | filter_json '.access_token // empty' \
    'data.get("access_token","")')
  [[ -n "$token" && "$token" != "null" ]] || die "no access_token in response: $resp"
  printf '%s' "$token" > "$TOKEN_CACHE"
  chmod 600 "$TOKEN_CACHE"
  printf '%s' "$token"
}

api() {
  local method="$1"; shift
  local path="$1"; shift
  local token; token=$(get_token)
  curl -fsS -X "$method" \
    "$KC_URL/admin/realms/$KC_REALM$path" \
    -H "Authorization: Bearer $token" \
    -H "Accept: application/json" \
    "$@"
}

cmd_token() {
  get_token
  echo
}

cmd_whoami() {
  load_credentials
  echo "url:    $KC_URL"
  echo "realm:  $KC_REALM"
  echo "user:   $KC_USER"
  echo "cache:  $TOKEN_CACHE (ttl ${TOKEN_TTL_SECS}s)"
  get_token >/dev/null && echo "token:  OK"
}

cmd_users() {
  api GET "/users?max=${1:-100}" | fmt_json
}

cmd_clients() {
  api GET "/clients" | fmt_json
}

cmd_groups() {
  api GET "/groups" | fmt_json
}

resolve_group_id() {
  local name="$1"
  api GET "/groups" | filter_json \
    ".[] | select(.name == \"$name\") | .id" \
    "next((g['id'] for g in data if g.get('name')=='$name'), '')"
}

cmd_user_add_to_group() {
  local user_id="${1:-}"
  local group_name="${2:-}"
  [[ -n "$user_id" && -n "$group_name" ]] \
    || die "usage: $0 user-add-to-group <user-id> <group-name>"
  local group_id
  group_id=$(resolve_group_id "$group_name" | tr -d '"' | tr -d '\n')
  [[ -n "$group_id" ]] || die "group not found: $group_name"
  local token; token=$(get_token)
  local status
  status=$(curl -sS -o /dev/null -w '%{http_code}' \
    -X PUT \
    "$KC_URL/admin/realms/$KC_REALM/users/$user_id/groups/$group_id" \
    -H "Authorization: Bearer $token")
  if [[ "$status" == "204" ]]; then
    echo "ok: added $user_id to $group_name ($group_id)"
  else
    die "failed: HTTP $status"
  fi
}

resolve_client_uuid() {
  local client_id="$1"
  api GET "/clients?clientId=$client_id" | filter_json \
    '.[0].id // empty' \
    "(data[0]['id'] if data else '')"
}

cmd_client_update_redirect() {
  local client_id="${1:-}"
  local new_uri="${2:-}"
  [[ -n "$client_id" && -n "$new_uri" ]] \
    || die "usage: $0 client-update-redirect <client-id> <new-redirect-uri>"
  local uuid
  uuid=$(resolve_client_uuid "$client_id" | tr -d '"' | tr -d '\n')
  [[ -n "$uuid" ]] || die "client not found: $client_id"

  local tmp; tmp=$(mktemp)
  trap 'rm -f "$tmp"' RETURN

  if command -v jq >/dev/null 2>&1; then
    api GET "/clients/$uuid" \
      | jq --arg uri "$new_uri" '.redirectUris = ((.redirectUris // []) + [$uri] | unique)' \
      > "$tmp"
  elif command -v python3 >/dev/null 2>&1; then
    api GET "/clients/$uuid" | python3 -c "
import json, sys
d = json.load(sys.stdin)
uris = sorted(set((d.get('redirectUris') or []) + ['$new_uri']))
d['redirectUris'] = uris
json.dump(d, sys.stdout)
" > "$tmp"
  else
    die "need jq or python3 to edit JSON"
  fi

  local token status
  token=$(get_token)
  status=$(curl -sS -o /dev/null -w '%{http_code}' \
    -X PUT \
    "$KC_URL/admin/realms/$KC_REALM/clients/$uuid" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    --data-binary "@$tmp")
  if [[ "$status" == "204" ]]; then
    echo "ok: $client_id ($uuid) now includes redirect_uri $new_uri"
  else
    die "failed: HTTP $status"
  fi
}

cmd_smtp_test() {
  local realm_cfg token status
  token=$(get_token)
  realm_cfg=$(api GET "" | filter_json '.smtpServer' "json.dumps(data.get('smtpServer', {}))")
  [[ -n "$realm_cfg" && "$realm_cfg" != "null" && "$realm_cfg" != "{}" ]] \
    || die "no smtpServer block on realm — configure SMTP in Keycloak first"
  status=$(curl -sS -o /dev/null -w '%{http_code}' \
    -X POST \
    "$KC_URL/admin/realms/$KC_REALM/testSMTPConnection" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    --data-binary "$realm_cfg")
  if [[ "$status" == "204" ]]; then
    echo "ok: SMTP test message sent"
  else
    die "SMTP test failed: HTTP $status — check SES creds and realm SMTP block"
  fi
}

usage() {
  sed -n '2,18p' "$0"
  exit "${1:-1}"
}

main() {
  local cmd="${1:-}"
  [[ -n "$cmd" ]] || usage 1
  shift || true
  case "$cmd" in
    token)                       cmd_token "$@" ;;
    whoami)                      cmd_whoami "$@" ;;
    users)                       cmd_users "$@" ;;
    clients)                     cmd_clients "$@" ;;
    groups)                      cmd_groups "$@" ;;
    user-add-to-group)           cmd_user_add_to_group "$@" ;;
    client-update-redirect)      cmd_client_update_redirect "$@" ;;
    smtp-test)                   cmd_smtp_test "$@" ;;
    -h|--help|help)              usage 0 ;;
    *)                           die "unknown command: $cmd (try --help)" ;;
  esac
}

main "$@"
