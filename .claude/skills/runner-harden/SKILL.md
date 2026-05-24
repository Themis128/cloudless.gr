---
name: runner-harden
description: Harden Pi self-hosted runner systemd units to decouple them from k3s.service, so runners survive k3s crashes and can pick up recovery jobs. Use when runners go offline after a k3s crash, when "Waiting for a runner" is stuck after k3s failure, after registering new Pi runners, or any time runners show After=k3s.service in their unit. Triggers on "runners offline after k3s crash", "decouple runner from k3s", "harden runner", "runner won't pick up jobs", "apply systemd fix", "runner drops when k3s fails".
allowed-tools: mcp__cloudless-infra__cluster_run_command, mcp__cloudless-infra__gh_runner_health, mcp__cloudless-infra__gh_runner_fix_service, mcp__cloudless-infra__gh_runner_restart
---

# Runner Systemd Hardening — Decouple from k3s

## Problem

When `k3s.service` crashes, it can drag the GitHub Actions runner services down with it
if their systemd units have `After=k3s.service` or `Requires=k3s.service`. This creates
a chicken-and-egg problem: the runner is needed to restart k3s, but k3s must be up for
the runner to start.

## Goal

Make each runner service depend only on `network-online.target`, not on k3s. A k3s crash
then leaves all three runners alive so they can pick up the "k3s restart (manual)" workflow.

---

## Step 1 — Check current unit dependencies

```
cluster_run_command(node: "omv-main",
  command: "for r in omv omv-2 omv-3; do echo \"=== $r ===\"; systemctl show actions.runner.Themis128-cloudless.gr.$r.service --property=After --property=Requires 2>/dev/null || echo 'not found'; done")
```

Look for `k3s` in the `After=` or `Requires=` output. If present → proceed to Step 2.

---

## Step 2 — Apply hardening via MCP tool (preferred)

Run for each runner. The tool writes the override.conf, configures fallback DNS,
daemon-reloads, and restarts the service. **Idempotent — safe to re-run.**

```
gh_runner_fix_service(repo: "cloudless.gr", runner: "omv")
gh_runner_fix_service(repo: "cloudless.gr", runner: "omv-2")
gh_runner_fix_service(repo: "cloudless.gr", runner: "omv-3")
```

What `gh_runner_fix_service` writes to
`/etc/systemd/system/actions.runner.Themis128-cloudless.gr.<runner>.service.d/override.conf`:

```ini
[Unit]
After=network-online.target
Wants=network-online.target

[Service]
Restart=on-failure
RestartSec=10s
StartLimitIntervalSec=0
Environment="RUNNER_RETRY_RENEW_SECONDS=300"
Environment="DOTNET_SYSTEM_NET_HTTP_USESOCKETSHTTPHANDLER=1"
```

And to `/etc/systemd/resolved.conf.d/retry.conf`:
```ini
[Resolve]
DNS=8.8.8.8 8.8.4.4 1.1.1.1
FallbackDNS=9.9.9.9
```

---

## Step 2 (fallback) — Apply via GitHub Actions workflow

If MCP tools are unavailable but at least one runner is online:

Trigger **"harden runner systemd units (manual)"** from GitHub Actions → workflow_dispatch.

It runs on all three runners in parallel via matrix strategy. Each runner:
1. Writes its own override.conf
2. Configures fallback DNS
3. Runs `daemon-reload` + restarts its own service

---

## Step 2 (manual) — Apply via SSH when all runners are offline

If k3s crashed and all runners are also down (no jobs can be picked up), SSH in directly:

```bash
# Run on omv-main (192.168.1.128) for each runner name:
bash /home/user/cloudless.gr/.github/scripts/harden-runner-systemd.sh omv
bash /home/user/cloudless.gr/.github/scripts/harden-runner-systemd.sh omv-2
bash /home/user/cloudless.gr/.github/scripts/harden-runner-systemd.sh omv-3
```

Or fetch and run from the repo directly:
```bash
curl -fsSL https://raw.githubusercontent.com/Themis128/cloudless.gr/main/.github/scripts/harden-runner-systemd.sh | sudo bash -s omv
```

---

## Step 3 — Verify

```
cluster_run_command(node: "omv-main",
  command: "for r in omv omv-2 omv-3; do echo \"=== $r ===\"; systemctl show actions.runner.Themis128-cloudless.gr.$r.service --property=After | grep -i k3s && echo 'STILL HAS k3s dep!' || echo 'OK - no k3s dep'; systemctl is-active actions.runner.Themis128-cloudless.gr.$r.service; done")
```

All three should show `active` and no k3s reference in `After=`.

---

## Step 4 — Check runner fleet health

```
gh_runner_health(repo: "cloudless.gr")
```

All three runners should be online. If any are offline, restart:

```
gh_runner_restart(repo: "cloudless.gr", runner: "omv")
```

---

## Bootstrap Problem

If k3s crashes AND runners are all offline (both at the same time):

1. SSH to omv-main: `ssh omv-main` (192.168.1.128)
2. Run harden script for each runner: `sudo bash .github/scripts/harden-runner-systemd.sh omv`
3. Once at least one runner is online, trigger "k3s restart (manual)" from GitHub Actions
4. After k3s is up, trigger "build pi image" or "Deploy to Pi" to restore the app

## Notes

- The `gh_runner_fix_service` MCP tool is the canonical implementation — the script and
  workflow are fallbacks for when MCP tools are unavailable.
- After hardening, a k3s crash will no longer take runners offline.
- The `StartLimitIntervalSec=0` setting means systemd will never stop trying to restart
  the runner service after repeated failures — important for DNS-flap scenarios.
