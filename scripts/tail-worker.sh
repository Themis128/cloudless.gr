#!/usr/bin/env bash
# Stream live logs from the cloudless2 (production) Cloudflare Worker.
#
# Usage:
#   bash scripts/tail-worker.sh                  # production, pretty format
#   ENV=staging bash scripts/tail-worker.sh      # staging worker
#   FORMAT=json bash scripts/tail-worker.sh      # JSON per line (pipe to jq)
#   FILTER="status:5xx" bash scripts/tail-worker.sh   # sampled by predicate
#
# Requires CLOUDFLARE_API_TOKEN with scopes:
#   Account → Workers Scripts:Read
#   Account → Workers Tail:Read
# The token is auto-sourced from .env.local (preferred) then .env at the repo
# root — same pattern as scripts/setup-postiz-access.sh — so `export` isn't
# strictly needed if the value lives there.

set -uo pipefail

ENV="${ENV:-production}"
FORMAT="${FORMAT:-pretty}"
FILTER="${FILTER:-}"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || dirname "$(dirname "$0")")"
  for candidate in "$REPO_ROOT/.env.local" "$REPO_ROOT/.env"; do
    [ -f "$candidate" ] || continue
    while IFS='=' read -r key value; do
      case "$key" in
        CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)
          value="${value%\"}"; value="${value#\"}"; value="${value%\'}"; value="${value#\'}"
          value="${value## }"; value="${value%% }"
          [ -z "$value" ] && continue
          case "$value" in your-*|xxx*|CHANGE*|TODO*|"<"*|"") continue ;; esac
          if [ -z "$(eval echo "\${$key:-}")" ]; then
            export "$key=$value"
            echo "  ($(basename "$candidate")) picked up $key" >&2
          fi
          ;;
      esac
    done < <(grep -E '^[A-Z_][A-Z0-9_]*=' "$candidate")
  done
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "❌ CLOUDFLARE_API_TOKEN not set." >&2
  echo "   Mint one at https://dash.cloudflare.com/profile/api-tokens with" >&2
  echo "     Account → Workers Scripts:Read" >&2
  echo "     Account → Workers Tail:Read" >&2
  echo "   Then either:  export CLOUDFLARE_API_TOKEN=…" >&2
  echo "   or add it to  .env.local  in the repo root and re-run." >&2
  exit 1
fi

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

# `wrangler tail --env <env>` targets the worker defined in wrangler.jsonc's
# env.<env> block automatically — no --name needed. `wrangler logs` is not a
# valid subcommand in wrangler 4.x; use `tail`.
args=(tail --env "$ENV" --format "$FORMAT")
[ -n "$FILTER" ] && args+=(--search "$FILTER")

echo "→ npx wrangler ${args[*]}"
exec npx --yes wrangler@latest "${args[@]}"
