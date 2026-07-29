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
  issues: read
  pull-requests: read
strict: false
engine: gemini
model: gemini-2.5-flash
models:
  default-ai-credits-pricing:
    input: 0.15
    output: 0.60
tools:
  github:
    toolsets: [default]
  bash: true
safe-outputs:
  report-failure-as-issue: false
  noop:
    report-as-issue: false
  create-issue:
    title-prefix: "[fly-proxy] "
    labels: [infrastructure, agentic-workflows]
    max: 1
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

## Runtime notes (gh-aw + Gemini)

- GitHub **reads**: use the `github` CLI on PATH (MCP bridge). Start with `github --help`. Do **not** invent names like `github_mcp_server` or bare `create_issue`.
- GitHub **writes / completion**: use only the `safeoutputs` CLI (e.g. `safeoutputs create_issue --help`, `safeoutputs noop --message "..."`).
- Prefer one successful `safeoutputs` call at the end. If nothing to do, call `noop` once — do not open tracker issues for no-ops.

## Guardrails

- Only runs when `apply` input is true
- Safe to re-run - Fly.io handles idempotent deployments
