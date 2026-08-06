---
description: "Restart k3s cluster on Pi when API server is unresponsive (port 6443 down). Posts results to tracking issue #382."
on:
  push:
    branches: [main]
    paths:
      - ".github/workflows/k3s-restart.yml"
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

# k3s Restart

Restart the k3s cluster on the Pi node when the API server is unresponsive.

## Mission

- Connect to Pi via Tailscale + SSH
- Check current k3s status and crash logs
- Check data disk mount status
- Restart k3s service
- Wait for API server (port 6443) to become healthy
- Perform stability check (30s post-restart)
- Post results to tracking issue #382

## Inputs

- SSH key from `OMV_SSH_KEY` secret
- Tailscale auth key from `TS_AUTHKEY` secret
- PI_HOST: 100.74.191.58
- PI_USER: tbaltzakis

## Workflow

1. Connect to Tailscale tailnet using `tailscale/github-action@0263d9e6d793eaefcf1de98ff7fde47abe6664d3` # v3.2.4
2. Install SSH key for Pi access
3. Check k3s status BEFORE restart (systemctl status, port 6443 check)
4. Capture k3s journal (last 80 lines) for crash analysis
5. Check data disk (/srv mount) status
6. Restart k3s: `sudo systemctl restart k3s`
   - Only evict stale port holder (fuser -k 6443/tcp) when port is actually down
   - Reset failed state first
7. Wait up to 60s for port 6443 to respond
8. Check k3s status AFTER restart
9. Sleep 30s and verify stability
10. Post timestamped log to issue #382

## Runtime notes (gh-aw + Gemini)

- GitHub **reads**: use the `github` CLI on PATH (MCP bridge). Start with `github --help`. Do **not** invent names like `github_mcp_server` or bare `create_issue`.
- GitHub **writes / completion**: use only the `safeoutputs` CLI (e.g. `safeoutputs create_issue --help`, `safeoutputs noop --message "..."`).
- Prefer one successful `safeoutputs` call at the end. If nothing to do, call `noop` once — do not open tracker issues for no-ops.

## Guardrails

- Safe to re-run: systemctl restart k3s is idempotent
- Only use when k3s API server is unresponsive (connection refused on port 6443)
- If port is already up at start, skip fuser step and do clean restart
