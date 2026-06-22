#!/usr/bin/env bash
set -uo pipefail
cd /home/tbaltzakis/code/cloudless.gr

echo "############# HEALTHCHECKS — log via --log-failed ##########"
gh run view 27900853524 --log-failed 2>&1 | head -80

echo
echo "############# SES SYNC — log via --log-failed ##########"
gh run view 27903248382 --log-failed 2>&1 | head -50

echo
echo "############# ETL SELFHOSTED — log via --log-failed ##########"
gh run view 27900242378 --log-failed 2>&1 | head -50
