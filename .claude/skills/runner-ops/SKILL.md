---
name: runner-ops
description: Operate and troubleshoot the Pi GitHub Actions self-hosted runner fleet. Use when the user asks to check runner health, restart a runner, fix a stuck workflow, cancel queued jobs, fetch runner logs, or apply systemd hardening. Triggers on "runner stuck", "runner offline", "cancel workflows", "runner logs", "fix runner", "restart runner", "runner health".
allowed-tools: mcp__cloudless-infra__gh_runner_list, mcp__cloudless-infra__gh_runner_health, mcp__cloudless-infra__gh_runner_restart, mcp__cloudless-infra__gh_runner_fix_service, mcp__cloudless-infra__gh_runner_logs, mcp__cloudless-infra__gh_runner_cancel_stuck, mcp__cloudless-infra__gh_runner_set_labels, mcp__cloudless-infra__gh_workflow_list, mcp__cloudless-infra__gh_workflow_trigger, mcp__cloudless-infra__gh_workflow_watch, mcp__cloudless-infra__cluster_run_command
---

# Pi Runner Operations

## Overview

The `cloudless.gr` repo has two registered runners. As of 2026-05-29:

| Runner | Host | Labels | Status |
|---|---|---|---|
| `omv` | omv-main (192.168.1.128) | `self-hosted, Linux, ARM64, omv, pi` | disabled |
| `omv-build` | omv-main (192.168.1.128) | `self-hosted, Linux, ARM64, omv, pi, build` | **active** (workdir on USB SSD) |

`omv-2-build` was retired on 2026-05-29 — it lacked docker (Pi image
builds couldn't land there) and went offline during the omv-main
network event. Unregistered via `gh api --method DELETE
/repos/.../actions/runners/<id>`.

Active Pi-image build workflows use `runs-on: [self-hosted, omv, pi, build]`
which pins them to `omv-build` (the only runner with all three labels).

**Service pattern:** `actions.runner.Themis128-{repo}.{runner}.service`
**Example:** `actions.runner.Themis128-cloudless.gr.omv.service`

## Common Tasks

### Check runner fleet status
```
gh_runner_health(repo: "cloudless.gr")
```
Shows: online/offline state, busy flag, queue depth, and actionable issues.

### Fetch runner logs (diagnose drops or failures)
```
gh_runner_logs(repo: "cloudless.gr", runner: "omv", lines: 100)
```
For a specific time window:
```
gh_runner_logs(repo: "cloudless.gr", runner: "omv", lines: 100, since: "30 minutes ago")
```
Look for: `HostNotFound`, `DNS`, `timeout`, `lease renewal` errors.

### Restart a stuck or offline runner
```
gh_runner_restart(repo: "cloudless.gr", runner: "omv")
```

### Apply systemd hardening (after fresh registration or if runner keeps dropping)
```
gh_runner_fix_service(repo: "cloudless.gr", runner: "omv")
```
This writes:
- `/etc/systemd/system/actions.runner.Themis128-cloudless.gr.omv.service.d/override.conf`
  - `Restart=on-failure`, `RestartSec=10s`, `StartLimitIntervalSec=0`
  - `After=network-online.target`
  - `RUNNER_RETRY_RENEW_SECONDS=300`
  - `DOTNET_SYSTEM_NET_HTTP_USESOCKETSHTTPHANDLER=1`
- `/etc/systemd/resolved.conf.d/retry.conf`
  - DNS: `8.8.8.8 8.8.4.4 1.1.1.1`, FallbackDNS: `9.9.9.9`

Then runs `daemon-reload` and restarts the service. **Idempotent — safe to re-run.**

### Cancel stuck queued/in-progress runs
```
gh_runner_cancel_stuck(repo: "cloudless.gr")
```
Preview first without cancelling:
```
gh_runner_cancel_stuck(repo: "cloudless.gr", dry_run: true)
```
Filter by workflow name:
```
gh_runner_cancel_stuck(repo: "cloudless.gr", workflow: "build pi image")
```

### Add missing `pi` label to a runner
```
gh_runner_set_labels(repo: "cloudless.gr", runner: "omv", labels: ["pi"], mode: "add")
```
Required so jobs with `runs-on: [self-hosted, omv, pi]` can be picked up.

### Re-trigger a workflow after fixing a runner
```
gh_workflow_trigger(repo: "cloudless.gr", workflow: "build pi image")
```

## Diagnosis Workflow

When workflows are stuck or runners appear offline:

1. **Check fleet health** — `gh_runner_health(repo: "cloudless.gr")`
2. **Fetch recent logs** — `gh_runner_logs(lines: 100, since: "1 hour ago")`
   - DNS failures (`HostNotFound`) → apply systemd fix + restart
   - Runner not responding → restart the service
3. **Cancel stuck runs** — `gh_runner_cancel_stuck(repo: "cloudless.gr", dry_run: true)` then without dry_run
4. **Apply hardening if needed** — `gh_runner_fix_service`
5. **Restart runner** — `gh_runner_restart`
6. **Re-trigger workflows** — `gh_workflow_trigger`

## Runner Service Status (raw SSH fallback)

If the MCP tools are unavailable, use:
```
cluster_run_command(node: "omv-main",
  command: "systemctl is-active actions.runner.Themis128-cloudless.gr.omv.service")
```

```
cluster_run_command(node: "omv-main",
  command: "sudo journalctl -u actions.runner.Themis128-cloudless.gr.omv.service -n 50 --no-pager")
```

## Known Issues

**DNS intermittent failures:** The Pi periodically loses DNS resolution for `*.actions.githubusercontent.com`. Cause: network instability, not DNS server configuration. The systemd hardening (fallback DNS + `RUNNER_RETRY_RENEW_SECONDS=300`) reduces impact but does not eliminate drops entirely.

**GitHub billing lock:** If GitHub-hosted runners (`ubuntu-latest`, `ubuntu-24.04-arm`) fail with billing errors, this blocks ALL GitHub-hosted runner jobs. Self-hosted Pi runners are unaffected. Fix: resolve billing at github.com/settings/billing.

**Pi label missing:** After re-registration, the runner has only `self-hosted, Linux, ARM64, omv`. Add `pi` label with `gh_runner_set_labels` so `[self-hosted, omv, pi]` jobs are picked up.

**ECR immutable tags / race condition:** If both a push-trigger and an HA-orchestrator dispatch fire for the same SHA, one will find the image already exists and skip the build (idempotent by design). This is correct behavior — the Pi sync webhook still fires.
