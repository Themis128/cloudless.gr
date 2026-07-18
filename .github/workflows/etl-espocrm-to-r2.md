---
description: "Hourly ETL sync from EspoCRM to R2 data lake. Uses Wrangler secrets, no AWS dependency."
on:
  schedule:
    - cron: "20 * * * *" # hourly at :20 (offset from EspoCRM 03:15 + Stripe 03:30)
  workflow_dispatch:
  push:
    paths:
      - ".github/workflows/etl-espocrm-to-r2.yml"
      - "scripts/etl/espocrm-to-r2.mjs"
permissions:
  contents: read
strict: false
engine: copilot
---

# ETL: EspoCRM to R2

Hourly sync from EspoCRM to Cloudflare R2 data lake.

## Mission

- Checkout repository
- Set up Node.js 22
- Install ETL dependencies
- Run EspoCRM-to-R2 sync script
- Notify on success/failure via Kuma or Slack

## Inputs

- ESPOCRM_BASE_URL, ESPOCRM_API_KEY, ESPOCRM_API_PASSWORD secrets
- CLOUDFLARE_ACCOUNT_ID, CF_R2_ACCESS_KEY_ID, CF_R2_SECRET_ACCESS_KEY secrets
- KUMA_PUSH_ETL_ESPOCRM, SLACK_WEBHOOK_URL secrets

## Workflow

1. Checkout repository
2. Set up Node.js 22
3. Install dependencies in `scripts/etl/` directory
4. Run `node scripts/etl/espocrm-to-r2.mjs` with R2 credentials
5. Ping Kuma on success (if token configured)
6. Notify Slack on failure (if webhook configured)

## Guardrails

- Must run on self-hosted Pi runners (omv/omv-2/omv-3)
- Cloudflare blocks data-center IPs for EspoCRM API
- Pi residential IPs are trusted by Cloudflare bot detection