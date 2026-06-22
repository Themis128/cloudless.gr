#!/usr/bin/env bash
set -uo pipefail
cd /home/tbaltzakis/code/cloudless.gr

echo "############# HEALTHCHECKS appflowy leg — actual log ##########"
hc_job=$(gh run view 27900853524 --json jobs -q '.jobs[] | select(.name | contains("appflowy")) | .databaseId')
echo "job id: $hc_job"
gh run view --job=$hc_job --log 2>&1 | grep -vE "Pre Run|Post Run|Set up job|Complete job|Run actions/" | tail -25

echo
echo "############# SES SYNC — actual log ##########"
ses_job=$(gh run view 27903248382 --json jobs -q '.jobs[0].databaseId')
echo "job id: $ses_job"
gh run view --job=$ses_job --log 2>&1 | grep -vE "Pre Run|Post Run|Set up job|Complete job" | grep -E "(Error|error|fail|denied|Unable|not found|kubectl|Sync)" | head -30

echo
echo "############# ETL SELFHOSTED — actual log ##########"
etl_job=$(gh run view 27900242378 --json jobs -q '.jobs[0].databaseId')
echo "job id: $etl_job"
gh run view --job=$etl_job --log 2>&1 | grep -vE "Pre Run|Post Run|Complete job|safe.directory|git config|git submodule|Removing" | grep -E "(Run pnpm|pnpm|Error|error|fail|Cannot find|node_modules|version)" | head -30
