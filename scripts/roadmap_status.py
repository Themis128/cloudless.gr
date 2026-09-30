#!/usr/bin/env python3
"""Print the cloudless.gr roadmap status summary."""

print("""=== cloudless.gr roadmap status ===

Completed from canonical TODO:
- R10 PVC daily backup CronJobs to S3
- R11 TLS cert parity probe
- R12 /admin/cost Athena panel
- R14 Sentry environment tagging: prod on AWS Lambda, pi-standby on Pi build
- R13 EspoCRM MariaDB hourly backup descoped to 24h RPO; covered by R10 daily EspoCRM backup
- R18 Pi-side SSM scope assertion

Next app task:
- R22 Stripe webhook idempotency audit + DynamoDB dedup

Next roadmap rows:
- R21 AI baseline: Meilisearch, semantic search, recommendations, GenAI copy
- R15 Cloudflare Access on admin tunnel hosts
- R17 Kuma monitors + ntfy/Slack channels
- R19 Monthly failover drill workflow

Useful local checks:
- python3 scripts/audit_langchain_v1_imports.py
- python3 scripts/run_langchain_v1_suite.py
- git status --short""")
