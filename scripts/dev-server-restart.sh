#!/usr/bin/env bash
# Back-compat wrapper. `pnpm dev` now auto-heals; this just forwards.
exec bash "$(cd "$(dirname "$0")" && pwd)/dev-server.sh" --restart "$@"
