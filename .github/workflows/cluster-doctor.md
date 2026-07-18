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
strict: false
engine: copilot
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

## Guardrails

- Read-only: Does NOT mutate the cluster
- Safe to run anytime for diagnostics
- Works via Tailscale when direct access unavailable