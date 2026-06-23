#!/usr/bin/env bash
set -euo pipefail

cd ~/code/cloudless.gr

echo "=== cloudless.gr roadmap status ==="
echo
echo "Completed from canonical TODO:"
echo "- R10 PVC daily backup CronJobs to S3"
echo "- R11 TLS cert parity probe"
echo "- R12 /admin/cost Athena panel"
echo "- R14 Sentry environment tagging: prod on AWS Lambda, pi-standby on Pi build"
echo
echo "Next app task:"
echo "- R13 EspoCRM MariaDB hourly backup to S3"
echo
echo "Next roadmap rows:"
echo "- R18 Pi-side SSM scope assertion"
echo "- R22 Stripe webhook idempotency audit + DynamoDB dedup"
echo "- R21 AI baseline: Meilisearch, semantic search, recommendations, GenAI copy"
echo
echo "Useful local checks:"
echo "- bash scripts/audit_langchain_v1_imports.sh"
echo "- bash scripts/run_langchain_v1_suite.sh"
echo "- git status --short"
