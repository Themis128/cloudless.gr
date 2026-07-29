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
  add-comment:
    max: 1
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

## Runtime notes (gh-aw + Gemini)

- GitHub **reads**: use the `github` CLI on PATH (MCP bridge). Start with `github --help`. Do **not** invent names like `github_mcp_server` or bare `create_issue`.
- GitHub **writes / completion**: use only the `safeoutputs` CLI (e.g. `safeoutputs create_issue --help`, `safeoutputs noop --message "..."`).
- Prefer one successful `safeoutputs` call at the end. If nothing to do, call `noop` once — do not open tracker issues for no-ops.

## Guardrails

- Runs on ubuntu-latest (works when Pi runners are offline)
- Only acts on pods that are genuinely stuck, not just slow to start
- Safe to re-run multiple times
