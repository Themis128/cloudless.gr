#!/bin/bash
# Wrapper script for Cline to handle rate limiting

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/scripts/handle-rate-limit.sh"

# If we're being called directly with a command, execute it with rate limit handling
if [ "$1" = "execute" ]; then
    shift
    exec "$SCRIPT_DIR/scripts/handle-rate-limit.sh" execute "$@"
else
    # Otherwise, just run the command normally (for backward compatibility)
    "$@"
fi
