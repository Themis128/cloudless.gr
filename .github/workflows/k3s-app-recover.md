---
description: "Recovery for k3s: clear stuck pods (CrashLoopBackOff, ContainerCreating) and ecr-heal thrashing."
on:
  push:
    branches: [main]
    paths:
      - ".github/workflows/k3s-app-recover.yml"
  workflow_dispatch:
permissions:
  contents: read
  issues: read
strict: false
engine: claude
safe-outputs:
  report-failure-as-issue: false
---

# k3s App Recovery

Clear stuck pods and thrashing CronJobs when k3s has recovery issues.

## Mission

- Connect to Tailscale tailnet
- Configure kubectl via KUBECONFIG_B64 secret
- Wait for k3s API to become accessible
- Delete stuck ecr-heal pods (CrashLoopBackOff thrashing)
- Delete stuck cloudless pods (ContainerCreating >30min)
- Post results to tracking issue

## Inputs

- KUBECONFIG_B64 secret
- TS_AUTHKEY secret

## Workflow

1. Checkout repository
2. Connect to Tailscale using `tailscale/github-action@v4.1.2`
3. Decode and configure kubectl
4. Poll k3s API at 100.113.41.119:6443 until accessible (up to 10 min)
5. Find and delete ecr-heal pods in CrashLoopBackOff state
6. Find and force-delete cloudless pods stuck in ContainerCreating >30min
7. Post action summary

## Guardrails

- Runs on ubuntu-latest (works when Pi runners are offline)
- Only acts on pods that are genuinely stuck, not just slow to start
- Safe to re-run multiple times
