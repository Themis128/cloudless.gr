---
description: "Patch Prometheus/Alertmanager StatefulSets to add nodeSelector for omv hostname. Fixes pods stuck in Pending due to NoSchedule taint on omv-ha node."
on:
  workflow_dispatch:
  push:
    branches: [main]
    paths:
      - ".github/workflows/monitoring-node-selector-fix.yml"
      - "infrastructure/monitoring/kube-prom-stack-values.yaml"
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
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'
  github:
    toolsets: [default]
  bash: true
safe-outputs:
  report-failure-as-issue: false
  noop:
    report-as-issue: false
  add-comment:
    max: 1
---

# Monitoring Node Selector Fix

Patch monitoring pods (Prometheus, Alertmanager, kube-state-metrics, cloudwatch-exporter) to add nodeSelector targeting the `omv` hostname.

## Mission

- Connect to Tailscale tailnet
- Configure kubectl via KUBECONFIG_B64 secret
- Show pending pods in monitoring namespace before patching
- Patch Prometheus StatefulSet with nodeSelector for omv hostname
- Patch Alertmanager StatefulSet with nodeSelector for omv hostname
- Patch kube-state-metrics and cloudwatch-exporter deployments if pending
- Wait for rollouts to complete

## Inputs

- KUBECONFIG_B64 secret
- TS_AUTHKEY secret

## Workflow

1. Connect to Tailscale using `tailscale/github-action@0263d9e6d793eaefcf1de98ff7fde47abe6664d3` # v3.2.4
2. Decode and configure kubectl from secret
3. List all non-Running pods in monitoring namespace
4. For each monitoring component found pending:
   - Get the StatefulSet/deployment name
   - Patch with: `{"spec":{"template":{"spec":{"nodeSelector":{"kubernetes.io/hostname":"omv"}}}}}`
   - Wait for rollout completion
5. If component not found, log that it may already be running

## Runtime notes (gh-aw + Gemini)

- GitHub **reads**: use the `github` CLI on PATH (MCP bridge). Start with `github --help`. Do **not** invent names like `github_mcp_server` or bare `create_issue`.
- GitHub **writes / completion**: use only the `safeoutputs` CLI (e.g. `safeoutputs create_issue --help`, `safeoutputs noop --message "..."`).
- Prefer one successful `safeoutputs` call at the end. If nothing to do, call `noop` once — do not open tracker issues for no-ops.
