#!/usr/bin/env bash
# Deprecated wrapper — use scripts/tailscale-retag-fleet.sh
# Kept so older docs/workflows keep working.
exec "$(cd "$(dirname "$0")" && pwd)/tailscale-retag-fleet.sh" "$@"
