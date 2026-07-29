---
description: "Deploy Fly.io HA failover proxy that sits in front of Cloudflare + Pi k3s. Handles automatic failover when health checks fail."
on:
  workflow_dispatch:
    inputs:
      apply:
        description: "Actually deploy (true) or dry-run (false)"
        type: boolean
        default: true
permissions:
  contents: read
strict: false
engine: claude
safe-outputs:
  report-failure-as-issue: false
---

# Deploy Fly.io Proxy

Deploy the Fly.io high-availability failover proxy.

## Mission

- Set up flyctl CLI
- Create Fly.io app if not exists (cloudless-proxy)
- Deploy the proxy application
- Show deployment status and IPs

## Inputs

- `apply` input (true = deploy, false = dry-run)
- FLY_API_TOKEN secret

## Workflow

1. Checkout repository
2. Set up flyctl using `superfly/flyctl-actions/setup-flyctl@master`
3. Create Fly.io app `cloudless-proxy` (skip if exists)
4. Deploy the proxy from `fly-proxy-app/` directory
5. Show deployment status and list IPs

## Guardrails

- Only runs when `apply` input is true
- Safe to re-run - Fly.io handles idempotent deployments
