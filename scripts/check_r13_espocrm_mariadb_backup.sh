#!/usr/bin/env bash
set -euo pipefail
MANIFEST="${1:-k8s/espocrm/backup/mariadb-xbstream-backup.yaml}"
ok=0; fail=0; warn=0
pass() { printf '✅ %s\n' "$*"; ok=$((ok + 1)); }
missing() { printf '❌ %s\n' "$*"; fail=$((fail + 1)); }
warning() { printf '⚠️  %s\n' "$*"; warn=$((warn + 1)); }
contains() { local text="$1"; [[ -f "$MANIFEST" ]] && grep -qF "$text" "$MANIFEST"; }
contains_re() { local pattern="$1"; [[ -f "$MANIFEST" ]] && grep -qE "$pattern" "$MANIFEST"; }
echo "== R13 EspoCRM MariaDB hourly xbstream backup check =="
echo "Manifest: $MANIFEST"; echo
[[ -f "$MANIFEST" ]] && pass "manifest exists" || missing "manifest missing: $MANIFEST"
contains 'kind: CronJob' && pass "is a Kubernetes CronJob" || missing "missing kind: CronJob"
contains 'namespace: espocrm' && pass "targets espocrm namespace" || missing "missing namespace: espocrm"
contains 'name: mariadb-xbstream-backup' && pass "uses canonical CronJob name" || warning "CronJob name differs from mariadb-xbstream-backup"
contains 'schedule: "0 * * * *"' && pass "uses hourly schedule" || missing "schedule is not hourly: expected schedule: \"0 * * * *\""
contains 'concurrencyPolicy: Forbid' && pass "prevents overlapping backups" || warning "missing concurrencyPolicy: Forbid"
contains 'failedJobsHistoryLimit: 7' && pass "keeps failed job history" || warning "failedJobsHistoryLimit not set to 7"
contains 'successfulJobsHistoryLimit: 3' && pass "keeps successful job history" || warning "successfulJobsHistoryLimit not set to 3"
contains_re 'backoffLimit: [01]' && pass "has low retry/backoff behavior" || warning "backoffLimit should preferably be 0 or 1"
contains_re 'restartPolicy: Never|restartPolicy: OnFailure' && pass "has explicit restart policy" || warning "missing restartPolicy"
contains_re 'mariadb-backup|mariabackup' && pass "uses MariaDB physical backup tooling" || missing "missing mariadb-backup/mariabackup"
contains 'xbstream' && pass "uses xbstream streaming format" || missing "missing xbstream"
contains 'aws s3 cp' && pass "uploads stream to S3" || missing "missing aws s3 cp upload"
contains 'aws s3api head-object' && pass "verifies uploaded S3 object" || warning "missing S3 head-object verification"
contains 'cloudless-analytics-data' && pass "uses cloudless analytics S3 bucket" || missing "missing cloudless-analytics-data bucket"
contains 'pvc-backups/espocrm/xbstream/hourly/' && pass "uses hourly EspoCRM xbstream S3 prefix" || missing "missing hourly S3 prefix"
contains 'espocrm-secrets' && pass "uses espocrm-secrets" || missing "missing espocrm-secrets reference"
contains 'mariadb-root-password' && pass "uses root DB password secret key" || missing "missing mariadb-root-password secret key"
contains 'pvc-backup-aws' && pass "uses existing pvc-backup-aws credentials secret" || missing "missing pvc-backup-aws secret reference"
contains 'backup too small' && pass "fails on suspiciously small backup" || warning "missing small-backup failure guard"
echo
printf 'Summary: %s passed, %s warnings, %s failures\n' "$ok" "$warn" "$fail"
[[ "$fail" -eq 0 ]]
