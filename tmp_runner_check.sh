#!/usr/bin/env bash
set -uo pipefail
cd /home/tbaltzakis/code/cloudless.gr
echo "=== Self-hosted runners status ==="
gh api /repos/Themis128/cloudless.gr/actions/runners 2>&1 | jq -r '.runners[] | "\(.name): status=\(.status) busy=\(.busy) labels=" + ([.labels[].name] | join(","))' 2>&1 | head -10
