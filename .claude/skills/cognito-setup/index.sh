#!/bin/bash
# Claude Code skill wrapper for cognito-setup

# This skill provides automatic Cognito authentication setup
# It handles: AWS auth → credential fetch → .env.local update → dev server test

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

# Source the setup script
source "$REPO_ROOT/scripts/cognito-setup.sh" "$@"
