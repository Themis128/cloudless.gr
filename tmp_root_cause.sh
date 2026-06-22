#!/usr/bin/env bash
set -uo pipefail
cd /home/tbaltzakis/code/cloudless.gr

echo "=== 1. Healthchecks: when did the 'skip when empty' gate land? ==="
git log --oneline -- .github/workflows/selfhosted-healthchecks.yml | head -5
echo
echo "=== 2. The healthchecks workflow at the moment of the failing run (sha eccd918c, 9h ago) ==="
git show eccd918c:.github/workflows/selfhosted-healthchecks.yml 2>&1 | grep -B 2 -A 8 "HC_URL" | head -30 || echo "file did not exist at that sha"
echo
echo "=== 3. ETL self-hosted: full setup block (looking for pnpm/npm mix) ==="
sed -n '30,80p' .github/workflows/etl-selfhosted-to-lake.yml
echo
echo "=== 4. Pi runner status check ==="
gh api /repos/Themis128/cloudless.gr/actions/runners --jq '.runners[] | "\(.name)\t\(.status)\t\(.busy)\t\(.labels | map(.name) | join(\",\"))"' 2>&1 | head -10
