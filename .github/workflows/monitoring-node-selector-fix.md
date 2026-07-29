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
  copilot-requests: write
strict: false
engine: copilot
safe-outputs:
  report-failure-as-issue: false
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

1. Connect to Tailscale using `tailscale/github-action@v4.1.2`
2. Decode and configure kubectl from secret
3. List all non-Running pods in monitoring namespace
4. For each monitoring component found pending:
   - Get the StatefulSet/deployment name
   - Patch with: `{"spec":{"template":{"spec":{"nodeSelector":{"kubernetes.io/hostname":"omv"}}}}}`
   - Wait for rollout completion
5. If component not found, log that it may already be running
