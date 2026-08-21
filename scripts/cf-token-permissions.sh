#!/usr/bin/env bash
# Manage Cloudflare API token permissions without the dashboard.
#
# Bootstrap: uses Global API Key (email + key) to edit any user token.
# Once the target token has "API Tokens Write", it can self-manage.
#
# Usage:
#   # List all tokens and their permissions
#   bash scripts/cf-token-permissions.sh list
#
#   # Show permissions for a specific token by name
#   bash scripts/cf-token-permissions.sh show "Cloudflare Agent Token - 2026-08-08"
#
#   # Add permissions (account-level)
#   bash scripts/cf-token-permissions.sh add "Cloudflare Agent Token - 2026-08-08" \
#     "R2 Write" "D1 Write" "Workers Scripts Write" "API Tokens Write" "Cloudflare Tunnel Write"
#
#   # Remove permissions
#   bash scripts/cf-token-permissions.sh remove "Cloudflare Agent Token - 2026-08-08" "R2 Write"
#
#   # Ensure CI token has all required permissions for deploy workflows
#   bash scripts/cf-token-permissions.sh ensure-ci "Cloudflare Agent Token - 2026-08-08"
#
# Auth (in order of precedence):
#   1. CF_GLOBAL_API_KEY + CF_EMAIL  — Global API Key (full access, bootstrap)
#   2. CLOUDFLARE_API_TOKEN          — Bearer token (needs "API Tokens Write")
#
# The Global API Key is at: dash.cloudflare.com → My Profile → API Tokens → Global API Key → View
# Never store it in a file or secret — use it interactively for bootstrap only.
set -euo pipefail

ACCOUNT_ID="${CF_ACCOUNT_ID:-${CLOUDFLARE_ACCOUNT_ID:-fb7dc7b69b662480cd5961a4d1913c78}}"

# ── Known permission group IDs (from GET /user/tokens/permission_groups) ──────
# Cloudflare uses "Read"/"Write" (not "Edit"). Scope determines where the
# permission attaches: account, zone, or user.
declare -A PERM_IDS=(
  # User-scoped
  ["API Tokens Read"]="0cc3a61731504c89b99ec1be78b77aa0"
  ["API Tokens Write"]="686d18d5ac6c441c867cbf6771e58a0a"

  # Account-scoped
  ["Account API Tokens Read"]="eb56a6953c034b9d97dd838155666f06"
  ["Account API Tokens Write"]="5bc3f8b21c554832afc660159ab75fa4"
  ["Account Analytics Read"]="b89a480218d04ceb98b4fe57ca29dc1f"
  ["Cloudflare Tunnel Read"]="efea2ab8357b47888938f101ae5e053f"
  ["Cloudflare Tunnel Write"]="c07321b023e944ff818fec44d8203567"
  ["D1 Read"]="192192df92ee43ac90f2aeeffce67e35"
  ["D1 Write"]="09b2857d1c31407795e75e3fed8617a1"
  ["D1 Metadata Read"]="5b4da8a35efa4fe8be684070183cdb32"
  ["Workers Scripts Read"]="1a71c399035b4950a1bd1466bbe4f420"
  ["Workers Scripts Write"]="e086da7e2179491d91ee5f35b3ca210a"
  ["Workers R2 Storage Read"]="b4992e1108244f5d8bfbd5744320c2e1"
  ["Workers R2 Storage Write"]="bf7481a1826f439697cb59a20b22293e"
  ["Workers R2 Storage Bucket Item Read"]="6a018a9f2fc74eb6b293b0c548f38b39"
  ["Workers R2 Storage Bucket Item Write"]="2efd5506f9c8494dacb1fa10a3e7d5b6"
  ["Workers R2 Storage Metadata Read"]="dc1beb502339482da2515d6e146ca1ac"
  ["Workers AI Read"]="a92d2450e05d4e7bb7d0a64968f83d11"
  ["Workers AI Write"]="bacc64e0f6c34fc0883a1223f938a104"

  # Zone-scoped
  ["Analytics Read"]="9c88f9c5bce24ce7af9a958ba9c504db"
  ["DNS Read"]="82e64a83756745bbbb1c9c2701bf816b"
  ["DNS Write"]="4755a26eedb94da69e1066d98aa820be"
  ["Zone Read"]="c8fed203ed3043cba015a93ad1616f1f"
  ["Zone Settings Read"]="517b21aee92c4d89936c976ba6e4be55"
  ["Zone Settings Write"]="3030687196b94b638145a3953da2b699"
  ["Zone Write"]="e6d2666161e84845a636613608cee8d5"
)

# Scope of each permission (account, zone, or user)
declare -A PERM_SCOPES=(
  ["API Tokens Read"]="user"
  ["API Tokens Write"]="user"
  ["Account API Tokens Read"]="account"
  ["Account API Tokens Write"]="account"
  ["Account Analytics Read"]="account"
  ["Cloudflare Tunnel Read"]="account"
  ["Cloudflare Tunnel Write"]="account"
  ["D1 Read"]="account"
  ["D1 Write"]="account"
  ["D1 Metadata Read"]="account"
  ["Workers Scripts Read"]="account"
  ["Workers Scripts Write"]="account"
  ["Workers R2 Storage Read"]="account"
  ["Workers R2 Storage Write"]="account"
  ["Workers R2 Storage Bucket Item Read"]="account"
  ["Workers R2 Storage Bucket Item Write"]="account"
  ["Workers R2 Storage Metadata Read"]="account"
  ["Workers AI Read"]="account"
  ["Workers AI Write"]="account"
  ["Analytics Read"]="zone"
  ["DNS Read"]="zone"
  ["DNS Write"]="zone"
  ["Zone Read"]="zone"
  ["Zone Settings Read"]="zone"
  ["Zone Settings Write"]="zone"
  ["Zone Write"]="zone"
)

# ── CI required permissions ───────────────────────────────────────────────────
CI_REQUIRED=(
  "API Tokens Write"            # cf-tunnel-set-pi-origin.py mints temp tokens
  "Workers R2 Storage Write"    # deploy-pi.yml uploads build artifacts to R2
  "Workers R2 Storage Bucket Item Write"  # wrangler r2 object put
  "D1 Write"                    # cloudflare-deploy.yml runs D1 migrations
  "Workers Scripts Write"       # deploys cloudless2 + postiz-ai-proxy Workers
  "Cloudflare Tunnel Write"     # tunnel config updates
  "Account Analytics Read"      # Analytics Engine SQL queries
  "Zone Settings Read"          # verification workflows
  "DNS Read"                    # DNS verification
  "Zone Read"                   # zone lookups
  "Workers AI Read"             # workers-ai-verify.yml
  "Analytics Read"              # zone analytics
)

# ── Auth ──────────────────────────────────────────────────────────────────────
cf_api() {
  local method="$1" url="$2"
  shift 2
  local data_args=()
  if [[ $# -gt 0 ]]; then
    data_args=(-d "$1")
  fi

  local auth_args=()
  if [[ -n "${CF_GLOBAL_API_KEY:-}" && -n "${CF_EMAIL:-}" ]]; then
    auth_args=(-H "X-Auth-Email: ${CF_EMAIL}" -H "X-Auth-Key: ${CF_GLOBAL_API_KEY}")
  elif [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    auth_args=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")
  else
    echo "ERROR: Set CF_GLOBAL_API_KEY+CF_EMAIL or CLOUDFLARE_API_TOKEN" >&2
    exit 1
  fi

  local tmpfile
  tmpfile=$(mktemp)
  local http_code
  http_code=$(curl -s -o "$tmpfile" -w "%{http_code}" -X "$method" \
    "https://api.cloudflare.com/client/v4${url}" \
    "${auth_args[@]}" \
    -H "Content-Type: application/json" \
    "${data_args[@]}" 2>/dev/null)

  local body
  body=$(cat "$tmpfile")
  rm -f "$tmpfile"

  if [[ "$http_code" -ge 400 ]]; then
    echo "ERROR: API returned HTTP ${http_code}:" >&2
    echo "$body" | jq . 2>&1 || echo "$body" >&2
    exit 1
  fi
  echo "$body"
}

# ── Commands ──────────────────────────────────────────────────────────────────

cmd_list() {
  local tokens
  tokens=$(cf_api GET "/user/tokens?per_page=50")

  echo "$tokens" | jq -r '
    .result[] |
    "\(.status | ascii_upcase)  \(.name)  (id: \(.id))" +
    (
      .policies // [] | map(
        "\n  " + ([.permission_groups[]? | .name] | join(", ")) +
        " → " + (.resources | keys | map(split(".") | last) | join(", "))
      ) | join("")
    ) + "\n"
  '
}

cmd_show() {
  local name="$1"
  local tokens
  tokens=$(cf_api GET "/user/tokens?per_page=50")
  local token_id
  token_id=$(echo "$tokens" | jq -r --arg n "$name" '.result[] | select(.name == $n) | .id')

  if [[ -z "$token_id" ]]; then
    echo "ERROR: Token '$name' not found. Available:" >&2
    echo "$tokens" | jq -r '.result[].name' >&2
    exit 1
  fi

  local token_detail
  token_detail=$(cf_api GET "/user/tokens/${token_id}")
  echo "$token_detail" | jq '{
    name: .result.name,
    id: .result.id,
    status: .result.status,
    policies: [.result.policies[] | {
      effect: .effect,
      resources: .resources,
      permissions: [.permission_groups[] | .name // .id]
    }]
  }'
}

cmd_add() {
  local name="$1"
  shift
  local perms=("$@")

  local tokens
  tokens=$(cf_api GET "/user/tokens?per_page=50")
  local token_id
  token_id=$(echo "$tokens" | jq -r --arg n "$name" '.result[] | select(.name == $n) | .id')

  if [[ -z "$token_id" ]]; then
    echo "ERROR: Token '$name' not found." >&2
    exit 1
  fi

  local token_detail
  token_detail=$(cf_api GET "/user/tokens/${token_id}")
  local current_body
  current_body=$(echo "$token_detail" | jq '.result')

  # Extract existing user ID from user policy (if any)
  local user_id
  user_id=$(echo "$current_body" | jq -r '
    [.policies[].resources | keys[] | select(startswith("com.cloudflare.api.user."))] |
    first // empty | ltrimstr("com.cloudflare.api.user.")
  ')

  local acct_res="com.cloudflare.api.account.${ACCOUNT_ID}"

  local added=0
  for perm in "${perms[@]}"; do
    local perm_id="${PERM_IDS[$perm]:-}"
    if [[ -z "$perm_id" ]]; then
      echo "ERROR: Unknown permission '$perm'. Known:" >&2
      printf '  %s\n' "${!PERM_IDS[@]}" | sort >&2
      exit 1
    fi

    local already
    already=$(echo "$current_body" | jq -r --arg pid "$perm_id" '
      [.policies[]?.permission_groups[]? | .id] | index($pid) // empty
    ')
    if [[ -n "$already" ]]; then
      echo "SKIP  $perm (already present)"
      continue
    fi

    local scope="${PERM_SCOPES[$perm]:-account}"

    # Add permission to the correct existing policy based on scope.
    # Cloudflare policies have 3 resource formats:
    #   account: {"com.cloudflare.api.account.{ID}": "*"}
    #   zone:    {"com.cloudflare.api.account.{ID}": {"com.cloudflare.api.account.zone.*": "*"}}
    #   user:    {"com.cloudflare.api.user.{UID}": "*"}
    case "$scope" in
      account)
        current_body=$(echo "$current_body" | jq \
          --arg pid "$perm_id" --arg pname "$perm" --arg ar "$acct_res" '
          # Find the account policy where resource value is "*" (not a nested zone object)
          if (.policies | map(select(.resources[$ar] == "*")) | length > 0) then
            .policies = [.policies[] |
              if .resources[$ar] == "*" then
                .permission_groups += [{"id": $pid, "name": $pname}]
                | .permission_groups |= unique_by(.id)
              else . end
            ]
          else
            .policies += [{"effect":"allow","resources":{($ar):"*"},"permission_groups":[{"id":$pid,"name":$pname}]}]
          end
        ')
        ;;
      zone)
        current_body=$(echo "$current_body" | jq \
          --arg pid "$perm_id" --arg pname "$perm" --arg ar "$acct_res" '
          # Find the zone policy where resource value is an object (nested zone wildcard)
          if (.policies | map(select(.resources[$ar] | type == "object")) | length > 0) then
            .policies = [.policies[] |
              if (.resources[$ar] | type == "object") then
                .permission_groups += [{"id": $pid, "name": $pname}]
                | .permission_groups |= unique_by(.id)
              else . end
            ]
          else
            .policies += [{"effect":"allow","resources":{($ar):{"com.cloudflare.api.account.zone.*":"*"}},"permission_groups":[{"id":$pid,"name":$pname}]}]
          end
        ')
        ;;
      user)
        if [[ -z "$user_id" ]]; then
          echo "WARN  No user policy found — fetching user ID..."
          local user_info
          user_info=$(cf_api GET "/user")
          user_id=$(echo "$user_info" | jq -r '.result.id')
        fi
        local user_res="com.cloudflare.api.user.${user_id}"
        current_body=$(echo "$current_body" | jq \
          --arg pid "$perm_id" --arg pname "$perm" --arg ur "$user_res" '
          if (.policies | map(select(.resources[$ur] != null)) | length > 0) then
            .policies = [.policies[] |
              if .resources[$ur] != null then
                .permission_groups += [{"id": $pid, "name": $pname}]
                | .permission_groups |= unique_by(.id)
              else . end
            ]
          else
            .policies += [{"effect":"allow","resources":{($ur):"*"},"permission_groups":[{"id":$pid,"name":$pname}]}]
          end
        ')
        ;;
    esac

    echo "ADD   $perm ($perm_id) [${scope}]"
    added=$((added + 1))
  done

  if [[ "$added" -eq 0 ]]; then
    echo "Nothing to add — all permissions already present."
    return 0
  fi

  local result
  result=$(cf_api PUT "/user/tokens/${token_id}" "$(echo "$current_body" | jq -c '.')")
  if echo "$result" | jq -e '.success' > /dev/null 2>&1; then
    echo "OK    Token '$name' updated with ${added} new permission(s)."
  else
    echo "ERROR: Update failed:" >&2
    echo "$result" | jq . >&2
    exit 1
  fi
}

cmd_remove() {
  local name="$1"
  shift
  local perms=("$@")

  local tokens
  tokens=$(cf_api GET "/user/tokens?per_page=50")
  local token_id
  token_id=$(echo "$tokens" | jq -r --arg n "$name" '.result[] | select(.name == $n) | .id')

  if [[ -z "$token_id" ]]; then
    echo "ERROR: Token '$name' not found." >&2
    exit 1
  fi

  local token_detail
  token_detail=$(cf_api GET "/user/tokens/${token_id}")
  local current_body
  current_body=$(echo "$token_detail" | jq '.result')

  local remove_ids='[]'
  for perm in "${perms[@]}"; do
    local perm_id="${PERM_IDS[$perm]:-}"
    if [[ -z "$perm_id" ]]; then
      echo "ERROR: Unknown permission '$perm'." >&2
      exit 1
    fi
    remove_ids=$(echo "$remove_ids" | jq --arg id "$perm_id" '. + [$id]')
    echo "REMOVE  $perm ($perm_id)"
  done

  local updated_body
  updated_body=$(echo "$current_body" | jq --argjson rids "$remove_ids" '
    .policies = [.policies[] |
      .permission_groups = [.permission_groups[] | select(.id as $id | $rids | index($id) | not)]
    | select(.permission_groups | length > 0)]
  ')

  local result
  result=$(cf_api PUT "/user/tokens/${token_id}" "$(echo "$updated_body" | jq -c '.')")
  if echo "$result" | jq -e '.success' > /dev/null 2>&1; then
    echo "OK    Permissions removed from '$name'."
  else
    echo "ERROR: Update failed:" >&2
    echo "$result" | jq . >&2
    exit 1
  fi
}

cmd_ensure_ci() {
  local name="$1"
  echo "Ensuring CI-required permissions on '$name'..."
  cmd_add "$name" "${CI_REQUIRED[@]}"
}

cmd_fetch_ids() {
  echo "Fetching all permission group IDs from Cloudflare API..."
  cf_api GET "/user/tokens/permission_groups" | jq -r '
    .result | sort_by(.name)[] |
    "  [\"\(.name)\"]=\"\(.id)\"  # \(.scopes | join(", "))"
  '
}

# ── Main ──────────────────────────────────────────────────────────────────────
usage() {
  cat <<'USAGE'
Usage: cf-token-permissions.sh <command> [args]

Commands:
  list                              List all tokens with permissions
  show  <token-name>                Show token details
  add   <token-name> <perm> [...]   Add permissions to a token
  remove <token-name> <perm> [...]  Remove permissions from a token
  ensure-ci <token-name>            Add all CI-required permissions
  fetch-ids                         Fetch all known permission group IDs

Auth (set before running):
  CF_GLOBAL_API_KEY + CF_EMAIL      Global API Key (bootstrap, full access)
  CLOUDFLARE_API_TOKEN              Bearer token (needs "API Tokens Write")

Examples:
  # One-time bootstrap: add all CI permissions using Global API Key
  CF_EMAIL=baltzakis.themis@gmail.com CF_GLOBAL_API_KEY=<key> \
    bash scripts/cf-token-permissions.sh ensure-ci "Cloudflare Agent Token - 2026-08-08"

  # After that, the token can manage itself:
  CLOUDFLARE_API_TOKEN=cfut_... \
    bash scripts/cf-token-permissions.sh add "Cloudflare Agent Token - 2026-08-08" "R2 Write"
USAGE
}

cmd="${1:-}"
shift || true

case "$cmd" in
  list)       cmd_list ;;
  show)       cmd_show "$1" ;;
  add)        name="$1"; shift; cmd_add "$name" "$@" ;;
  remove)     name="$1"; shift; cmd_remove "$name" "$@" ;;
  ensure-ci)  cmd_ensure_ci "$1" ;;
  fetch-ids)  cmd_fetch_ids ;;
  *)          usage; exit 1 ;;
esac
