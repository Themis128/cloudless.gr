#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://cloudless-gr.baltzakis-themis.workers.dev}"

export REVIEW_MODE="patch"
export MAX_FILE_CHARS="${MAX_FILE_CHARS:-12000}"

exec /home/tbaltzakis/cloudless.gr/scripts/coding-agent-review-repo.sh "$BASE_URL"
