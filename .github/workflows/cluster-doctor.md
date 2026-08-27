---
description: "Read-only diagnostics for omv k3s cluster. Posts snapshot to tracking issue #382."
on:
  workflow_dispatch:
    inputs:
      issue:
        description: "Issue number to post the snapshot to"
        required: false
        default: "382"
  push:
    branches: [main]
    paths:
      - ".github/workflows/cluster-doctor.yml"
      - "scripts/cluster-doctor.sh"
permissions:
  contents: read
  issues: read
  pull-requests: read
strict: false
engine: gemini
# flash-lite = separate free-tier quota from gemini-2.5-flash (avoids #1485 parse_error).
model: gemini-2.5-flash-lite
models:
  default-ai-credits-pricing:
    input: 0.10
    output: 0.40
tools:
  github:
    toolsets: [default]
  bash: true
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'
# Do not fail the workflow when Gemini quota is exhausted mid-run.
# jobs.agent.continue-on-error is also pinned in the compiled lock.yml
# (gh-aw currently omits it from built-in agent emission).
jobs:
  agent:
    continue-on-error: true
safe-outputs:
  report-failure-as-issue: false
  noop:
    report-as-issue: false
  add-comment:
    max: 1
  threat-detection:
    continue-on-error: true
---

# Cluster Doctor

Read-only visibility into the omv k3s cluster from CI.

## Mission

- Connect to Tailscale tailnet
- Configure kubectl via KUBECONFIG_B64 secret
- Run diagnostics script (pod health, OOM kills, events, logs)
- Post snapshot to tracking issue (default #382)

## Inputs

- KUBECONFIG_B64 secret
- TS_AUTHKEY secret
- `issue` input (optional, defaults to 382)

## Workflow

1. Checkout repository
2. Connect to Tailscale using `tailscale/github-action@v3.2.4`
3. Decode and configure kubectl
4. Run `scripts/cluster-doctor.sh` and capture output
5. Post output as comment to the specified issue
6. If no output, post a message indicating kubectl could not reach the cluster

## Runtime notes (gh-aw + Gemini)

- GitHub **reads**: use the `github` CLI on PATH (MCP bridge). Start with `github --help`. Do **not** invent names like `github_mcp_server` or bare `create_issue`.
- GitHub **writes / completion**: use only the `safeoutputs` CLI (e.g. `safeoutputs create_issue --help`, `safeoutputs noop --message "..."`).
- Prefer one successful `safeoutputs` call at the end. If nothing to do, call `noop` once — do not open tracker issues for no-ops.

## Guardrails

- Read-only: Does NOT mutate the cluster
- Safe to run anytime for diagnostics
- Works via Tailscale when direct access unavailable
